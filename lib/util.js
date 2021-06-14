exports.checkStatus = function(res) {
  /**
   * Verify if fetch response is ok
   *
   * @param {Response} res - response to verify
   * @return {Response} response obj if valid
   */
  if (res.ok) // res.status >= 200 && res.status < 300
    return res;
  else
    throw new Error(res.status);
}
