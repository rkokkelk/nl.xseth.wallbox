const base64 = require('base-64');
const fetch = require('node-fetch');
const util = require('/lib/util.js');

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

  async getChargers() {
    const url = this._baseUrl + 'v3/chargers/groups';
    const res = await fetch(url, { headers: this._headers });

    if (!res.ok)
      throw new Error(res.status);

    console.log('Succesfully got charger list');
    return await res.json();
  }

  async getChargerStatus(chargerId){
    const url = this._baseUrl + 'chargers/status/' + chargerId;
    const res = await fetch(url, { headers: this._headers });

    if (!res.ok)
      throw new Error(res.status);

    console.log('Succesfully got charger status');
    return await res.json();
  }

  async _setChargerProperties(chargerId, data){
    const url = this._baseUrl + 'v2/charger/' + chargerId;
    data = JSON.stringify(data);

    const res = await fetch(url, { method: 'PUT', body: data, headers: this._headers });

    util.checkStatus(res);

    console.log('Succesfully set properties: ', data);

    return await res.json();
  }

  async _setCharging(chargerId, data){
    const url = `${this._baseUrl}v3/chargers/${chargerId}/remote-action`;
    data = JSON.stringify(data);

    const res = await fetch(url, { method: 'POST', body: data, headers: this._headers });

    util.checkStatus(res);

    console.log('Pause/Resumed charging', data);

    return await res.json();
  }

  async unlockCharger(chargerId){
    await this._setChargerProperties(chargerId, {locked: 0});
  }

  async lockCharger(chargerId){
    await this._setChargerProperties(chargerId, {locked: 1});
  }

  async pauseCharging(chargerId, data){
    await this._setCharging(chargerId, {action: 2});
  }

  async resumeCharging(chargerId, data){
    await this._setCharging(chargerId, {action: 1});
  }
  
}
