'use strict';

const { classifyUploadResponse, uploadOutcome } = require( './uploadResult.js' );

// A second bound on the retry loop, independent of the gate. The gate is the
// one that gives up on a batch, and it starts counting again whenever an attempt
// is not refused, so a file queued behind a long run of others getting through
// can be refused many times before its turn comes. One that reaches this bound is not failed: it
// goes back among the files waiting, and the batch sends it again.
const MAX_ATTEMPTS_PER_FILE = 40;

/**
 * Runs one file upload to completion: through the concurrency queue, behind the
 * rate limit gate, retrying for as long as the gate allows.
 *
 * @param {Object} options
 * @param {Object} options.gate
 * @param {Object} options.queue
 * @param {number} [options.maxAttempts]
 * @return {Object}
 */
function createUploadRunner( options ) {
	const gate = options.gate;
	const queue = options.queue;
	const maxAttempts = options.maxAttempts === undefined ?
		MAX_ATTEMPTS_PER_FILE :
		options.maxAttempts;

	async function attempt( submit ) {
		const allowed = await gate.wait();

		if ( !allowed ) {
			return uploadOutcome( 'stopped' );
		}

		let response;

		try {
			response = await submit();
		} catch ( transportFailure ) {
			// A proxy in front of the wiki may shed a flood with a real 429 and
			// an HTML body, which never reaches the JSON classifier. That is the
			// limiter talking, just not MediaWiki's.
			if ( transportFailure && transportFailure.status === 429 ) {
				gate.noteRateLimited();
				return uploadOutcome( 'ratelimited' );
			}

			// Any other transport failure is not the limiter talking.
			gate.noteProgress();
			return uploadOutcome( 'network-error' );
		}

		const outcome = classifyUploadResponse( response );

		// Told to the gate before the permit is released, so the next file in
		// the queue sees the closed gate rather than racing past it.
		if ( outcome.status === 'ratelimited' ) {
			gate.noteRateLimited();
		} else {
			gate.noteProgress();
		}

		return outcome;
	}

	/**
	 * @param {Function} submit Returns a promise for the parsed API response
	 * @param {Function} [onRateLimited] Called each time an attempt is deferred
	 * @param {Function} [refreshToken] Fetches a fresh CSRF token, awaited once
	 *  if the wiki reports the batch's token as stale
	 * @return {Promise<Object>} The outcome of the final attempt
	 */
	async function run( submit, onRateLimited, refreshToken ) {
		let attempts = 0;
		let tokenRefreshed = false;

		for ( ;; ) {
			const outcome = await queue.run( () => attempt( submit ) );
			attempts += 1;

			if ( outcome.status === 'badtoken' ) {
				if ( tokenRefreshed || !refreshToken ) {
					return uploadOutcome( 'error', { info: outcome.info } );
				}

				tokenRefreshed = true;
				await refreshToken();
				continue;
			}

			if ( outcome.status !== 'ratelimited' ) {
				return outcome;
			}

			if ( attempts >= maxAttempts ) {
				return uploadOutcome( 'stopped' );
			}

			if ( onRateLimited ) {
				onRateLimited();
			}
		}
	}

	return { run: run };
}

module.exports = { createUploadRunner: createUploadRunner };
