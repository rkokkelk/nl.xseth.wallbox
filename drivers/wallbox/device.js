'use strict';

const Homey = require('homey');
const moment = require('moment')
const WallboxAPI = require('/lib/wallbox_api');

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
    await this.poll().bind(this); 

    // Register capabilities
    this.registerCapabilityListener('locked', this.turnLocked.bind(this));
  }

  onDeleted() {
    console.log("deleting device...", this._name);

    clearInterval(this.polling);
    this.available = false;
  }

  async poll() {
    /**
     * Polling function for retrieving/parsing current status charger
     */
    let stats = await this._api.getChargerStatus(this._id);
    console.log(stats)
    
    // Parse locked capability
    let isLocked = Boolean(stats['config_data']['locked']);
    if (this.getCapabilityValue('locked') !== isLocked) {
      this.log(`Setting [locked]: {isLocked}`);
      this.setCapabilityValue('locked', isLocked);
    }

    // Parse current status
    let status = stats['status_id'].toString();
    if (this.getCapabilityValue('status') !== status) {

      // Ensure availability is correct
      status === '0' ? this.setUnavailable() : this.setAvailable();
        
      this.log('Setting [status]: ', status);
      this.setCapabilityValue('status', status);
    }

    // Parse power
    try{
    let power = stats['added_energy'];
    if (this.getCapabilityValue('meter_power') !== power) {
      this.log('Setting [meter_power]: ', power);
      //this.setCapabilityValue('meter_power', power);
    }
    }catch (err) {
      this.log(err);
    }

    // Parse charging time
    let time = stats['charging_time'];
    let time_human = moment.duration(time, "seconds").humanize();
    if (this.getCapabilityValue('meter_time') !== time_human) {
      this.log('Setting [meter_time]: ', time_human);
      //this.setCapabilityValue('meter_time', time_human);
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
}

module.exports = wallbox_charger;
