'use strict';

const Homey = require('homey');
const WallboxAPI = require('../../lib/wallbox_api');

class wallbox extends Homey.Driver {

  async onInit() {
    console.log("onInit WallBox driver");

    this._triggers = {}
    this.trigger_keys = [
      'charging_ended', 'charging_started', 'car_connected', 'car_unplugged', 'status_changed'
    ];
    for (const type of this.trigger_keys) {
      this._triggers[type] = this.homey.flow.getDeviceTriggerCard(type);
    }
  }

  trigger(key, device, tokens, state){
    /**
     * Trigger a triggerCard
     *
     * @param {String} key: id of triggerCard to trigger
     * @param {Device} device: device for which to trigger card
     * @param {Dictionary} tokens: list of related tokens
     * @param {Dictionary} state: current state of trigger
     */

    this._triggers[key]
      .trigger(device, tokens, state)
      .then(this.log)
      .catch(this.error);
  }

	async onPair(session) {
		let user = "";
    let pass = "";
		let api = null;

    // Pairing sequences
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
			const chargerGroups = await api.getChargers();
			const chargerDevices = chargerGroups['result']['groups'].map((chargerGroup) => {
				this.log("Found chargers group: ", chargerGroup['chargers']);

        return chargerGroup['chargers'].map((charger) => {
          this.log("Found charger: ", charger);

          return {
            name: charger['name'],
            data: {
              id: charger['id']
            },
            settings: {
              user: user,
              pass: pass
            },
          };
        });
			});

			return chargerDevices
		});
	}
}

module.exports = wallbox;