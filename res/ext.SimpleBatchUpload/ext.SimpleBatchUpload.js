'use strict';

/**
 * Wires the vendored blueimp file upload widget to the MediaWiki upload API.
 *
 * Everything that can be decided without the DOM lives in the sibling modules;
 * this file is the jQuery and blueimp glue.
 *
 * @copyright (C) 2016 - 2017, Stephan Gambke
 * @license GPL-2.0-or-later
 */

const { resolveUserLimit, createBatchLimit } = require( './batchLimit.js' );
const { parseRenameDirective } = require( './renamePattern.js' );
const { createRateLimitGate } = require( './rateLimitGate.js' );
const { limitFromUserInfo } = require( './rateLimits.js' );
const { createUploadQueue } = require( './uploadQueue.js' );
const { createUploadRunner } = require( './uploadRunner.js' );
const { createResultRow, pruneFinishedRows } = require( './resultRow.js' );
const { filePageUrl } = require( './uploadResult.js' );
const { estimateRemainingMs, describeRemaining } = require( './remainingTime.js' );
const { showEstimate } = require( './estimateRow.js' );

// The rate limit is per user, so one gate and one queue serve every widget on
// the page. blueimp's own limit is set to the same number as a backstop.
const MAX_CONCURRENT_UPLOADS = 4;

const gate = createRateLimitGate();
const queue = createUploadQueue( { limit: MAX_CONCURRENT_UPLOADS } );
const runner = createUploadRunner( { gate: gate, queue: queue } );

$( () => {
	const api = new mw.Api();

	// The wiki publishes the limits it will enforce, so the queue can pace
	// itself to them instead of discovering them by being refused. Deliberately
	// not awaited: the widget has to work the moment the page is ready, and the
	// gate does not pace until something is refused anyway. A failed query
	// simply means no pacing.
	api.get( { action: 'query', meta: 'userinfo', uiprop: 'ratelimits' } ).then(
		( response ) => gate.useLimit( limitFromUserInfo( response ) ),
		( error ) => mw.log.warn( 'SimpleBatchUpload: could not read the rate limits', error )
	);
	const batchLimit = createBatchLimit( resolveUserLimit(
		mw.config.get( 'simpleBatchUploadMaxFilesPerBatch' ),
		mw.config.get( 'wgUserGroups' )
	) );

	const resultLists = [];

	/**
	 * Shows how much longer the wiki's rate limit will hold the batch up.
	 *
	 * Refreshed where its inputs change -- a file admitted, an upload refused,
	 * a file finished -- and never on a timer.
	 */
	function refreshEstimate() {
		const text = describeRemaining(
			estimateRemainingMs( batchLimit.active(), gate.schedule() )
		);

		// Gate, queue and batch limit are page-wide, so every widget shows the
		// same figure.
		resultLists.forEach( ( results ) => showEstimate( results, text ) );
	}

	function appendNotice( results, text ) {
		const notice = document.createElement( 'li' );
		notice.className = 'ful-notice';
		notice.textContent = text;
		results.appendChild( notice );
	}

	async function startUpload( widget, container, results, data ) {
		// Nothing here may throw outside the try: this runs detached from
		// blueimp's add() callback, so an escaping error becomes an unhandled
		// rejection and the file silently never reports back.
		let row = null;

		try {
			const description = $( container ).find( '[name="wfUploadDescription"]' ).val();
			const rename = parseRenameDirective( description );
			const sourceName = data.files[ 0 ].name;
			const targetName = rename.renameFile( sourceName );

			row = createResultRow( sourceName, targetName );
			results.appendChild( row.element );
			row.showQueued();
			data.resultRow = row;

			if ( rename.invalid ) {
				row.showError( mw.msg( 'simplebatchupload-error-rename-pattern' ), 'rename-error' );
				return;
			}

			let token;

			try {
				// Served from mw.Api's cache, which is seeded from mw.user.tokens:
				// a batch of any size costs zero token requests.
				token = await api.getToken( 'csrf' );
			} catch ( tokenFailure ) {
				row.showError( mw.msg( 'simplebatchupload-result-token-error' ), 'token-error' );
				return;
			}

			data.formData = {
				format: 'json',
				action: 'upload',
				token: token,
				ignorewarnings: 1,
				text: rename.text,
				comment: $( widget ).fileupload( 'option', 'comment' ),
				filename: targetName
			};

			const outcome = await runner.run(
				() => data.submit(),
				() => {
					row.showWaiting();
					refreshEstimate();
				},
				async () => {
					api.badToken( 'csrf' );
					data.formData.token = await api.getToken( 'csrf' );
				}
			);

			row.show( outcome, filePageUrl( outcome.filename ) );
		} catch ( unexpected ) {
			mw.log.error( unexpected );

			if ( row ) {
				row.showError( mw.msg( 'simplebatchupload-result-unknown-error' ), 'api-error' );
			}
		} finally {
			batchLimit.release();
			refreshEstimate();
		}
	}

	function initContainer( container ) {
		const results = container.querySelector( 'ul.fileupload-results' );
		resultLists.push( results );

		// blueimp calls add() once per file and hands every file of one
		// selection the same originalFiles array, which is how a new selection
		// is spotted.
		let selection = null;
		let admitted = 0;
		let limitReported = false;

		$( 'input.fileupload', container ).fileupload( {
			dataType: 'json',
			dropZone: $( '.fileupload-dropzone', container ),
			progressInterval: 100,
			limitConcurrentUploads: MAX_CONCURRENT_UPLOADS,

			add: function ( e, data ) {
				if ( data.originalFiles !== selection ) {
					selection = data.originalFiles;
					admitted = 0;
					limitReported = false;
					// A fresh selection is the user asking to try again.
					gate.resume();
					// Rows of uploads still running are deliberately kept.
					pruneFinishedRows( results );
				}

				if ( !batchLimit.admit() ) {
					if ( !limitReported ) {
						limitReported = true;
						appendNotice( results, mw.msg(
							'simplebatchupload-max-files-reached',
							admitted,
							selection.length
						) );
					}

					// Stops blueimp offering the rest of this selection.
					return false;
				}

				admitted += 1;
				refreshEstimate();
				startUpload( this, container, results, data );
			},

			progress: function ( e, data ) {
				// blueimp hands the callback a shallow copy of the add() data,
				// so the row reference survives.
				if ( data.resultRow && data.loaded !== data.total ) {
					data.resultRow.showProgress( data.loaded / data.total );
				}
			}
		} );
	}

	// Not NodeList.forEach: eslint-config-wikimedia forbids it for browsers
	// below the ResourceLoader baseline.
	Array.prototype.forEach.call(
		document.querySelectorAll( 'div.fileupload-container' ),
		initContainer
	);

	$( document ).on( 'drop dragover', ( e ) => {
		e.preventDefault();
	} );
} );
