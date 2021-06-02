'use strict';

const Homey = require('homey');
const WallboxAPI = require('/lib/wallbox_api');

class goe_charger_home_plus extends Homey.Driver {

	async onPair(session) {
		let user = "";
    let pass = "";
		let api = null;

    session.setHandler("login", async (data) => {
      user = data.username;
      pass = data.password;

			api = new WallboxAPI(user, pass);
			await api.authenticate();

      // return true to continue adding the device if the login succeeded
      // return false to indicate to the user the login attempt failed
      // thrown errors will also be shown to the user
      return true;
    });

    session.setHandler("list_devices", async () => {
			const chargers = await api.getChargers();
			const chargerDevices = chargers['result']['groups'].map((charger) => {
				this.log("Found charger: " + charger);

				return {
					name: charger['chargers'][0]['name'],
					data: {
						id: charger['id']
					},
					settings: {
						user: user,
						pass: pass
					},
				}
			});

			return chargerDevices
		});
	}
}

module.exports = goe_charger_home_plus;
