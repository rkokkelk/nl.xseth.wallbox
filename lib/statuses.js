
/**
 * Relations between statusses and statusIDs
 */
exports.statuses = {
  Charging: [193, 194, 195],
  Waiting: [164, 180, 181, 183, 184, 185, 186, 187, 188, 189],
  Ready: [161, 162],
  Paused: [178, 182],
  Discharging: [196],
  Error: [14, 15],
  Disconnected: [0, 163, null, undefined],
  Locked: [209, 210, 165],
  Updating: [166]
}

exports.chargingState = {
  Charging: 'plugged_in_charging',
  Waiting: 'plugged_in',
  Ready: 'plugged_in',
  Paused: 'plugged_in_paused',
  Discharging: 'plugged_in_discharging',
  Error: 'plugged_out',
  Disconnected: 'plugged_out',
  Locked: 'plugged_in_paused',
  Updating: 'plugged_out'
}

/**
 * Get the status based on status ID
 *
 * @param {int} statusId - statusId to get official status from
 * @return {String} - Current status or undefined if not found
 */
exports.getStatus = function(statusId){

    let found = undefined
  for (const [key, value] of Object.entries(this.statuses)){
    found = value.find(id => id == statusId)

    if (found != undefined)
      return key
  }

  return undefined
}

/**
 * Get the Homey EV charging state based on Status
 *
 * @param {String} status - status
 * @return {String} - Current homey ev charging state
 */
exports.getChargingState = function(status){
  return this.chargingState[status];
}