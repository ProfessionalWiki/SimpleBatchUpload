'use strict';

/**
 * How much longer a rate limited batch has to run.
 *
 * Arithmetic on the schedule the gate already enforces, not a measurement of
 * throughput, so there is nothing here to smooth. It excludes transfer time and
 * can grow if the wiki refuses again, hence "about" and whole minutes.
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

	const remaining = schedule.waitMs + ( pending - 1 ) * schedule.intervalMs;

	// A single file released immediately is not being held up by anything, so
	// there is nothing to announce.
	return remaining > 0 ? remaining : null;
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

	// Rounded up because the figure excludes transfer time and so is already an
	// underestimate; ceil keeps it an upper bound. Whole minutes also keep the
	// live region quiet: the text changes once a minute, not on every refresh.
	return mw.msg(
		'simplebatchupload-estimate-minutes',
		Math.ceil( ms / MS_PER_MINUTE )
	);
}

module.exports = {
	estimateRemainingMs: estimateRemainingMs,
	describeRemaining: describeRemaining
};
