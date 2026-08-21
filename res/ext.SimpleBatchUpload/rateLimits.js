'use strict';

/**
 * Reads the rate limits the wiki advertises for uploading.
 *
 * MediaWiki charges an upload against both the 'edit' and the 'upload' limiter
 * (UploadBase::verifyTitlePermissions), and a user can fall under several
 * categories of one action at once -- a registered newbie is charged as 'ip',
 * 'newbie' and 'user' together -- so the limit that actually binds is the most
 * restrictive of all of them.
 *
 * Restrictive means slowest sustained rate, not smallest count: 100 uploads a
 * day is far tighter than 8 a minute despite the larger number.
 */

// The actions an upload is charged against. Anything else the wiki reports is
// irrelevant here.
const CHARGED_ACTIONS = [ 'upload', 'edit' ];

/**
 * @param {?Object} bucket A { hits, seconds } pair from the API
 * @return {boolean}
 */
function usable( bucket ) {
	return !!bucket &&
		typeof bucket.hits === 'number' && bucket.hits > 0 &&
		typeof bucket.seconds === 'number' && bucket.seconds > 0;
}

/**
 * The limit an upload actually has to respect.
 *
 * @param {?Object} ratelimits The `ratelimits` object from
 *  action=query&meta=userinfo&uiprop=ratelimits. An empty object means the user
 *  holds noratelimit, which is unlimited rather than zero.
 * @return {?{hits: number, seconds: number, intervalMs: number, windowMs: number}}
 *  Null when nothing limits this user, in which case do not pace at all.
 */
function bindingLimit( ratelimits ) {
	const reported = ratelimits || {};

	const buckets = CHARGED_ACTIONS
		.reduce( ( found, action ) => found.concat(
			Object.keys( reported[ action ] || {} )
				.map( ( category ) => reported[ action ][ category ] )
		), [] )
		.filter( usable );

	if ( buckets.length === 0 ) {
		return null;
	}

	const binding = buckets.reduce( ( slowest, bucket ) => (
		bucket.seconds / bucket.hits > slowest.seconds / slowest.hits ? bucket : slowest
	) );

	return {
		hits: binding.hits,
		seconds: binding.seconds,
		// Spacing that keeps a sustained batch inside the limit.
		intervalMs: Math.ceil( binding.seconds / binding.hits * 1000 ),
		// How long an exhausted budget takes to refill, which is the longest a
		// wait can usefully be.
		windowMs: binding.seconds * 1000
	};
}

/**
 * The binding limit, read straight out of an API response.
 *
 * Kept here rather than in the DOM glue so the shape of the response is
 * covered by a test: a wrong path would otherwise degrade silently to "this
 * user is not limited", which is indistinguishable from the real thing.
 *
 * @param {?Object} response From action=query&meta=userinfo&uiprop=ratelimits
 * @return {?Object} See bindingLimit()
 */
function limitFromUserInfo( response ) {
	const userinfo = response && response.query && response.query.userinfo;

	return bindingLimit( userinfo && userinfo.ratelimits );
}

module.exports = {
	bindingLimit: bindingLimit,
	limitFromUserInfo: limitFromUserInfo
};
