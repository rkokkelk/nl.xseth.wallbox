'use strict';

const Homey = require('homey');
const util = require('../../lib/util');
const status_util = require('../../lib/statuses');
const energy = require('../../lib/energy');
const WallboxAPI = require('../../lib/wallbox_api');

const statuses = status_util.statuses;

const POLL_INTERVAL = 123;  // Follow API guidelines
const AUTH_INTERVAL = 300;  // Follow API guidelines

class wallbox_charger extends Homey.Device {

  async onInit() {
    this.log('Device init: ', this.getName());

    // Ensure all capabilities are added to the device
    const capabilities = [
      'evcharger_charging_state', 'evcharger_charging', 'meter_power.charged', 'status',
      'onoff', 'target_power', 'target_power_mode'
    ]

    for (let cap of capabilities) {
      if (this.hasCapability(cap) === false) {
        await this.addCapability(cap);
      }
    }

    if (this.hasCapability('meter_power.total') === false) {
      await this.addCapabilityWithOptions('meter_power.total');
      await this.setManifestOptions('meter_power.charged'); // New title on devices paired before
    }
    // Was never set, lifetime energy is in meter_power.total now
    if (this.hasCapability('meter_power') === true)
      await this.removeCapability('meter_power');

    let user = this.getSetting('user');
    let pass = this.getSetting('pass');

    this._name = this.getName();
    this._id = this.getData().id;
    this._api = new WallboxAPI(user, pass, this.homey, AUTH_INTERVAL);
    this._energy = new energy.EnergyMeter({
      fetchSessions: (start, end) => this._api.getSessionsEnergy(this._id, start, end),
      store: { get: key => this.getStoreValue(key), set: (key, value) => this.setStoreValue(key, value) },
      log: message => this.log(message),
      timers: { setTimeout: (fn, ms) => this.homey.setTimeout(fn, ms), clearTimeout: timer => this.homey.clearTimeout(timer) }
    });
    
    // Perform initial authentication, on failure the interval below retries
    try {
      await this._api.authenticate();
    } catch (error) {
      this.log(`Initial authentication failed: ${error}`);
    }

    // Verify default polling frequenty is set
    if (!this.getSetting('polling'))
      this.setSettings({ polling: POLL_INTERVAL});

    // Setup polling of device
    this.polling = this.homey.setInterval(this.poll.bind(this), 1000 * POLL_INTERVAL);
    this.authentication = this.homey.setInterval(() => this._api.authenticate().catch(error => this.log(`Authentication failed: ${error}`)), 1000 * AUTH_INTERVAL); // Validate authentication every 10m
    await this.poll();
    await this.updateOptions();

    // Register capabilities
    this.registerCapabilityListener('locked', this.turnLocked.bind(this));
    this.registerCapabilityListener('evcharger_charging', this.turnOnOff.bind(this));
    this.registerMultipleCapabilityListener(["target_power", "target_power_mode", "evcharger_charging"], this.changePower.bind(this), 500)
  }

  onDeleted() {
    this.log("deleting device...", this._name);
    this.homey.clearInterval(this.polling);
    this.homey.clearInterval(this.authentication);
  }

  async poll() {
    /**
     * Polling function for retrieving/parsing current status charger
     */
    let stats;

    // Login rejected, nothing to poll until the app restarts
    if (this._api.credentialsRejected) {
      await this.setUnavailable(this.homey.__('errors.login'));
      return
    }

    try {
      stats = await this._api.getChargerStatus(this._id);
      this._max_amp = stats['config_data']['max_available_current'];
    } catch (error) {
      await this.setUnavailable();
      this.log(`Failed to get ChargerStatus: ${error}`)
      return
    }
    // this.log(stats);

    // Parse current status
    const statusId = stats['status_id']
    const status = status_util.getStatus(statusId)
    const curStatus = this.getCapabilityValue('status')
    
    // Parse locked capability
    let isLocked = Boolean(stats['config_data']['locked']);
    if (this.getCapabilityValue('locked') !== isLocked) {
      this.log(`Setting [locked]: ${isLocked}`);
      this.setCapabilityValue('locked', isLocked);
    }

    // Parse on/off-pause/resume capability
    const charging = status == 'Charging';
    this.log(`charging: ${charging}`);
    this.log(`Status: ${status}`);    
    // if (this.getCapabilityValue('evcharger_charging') !== charging) {
      this.log(`Setting [evcharger_charging]: ${charging}`);
      this.setCapabilityValue('evcharger_charging', charging);
    // }

    // Ensure availability is correct
    if (status == 'Disconnected' || status == 'Error') {
      this.setCapabilityValue('measure_power', 0); // Don't keep last power while unavailable
      await this.setUnavailable();
      this.log(`Device ${this._name} is unavailable (disconnected/error)`)
      return
    } else 
      await this.setAvailable();

    if (curStatus !== status) {
      let homeyState = status_util.getChargingState(status);
      this.log(`Setting [status]: ${status}`);
      this.log(`Setting [evcharger_charging_state]: ${homeyState}`);
      this.setCapabilityValue('evcharger_charging_state', homeyState);
      this.setCapabilityValue('status', status);
    }
    this.triggerStatusChange(curStatus, status);

    // Set power measurements
    const amps = stats['config_data']['max_charging_current'];
    const kw = stats['charging_power'];
    // The API keeps reporting the last charging_power for several minutes
    // after charging stops, so only use it while power is actually flowing
    const flowing = status === 'Charging' || status === 'Discharging';
    const watts = flowing ? kw * 1000 : 0; // KiloWatt = Watt / 1000

    if (status === 'Charging'){
      const kwhs = stats['added_energy'];
      this.setCapabilityValue('meter_power.charged', kwhs);
    }

    this.setCapabilityValue('measure_current', amps);
    this.setCapabilityValue('measure_power', watts);

    // Meter problems must not break polling or device init
    await this.updateEnergyMeter(status, stats).catch(error => this.log(`Failed to update energy meter: ${error}`));
  }

  async updateEnergyMeter(status, stats) {
    /**
     * Update lifetime energy (meter_power.total, meter_power.green) for Homey Energy
     *
     * @param {String} status - current Status
     * @param {Object} stats - charger status from the API
     */
    const values = await this._energy.update(status, stats);
    if (!values)
      return;

    await this.setMeterValue('meter_power.total', values.total);

    // Green (solar) energy for chargers with Eco-Smart or green energy in their history
    const ecoSmart = stats.config_data && stats.config_data.ecosmart;
    if (energy.showGreen(values.green, ecoSmart) && !this.hasCapability('meter_power.green'))
      await this.addCapabilityWithOptions('meter_power.green');
    if (this.hasCapability('meter_power.green'))
      await this.setMeterValue('meter_power.green', values.green);
  }

  async setMeterValue(capabilityId, kwh) {
    /**
     * Set a lifetime meter, never lower than the value it has now
     *
     * @param {String} capabilityId - meter capability
     * @param {number} kwh - new value
     */
    const value = Math.max(Math.round(kwh * 1000) / 1000, this.getCapabilityValue(capabilityId) || 0);
    if (value !== this.getCapabilityValue(capabilityId))
      await this.setCapabilityValue(capabilityId, value);
  }

  async addCapabilityWithOptions(capabilityId) {
    /**
     * Add a capability after pairing, with its title from the driver manifest
     *
     * @param {String} capabilityId - capability to add
     */
    await this.addCapability(capabilityId);
    await this.setManifestOptions(capabilityId);
  }

  async setManifestOptions(capabilityId) {
    /**
     * Apply capability options (title) from the driver manifest
     *
     * @param {String} capabilityId - capability to update
     */
    const options = (this.driver.manifest.capabilitiesOptions || {})[capabilityId];
    if (options)
      await this.setCapabilityOptions(capabilityId, options).catch(error => this.log(`Failed to set options of ${capabilityId}: ${error}`));
  }

  async triggerStatusChange(curStatus, newStatus){
    /**
     * Fire homey triggers for status change
     * 
     * @param {String} curStatus - current Status
     * @param {String} newStatus - new Status
     */

    // Ignore Error and Update triggers for now
    if (newStatus == 'Error' || newStatus == 'Updating')
      return;

    // Triggers based on change in previous status
    if (newStatus == 'Waiting')
      this.setCapabilityValue('evcharger_charging_state', 'plugged_in');
    if (newStatus === 'Paused')
      this.setCapabilityValue('evcharger_charging_state', 'plugged_in_paused');
    // Triggers based on change in current status
    if (newStatus == 'Charging')
      this.setCapabilityValue('evcharger_charging_state', 'plugged_in_charging');
    else if (newStatus == 'Disconnected' || newStatus == 'Ready' || newStatus === 'Locked')
      this.setCapabilityValue('evcharger_charging_state', 'plugged_out');
  }

  async changePower({ target_power, target_power_mode, evcharger_charging }) {
    /**
     * Change the charging of the device
     *
     * All capability changes arrive as a single debounced batch.
     * Only the changed capabilities are present in the object.
     */

    // Handle mode switch
    if (target_power_mode === "device") {
      await this.enableBuiltInScheduling();
      this.log("Switched to device mode");
      return;
    }

    // Handle stop charging
    if (evcharger_charging === false) {
      await this.turnOnOff(evcharger_charging);
      this.log("Stopped charging/discharging");
      return;
    }

    // Handle start charging / power adjustment
    const isCharging =
      evcharger_charging === true ||
      this.getCapabilityValue("evcharger_charging");
    const power =
      target_power ?? this.getCapabilityValue("target_power") ?? 0;

    const amps = util.calcWattstoAmperage(power);
    if (evcharger_charging === true) {
      // Start charging at the current target power
      if (power >= 0) {
        await this.setAmpere(amps);
        this.log(`Started charging at ${power}W (${amps}A)`);
      }
    } else if (target_power != null && isCharging) {
      // Adjust charging rate while already charging
      if (target_power > 0) {
        await this.setAmpere(amps);
        this.log(`Charging power adjusted to ${target_power}W (${amps}A)`);
      } else {
        await this.turnOnOff(false);
        this.log("Power set to idle (0W)");
      }
    } else if (target_power !== undefined && !isCharging) {
      this.log(
        `Target power set to ${target_power}W, will apply when charging starts`,
      );
    }
  }

  async updateOptions() {
    /**
     * Ensure that device / capabilities options reflect the device
     */
    if (this._max_amp != undefined) {
      const max_watts = util.calcAmperagetoWatts(this._max_amp);

      const options = {
        'min': 0,
        'max': max_watts,
        'step': 230,
        'excludeMin': 0,
        'excludeMax': 1380
      }

      this.setCapabilityOptions('target_power', options);
    }
  }

  async turnLocked(value) {
    /**
     * Lock or unlock charger
     *
     * @param {Boolean} value - to lock or unlock
     */
    let func;
    if (value)
      func = this._api.lockCharger(this._id);
    else
      func = this._api.unlockCharger(this._id);

    await func;
  }

  async turnOnOff(value) {
    /**
     * On (resume) or off (pause) charging
     *
     * @param {Boolean} value - to pause / resume charging
     */
    let func;

    if (value)
      func = this._api.resumeCharging(this._id);
    else
      func = this._api.pauseCharging(this._id);

    try {
      await func;
    } catch (error) {
      // 403: Car is not connected
      if(error.message == '403')
        error = this.homey.__("errors.no_car");
      
      throw new Error(error);
    }
    
    // Ensure quick update of status
    await setTimeout(this.poll.bind(this), 10000)
  }

  async setAmpere(amperage) {
    /**
     * Change ampere value for charging session
     *
     * @param {int} amperage - ampere to set charging to
     */
    await this._api.setMaxChargingCurrent(this._id, amperage);

    // Ensure quick update of status
    await setTimeout(this.poll.bind(this), 10000)
  }

  async setEcoSmart(mode) {
    /**
     * Change Eco-Smart (solar charging) mode
     *
     * @param {String} mode - off, eco or full_solar
     */
    if (mode === 'off')
      await this._api.setEcoSmart(this._id, 0, 0);
    else
      await this._api.setEcoSmart(this._id, 1, mode === 'full_solar' ? 1 : 0);

    // Ensure quick update of status
    this.homey.setTimeout(this.poll.bind(this), 10000);
  }
}

module.exports = wallbox_charger;
