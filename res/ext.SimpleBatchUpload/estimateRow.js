'use strict';

/**
 * The one row that says how much longer the wiki's rate limit will hold the
 * batch up. Kept above the file rows, and taken away when there is nothing to
 * say.
 */

/**
 * @param {HTMLElement} list The ul.fileupload-results element
 * @param {?string} text Null to take the row away
 */
function showEstimate( list, text ) {
	let row = list.querySelector( 'li.ful-estimate' );

	if ( !text ) {
		if ( row ) {
			row.remove();
		}

		return;
	}

	if ( !row ) {
		row = document.createElement( 'li' );
		row.className = 'ful-estimate';

		// The live region is a child rather than the <li> itself: role="status"
		// on the <li> would replace its listitem role, and the list would
		// announce one fewer item than it has.
		const region = document.createElement( 'span' );
		region.setAttribute( 'role', 'status' );
		row.appendChild( region );

		list.insertBefore( row, list.firstChild );
	}

	const announced = row.firstChild;

	// Rewriting an unchanged live region announces it again.
	if ( announced.textContent !== text ) {
		announced.textContent = text;
	}
}

module.exports = { showEstimate: showEstimate };
