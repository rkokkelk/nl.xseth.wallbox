'use strict';

const Homey = require('homey');
const WallboxAPI = require('/lib/wallbox_api');

const POLL_INTERVAL = 15;

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

    // Verify default polling frequenty is set
    if (this.getSetting('polling') == null)
      this.setSettings({ polling: POLL_INTERVAL});

    // Setup polling of device
    this.polling = setInterval(this.poll.bind(this), 1000 * this.getSetting('polling'));

    // Register capabilities
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

module.exports = goe_charger_home_plus_device;
