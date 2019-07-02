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
			this._registerCapabilities();

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
										this.setCapabilityValue('status', infoJson.status);
										this.setCapabilityValue('errr', infoJson.error);
										this.setCapabilityValue('charge_amp', infoJson.charge_amp);
										this.setCapabilityValue('charge_amp_limit', infoJson.charge_amp_limit);
									}
			        } catch (e) {
			            this.setUnavailable(e);
			            //console.log(e);
			            return e;
			        }
			    }

					_registerCapabilities() {
								const capabilitySetMap = new Map([
										['onoff', this._setOnOff]//,
										//['charge_amp', this._setChargeAmp]
								]);
								this.getCapabilities().forEach(capability =>
								this.registerCapabilityListener(capability, (value) => {
										return capabilitySetMap.get(capability).call(this, value)
												.catch(err => {
														return Promise.reject(err);
												});
								}))
						}

						async _setOnOff(onoff) {
				        console.log('_setOnOff');
				        try {
				            if (onoff) {
				                if (!this.getCapabilityValue('onoff')) {
				                    return Promise.resolve(await this._api.onoff(1));
				                }
				            } else {
				                if (this.getCapabilityValue('onoff')) {
				                    return Promise.resolve(await this._api.onoff(0));
				                }
				            }
				        } catch (e) {
				            return Promise.reject(e);
				        }
				    }

						async _setChargeAmp () {
							console.log('_setChargeAmp');
						}


}
module.exports = goe_charger_home_plus_device;
