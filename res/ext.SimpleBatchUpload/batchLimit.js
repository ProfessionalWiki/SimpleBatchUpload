'use strict';

/**
 * How many files one user may have in a batch at once.
 *
 * How many of those slots are taken is the batch's own business: a slot is held
 * by any file that has not finished, whatever it is waiting for.
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

module.exports = { resolveUserLimit: resolveUserLimit };
