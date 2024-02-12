'use strict';

const Homey = require('homey');
const util = require('../../lib/util');
const status_util = require('../../lib/statuses');
const WallboxAPI = require('../../lib/wallbox_api');

const statuses = status_util.statuses;

const POLL_INTERVAL = 15;

class wallbox_charger extends Homey.Device {

  async onInit() {
    this.log('Device init: ', this.getName());
    let user = this.getSetting('user');
    let pass = this.getSetting('pass');

    this._name = this.getName();
    this._id = this.getData().id;
    this._api = new WallboxAPI(user, pass, this.homey);
    
    // Perform initial authentication
    await this._api.authenticate();

    // Verify default polling frequenty is set
    if (!this.getSetting('polling'))
      this.setSettings({ polling: POLL_INTERVAL});

    // Setup polling of device
    this.polling = this.homey.setInterval(this.poll.bind(this), 1000 * this.getSetting('polling'));
    this.authentication = this.homey.setInterval(this._api.authenticate.bind(this._api), 1000 * 60 * 60 * 24 * 2); // Reauthenticate every 2d
    await this.poll();

    // Register capabilities
    //this.addCapability('measure_power')
    this.registerCapabilityListener('locked', this.turnLocked.bind(this));
    this.registerCapabilityListener('onoff', this.turnOnOff.bind(this));
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

    try {
      stats = await this._api.getChargerStatus(this._id);
    } catch (error) {
      await this.setUnavailable();
      this.log(`Failed to get ChargerStatus: ${error}`)
      return
    }

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
    const isOnOff = status != 'Paused';
    if (this.getCapabilityValue('onoff') !== isOnOff) {
      this.log(`Setting [onoff]: ${isOnOff}`);
      this.setCapabilityValue('onoff', isOnOff);
    }

    // Ensure availability is correct
    if (status == 'Disconnected' || status == 'Error') {
      await this.setUnavailable();
      this.log(`Device ${this._name} is unavailable (disconnected/error)`)
      return
    } else 
      await this.setAvailable();

    if (curStatus !== status) {
      this.log('Setting [status]: ', status);
      this.setCapabilityValue('status', status);

      this.triggerStatusChange(curStatus, status);
    }

    // Set power measurements
    const amps = stats['config_data']['max_charging_current'];
    const kw = stats['charging_power'];
    const watts = kw * 1000; // KiloWatt = Watt / 1000

    if (status === 'Charging'){
      const kwhs = stats['added_energy'];
      this.setCapabilityValue('meter_power', kwhs);
    }

    this.setCapabilityValue('measure_current', amps);
    this.setCapabilityValue('measure_power', watts);
  }

  async triggerStatusChange(curStatus, newStatus){
    /**
     * Fire homey triggers for status change
     * 
     * @param {String} curStatus - current Status
     * @param {String} newStatus - new Status
     */
    const tokens = {
      status: newStatus
    };

    this.driver.trigger('status_changed', this, tokens);

    // Ignore Error and Update triggers for now
    if (newStatus == 'Error' || newStatus == 'Updating')
      return;

    // Triggers based on change in previous status
    if (curStatus == 'Charging')
      this.driver.trigger('charging_ended', this);
    else if (curStatus == 'Ready')
      this.driver.trigger('car_connected', this);


    // Triggers based on change in current status
    if (newStatus == 'Charging')
      this.driver.trigger('charging_started', this);
    else if (newStatus == 'Ready')
      this.driver.trigger('car_unplugged', this);

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

    await func;
  }

  async setAmpere(amperage) {
    /**
     * Change ampere value for charging session
     *
     * @param {int} amperage - ampere to set charging to
     */
    await this._api.setMaxChargingCurrent(this._id, amperage);
  }
}

module.exports = wallbox_charger;
