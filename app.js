'use strict';

const inspector = require('inspector');
const Homey = require('homey');

class wallboxapp extends Homey.App {

	onInit() {
		if (process.env.DEBUG === '1'){
		try{
			require('inspector').waitForDebugger();
		}
		catch(error){
			require('inspector').open(9222, '0.0.0.0', true);
		}
		}

		this.log('wallboxapp is running...');

		this.log('Setting up actions')
		this.homey.flow.getActionCard('change_ampere')
			.registerRunListener(args => args.device.setAmpere(args.ampere));
		this.homey.flow.getActionCard('set_eco_smart')
			.registerRunListener(args => args.device.setEcoSmart(args.mode));
	}
}

module.exports = wallboxapp;
