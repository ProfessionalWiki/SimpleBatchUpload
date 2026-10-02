'use strict';

/**
 * Runs at most `limit` tasks at a time, in the order they were queued.
 *
 * The rate limit gate is consulted from inside a task that already holds a
 * permit, so a batch that runs into the limit stops after at most `limit`
 * further requests instead of offering the whole selection to the limiter.
 *
 * @param {Object} [options]
 * @param {number} [options.limit]
 * @return {Object}
 */
function createUploadQueue( options ) {
	const limit = ( options && options.limit ) || 1;
	const waiting = [];
	let running = 0;

	/**
	 * @param {Function} task Returns a promise
	 * @return {Promise} Settles with the task's result
	 */
	function run( task ) {
		return new Promise( ( resolve, reject ) => {
			waiting.push( () => {
				running += 1;

				Promise.resolve().then( task ).then(
					( value ) => {
						finish();
						resolve( value );
					},
					( error ) => {
						finish();
						reject( error );
					}
				);
			} );

			startNext();
		} );
	}

	function startNext() {
		if ( running >= limit || waiting.length === 0 ) {
			return;
		}

		waiting.shift()();
	}

	function finish() {
		running -= 1;
		startNext();
	}

	return {
		run: run,
		running: () => running,
		waiting: () => waiting.length
	};
}

module.exports = { createUploadQueue: createUploadQueue };
