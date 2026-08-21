'use strict';

/**
 * Shared pacing for the MediaWiki upload rate limit.
 *
 * MediaWiki pings both the 'edit' and the 'upload' limiter for every upload
 * (UploadBase::verifyTitlePermissions) and answers the surplus with HTTP 200
 * and error.code 'ratelimited' -- no 429, no Retry-After. The limit is time
 * based, so uploading sequentially does not avoid it. Only waiting does.
 *
 * One gate serves every widget on the page, because the limit is per user.
 * A rejection that arrives while the gate is already closed does not extend
 * the wait: concurrent uploads report the same overrun, not a worse one.
 */

const FIRST_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 60000;
const MAX_CONSECUTIVE_RETRIES = 6;

// Browsers fire a timer immediately above this, so never sleep for longer.
const MAX_TIMEOUT_MS = 2147483647;

/**
 * @param {number} rejections Consecutive rate limit rejections, 1 for the first
 * @param {number} [capMs] Longest useful wait, normally the advertised window.
 *  Only ever binds below about 64 seconds, where the ladder tops out, so this
 *  shortens the wait for a wiki that refills quickly rather than lengthening it
 *  for one that refills slowly. Spacing the attempts is what carries a file
 *  past a long window.
 * @return {number} Milliseconds to wait before the next attempt
 */
function retryDelay( rejections, capMs ) {
	if ( rejections < 1 ) {
		return 0;
	}

	return Math.min(
		FIRST_RETRY_DELAY_MS * Math.pow( 2, rejections - 1 ),
		capMs === undefined ? MAX_RETRY_DELAY_MS : capMs
	);
}

/**
 * @param {Object} [options]
 * @param {Function} [options.now] Returns the current time in milliseconds
 * @param {Function} [options.sleep] Returns a promise resolving after n milliseconds
 * @param {number} [options.maxRetries]
 * @param {?Object} [options.limit] From rateLimits.bindingLimit(): the
 *  { intervalMs, windowMs } the wiki advertises. Null or absent means the user
 *  is not rate limited, so nothing is paced and the wait falls back to a minute.
 * @return {Object}
 */
function createRateLimitGate( options ) {
	const settings = options || {};
	// mw.now(), not Date.now(): the gate measures an elapsed duration, and
	// Date.now() is a wall clock that can step backwards on an NTP correction.
	// A backward step lengthens an in-progress wait by exactly the size of the
	// step, and a paced batch now stays open for minutes. mw.now() is
	// navigationStart + performance.now() where available, so it is monotonic,
	// and falls back to Date.now() where it is not.
	const now = settings.now || ( () => mw.now() );
	const sleep = settings.sleep ||
		( ( ms ) => new Promise( ( resolve ) => {
			setTimeout( resolve, ms );
		} ) );
	const maxRetries = settings.maxRetries === undefined ?
		MAX_CONSECUTIVE_RETRIES :
		settings.maxRetries;

	let capMs = MAX_RETRY_DELAY_MS;
	let intervalMs = 0;

	let rejections = 0;
	let openAt = 0;
	let halted = false;

	// Pacing starts only once the wiki has actually refused something. A batch
	// that fits inside the budget is never refused, so it is never slowed down:
	// bursting is what makes the ordinary case fast, and it succeeds.
	let pacing = false;
	let nextReleaseAt = 0;
	let lastRefusalAt = 0;

	/**
	 * Stops pacing once the wiki has gone a full window without refusing
	 * anything, because by then whatever was exhausted has refilled.
	 *
	 * Without this, one refusal at the tail of a batch would slow every later
	 * selection on the page for as long as the tab stayed open, including
	 * batches small enough to fit comfortably.
	 */
	function forgetStaleRefusals() {
		if ( pacing && now() - lastRefusalAt >= capMs ) {
			pacing = false;
			nextReleaseAt = 0;
		}
	}

	/**
	 * Adopts the limit the wiki advertises.
	 *
	 * Separate from construction because the widget has to work the moment the
	 * page is ready, and the limit arrives from an API call. Until it does the
	 * gate behaves as it always did, which is safe: pacing only ever starts
	 * after a refusal, and a refusal that early is not realistic.
	 *
	 * @param {?Object} limit From rateLimits.bindingLimit(), or null for a user
	 *  the wiki does not limit
	 */
	function useLimit( limit ) {
		capMs = limit ? limit.windowMs : MAX_RETRY_DELAY_MS;
		intervalMs = limit ? limit.intervalMs : 0;
	}

	useLimit( settings.limit || null );

	/**
	 * @return {Promise<boolean>} True once uploading may continue, false if the
	 *  batch was given up on while waiting
	 */
	async function wait() {
		for ( ;; ) {
			if ( halted ) {
				return false;
			}

			forgetStaleRefusals();

			const releaseAt = pacing ? Math.max( openAt, nextReleaseAt ) : openAt;
			const remaining = releaseAt - now();

			if ( remaining <= 0 ) {
				if ( pacing ) {
					// Claim this slot before returning, so the next caller is
					// spaced behind it rather than released alongside it.
					nextReleaseAt = Math.max( now(), nextReleaseAt ) + intervalMs;
				}

				return true;
			}

			// Above 2^31-1 ms a browser timer fires immediately, which would turn
			// this loop hot. The loop re-checks, so clamping is safe.
			await sleep( Math.min( remaining, MAX_TIMEOUT_MS ) );
		}
	}

	function noteRateLimited() {
		if ( now() < openAt ) {
			// Already paying for this overrun.
			return;
		}

		rejections += 1;

		if ( rejections > maxRetries ) {
			halted = true;
			return;
		}

		lastRefusalAt = now();

		if ( intervalMs > 0 ) {
			// The budget is demonstrably tight, so stop bursting.
			pacing = true;
		}

		openAt = now() + retryDelay( rejections, capMs );
	}

	function noteProgress() {
		rejections = 0;
	}

	/**
	 * Takes the batch off halt so a new selection can upload.
	 *
	 * Deliberately leaves openAt alone: files from an earlier selection may be
	 * asleep in wait(), and clearing it would wake them all at once straight
	 * into the limiter they are backing off from.
	 */
	function resume() {
		rejections = 0;
		halted = false;
	}

	return {
		useLimit: useLimit,
		wait: wait,
		noteRateLimited: noteRateLimited,
		noteProgress: noteProgress,
		resume: resume,
		stopped: () => halted
	};
}

module.exports = {
	retryDelay: retryDelay,
	createRateLimitGate: createRateLimitGate
};
