'use strict';

const Homey = require('homey');
const util = require('../../lib/util');
const status_util = require('../../lib/statuses');
const WallboxAPI = require('../../lib/wallbox_api');
const { PhaseMeter, MIN_AMP } = require('../../lib/phases');

const statuses = status_util.statuses;

const POLL_INTERVAL = 123;  // Follow API guidelines
const AUTH_INTERVAL = 300;  // Follow API guidelines
const CAR_CONNECTED = ['Paused', 'Waiting']; // Waiting includes Scheduled

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

    let user = this.getSetting('user');
    let pass = this.getSetting('pass');

    this._name = this.getName();
    this._id = this.getData().id;
    this._api = new WallboxAPI(user, pass, this.homey, AUTH_INTERVAL);
    this._phases = new PhaseMeter(this.getStoreValue('phases'));
    
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

    await this.updatePhases(status, amps, kw);
  }

  async updatePhases(status, amps, kw) {
    /**
     * Track the phases the car charges on, for target power
     *
     * @param {String} status - current status
     * @param {Number} amps - set charging current
     * @param {Number} kw - charging power in kW
     */
    const before = this.phases();
    const last = this._phases.last;
    this._phases.update(status, amps, kw);

    if (this._phases.last !== last)
      await this.setStoreValue('phases', this._phases.last).catch(this.error);

    if (this.phases() !== before) {
      this.log(`Phases in use: ${this.phases()}`);
      await this.updateOptions();
    }
  }

  phases() {
    return this._phases ? this._phases.phases : 1;
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

    // Device mode: Homey stops steering, the charger keeps its own settings
    const mode = target_power_mode !== undefined ? target_power_mode : this.getCapabilityValue('target_power_mode');
    if (target_power_mode === 'device')
      this.log('Switched to device mode, target power ignored');

    // Handle stop charging
    if (evcharger_charging === false) {
      await this.turnOnOff(evcharger_charging);
      this.log("Stopped charging/discharging");
      return;
    }

    const isCharging = this.getCapabilityValue('evcharger_charging') === true;

    // Handle start charging
    if (evcharger_charging === true) {
      // Only a real target power changes the charging current. Without one,
      // keep the current as set (e.g. by the "Set charging to current" card)
      let power = mode === 'device' ? undefined : target_power;
      if (power === undefined && mode === 'homey')
        power = this.getCapabilityValue('target_power');

      if (power > 0)
        await this.setPower(power);
      if (!isCharging)
        await this.turnOnOff(true);

      this.log('Started charging');
      return;
    }

    // Handle power adjustment
    if (target_power == null || mode === 'device')
      return;

    const minPower = util.calcAmperagetoWatts(MIN_AMP, this.phases()); // 1380 W, 3 phases 4140 W
    if (isCharging && target_power >= minPower)
      await this.setPower(target_power);
    else if (isCharging)
      await this.turnOnOff(false); // 0 W or below the 6 A minimum
    else if (target_power >= minPower && CAR_CONNECTED.includes(this.getCapabilityValue('status'))) {
      // Homey: "For EV chargers, charging is automatically started or stopped."
      await this.setPower(target_power);
      await this.turnOnOff(true);
    } else
      this.log(`Target power set to ${target_power}W, will apply when charging starts`);
  }

  async setPower(power) {
    /**
     * Set the charging current for a target power, within the charger's range
     *
     * @param {int} power - target power in watts
     */
    const phases = this.phases();
    let amps = Math.max(util.calcWattstoAmperage(power, phases), MIN_AMP);
    if (this._max_amp)
      amps = Math.min(amps, this._max_amp);

    await this.setAmpere(amps);
    this.log(`Charging current set to ${amps}A for ${power}W on ${phases} phase(s)`);
  }

  async updateOptions() {
    /**
     * Ensure that device / capabilities options reflect the device
     */
    if (this._max_amp != undefined) {
      const phases = this.phases();
      const max_watts = util.calcAmperagetoWatts(this._max_amp, phases);

      const options = {
        'min': 0,
        'max': max_watts,
        'step': 230,
        'excludeMin': 0,
        'excludeMax': util.calcAmperagetoWatts(MIN_AMP, phases)
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
