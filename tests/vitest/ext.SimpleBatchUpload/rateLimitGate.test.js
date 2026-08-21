const {
	retryDelay,
	createRateLimitGate
} = require( '../../../res/ext.SimpleBatchUpload/rateLimitGate.js' );
const { createFakeClock } = require( '../fakeClock.js' );

function gateOn( clock, maxRetries ) {
	return createRateLimitGate( {
		now: clock.now,
		sleep: clock.sleep,
		maxRetries: maxRetries
	} );
}

describe( 'retryDelay', () => {
	it( 'doubles the wait for each consecutive rejection', () => {
		expect( [ retryDelay( 1 ), retryDelay( 2 ), retryDelay( 3 ) ] )
			.toEqual( [ 2000, 4000, 8000 ] );
	} );

	it( 'caps the wait at a minute', () => {
		expect( retryDelay( 20 ) ).toBe( 60000 );
	} );
} );

describe( 'createRateLimitGate', () => {
	it( 'lets an upload through immediately while nothing was refused', async () => {
		const clock = createFakeClock();

		await expect( gateOn( clock ).wait() ).resolves.toBe( true );

		expect( clock.now() ).toBe( 0 );
	} );

	it( 'holds the next upload back for the backoff delay after a refusal', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock );

		gate.noteRateLimited();
		await gate.wait();

		expect( clock.now() ).toBe( 2000 );
	} );

	it( 'does not lengthen the wait when concurrent uploads report the same overrun', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock );

		gate.noteRateLimited();
		gate.noteRateLimited();
		gate.noteRateLimited();
		await gate.wait();

		expect( clock.now() ).toBe( 2000 );
	} );

	it( 'lengthens the wait when a refusal arrives after the previous wait expired', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock );

		gate.noteRateLimited();
		await gate.wait();
		gate.noteRateLimited();
		await gate.wait();

		expect( clock.now() ).toBe( 6000 );
	} );

	it( 'forgets earlier refusals once an upload gets through', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock );

		gate.noteRateLimited();
		await gate.wait();
		gate.noteProgress();
		gate.noteRateLimited();
		await gate.wait();

		expect( clock.now() ).toBe( 4000 );
	} );

	it( 'stops the batch after too many consecutive refusals', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock, 1 );

		gate.noteRateLimited();
		await gate.wait();
		gate.noteRateLimited();

		await expect( gate.wait() ).resolves.toBe( false );
		expect( gate.stopped() ).toBe( true );
	} );

	it( 'accepts uploads again after resuming', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock, 0 );

		gate.noteRateLimited();
		gate.resume();

		await expect( gate.wait() ).resolves.toBe( true );
	} );
} );

describe( 'resuming a given up batch', () => {
	it( 'does not shorten a wait that is already in progress', async () => {
		const clock = createFakeClock();
		const gate = gateOn( clock );

		gate.noteRateLimited();
		const waitingSince = clock.now();

		gate.resume();
		await gate.wait();

		expect( clock.now() - waitingSince ).toBe( 2000 );
	} );
} );
