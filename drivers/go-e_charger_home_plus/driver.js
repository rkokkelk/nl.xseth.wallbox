'use strict';

const Homey = require('homey');

class goe_charger_home_plus extends Homey.Driver {

	onInit() {
		this.log('go-e_charger_home_plus has been inited');
	}

	onPair(socket) {

			let devices = [
					{
							"name": "My Device",
							"data": { "id": "abcd" },
							"settings": {
									"APIKey": 'APIKey',
									"IPaddress": '192.168.1.45'
							}
					}
			]

			// this is called when the user presses save settings button in pair.html
			socket.on('get_devices', (device_data, callback) => {
					devices = device_data;
					callback(null, devices);
			});

			// this happens when user clicks away the pairing windows
			socket.on('disconnect', () => {
					this.log("OpenWeatherMap - Pairing is finished (done or aborted) ");
			})

	} // end onPair

}
module.exports = goe_charger_home_plus;
