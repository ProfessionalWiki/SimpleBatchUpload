'use strict';

/**
 * One upload, over XMLHttpRequest.
 *
 * XHR rather than fetch, permanently rather than for now: the Fetch Standard
 * defines no way to observe how much of a request body has been sent.
 * Streaming request bodies will not provide it either. Since every row shows
 * how far its file has got, XHR is forced -- which is also why core's own
 * mw.Api#upload uses it.
 *
 * mw.Api#upload is not used, for a different reason. It rejects on any
 * `upload.warnings` key regardless of `upload.result`, so a file the wiki
 * stored and merely commented on is reported as a failure
 * (mediawiki.api/upload.js).
 *
 * Two response shapes matter and only one of them is an error. The API answers
 * HTTP 200 whatever happens, including for a refused rate limit, so a 200
 * carrying JSON is resolved and left to uploadResult.js to classify. A non-200 is something in
 * front of the wiki talking -- a proxy shedding a flood with a real 429 and an
 * HTML body -- and is rejected with the status so the runner can tell that case
 * from a dropped connection.
 */

/**
 * @param {Object} [options]
 * @param {string} [options.url] Where api.php lives
 * @param {Function} [options.createRequest] For tests
 * @return {{upload: Function}}
 */
function createUploader( options ) {
	const settings = options || {};
	const url = settings.url;
	const createRequest = settings.createRequest || ( () => new XMLHttpRequest() );

	/**
	 * @param {Object} params
	 * @param {?File} params.file The bytes, omitted when confirming a filekey
	 * @param {string} params.filename The name the wiki will store it under
	 * @param {string} params.token
	 * @param {string} [params.text] Wikitext for the file page
	 * @param {string} [params.comment] Upload summary
	 * @param {string} [params.filekey] Confirm a file the wiki already stashed,
	 *  which costs a kilobyte rather than the whole file again
	 * @param {boolean} [params.ignoreWarnings] Only once the warning the wiki
	 *  raised is answered, by the user or, where nothing is at risk, the batch
	 * @return {FormData}
	 */
	function bodyFor( params ) {
		const body = new FormData();

		body.append( 'action', 'upload' );
		body.append( 'format', 'json' );
		body.append( 'token', params.token );
		body.append( 'filename', params.filename );

		if ( params.text !== undefined ) {
			body.append( 'text', params.text );
		}

		if ( params.comment !== undefined ) {
			body.append( 'comment', params.comment );
		}

		if ( params.ignoreWarnings ) {
			body.append( 'ignorewarnings', '1' );
		}

		// A stashed file is addressed by key alone: the API refuses a request
		// carrying the bytes as well.
		if ( params.filekey ) {
			body.append( 'filekey', params.filekey );
		} else {
			body.append( 'file', params.file, params.filename );
		}

		return body;
	}

	/**
	 * @param {Object} params As for bodyFor()
	 * @param {Function} [onProgress] Called with a fraction between 0 and 1
	 * @return {Promise<Object>} The parsed response body. Rejects with an object
	 *  carrying `status` when the request never reached the API, or reached
	 *  something that answered with something other than JSON
	 */
	function upload( params, onProgress ) {
		return new Promise( ( resolve, reject ) => {
			const request = createRequest();

			request.open( 'POST', url );

			if ( onProgress ) {
				request.upload.onprogress = ( event ) => {
					// A request with no known length reports loaded bytes
					// against a total of zero, which is not a fraction.
					if ( event.lengthComputable && event.total ) {
						onProgress( event.loaded / event.total );
					}
				};
			}

			function fail( status ) {
				reject( { status: status } );
			}

			request.onload = () => {
				if ( request.status !== 200 ) {
					fail( request.status );
					return;
				}

				let body;

				try {
					body = JSON.parse( request.responseText );
				} catch ( notJson ) {
					// A 200 carrying HTML is a fatal exception page or an
					// intercepting portal, not an API answer.
					fail( 200 );
					return;
				}

				resolve( body );
			};

			request.onerror = () => fail( request.status || 0 );
			request.ontimeout = () => fail( request.status || 0 );

			request.send( bodyFor( params ) );
		} );
	}

	return { upload: upload };
}

module.exports = { createUploader: createUploader };
