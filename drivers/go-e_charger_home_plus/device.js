'use strict';

const Homey = require('homey');
const goechargerApi = require("../../api/api.js");
const POLL_INTERVAL = 5000;

class goe_charger_home_plus_device extends Homey.Device {
	onInit() {
			const device = this;
			this.log('device init');
			let settings = this.getSettings();
			this._api = new goechargerApi(settings.ip, null);
			this._registerCapabilities();

			this.interval = setInterval(() => {
				try {
						this.log("=============refresh state=============");
						var status_old = "oldstatustext";
						status_old = this.getCapabilityValue('status');
						this.log("old status: '"+status_old+"'");
						this._pollChargerState(status_old);
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
					this._pollChargerState(); //first time immediately get the results
			} // end onAdded

	    onDeleted() {
					this.log("deleting device...");
					clearInterval(this.interval);
					let id = this.getData().id;
					this.log("device deleted:'"+id+"'");
					this.available = false;
	    } // end onDeleted


			async _pollChargerState(status_old) {

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

										var status_new = "newstatustext";
										status_new = infoJson.status;
										this.log("new status: '"+status_new+"'");
											if (status_old!==status_new) {
												//status has changed.
												this.log("status changed");
												//so trigger a flow
												//add  && status_old!=null to not run the trigger if the app was first installed.
												if(status_new=="Charging finished") //status is finished, car still connected
								        {
								          this.log("Status changed to finished");
								          let chargingFinishedTrigger = new Homey.FlowCardTrigger('charging_finished');
								          chargingFinishedTrigger
								            .register()
								            .trigger()
								              .catch( this.error )
								              .then( this.log )
								        }
												if(status_old=="Charging car") //was charging but no longer
												{
													this.log("Status changed from charging to no car connected");
													let chargingEndedTrigger = new Homey.FlowCardTrigger('charging_ended');
													chargingEndedTrigger
														.register()
														.trigger()
															.catch( this.error )
															.then( this.log )
												}
												if(status_new=="Charging car") //status is car charging started
								        {
								          this.log("Status changed to charging");
								          let chargingStartedTrigger = new Homey.FlowCardTrigger('charging_started');
								          chargingStartedTrigger
								            .register()
								            .trigger()
								              .catch( this.error )
								              .then( this.log )
								        }
												if(status_new=="Car connected") //status is car connected
								        {
								          this.log("Status changed to car connected");
								          let carConnectedTrigger = new Homey.FlowCardTrigger('car_connected');
								          carConnectedTrigger
								            .register()
								            .trigger()
								              .catch( this.error )
								              .then( this.log )
								        }
												if(status_new=="No car connected" && status_old!=null) //status no car is connected
								        {
								          this.log("Status changed to car unplugged");
								          let carDisconnectedTrigger = new Homey.FlowCardTrigger('car_unplugged');
								          carDisconnectedTrigger
								            .register()
								            .trigger()
								              .catch( this.error )
								              .then( this.log )
								        }
											}
											else {
												//status unchanged
												this.log("status same");
											}
									}
			        } catch (e) {
			            this.setUnavailable(e);
			            console.log(e);
			            return "not connected";
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

}
module.exports = goe_charger_home_plus_device;
