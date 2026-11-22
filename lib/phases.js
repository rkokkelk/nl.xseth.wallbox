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
const MARGIN = 0.1; // Ratio within 10% of a whole number of phases
const STABLE_MS = 60 * 1000; // Same reading this long (quick polls come 10 s after a change)

// Without a car connected, the next car may charge on other phases
const NO_CAR = ['Ready', 'Locked'];

/**
 * Phases for one poll, or null when it doesn't fit a whole number
 * (car draws less than the set current, or stale power after a change)
 */
function reading(status, amps, kw) {
  if (status !== 'Charging' || !(amps >= MIN_AMP) || !(kw >= MIN_KW))
    return null;

  const ratio = (kw * 1000) / (VOLT * amps);
  const phases = Math.round(ratio);
  if (phases < 1 || phases > 3 || Math.abs(ratio / phases - 1) > MARGIN)
    return null;
  return phases;
}

class PhaseMeter {

  /**
   * @param {int} last - phases of the last session, if known
   */
  constructor(last) {
    this.last = [1, 2, 3].includes(last) ? last : 1;
    this.session = null; // highest stable reading this session
    this.prev = null; // first poll of the current reading
  }

  get phases() {
    return this.session || this.last;
  }

  /**
   * Update with a poll of the charger
   *
   * A reading counts when it stays the same, at the same set current, for at
   * least a minute. The highest reading of a session wins, so tapering near
   * full or a switch to 1 phase never raises the current.
   *
   * @param {String} status - status, see statuses.js
   * @param {Number} amps - set charging current (config_data.max_charging_current)
   * @param {Number} kw - charging power in kW (charging_power)
   * @param {Number} now - time in ms
   * @return {int} phases in use
   */
  update(status, amps, kw, now = Date.now()) {
    if (NO_CAR.includes(status)) {
      this.session = null;
      this.prev = null;
      return this.phases;
    }

    const phases = reading(status, amps, kw);
    const prev = this.prev;
    if (!phases || !prev || prev.amps !== amps || prev.phases !== phases) {
      this.prev = phases ? { amps, phases, at: now } : null;
      return this.phases;
    }

    if (now - prev.at >= STABLE_MS && (!this.session || phases > this.session)) {
      this.session = phases;
      this.last = phases;
    }
    return this.phases;
  }

}

module.exports = { PhaseMeter, MIN_AMP };
