const base64 = require('base-64');
const fetch = require('node-fetch');

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
    let headers = this._headers;
    headers['Authorization'] = 'Basic ' + base64.encode(this._user + ":" + this._pass);

    let url = this._baseUrl + 'auth/token/user';
    const res = await fetch(url, { headers: headers });
    
    if (!res.ok)
      throw new Error(res.status);

    let result = await res.json();

    this._jwt = result['jwt'];
    this._headers['Authorization'] = 'Bearer ' + this._jwt;
  }

  async getChargers() {
    console.log(this._headers['Authorization']);
    let url = this._baseUrl + 'v3/chargers/groups';
    const res = await fetch(url, { headers: this._headers });

    if (!res.ok)
      throw new Error(res.status);

    return await res.json();
  }


  
}
