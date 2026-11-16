const base64 = require('base-64');
const fetch = require('node-fetch');
const util = require('./util.js');
const Homey = require('homey');

module.exports = class WallboxAPI {

  constructor(user, pass, homey, authInterval) {
    this._user = user;
    this._pass = pass;
    this.homey = homey;
    this._jwt = "";
    this._tokenDrift = authInterval + 30;
    this._jwtRefreshToken = "";
    this._jwtTokenTtl = 0;
    this._jwtRefreshTokenTtl = 0;
    this.credentialsRejected = false;
    this._version = this.homey.app.manifest.version;
    this._baseUrl = "https://api.wall-box.com/";
    this._authUrl = "https://user-api.wall-box.com/"
    this._headers = {
      "Accept": "application/json",
      "Partner": "wallbox",
      "Content-Type": "application/json;charset=UTF-8",
      "User-Agent": `Homey-WallBox (nl.xseth.wallbox/${this._version})`
    };

  }

  /**
  * Authenticates with user credentials and gets the authentication token
  *
  * @returns {Promise} Promise object represents the result of the authentication
  */
  async authenticate() {
    // Credentials were rejected, don't keep signing in with them
    if (this.credentialsRejected)
      throw new Error(this.homey.__('errors.login'));

    const basicAuth = 'Basic ' + base64.encode(this._user + ":" + this._pass);
    let authPath = "users/signin"
    let authHeader = basicAuth

    if(this._jwt){

      // JWT token still valid
      if(Math.round((this._jwtTokenTtl / 1000) - this._tokenDrift) > Math.floor(Date.now() / 1000)){
        this.homey.log(`Valid auth! Now:(${Date.now()}); TTL:(${this._jwtTokenTtl}); Refresh:(${this._jwtRefreshTokenTtl});`);
        return
      }

      // Need to refresh token, if refresh token is still valid
      if (this._jwtRefreshToken && Math.round((this._jwtRefreshTokenTtl / 1000) - this._tokenDrift) > Math.floor(Date.now() / 1000)){
        authPath = "users/refresh-token"
        authHeader = 'Bearer ' + this._jwtRefreshToken;
        this.homey.log('Refreshing auth!');
      }
    }

    // No valid tokens left, sign in with credentials
    if (authPath === 'users/signin')
      this.homey.log("Performing full auth!");

    let res = await fetch(`${this._authUrl}${authPath}`, { headers: { ...this._headers, Authorization: authHeader } });

    // Refresh token rejected by server, sign in with credentials instead
    if (authPath === 'users/refresh-token' && (res.status === 401 || res.status === 403)) {
      this.homey.log('Refresh rejected, performing full auth!');
      authPath = 'users/signin'
      res = await fetch(`${this._authUrl}${authPath}`, { headers: { ...this._headers, Authorization: basicAuth } });
    }

    // Credentials rejected, stop signing in until the app restarts
    if (authPath === 'users/signin' && (res.status === 401 || res.status === 403)) {
      this.credentialsRejected = true;
      throw new Error(this.homey.__('errors.login'));
    }
    util.checkStatus(res);

    let result = await res.json();

    this._jwt = result['data']['attributes']['token'];
    this._jwtRefreshToken = result["data"]["attributes"]["refresh_token"]
    this._jwtTokenTtl = result["data"]["attributes"]["ttl"]
    this._jwtRefreshTokenTtl = result["data"]["attributes"]["refresh_token_ttl"]
    this._headers['Authorization'] = 'Bearer ' + this._jwt;

    this.homey.log('Succesfully authenticated with user: ', this._user);
  }

  /**
  * Gets list of chargers available
  *
  * @returns {Promise} Promise object represents the list of chargers
  */
  async getChargers() {
    const url = this._baseUrl + 'v3/chargers/groups';
    const res = await fetch(url, { headers: this._headers });

    util.checkStatus(res);

    this.homey.log('Succesfully got charger list');
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

    util.checkStatus(res);

    this.homey.log('Succesfully got charger status');
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
    const url = `${this._baseUrl}v2/charger/${chargerId}`;
    data = JSON.stringify(data);

    const res = await fetch(url, { method: 'PUT', body: data, headers: this._headers });

    util.checkStatus(res);

    this.homey.log('Succesfully set properties: ', data);

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

    this.homey.log('Pause/Resumed charging', data);

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
   * @returns {Promise} Promise object represents the result of pausing charging
   */
  async pauseCharging(chargerId) {
    await this._setCharging(chargerId, { action: 2 });
  }

  /**
   * Resumes charging for a specific charger
   *
   * @param {string} chargerId - Identifier of the target charger
   * @returns {Promise} Promise object represents the result of resuming charging
   */
  async resumeCharging(chargerId) {
    await this._setCharging(chargerId, { action: 1 });
  }

  /**
   * Set max charging current
   *
   * @param {string} chargerId - Identifier of the target charger
   * @param {int} maxChargingCurrent - Max Ampere to set for charging
   * @returns {Promise} Promise object represents the result of setting max charging current
   */
  async setMaxChargingCurrent(chargerId, maxChargingCurrent) {
    const MIN_CURRENT = 1;
    const stats = await this.getChargerStatus(chargerId);
    const MAX_CURRENT = stats['config_data']['max_available_current'];

    // Validate whether new maxChargingCurrents is within bounds
    if (MIN_CURRENT > maxChargingCurrent  || MAX_CURRENT < maxChargingCurrent)
      throw Error(this.homey.__("errors.max_amperage", { MIN_CURRENT: MIN_CURRENT, MAX_CURRENT: MAX_CURRENT, maxChargingCurrent: maxChargingCurrent }));

    await this._setChargerProperties(chargerId, { maxChargingCurrent: maxChargingCurrent });
  }

  /**
   * Set Eco-Smart (solar charging) mode
   *
   * @param {string} chargerId - Identifier of the target charger
   * @param {int} enabled - 1 to enable, 0 to disable
   * @param {int} mode - 0 for Eco mode, 1 for Full solar
   * @returns {Promise} Promise object represents the result of setting Eco-Smart
   */
  async setEcoSmart(chargerId, enabled, mode) {
    const url = `${this._baseUrl}v4/chargers/${chargerId}/eco-smart`;
    const data = JSON.stringify({ data: { attributes: { enabled, mode }, type: 'eco_smart' } });

    const res = await fetch(url, { method: 'PUT', body: data, headers: this._headers });

    util.checkStatus(res);

    this.homey.log('Succesfully set Eco-Smart: ', data);
  }
}
