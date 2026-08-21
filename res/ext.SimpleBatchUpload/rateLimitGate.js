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

/**
 * @param {number} rejections Consecutive rate limit rejections, 1 for the first
 * @return {number} Milliseconds to wait before the next attempt
 */
function retryDelay( rejections ) {
	if ( rejections < 1 ) {
		return 0;
	}

	return Math.min(
		FIRST_RETRY_DELAY_MS * Math.pow( 2, rejections - 1 ),
		MAX_RETRY_DELAY_MS
	);
}

/**
 * @param {Object} [options]
 * @param {Function} [options.now] Returns the current time in milliseconds
 * @param {Function} [options.sleep] Returns a promise resolving after n milliseconds
 * @param {number} [options.maxRetries]
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

	let rejections = 0;
	let openAt = 0;
	let halted = false;

	/**
	 * @return {Promise<boolean>} True once uploading may continue, false if the
	 *  batch was given up on while waiting
	 */
	async function wait() {
		for ( ;; ) {
			if ( halted ) {
				return false;
			}

			const remaining = openAt - now();

			if ( remaining <= 0 ) {
				return true;
			}

			await sleep( remaining );
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

		openAt = now() + retryDelay( rejections );
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
