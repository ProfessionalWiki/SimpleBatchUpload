'use strict';

/**
 * @param {string} status
 * @param {Object} [extra]
 * @return {{status: string, info: ?string, filename: ?string, warnings: Object}}
 */
function uploadOutcome( status, extra ) {
	return Object.assign(
		{ status: status, info: null, filename: null, warnings: {} },
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
 * @param {?Object} response
 * @return {{status: string, info: ?string, filename: ?string, warnings: Object}}
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

	if ( upload.result ) {
		return uploadOutcome( 'not-uploaded', { warnings: upload.warnings || {} } );
	}

	return uploadOutcome( 'error' );
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
	filePageUrl: filePageUrl,
	uploadOutcome: uploadOutcome
};
