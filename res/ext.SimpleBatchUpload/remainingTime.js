'use strict';

/**
 * How much longer a rate limited batch has to run.
 *
 * This is not a measurement. The gate hands out one upload slot per interval
 * and already knows when the next one is due, so the figure is arithmetic on a
 * schedule the client is itself enforcing. That is why there is no smoothing
 * here: there is no noisy throughput to smooth.
 *
 * It excludes the time the files themselves take to transfer, which is additive
 * and matters for large ones, and it can grow if the wiki refuses again. Hence
 * "about", and hence whole minutes rather than a countdown.
 */

const MS_PER_MINUTE = 60000;

/**
 * @param {number} pending Files admitted to the batch that have not finished
 * @param {?Object} schedule From the gate: { waitMs, intervalMs }, or null when
 *  nothing is paced
 * @return {?number} Milliseconds, or null when there is nothing to estimate
 */
function estimateRemainingMs( pending, schedule ) {
	if ( !schedule || pending < 1 ) {
		return null;
	}

	return schedule.waitMs + ( pending - 1 ) * schedule.intervalMs;
}

/**
 * @param {?number} ms From estimateRemainingMs()
 * @return {?string} Message text, or null when there is nothing to say
 */
function describeRemaining( ms ) {
	if ( ms === null || ms === undefined ) {
		return null;
	}

	if ( ms < MS_PER_MINUTE ) {
		return mw.msg( 'simplebatchupload-estimate-under-a-minute' );
	}

	// Rounded up, so it never reads as no time left while files remain. Whole
	// minutes are also what keeps the live region quiet: the text changes once
	// a minute rather than on every refresh.
	return mw.msg(
		'simplebatchupload-estimate-minutes',
		Math.ceil( ms / MS_PER_MINUTE )
	);
}

module.exports = {
	estimateRemainingMs: estimateRemainingMs,
	describeRemaining: describeRemaining
};
