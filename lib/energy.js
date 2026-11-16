'use strict'

/**
 * Lifetime energy meter for Homey Energy.
 *
 * Homey Energy needs a meter that only goes up. The Wallbox API gives the
 * energy of the current session (added_energy, resets every session) and a
 * list of finished sessions (v4/sessions/stats). The meter is:
 *   total = finished sessions + open session
 * The finished list is fetched again regularly, so energy missed while Homey
 * was off is added at the next refresh. The total never goes down.
 * Green (solar) energy is counted the same way.
 *
 * Energy values are { energy, green } in kWh.
 *
 * Finished sessions (history): { base, cutoff, recent, latest, refreshed }
 *   base      - sessions before cutoff, fetched once
 *   cutoff    - seconds, sessions from here on are fetched on every refresh
 *   recent    - sessions from cutoff on, at the last refresh
 *   latest    - energy of the last finished session, or null
 *   refreshed - time of the last refresh in ms
 *
 * Meter: { total, green, stale, open, last }
 *   total - lifetime kWh
 *   green - lifetime green kWh
 *   stale - added_energy of a session that is no longer open (it is in the
 *           finished list, or soon will be), null while a new session is open
 *   open  - a session was open at the previous poll
 *   last  - added_energy at the previous poll
 */

const DAY = 24 * 60 * 60
const FIRST_YEAR = 2015 // Oldest year to look for sessions
const MIN_TIME = Date.UTC(2026, 0, 1) // Clock before this is not set yet (Homey just booted)
const WINDOW = 30 * DAY // Recent part, fetched on every refresh
const MAX_WINDOW = 60 * DAY // Move the cutoff when the recent part gets this long
const REFRESH = DAY * 1000 // Refresh at least daily
const GAP = 10 * 60 * 1000 // Refresh after this long without a poll (Homey off, no internet)
const MIN_INTERVAL = 15 * 60 * 1000 // At most one list fetch per 15 minutes, failed ones too
const MAX_INTERVAL = DAY * 1000 // Longest wait after repeated failures
const LOAD_TIMEOUT = 5 * 60 * 1000 // Give up a history load after this long

// Statuses with an open charging session
const SESSION_OPEN = ['Charging', 'Discharging', 'Paused', 'Waiting']

// Statuses without a session; added_energy still shows the last session
// here (also at 210, after plugging back in on a locked charger)
const NO_SESSION = ['Ready', 'Locked', 'LockedCarConnected']

/**
 * Queue for history loads. All devices share one, so an app start with
 * several chargers does not send all requests at once.
 */
class Queue {

  constructor() {
    this.tail = Promise.resolve()
  }

  /**
   * Run a task after the ones before it, also when those failed
   *
   * @param {Function} task - returns a promise
   * @return {Promise} result of the task
   */
  run(task) {
    const result = this.tail.then(task, task)
    this.tail = result.catch(() => {})
    return result
  }

}
exports.Queue = Queue
const sharedQueue = new Queue()

/**
 * Session state for a status
 *
 * @param {String} status - status from statuses.getStatus
 * @return {String|null} 'open', 'none' or null when unknown (skip update)
 */
exports.sessionState = function(status) {
  if (SESSION_OPEN.includes(status)) return 'open'
  if (NO_SESSION.includes(status)) return 'none'
  return null
}

/**
 * Sum a v4/sessions/stats response
 *
 * @param {Object} result - parsed response
 * @param {number|string} chargerId - only count sessions of this charger
 * @return {Object} { energy, green, count, latest }: kWh, sessions, energy of the last one
 */
exports.sumSessions = function(result, chargerId) {
  // A missing or cut off list would make the total too low, fail so it is fetched again
  if (!result || !Array.isArray(result.data))
    throw new Error('Session list missing')
  if (result.meta && result.meta.count > result.data.length) {
    const error = new Error(`Session list incomplete: ${result.data.length} of ${result.meta.count}`)
    error.code = 'incomplete'
    throw error
  }

  // The list is asked for this charger; drop sessions of other chargers in case it holds them
  const mine = session => {
    const charger = (session.attributes || {}).charger
    return charger == null || String(charger) === String(chargerId)
  }

  let end = -1
  return result.data.filter(mine).reduce((sum, session) => {
    const attributes = session.attributes || {}
    const kwh = value => (attributes.energy_unit === 'Wh' ? (Number(value) || 0) / 1000 : Number(value) || 0)
    const energy = kwh(attributes.energy)
    if ((Number(attributes.end) || 0) > end) {
      end = Number(attributes.end) || 0
      sum.latest = energy
    }
    sum.energy += energy
    sum.green += kwh(attributes.green_energy)
    sum.count++
    return sum
  }, { energy: 0, green: 0, count: 0, latest: null })
}

/**
 * Add two energy values
 *
 * @param {Object} a - { energy, green }
 * @param {Object} b - { energy, green }
 * @return {Object} { energy, green }
 */
exports.add = function(a, b) {
  return { energy: a.energy + b.energy, green: a.green + b.green }
}

/**
 * Green meter should be shown: the charger can do Eco-Smart (its mode is null
 * when it can't, also while switched off it has a mode), or it charged green
 * energy before
 *
 * @param {number} green - lifetime green kWh
 * @param {Object|undefined} ecoSmart - config_data.ecosmart of the charger
 * @return {boolean}
 */
exports.showGreen = function(green, ecoSmart) {
  return green > 0 || Boolean(ecoSmart && ecoSmart.mode != null)
}

/**
 * Meter state before the first update
 *
 * @param {Object} session - current session { energy, green }
 * @param {boolean} open - a session is open
 * @param {number|null} latest - energy of the last finished session
 * @return {Object} meter state
 */
exports.initial = function(session, open, latest) {
  // added_energy may still show the last finished session, which is counted in the list
  const stale = !open || session.energy === latest ? session.energy : null
  return { total: 0, green: 0, stale, open, last: session.energy }
}

/**
 * New meter state
 *
 * @param {Object} meter - meter state of the previous poll
 * @param {Object} finished - all finished sessions { energy, green }
 * @param {Object} session - current session now { energy, green }
 * @param {boolean} open - a session is open
 * @return {Object} meter state
 */
exports.update = function(meter, finished, session, open) {
  let stale = meter.stale
  if (!open)
    stale = session.energy
  else if (stale !== null && session.energy !== stale)
    stale = null // New session started

  // The session only counts while open and not in the finished list yet
  const live = open && stale === null
  return {
    total: Math.max(meter.total, finished.energy + (live ? session.energy : 0)),
    green: Math.max(meter.green, finished.green + (live ? session.green : 0)),
    stale,
    open,
    last: session.energy
  }
}

/**
 * Should the finished list be fetched again
 *
 * @param {Object|null} meter - meter state of the previous poll
 * @param {Object|null} history - finished sessions
 * @param {Object} session - current session now { energy, green }
 * @param {boolean} open - a session is open
 * @param {number} now - time in ms
 * @param {number|null} lastPoll - time of the previous poll in ms, null after app start
 * @return {boolean}
 */
exports.refreshDue = function(meter, history, session, open, now, lastPoll) {
  if (!history || !lastPoll) return true // First run or app start
  if (now - lastPoll > GAP) return true // Sessions may have ended unseen
  if (now - history.refreshed > REFRESH) return true
  if (!meter) return false // History just loaded, first meter update
  if (meter.open && !open) return true // Session ended
  if (open && meter.stale !== null && session.energy !== meter.stale) return true // New session started
  if (open && session.energy < meter.last) return true // New session, previous one ended unseen
  return false
}

/**
 * Is a list fetch allowed now. At most every 15 minutes, failed ones too,
 * and twice as long after each further failure, up to a day.
 *
 * @param {number|null} lastAttempt - time of the previous fetch attempt in ms
 * @param {number} now - time in ms
 * @param {number} failures - failed fetches in a row
 * @return {boolean}
 */
exports.fetchAllowed = function(lastAttempt, now, failures = 0) {
  const wait = Math.min(MIN_INTERVAL * 2 ** Math.max(0, failures - 1), MAX_INTERVAL)
  return !lastAttempt || now - lastAttempt >= wait
}

/**
 * Split a time range per calendar year, so no request covers more than a year
 *
 * @param {number} from - seconds
 * @param {number} to - seconds, exclusive
 * @return {Array} [start, end] pairs, end inclusive
 */
exports.ranges = function(from, to) {
  const ranges = []
  for (let start = from; start < to;) {
    const nextYear = Date.UTC(new Date(start * 1000).getUTCFullYear() + 1, 0, 1) / 1000
    const end = Math.min(nextYear, to)
    ranges.push([start, end - 1])
    start = end
  }
  return ranges
}

/**
 * What a refresh has to fetch
 *
 * @param {Object|null} history - finished sessions
 * @param {number} now - seconds
 * @return {Object} { base, add, cutoff }: energy to keep, ranges to add to it, new cutoff
 */
exports.plan = function(history, now) {
  // No history, or the clock went back before the cutoff: load everything again
  if (!history || now < history.cutoff)
    return { base: { energy: 0, green: 0 }, add: exports.ranges(Date.UTC(FIRST_YEAR, 0, 1) / 1000, now - WINDOW), cutoff: now - WINDOW }
  if (now - history.cutoff > MAX_WINDOW)
    return { base: history.base, add: exports.ranges(history.cutoff, now - WINDOW), cutoff: now - WINDOW }
  return { base: history.base, add: [], cutoff: history.cutoff }
}

/**
 * Lifetime meter of one charger
 */
exports.EnergyMeter = class EnergyMeter {

  /**
   * @param {Object} options
   * @param {Function} options.fetchSessions - (start, end) => Promise of sumSessions result
   * @param {Object} options.store - persistent { get(key), set(key, value) }
   * @param {Function} options.log - log function
   * @param {Function} options.now - clock in ms, Date.now by default
   * @param {Object} options.timers - { setTimeout, clearTimeout } for the load timeout, none by default
   * @param {Queue} options.queue - load queue, shared by all chargers by default
   */
  constructor({ fetchSessions, store, log, now, timers, queue }) {
    this._fetchSessions = fetchSessions
    this._store = store
    this._log = log || (() => {})
    this._now = now || Date.now
    this._timers = timers
    this._queue = queue || sharedQueue
    this._updating = Promise.resolve()
    this._lastPoll = null
    this._lastAttempt = null
    this._failures = 0
    this._pending = false
    this.refreshing = null
  }

  /**
   * Update from a status poll; a due history fetch runs in the background.
   * Updates run one at a time, so overlapping polls can't lower the total.
   *
   * @param {String} status - status from statuses.getStatus
   * @param {Object} stats - charger status from the API
   * @return {Promise} { total, green } in kWh, or null when nothing to show yet
   */
  update(status, stats) {
    const run = () => this._update(status, stats)
    const result = this._updating.then(run, run)
    this._updating = result.catch(() => {})
    return result
  }

  async _update(status, stats) {
    const session = { energy: Number(stats.added_energy), green: Number(stats.added_green_energy) || 0 }
    const state = exports.sessionState(status)
    const now = this._now()
    if (!Number.isFinite(session.energy) || state === null || now < MIN_TIME)
      return null

    const open = state === 'open'
    const prev = this._store.get('energy_meter')
    const history = this._store.get('energy_history')

    // A trigger stays pending until a fetch that started after it succeeds.
    // A missing history during the first load is not a new trigger.
    if (exports.refreshDue(prev, history, session, open, now, this._lastPoll) && !(this.refreshing && !history))
      this._pending = true
    if (this._pending && !this.refreshing && exports.fetchAllowed(this._lastAttempt, now, this._failures))
      this.refresh(history)
    this._lastPoll = now

    // Nothing to show before the first history load
    if (!history)
      return null

    const meter = exports.update(prev || exports.initial(session, open, history.latest), exports.add(history.base, history.recent), session, open)
    // Never save a broken value; update() never goes below the saved one
    if (!Number.isFinite(meter.total) || !Number.isFinite(meter.green))
      throw new Error(`Invalid meter value: ${meter.total}, ${meter.green}`)
    if (JSON.stringify(meter) !== JSON.stringify(prev))
      await this._store.set('energy_meter', meter)
    return { total: meter.total, green: meter.green }
  }

  /**
   * Fetch finished sessions, queued behind other chargers
   *
   * @param {Object|null} history - finished sessions of the last refresh
   * @return {Promise} resolves when done, never rejects
   */
  refresh(history) {
    this._pending = false
    this._lastAttempt = this._now()
    this.refreshing = this._queue.run(() => this._withTimeout(this._load(history)))
      .then(() => {
        this._failures = 0
      }, error => {
        this._pending = true
        this._failures++
        this._log(`Failed to load energy history: ${error}`)
      })
      .then(() => {
        this.refreshing = null
      })
    return this.refreshing
  }

  // A load that never settles must not block the queue for other chargers
  _withTimeout(promise) {
    if (!this._timers)
      return promise
    let timer
    const timeout = new Promise((resolve, reject) => {
      timer = this._timers.setTimeout(() => reject(new Error('History load timed out')), LOAD_TIMEOUT)
    })
    return Promise.race([promise, timeout]).finally(() => this._timers.clearTimeout(timer))
  }

  async _load(history) {
    const now = Math.floor(this._now() / 1000)
    const plan = exports.plan(history, now)
    const ranges = plan.add
    let base = plan.base
    let latest = null
    let found = false
    let empty = 0

    // Newest year first. After two empty years, the years before are asked
    // in one request: usually empty, as the charger did not exist yet
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (found && empty >= 2)
        try {
          base = exports.add(base, await this._fetchSessions(ranges[0][0], ranges[i][1]))
          break
        } catch (error) {
          if (error.code !== 'incomplete')
            throw error
          empty = 0 // Too many sessions for one request, continue per year
        }
      const part = await this._fetchSessions(ranges[i][0], ranges[i][1])
      base = exports.add(base, part)
      if (latest === null) latest = part.latest
      if (part.count > 0) {
        found = true
        empty = 0
      } else
        empty++
    }
    const recent = await this._fetchSessions(plan.cutoff, now + 60)

    await this._store.set('energy_history', {
      base,
      cutoff: plan.cutoff,
      recent: { energy: recent.energy, green: recent.green },
      // Newest finished session: in the recent part, else the newest year with sessions
      latest: recent.latest !== null ? recent.latest : (latest !== null ? latest : (history ? history.latest : null)),
      refreshed: this._now()
    })
  }

}
