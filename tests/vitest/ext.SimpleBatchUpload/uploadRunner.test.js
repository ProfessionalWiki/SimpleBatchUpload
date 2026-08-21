const { createUploadRunner } = require( '../../../res/ext.SimpleBatchUpload/uploadRunner.js' );
const { createRateLimitGate } = require( '../../../res/ext.SimpleBatchUpload/rateLimitGate.js' );
const { createUploadQueue } = require( '../../../res/ext.SimpleBatchUpload/uploadQueue.js' );
const { createFakeClock } = require( '../fakeClock.js' );

const RATE_LIMITED = { error: { code: 'ratelimited', info: 'exceeded' } };

function success( filename ) {
	return { upload: { result: 'Success', filename: filename } };
}

function gateOn( clock, gateOptions ) {
	return createRateLimitGate( Object.assign(
		{ now: clock.now, sleep: clock.sleep },
		gateOptions || {}
	) );
}

function runnerOn( clock, gateOptions ) {
	return createUploadRunner( {
		gate: gateOn( clock, gateOptions ),
		queue: createUploadQueue( { limit: 4 } )
	} );
}

/**
 * @param {Array} responses Served in order, the last one repeating
 * @return {Function}
 */
function serving( responses ) {
	const remaining = responses.slice();

	return () => Promise.resolve(
		remaining.length > 1 ? remaining.shift() : remaining[ 0 ]
	);
}

describe( 'createUploadRunner', () => {
	it( 'reports a file the wiki rate limited as uploaded once it goes through', async () => {
		const clock = createFakeClock();
		const submit = serving( [ RATE_LIMITED, RATE_LIMITED, success( 'A.png' ) ] );

		const outcome = await runnerOn( clock ).run( submit );

		expect( outcome.status ).toBe( 'success' );
		expect( outcome.filename ).toBe( 'A.png' );
	} );

	it( 'waits longer after each consecutive rate limit refusal', async () => {
		const clock = createFakeClock();
		const submit = serving( [ RATE_LIMITED, RATE_LIMITED, success( 'A.png' ) ] );

		await runnerOn( clock ).run( submit );

		expect( clock.now() ).toBe( 6000 );
	} );

	it( 'tells the caller each time a file is held back', async () => {
		const clock = createFakeClock();
		const submit = serving( [ RATE_LIMITED, RATE_LIMITED, success( 'A.png' ) ] );
		const heldBack = vi.fn();

		await runnerOn( clock ).run( submit, heldBack );

		expect( heldBack ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'uploads every file of a batch the wiki rate limits partway through', async () => {
		const clock = createFakeClock();
		const runner = runnerOn( clock );
		let offered = 0;
		const submit = ( name ) => () => {
			offered += 1;
			return Promise.resolve(
				offered > 8 && offered <= 12 ? RATE_LIMITED : success( name )
			);
		};
		const names = [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l' ];

		const outcomes = await Promise.all(
			names.map( ( name ) => runner.run( submit( name + '.png' ) ) )
		);

		expect( outcomes.map( ( outcome ) => outcome.status ) )
			.toEqual( names.map( () => 'success' ) );
	} );

	it( 'gives up on a file once the batch has been stopped', async () => {
		const clock = createFakeClock();
		const runner = runnerOn( clock, { maxRetries: 0 } );
		const submit = serving( [ RATE_LIMITED ] );

		const outcome = await runner.run( submit );

		expect( outcome.status ).toBe( 'stopped' );
	} );

	it( 'does not offer a file to the server after the batch has been stopped', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock, { maxRetries: 0 } );
		gate.noteRateLimited();
		const runner = createUploadRunner( {
			gate: gate,
			queue: createUploadQueue( { limit: 4 } )
		} );
		const submit = vi.fn( () => Promise.resolve( success( 'A.png' ) ) );

		const outcome = await runner.run( submit );

		expect( outcome.status ).toBe( 'stopped' );
		expect( submit ).not.toHaveBeenCalled();
	} );

	it( 'reports a transport failure without retrying it', async () => {
		const clock = createFakeClock();
		const submit = vi.fn( () => Promise.reject( new Error( 'offline' ) ) );

		const outcome = await runnerOn( clock ).run( submit );

		expect( outcome.status ).toBe( 'network-error' );
		expect( submit ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'bounding the retry loop', () => {
	it( 'gives up on a file the wiki keeps refusing, without waiting for the gate', async () => {
		const clock = createFakeClock();
		// A gate that never halts, standing in for a limiter that never drains.
		const neverHalting = {
			wait: () => Promise.resolve( true ),
			noteRateLimited: () => {},
			noteProgress: () => {},
			stopped: () => false
		};
		const runner = createUploadRunner( {
			gate: neverHalting,
			queue: createUploadQueue( { limit: 1 } ),
			maxAttempts: 3
		} );
		const submit = vi.fn( () => Promise.resolve( RATE_LIMITED ) );

		const outcome = await runner.run( submit );

		// Reported as stopped, not as a raw rate limit: from the user's side this
		// file was given up on because of the limit, which is what 'stopped' says.
		expect( outcome.status ).toBe( 'stopped' );
		expect( submit ).toHaveBeenCalledTimes( 3 );
		expect( clock.now() ).toBe( 0 );
	} );
} );

describe( 'a proxy answering with HTTP 429', () => {
	it( 'treats it as a rate limit rather than a broken connection', async () => {
		const clock = createFakeClock();
		let offered = 0;
		const submit = vi.fn( () => {
			offered += 1;

			if ( offered === 1 ) {
				// jQuery rejects with the jqXHR first.
				return Promise.reject( { status: 429, responseText: '<html>429</html>' } );
			}

			return Promise.resolve( success( 'A.png' ) );
		} );

		const outcome = await runnerOn( clock ).run( submit );

		expect( outcome.status ).toBe( 'success' );
		expect( submit ).toHaveBeenCalledTimes( 2 );
	} );
} );

describe( 'a CSRF token that went stale mid-batch', () => {
	const STALE_TOKEN = { error: { code: 'badtoken', info: 'Invalid CSRF token.' } };

	it( 'fetches a fresh token and uploads the file', async () => {
		const clock = createFakeClock();
		const submit = serving( [ STALE_TOKEN, success( 'A.png' ) ] );
		const refreshToken = vi.fn( () => Promise.resolve() );

		const outcome = await runnerOn( clock ).run( submit, null, refreshToken );

		expect( outcome.status ).toBe( 'success' );
		expect( refreshToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'reports the failure rather than refreshing the token forever', async () => {
		const clock = createFakeClock();
		const submit = vi.fn( () => Promise.resolve( STALE_TOKEN ) );
		const refreshToken = vi.fn( () => Promise.resolve() );

		const outcome = await runnerOn( clock ).run( submit, null, refreshToken );

		expect( outcome.status ).toBe( 'error' );
		expect( refreshToken ).toHaveBeenCalledTimes( 1 );
		expect( submit ).toHaveBeenCalledTimes( 2 );
	} );
} );
