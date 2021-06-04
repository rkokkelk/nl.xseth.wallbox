'use strict';

const Homey = require('homey');
const WallboxAPI = require('/lib/wallbox_api');
const POLL_INTERVAL = 5000;

class goe_charger_home_plus_device extends Homey.Device {

  async onInit() {
    console.log('Device init: ', this.getName());
    let user = this.getSetting('user');
    let pass = this.getSetting('pass');

    this._name = this.getName();
    this._id = this.getData().id;
    this._api = new WallboxAPI(user, pass);
    
    // Perform initial authentication
    await this._api.authenticate();

    // Register capabilities
    this.registerCapabilityListener('locked', this.turnLocked.bind(this));
  }

  onDeleted() {
    console.log("deleting device...", this._name);
    clearInterval(this.interval);
    let id = this.getData().id;
    console.log("device deleted:'"+id+"'");
    this.available = false;
  } // end onDeleted


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

module.exports = goe_charger_home_plus_device;
