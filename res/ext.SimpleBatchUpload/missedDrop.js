'use strict';

/**
 * A file dropped anywhere but on a panel makes the browser leave the page to
 * open it, taking every file still waiting with it.
 */

/**
 * @param {Event} event
 * @return {boolean}
 */
function carriesFiles( event ) {
	return Array.prototype.indexOf.call( event.dataTransfer.types, 'Files' ) !== -1;
}

/**
 * Turns away files dropped outside a panel. Dragged text still lands in a text
 * field, the description's included.
 *
 * @param {EventTarget} page
 */
function catchMissedDrops( page ) {
	const turnAway = ( event ) => {
		if ( carriesFiles( event ) ) {
			event.preventDefault();
		}
	};

	page.addEventListener( 'dragover', turnAway );
	page.addEventListener( 'drop', turnAway );
}

module.exports = { catchMissedDrops: catchMissedDrops };
