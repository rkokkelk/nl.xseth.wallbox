const base64 = require('base-64');
const fetch = require('node-fetch');
const util = require('./util.js');

module.exports = class WallboxAPI {

  constructor(user, pass) {
    this._user = user;
    this._pass = pass;
    this._baseUrl = "https://api.wall-box.com/";
    this._headers = {
      "Accept": "application/json",
      "Content-Type": "application/json;charset=UTF-8",
    };

  }

  /**
  * Authenticates with user credentials and gets the authentication token
  *
  * @returns {Promise} Promise object represents the result of the authentication
  */
  async authenticate() {
    this._headers['Authorization'] = 'Basic ' + base64.encode(this._user + ":" + this._pass);

    const url = this._baseUrl + 'auth/token/user';
    const res = await fetch(url, { headers: this._headers });

    if (!res.ok)
      throw new Error(res.status);

    let result = await res.json();

    this._jwt = result['jwt'];
    this._headers['Authorization'] = 'Bearer ' + this._jwt;

    console.log('Succesfully authenticated with user: ', this._user);
  }

  /**
  * Gets list of chargers available
  *
  * @returns {Promise} Promise object represents the list of chargers
  */
  async getChargers() {
    const url = this._baseUrl + 'v3/chargers/groups';
    const res = await fetch(url, { headers: this._headers });

    if (!res.ok)
      throw new Error(res.status);

    console.log('Succesfully got charger list');
    return await res.json();
  }

  /**
   * Gets status of a specific charger
   *
   * @param {string} chargerId - Identifier of the target charger
   * @returns {Promise} Promise object represents the status of the charger
   */
  async getChargerStatus(chargerId) {
    const url = this._baseUrl + 'chargers/status/' + chargerId;
    const res = await fetch(url, { headers: this._headers });

    if (!res.ok)
      throw new Error(res.status);

    console.log('Succesfully got charger status');
    return await res.json();
  }

  /**
   * Sets charger properties
   *
   * @param {string} chargerId - Identifier of the target charger
   * @param {JSON} data - The charger property data that needs to be updated
   * @returns {Promise} Promise object represents the result of setting charger properties
   */
  async _setChargerProperties(chargerId, data) {
    const url = this._baseUrl + 'v2/charger/' + chargerId;
    data = JSON.stringify(data);

    const res = await fetch(url, { method: 'PUT', body: data, headers: this._headers });

    util.checkStatus(res);

    console.log('Succesfully set properties: ', data);

    return await res.json();
  }

  /**
   * Sets charging status (Pause or Resume)
   *
   * @param {string} chargerId - Identifier of the target charger
   * @param {JSON} data - Charging status data to be updated
   * @returns {Promise} Promise object represents the result of setting charging status
   */
  async _setCharging(chargerId, data) {
    const url = `${this._baseUrl}v3/chargers/${chargerId}/remote-action`;
    data = JSON.stringify(data);

    const res = await fetch(url, { method: 'POST', body: data, headers: this._headers });

    util.checkStatus(res);

    console.log('Pause/Resumed charging', data);

    return await res.json();
  }

  /**
   * Unlocks a specific charger
   *
   * @param {string} chargerId - Identifier of the target charger
   * @returns {Promise} Promise object represents the result of unlocking the charger
   */
  async unlockCharger(chargerId) {
    await this._setChargerProperties(chargerId, { locked: 0 });
  }

  /**
   * Locks a specific charger
   *
   * @param {string} chargerId - Identifier of the target charger
   * @returns {Promise} Promise object represents the result of locking the charger
   */
  async lockCharger(chargerId) {
    await this._setChargerProperties(chargerId, { locked: 1 });
  }

  /**
   * Pauses charging for a specific charger
   *
   * @param {string} chargerId - Identifier of the target charger
   * @param {JSON} data - Charging pause data to be updated
   * @returns {Promise} Promise object represents the result of pausing charging
   */
  async pauseCharging(chargerId, data) {
    await this._setCharging(chargerId, { action: 2 });
  }

  /**
   * Resumes charging for a specific charger
   *
   * @param {string} chargerId - Identifier of the target charger
   * @param {JSON} data - Charging resume data to be updated
   * @returns {Promise} Promise object represents the result of resuming charging
   */
  async resumeCharging(chargerId, data) {
    await this._setCharging(chargerId, { action: 1 });
  }
}
