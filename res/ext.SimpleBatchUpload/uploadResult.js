'use strict';

// Warnings that mean a file already on the wiki would be replaced. Only the
// user can answer those. Every other warning the API raises is about something
// that is merely worth saying -- the same bytes under another name, a name that
// was deleted before, a similarly named file (exists-normalized, which the wiki
// raises only when the exact name is free) -- and earlier versions of this
// extension sent ignorewarnings=1 past all of them without asking.
const OVERWRITE_WARNINGS = [ 'exists' ];

/**
 * @param {string} status
 * @param {Object} [extra]
 * @return {{status: string, info: ?string, filename: ?string, filekey: ?string,
 *  warnings: Object}}
 */
function uploadOutcome( status, extra ) {
	return Object.assign(
		{ status: status, info: null, filename: null, filekey: null, warnings: {} },
		extra || {}
	);
}

/**
 * Classifies an action=upload response body.
 *
 * The API answers with HTTP 200 whatever happens, so success has to be read off
 * upload.result rather than inferred from the absence of an error: a stashed
 * 'Warning' result carries no error and did not store the file. With
 * ignorewarnings set the server still reports its warnings next to a successful
 * upload (ApiUpload::performUpload), which is where duplicate and exists come
 * from.
 *
 * Without ignorewarnings the API keeps the bytes it already received in the
 * upload stash and answers 'Warning' with a filekey. That is what lets the
 * interface ask before overwriting anything: going ahead afterwards costs a
 * request carrying the key rather than the file. Where the stash cannot keep
 * them -- it refuses anyone not logged in -- the warning comes without a key,
 * and going ahead sends the file again.
 *
 * @param {?Object} response
 * @return {{status: string, info: ?string, filename: ?string, filekey: ?string,
 *  warnings: Object}}
 */
function classifyUploadResponse( response ) {
	const body = response || {};

	if ( body.error ) {
		if ( body.error.code === 'ratelimited' ) {
			return uploadOutcome( 'ratelimited' );
		}

		// Refused because the wiki already holds this exact content under this
		// exact title. LocalFile::recordUpload3 returns this before writing
		// anything, so the file is present with the content that was selected.
		// Reporting it as a failure would make a retry after an ambiguous
		// result look like an error when nothing is wrong.
		if ( body.error.code === 'fileexists-no-change' ) {
			return uploadOutcome( 'success', { warnings: { 'no-change': [] } } );
		}

		// The token is fetched once per batch, so a session that rotates midway
		// through invalidates every file still to come. Recoverable, once.
		if ( body.error.code === 'badtoken' ) {
			return uploadOutcome( 'badtoken', {
				info: body.error.info || body.error.code
			} );
		}

		return uploadOutcome( 'error', {
			info: body.error.info || body.error.code || null
		} );
	}

	const upload = body.upload || {};

	if ( upload.result === 'Success' ) {
		return uploadOutcome( 'success', {
			filename: upload.filename || null,
			warnings: upload.warnings || {}
		} );
	}

	if ( upload.result === 'Warning' ) {
		const warnings = upload.warnings || {};
		const overwrites = OVERWRITE_WARNINGS.some( ( name ) => name in warnings );

		return uploadOutcome( overwrites ? 'held' : 'confirmable', {
			filekey: upload.filekey || null,
			warnings: warnings
		} );
	}

	return uploadOutcome( 'error' );
}

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
 * URL of the file page for an uploaded file.
 *
 * @param {?string} filename
 * @return {?string} Null when no file page can be addressed.
 */
function filePageUrl( filename ) {
	if ( !filename ) {
		return null;
	}

	const title = mw.Title.newFromFileName( filename );

	return title ? title.getUrl() : null;
}

module.exports = {
	classifyUploadResponse: classifyUploadResponse,
	describeWarnings: describeWarnings,
	filePageUrl: filePageUrl,
	uploadOutcome: uploadOutcome
};
