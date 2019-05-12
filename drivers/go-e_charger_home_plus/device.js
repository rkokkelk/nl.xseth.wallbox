'use strict';

const Homey = require('homey');
const goechargerApi = require("../../api/api.js");
const POLL_INTERVAL = 5000;

class goe_charger_home_plus_device extends Homey.Device {
	async onInit() {
			this.log('device init');
			let settings = this.getSettings();
			let name = this.getName() + '_' + this.getData().id;
			this._api = new goechargerApi(settings.ip, null);
			//this._registerCapabilities();

			setInterval(() => {
				try {
            this._pollChargerState();
				} catch (e) {
						return e;
				}}, POLL_INTERVAL)
			} // end onInit

			onAdded() {
	        let id = this.getData().id;
	        this.log('device_added: ', id);
	        this.log('name:', this.getName());
	        this.log('device_class:', this.getClass());
	        this.log('settings:', this.getSettings());
	        this.log('data:', this.getData());
	    } // end onAdded

	    onDeleted() {
	        let id = this.getData().id;
	        clearInterval(this.pollingIntervalCurrent);
	        this.log('device deleted:', id);
					this.available = false;
	    } // end onDeleted


			async _pollChargerState() {
			        try {
								 const infoJson = await this._api.getInfo();
									if(infoJson){
										this.setAvailable();
										this.setCapabilityValue('onoff', infoJson.onoff);
										this.setCapabilityValue('measure_power', infoJson.measure_power);
										this.setCapabilityValue('measure_current', infoJson.measure_current);
										this.setCapabilityValue('measure_voltage', infoJson.measure_voltage);
										this.setCapabilityValue('measure_temperature', infoJson.measure_temperature);
										this.setCapabilityValue('meter_power', infoJson.meter_power);
									}
			        } catch (e) {
			            this.setUnavailable(e);
			            //console.log(e);
			            return e;
			        }
			    }

}
module.exports = goe_charger_home_plus_device;
