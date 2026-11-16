/**
 * Verify if fetch response is ok
 *
 * @param {Response} res - response to verify
 * @return {Response} response obj if valid
 */
exports.checkStatus = function(res) {
  if (res.ok) // res.status >= 200 && res.status < 300
    return res;
  else
    throw new Error(res.status);
}

/**
 * Determine watt usage from kWh in seconds
 *
 * @param {float} kwh - kWh to use to calculate watt
 * @param {int} time - Elapsed time in seconds
 * @return {int} watt
 * 
 * W = (1000*KWh) / (time / 3600)
 */
exports.calcWattFromkWhs = function(kwh, time) {
  return (1000 * kwh) / (time / 3600)
}

/**
 * Determine amperage (A) to watts (W)
 * 
 * @param {int} amperage - amperage used to calculate watt
 * @return {int} watt
 */
exports.calcAmperagetoWatts = function(amperage) {
  return Math.round(Math.abs(amperage) * 230);
}

/**
 * Determine watts (w) to amperage (A)
 * 
 * @param {int} watt - watt used to calculate amperage
 * @return {int} amperage
 */
exports.calcWattstoAmperage = function(watt) {
  return Math.round(Math.abs(watt) / 230);
}