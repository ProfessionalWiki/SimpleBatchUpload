'use strict';

/**
 * ignorewarnings=1 does not silence the server's warnings, it only stops them
 * from blocking the upload, so duplicate and exists still arrive next to a
 * successful result and are worth showing.
 *
 * @param {?Object} warnings
 * @return {string[]}
 */
function describeWarnings( warnings ) {
	const reported = warnings || {};
	const notes = [];
	const duplicates = reported.duplicate;

	if ( duplicates && duplicates.length ) {
		notes.push( mw.msg(
			'simplebatchupload-warning-duplicate',
			duplicates.join( ', ' ),
			duplicates.length
		) );
	}

	if ( reported.exists ) {
		notes.push( mw.msg( 'simplebatchupload-warning-exists', reported.exists ) );
	}

	if ( reported[ 'no-change' ] ) {
		notes.push( mw.msg( 'simplebatchupload-warning-no-change' ) );
	}

	const others = Object.keys( reported ).filter(
		( name ) => name !== 'duplicate' && name !== 'exists' && name !== 'no-change'
	);

	if ( others.length ) {
		notes.push( mw.msg(
			'simplebatchupload-warning-other',
			others.join( ', ' ),
			others.length
		) );
	}

	return notes;
}

/**
 * One <li> in the result list: the file name, its status, and -- once the
 * upload lands -- a link to the file page.
 *
 * The name and the status are separate nodes. The previous implementation kept
 * the name in the row's text and in jQuery .data(), so every status update had
 * to rebuild the label, and clearing the list dropped the data of rows whose
 * upload was still running.
 *
 * @param {string} sourceName
 * @param {string} targetName
 * @return {Object}
 */
function createResultRow( sourceName, targetName ) {
	const element = document.createElement( 'li' );
	const label = sourceName === targetName ?
		sourceName :
		mw.msg( 'simplebatchupload-rename-label', sourceName, targetName );

	const nameNode = document.createElement( 'span' );
	nameNode.className = 'fileupload-result-name';
	nameNode.textContent = label;

	const statusNode = document.createElement( 'span' );
	statusNode.className = 'fileupload-result-status';

	element.appendChild( nameNode );
	element.appendChild( document.createTextNode( ' ' ) );
	element.appendChild( statusNode );

	function setStatus( text ) {
		statusNode.textContent = text;
	}

	function linkName( fileUrl ) {
		const link = document.createElement( 'a' );
		link.setAttribute( 'href', fileUrl );
		link.textContent = label;

		nameNode.textContent = '';
		nameNode.appendChild( link );
	}

	function showSuccess( fileUrl, warnings ) {
		element.classList.add( 'ful-success' );

		if ( fileUrl ) {
			linkName( fileUrl );
		}

		setStatus( [ mw.msg( 'simplebatchupload-result-success' ) ]
			.concat( describeWarnings( warnings ) )
			.join( ' ' ) );
	}

	/**
	 * @param {string} text
	 * @param {string} [kind] Extra class, kept for wikis styling api-error,
	 *  server-error or token-error
	 */
	function showError( text, kind ) {
		element.classList.remove( 'ful-success' );
		element.classList.add( 'ful-error' );

		if ( kind ) {
			element.classList.add( kind );
		}

		setStatus( mw.msg( 'simplebatchupload-result-error', text ) );
	}

	/**
	 * @param {Object} outcome From classifyUploadResponse, or the runner's
	 *  'stopped' and 'network-error'
	 * @param {?string} fileUrl
	 */
	function show( outcome, fileUrl ) {
		switch ( outcome.status ) {
			case 'success':
				showSuccess( fileUrl, outcome.warnings );
				break;
			case 'not-uploaded':
				showError( mw.msg(
					'simplebatchupload-result-not-uploaded',
					Object.keys( outcome.warnings || {} ).join( ', ' )
				), 'api-error' );
				break;
			case 'network-error':
				showError( mw.msg( 'simplebatchupload-result-network-error' ), 'server-error' );
				break;
			case 'stopped':
				showError( mw.msg( 'simplebatchupload-result-rate-limit-stopped' ), 'ratelimit-error' );
				break;
			default:
				showError(
					outcome.info || mw.msg( 'simplebatchupload-result-unknown-error' ),
					'api-error'
				);
		}
	}

	function showQueued() {
		setStatus( mw.msg( 'simplebatchupload-result-queued' ) );
	}

	function showWaiting() {
		setStatus( mw.msg( 'simplebatchupload-result-rate-limited' ) );
	}

	function showProgress( fraction ) {
		setStatus( Math.floor( fraction * 100 ) + '%' );
	}

	return {
		element: element,
		show: show,
		showError: showError,
		showQueued: showQueued,
		showWaiting: showWaiting,
		showProgress: showProgress
	};
}

// A row is finished once it carries one of these. Anything else is still
// queued, waiting on the rate limit, or uploading.
//
// ful-estimate is deliberately absent: it is not an upload row, and it has to
// survive a new selection started while an earlier batch is still going.
const FINISHED_ROW_CLASSES = [ 'ful-success', 'ful-error', 'ful-notice' ];

/**
 * Removes rows whose upload has finished, leaving those still in flight.
 *
 * Called when a new selection starts, so a page used for batch after batch does
 * not grow an unbounded list. Uploads still running keep their row: clearing
 * those was the original bug.
 *
 * @param {HTMLElement} list The ul.fileupload-results element
 */
function pruneFinishedRows( list ) {
	Array.prototype.slice.call( list.children )
		.filter( ( row ) => FINISHED_ROW_CLASSES.some(
			( finished ) => row.classList.contains( finished )
		) )
		.forEach( ( row ) => row.remove() );
}

module.exports = {
	createResultRow: createResultRow,
	pruneFinishedRows: pruneFinishedRows
};
