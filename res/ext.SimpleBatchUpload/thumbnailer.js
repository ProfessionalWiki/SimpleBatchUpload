'use strict';

/**
 * Previews, made off the main thread.
 *
 * Decoding a photograph costs about 4 ms per megapixel, and one file is a
 * single indivisible unit of that, so on the main thread it drops frames
 * however it is scheduled.
 *
 * What fixes it is being off the thread that paints, not the parallelism: one
 * lane, with the same compute per file, is already smooth. Extra lanes make it
 * faster where there are cores to spare, which is a bonus rather than the
 * point -- weak hardware is where this helps most.
 *
 * Where the worker cannot be built the answer is no previews: falling back to
 * the main thread would put the stalls on exactly the weakest machines.
 */

const { isThumbnailable, THUMBNAIL_PX } = require( './thumbnail.js' );

// Kept as a string because a Worker needs a URL, and a blob URL is the only one
// ResourceLoader can give us without shipping a second entry point. It is short
// on purpose: it is the one part of this extension that no linter checks.
//
// createImageBitmap decodes off-thread, OffscreenCanvas scales without a DOM,
// and FileReaderSync exists only in workers -- so the base64 encoding stays off
// the main thread too, and what comes back is a plain string with no object URL
// to revoke. A JPEG has no transparency, and what was transparent comes out
// black unless something is painted under it first.
const WORKER_SOURCE = [
	'self.onmessage = function ( event ) {',
	'    var data = event.data;',
	'    createImageBitmap( data.file ).then( function ( bitmap ) {',
	'        var canvas = new OffscreenCanvas( data.px, data.px );',
	'        var context = canvas.getContext( "2d" );',
	'        var side = Math.min( bitmap.width, bitmap.height );',
	'        context.fillStyle = "#fff";',
	'        context.fillRect( 0, 0, data.px, data.px );',
	'        context.drawImage(',
	'            bitmap,',
	'            ( bitmap.width - side ) / 2, ( bitmap.height - side ) / 2, side, side,',
	'            0, 0, data.px, data.px',
	'        );',
	'        bitmap.close();',
	'        return canvas.convertToBlob( { type: "image/jpeg", quality: 0.7 } );',
	'    } ).then( function ( blob ) {',
	'        self.postMessage( {',
	'            id: data.id,',
	'            dataUrl: new FileReaderSync().readAsDataURL( blob )',
	'        } );',
	'    } ).catch( function ( error ) {',
	'        self.postMessage( { id: data.id, error: String( error ) } );',
	'    } );',
	'};'
].join( '\n' );

/**
 * Whether this browser can decode and scale away from the main thread.
 *
 * Two of them arrived long after the extension's Safari 11.1 floor -- 15 for
 * createImageBitmap, 16.4 for OffscreenCanvas -- so this is an enhancement, and
 * a lot of installs will not get it.
 *
 * @return {boolean}
 */
function canThumbnailOffThread() {
	return typeof Worker === 'function' &&
		typeof OffscreenCanvas === 'function' &&
		typeof createImageBitmap === 'function';
}

/**
 * How many decodes to keep in flight.
 *
 * Lanes only pay off where there are cores to run them, and a two core machine
 * running eight of them just queues them somewhere less visible.
 *
 * @return {number}
 */
function defaultConcurrency() {
	// Missing in some browsers the linter checks against, where the fallback
	// answers instead.
	// eslint-disable-next-line compat/compat
	return Math.min( 4, navigator.hardwareConcurrency || 2 );
}

/**
 * @return {?Worker} Null where the browser cannot run one. Throws where a
 *  Content-Security-Policy refuses the blob URL
 */
function spawnWorker() {
	if ( !canThumbnailOffThread() ) {
		return null;
	}

	const url = URL.createObjectURL( new Blob( [ WORKER_SOURCE ], { type: 'text/javascript' } ) );
	const worker = new Worker( url );

	// The worker holds its own reference now, and leaving this one alive would
	// pin the blob for the life of the document.
	URL.revokeObjectURL( url );

	return worker;
}

/**
 * @param {Object} [options]
 * @param {Function} [options.createWorker] For tests
 * @param {number} [options.concurrency]
 * @return {?{thumbnail: Function}} Null when previews are not available at all,
 *  and every row keeps its placeholder
 */
function createThumbnailer( options ) {
	const settings = options || {};
	const createWorker = settings.createWorker || spawnWorker;
	const concurrency = settings.concurrency || defaultConcurrency();

	let worker;

	try {
		worker = createWorker();
	} catch ( refused ) {
		return null;
	}

	if ( !worker ) {
		return null;
	}

	const waiting = new Map();
	const queued = [];
	let inFlight = 0;
	let nextId = 0;

	function pump() {
		while ( inFlight < concurrency && queued.length ) {
			const job = queued.shift();

			inFlight += 1;
			waiting.set( job.id, job.settle );
			worker.postMessage( { id: job.id, file: job.file, px: THUMBNAIL_PX } );
		}
	}

	worker.onmessage = ( event ) => {
		const settle = waiting.get( event.data.id );

		if ( !settle ) {
			return;
		}

		waiting.delete( event.data.id );
		inFlight -= 1;
		// A file the decoder choked on is not an error the batch should hear
		// about: the upload is unaffected and the row falls back to its icon.
		settle( event.data.dataUrl || null );
		pump();
	};

	/**
	 * @param {File} file
	 * @return {Promise<?string>} A data URL, or null for no preview
	 */
	function thumbnail( file ) {
		if ( !isThumbnailable( file ) ) {
			return Promise.resolve( null );
		}

		nextId += 1;

		return new Promise( ( resolve ) => {
			queued.push( { id: nextId, file: file, settle: resolve } );
			pump();
		} );
	}

	return { thumbnail: thumbnail };
}

module.exports = { createThumbnailer: createThumbnailer };
