'use strict';

const Homey = require('homey');
const util = require('/lib/util');
const status_util = require('/lib/statuses');
const WallboxAPI = require('/lib/wallbox_api');

const statuses = status_util.statuses;

const POLL_INTERVAL = 15;

class wallbox_charger extends Homey.Device {

  async onInit() {
    console.log('Device init: ', this.getName());
    let user = this.getSetting('user');
    let pass = this.getSetting('pass');

    this._name = this.getName();
    this._id = this.getData().id;
    this._api = new WallboxAPI(user, pass);
    
    // Perform initial authentication
    await this._api.authenticate();

    // Verify default polling frequenty is set
    if (this.getSetting('polling') == null)
      this.setSettings({ polling: POLL_INTERVAL});

    // Setup polling of device
    this.polling = setInterval(this.poll.bind(this), 1000 * this.getSetting('polling'));

    // Register capabilities
    //this.addCapability('measure_power')
    this.registerCapabilityListener('locked', this.turnLocked.bind(this));
  }

  onDeleted() {
    console.log("deleting device...", this._name);

    clearInterval(this.polling);
    this.available = false;
  }

  async poll() {
    let stats = await this._api.getChargerStatus(this._id);
    console.log(stats)

    
    // Parse locked capability
    let isLocked = Boolean(stats['config_data']['locked']);
    if (this.getCapabilityValue('locked') !== isLocked) {
      this.log(`Setting [locked]: {isLocked}`);
      this.setCapabilityValue('locked', isLocked);
    }

    // Parse current status
    const statusId = stats['status_id']
    const status = status_util.getStatus(statusId)
    const curStatus = this.getCapabilityValue('status')

    if (curStatus !== status) {

      // Ensure availability is correct
      status == statuses.Error ? this.setUnavailable() : this.setAvailable();

      this.log('Setting [status]: ', status);
      this.setCapabilityValue('status', status);

      this.triggerStatusChange(curStatus, status)
    }

    let watss = 0
    // Set current usage
    if (status === statuses.Charging){
      const kwhs = stats['added_energy']
      const charge_time = stats['charging_time']
      const watts = util.calcWattFromkWhs(kwhs, charge_time)
    }

    this.setCapabilityValue('measure_power', Math.round(watts))

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
    }

    this.driver.trigger('status_changed', this, tokens)

    // Ignore Error and Update triggers for now
    if (newStatus == statuses.Error || newStatus == statuses.Updating)
      return

    // Triggers based on change in previous status
    if (curStatus == statuses.Charging)
      this.driver.trigger('charging_ended', this)
    else if (curStatus == statuses.Disconnected)
      this.driver.trigger('car_connected', this)


    // Triggers based on change in current status
    if (newStatus == statuses.Charging)
      this.driver.trigger('charging_started', this)
    else if (newStatus == statuses.Disconnected)
      this.driver.trigger('car_unplugged', this)

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
}

module.exports = wallbox_charger;
