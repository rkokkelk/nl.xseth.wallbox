'use strict';

const inspector = require('inspector');
const Homey = require('homey');

class wallboxapp extends Homey.App {

	onInit() {

		if (process.env.DEBUG === '1')
			inspector.open(8080, '0.0.0.0', true)

		this.log('wallboxapp is running...');

		this.log('Setting up actions')
		this.homey.flow.getActionCard('resume_charging')
			.registerRunListener(args => args.device.turnOnOff(true));
		this.homey.flow.getActionCard('pause_charging')
			.registerRunListener(args => args.device.turnOnOff(false));
		this.homey.flow.getActionCard('change_ampere')
			.registerRunListener(args => args.device.setAmpere(args.ampere));
		this.homey.flow.getActionCard('change_charge_mode')
			.registerRunListener(args => args.device.setChargeMode(args.mode));
	}
}

module.exports = wallboxapp;
