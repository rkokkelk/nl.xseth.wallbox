'use strict';

const Homey = require('homey');

if (process.env.DEBUG === '1') {
    require('inspector').open(9222, '0.0.0.0', true);
}

class wallboxapp extends Homey.App {

	onInit() {
		this.log('wallboxapp is running...');
	}
}

module.exports = wallboxapp;
