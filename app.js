'use strict';

const Homey = require('homey');

class wallboxapp extends Homey.App {

	onInit() {
		this.log('wallboxapp is running...');
	}
}

module.exports = wallboxapp;
