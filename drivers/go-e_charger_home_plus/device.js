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
						this.setUnavailable(e);
						console.log(e);
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
	        //clearInterval(this.pollingIntervalCurrent);
	        this.log('device deleted:', id);
					this.available = false;
	    } // end onDeleted

			/**_registerCapabilities() {
			const capabilitySetMap = new Map([
					["onoff", 0]//this._onoff],
	        ["measure_power", 0]//this._nrg[11]/100],
	        ["measure_current", 0]//(this._nrg[7]+this._nrg[8]+this._nrg[9])/10],
	        ["measure_voltage", 0]//this._nrg[0]+this._nrg[1]+this._nrg[2]],
	        ["measure_temperature", 0]//this._tmp],
	        ["meter_power", 0]//this._dws*0.00000277]
					]);
					this.getCapabilities().forEach(capability =>
					this.registerCapabilityListener(capability, (value) => {
							return capabilitySetMap.get(capability).call(this, value)
									.catch(err => {
											return Promise.reject(err);
									});
					}))
			} // end _registerCapabilities**/

			async _pollChargerState() {
			        try {
			            //this.setAvailable();
									const infoJson = await this._api.getInfo();
									this.setCapabilityValue('onoff', infoJson.onoff);
									this.setCapabilityValue('measure_power', infoJson.measure_power);
									this.setCapabilityValue('measure_current', infoJson.measure_current);
									this.setCapabilityValue('measure_voltage', infoJson.measure_voltage);
									this.setCapabilityValue('measure_temperature', infoJson.measure_temperature);
									this.setCapabilityValue('meter_power', infoJson.meter_power);
			        } catch (e) {
			            this.setUnavailable(e);
			            console.log(e);
			            return e;
			        }
			    }

}
module.exports = goe_charger_home_plus_device;
