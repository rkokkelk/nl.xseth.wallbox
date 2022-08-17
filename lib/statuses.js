
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

exports.getStatus = function(statusId){
  /**
   * Get the status based on status ID
   *
   * @param {int} statusId - statusId to get official status from
   * @return {String} - Current status or undefined if not found
   */

    let found = undefined
  for (const [key, value] of Object.entries(this.statuses)){
    found = value.find(id => id == statusId)

    if (found != undefined)
      return key
  }

  return undefined
}