'use strict';

/**
 * Which files are worth previewing, and how big a preview is. The work itself
 * is thumbnailer.js's, in a worker.
 */

// The same cap core puts on its own Special:Upload preview.
const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;

const THUMBNAIL_PX = 80;

// Raster formats every supported browser can decode. SVG is deliberately absent:
// createImageBitmap will not decode one in a worker, and the placeholder covers
// it.
const PREVIEWABLE_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp'
];

/**
 * Whether a preview is worth attempting.
 *
 * @param {?File} file
 * @return {boolean}
 */
function isThumbnailable( file ) {
	if ( !file || !file.type || !file.size ) {
		return false;
	}

	if ( file.size >= MAX_THUMBNAIL_BYTES ) {
		return false;
	}

	return PREVIEWABLE_TYPES.includes( file.type );
}

module.exports = {
	isThumbnailable: isThumbnailable,
	THUMBNAIL_PX: THUMBNAIL_PX
};
