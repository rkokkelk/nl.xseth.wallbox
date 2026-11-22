'use strict';

/**
 * Number of phases the car charges on
 *
 * The Wallbox API has no phase field, only config_data.phase_switch.enabled.
 * While charging, power / (230 V x set current) gives the phases in use, as
 * long as the car draws the full set current. The car decides (1, 2 or 3
 * phases), and some chargers switch from 3 to 1 phase for solar charging.
 */

const VOLT = 230;
const MIN_AMP = 6; // Lowest charging current
const MIN_KW = 1; // Ignore readings while power ramps up

// Without a car connected, the next car may charge on other phases
const NO_CAR = ['Ready', 'Locked'];

class PhaseMeter {

  /**
   * @param {int} last - phases of the last session, if known
   */
  constructor(last) {
    this.last = [1, 2, 3].includes(last) ? last : 1;
    this.session = null; // highest stable reading this session
    this.prev = null; // previous charging reading
  }

  get phases() {
    return this.session || this.last;
  }

  /**
   * Update with a poll of the charger
   *
   * A reading counts when two polls in a row show Charging with the same set
   * current (the API reports stale power right after a change); the lower
   * ratio of the two is used. The highest reading of a session wins, so
   * tapering near full or a switch to 1 phase never raises the current.
   *
   * @param {String} status - status, see statuses.js
   * @param {Number} amps - set charging current (config_data.max_charging_current)
   * @param {Number} kw - charging power in kW (charging_power)
   * @return {int} phases in use
   */
  update(status, amps, kw) {
    if (NO_CAR.includes(status)) {
      this.session = null;
      this.prev = null;
      return this.phases;
    }

    if (status !== 'Charging' || !(amps >= MIN_AMP) || !(kw >= MIN_KW)) {
      this.prev = null;
      return this.phases;
    }

    const ratio = (kw * 1000) / (VOLT * amps);
    const prev = this.prev;
    this.prev = { amps, ratio };
    if (!prev || prev.amps !== amps)
      return this.phases;

    const reading = Math.min(3, Math.max(1, Math.round(Math.min(prev.ratio, ratio))));
    if (!this.session || reading > this.session) {
      this.session = reading;
      this.last = reading;
    }
    return this.phases;
  }

}

module.exports = { PhaseMeter, MIN_AMP };
