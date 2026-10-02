'use strict';

/**
 * A file's size, in the wiki's own words.
 *
 * Megabytes and gigabytes keep one decimal, because the size is often what
 * separates two files sharing a name: 2 MB beside 2 MB says nothing, where
 * 2.1 MB beside 1.8 MB says they are different photographs. Below that a
 * decimal is noise. The unit messages are core's own, so there are no new keys
 * to translate.
 */

// * size-bytes
// * size-kilobytes
// * size-megabytes
// * size-gigabytes
const UNIT_MESSAGES = [ 'size-bytes', 'size-kilobytes', 'size-megabytes', 'size-gigabytes' ];

const FIRST_UNIT_WITH_A_DECIMAL = 2;

/**
 * @param {?number} bytes
 * @return {string} Empty when there is no size to describe
 */
function describeSize( bytes ) {
	if ( typeof bytes !== 'number' || isNaN( bytes ) ) {
		return '';
	}

	let size = bytes;
	let unit = 0;

	while ( size >= 1024 && unit < UNIT_MESSAGES.length - 1 ) {
		size /= 1024;
		unit += 1;
	}

	const rounded = unit >= FIRST_UNIT_WITH_A_DECIMAL ?
		Math.round( size * 10 ) / 10 :
		Math.round( size );

	// Digits and the decimal mark are the interface language's: 2,1 MB in German.
	return mw.msg( UNIT_MESSAGES[ unit ], mw.language.convertNumber( rounded ) );
}

module.exports = { describeSize: describeSize };
