'use strict';

const Homey = require('homey');

class goe_charger_home_plus_device extends Homey.Device {

	onInit() {
		this.log('goe_charger_home_plus_device has been inited');
	}

	async onInit() {
			this.log('device init');
			let settings = this.getSettings();
			let name = this.getName() + '_' + this.getData().id;
			//this._api = new goechargerApi(this.getSettings().ip);
			} // end onInit

			onAdded() {
	        let id = this.getData().id;
	        this.log('device added: ', id);
	        this.log('name:', this.getName());
	        this.log('class:', this.getClass());
	        this.log('settings', this.getSettings());
	        this.log('data', this.getData());
	    } // end onAdded

	    onDeleted() {

	        let id = this.getData().id;
	        //clearInterval(this.pollingIntervalCurrent);
	        this.log('device deleted:', id);
					this.available = false;

	    } // end onDeleted

}
module.exports = goe_charger_home_plus_device;
