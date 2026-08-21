'use strict';

/**
 * How many files one user may have in a batch, and how many of those slots are
 * still taken by uploads that are queued or in flight.
 */

/**
 * @param {?Object} limitsByGroup $wgSimpleBatchUploadMaxFilesPerBatch
 * @param {?string[]} userGroups wgUserGroups, which includes the implicit '*' and 'user'
 * @return {number} The highest limit granted to any of the user's groups
 */
function resolveUserLimit( limitsByGroup, userGroups ) {
	const groups = userGroups || [];
	const limits = limitsByGroup || {};

	return Object.keys( limits )
		.filter( ( group ) => groups.includes( group ) )
		.reduce( ( highest, group ) => Math.max( highest, limits[ group ] ), 0 );
}

/**
 * Counts the uploads that are queued or in flight, so the limit applies to the
 * batch as it stands rather than to one file selection. Selecting 3 files while
 * 999 of a 1000 file limit are still running leaves room for one.
 *
 * @param {number} limit
 * @return {Object}
 */
function createBatchLimit( limit ) {
	let active = 0;

	/**
	 * @return {boolean} True if a slot was taken for this file
	 */
	function admit() {
		if ( active >= limit ) {
			return false;
		}

		active += 1;
		return true;
	}

	function release() {
		active = Math.max( 0, active - 1 );
	}

	return {
		admit: admit,
		release: release,
		remaining: () => Math.max( 0, limit - active ),
		limit: () => limit
	};
}

module.exports = {
	resolveUserLimit: resolveUserLimit,
	createBatchLimit: createBatchLimit
};
