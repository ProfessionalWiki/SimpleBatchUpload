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

describe( 'pacing to the advertised limit', () => {
	const EIGHT_PER_MINUTE = { intervalMs: 7500, windowMs: 60000 };

	function pacedGate( clock, limit ) {
		return createRateLimitGate( {
			now: clock.now,
			sleep: clock.sleep,
			limit: limit || EIGHT_PER_MINUTE
		} );
	}

	it( 'does not slow anything down before the wiki has refused an upload', async () => {
		const clock = createFakeClock();
		const gate = pacedGate( clock );

		await gate.wait();
		await gate.wait();
		await gate.wait();

		// A batch that fits inside the budget must not be paced: bursting is
		// what makes the common case fast, and it succeeds.
		expect( clock.now() ).toBe( 0 );
	} );

	it( 'spaces releases once refused, so they do not burst back into the limiter', async () => {
		const clock = createFakeClock();
		const gate = pacedGate( clock );

		gate.noteRateLimited();

		await gate.wait();
		const first = clock.now();
		await gate.wait();
		const second = clock.now();
		await gate.wait();

		expect( second - first ).toBe( 7500 );
		expect( clock.now() - second ).toBe( 7500 );
	} );

	it( 'shortens the ladder for a wiki whose window is tighter than the ladder', () => {
		// The cap only ever binds below ~64s, which is where the ladder tops
		// out. A wiki refilling every 10s should not be made to wait a minute.
		expect( [ 1, 2, 3, 4, 5, 6 ].map( ( n ) => retryDelay( n, 10000 ) ) )
			.toEqual( [ 2000, 4000, 8000, 10000, 10000, 10000 ] );
	} );

	it( 'still caps at a minute when the wiki advertises nothing', () => {
		expect( retryDelay( 20 ) ).toBe( 60000 );
	} );

	it( 'spaces attempts by the advertised rate on a wiki with a long window', async () => {
		const clock = createFakeClock();
		// 3 uploads per 150s: pacing, not the cap, is what carries a file past
		// a window far longer than the retry ladder.
		const gate = pacedGate( clock, { intervalMs: 50000, windowMs: 150000 } );

		gate.noteRateLimited();
		await gate.wait();
		const first = clock.now();
		await gate.wait();

		expect( clock.now() - first ).toBe( 50000 );
	} );
} );

describe( 'learning the limit after the widget is already usable', () => {
	it( 'adopts a limit that arrives once the query returns', async () => {
		const clock = createFakeClock();
		// Created before the API call resolves, so the button works immediately.
		const gate = createRateLimitGate( { now: clock.now, sleep: clock.sleep } );

		gate.useLimit( { intervalMs: 5000, windowMs: 86400000 } );
		gate.noteRateLimited();

		await gate.wait();
		const first = clock.now();
		await gate.wait();

		expect( clock.now() - first ).toBe( 5000 );
	} );

	it( 'ignores an absent limit, so an unlimited user is never paced', async () => {
		const clock = createFakeClock();
		const gate = createRateLimitGate( { now: clock.now, sleep: clock.sleep } );

		gate.useLimit( null );
		gate.noteRateLimited();

		await gate.wait();
		const first = clock.now();
		await gate.wait();

		expect( clock.now() - first ).toBe( 0 );
	} );
} );

describe( 'pacing stops once the budget has demonstrably refilled', () => {
	const EIGHT_PER_MINUTE = { intervalMs: 7500, windowMs: 60000 };

	it( 'stops pacing a later batch once a full window has passed without a refusal', async () => {
		const clock = createFakeClock();
		const gate = createRateLimitGate( {
			now: clock.now,
			sleep: clock.sleep,
			limit: EIGHT_PER_MINUTE
		} );

		gate.noteRateLimited();
		await gate.wait();

		// The user goes away for longer than the limit window, so whatever the
		// wiki was refusing has long since refilled.
		clock.advance( 120000 );
		gate.resume();

		const before = clock.now();
		await gate.wait();
		await gate.wait();
		await gate.wait();

		// A batch that fits must not be slowed just because an earlier one was
		// refused several minutes ago.
		expect( clock.now() - before ).toBe( 0 );
	} );

	it( 'keeps pacing while refusals are still recent', async () => {
		const clock = createFakeClock();
		const gate = createRateLimitGate( {
			now: clock.now,
			sleep: clock.sleep,
			limit: EIGHT_PER_MINUTE
		} );

		gate.noteRateLimited();
		await gate.wait();

		clock.advance( 5000 );
		gate.resume();

		const before = clock.now();
		await gate.wait();

		expect( clock.now() - before ).toBeGreaterThan( 0 );
	} );
} );

describe( 'reporting the schedule it is enforcing', () => {
	const EIGHT_PER_MINUTE = { intervalMs: 7500, windowMs: 60000 };

	function limitedGate( clock, maxRetries ) {
		return createRateLimitGate( {
			now: clock.now,
			sleep: clock.sleep,
			limit: EIGHT_PER_MINUTE,
			maxRetries: maxRetries
		} );
	}

	it( 'offers no schedule before the wiki has refused an upload', () => {
		expect( limitedGate( createFakeClock() ).schedule() ).toBeNull();
	} );

	it( 'offers no schedule for a user the wiki does not limit', () => {
		const clock = createFakeClock();
		const gate = createRateLimitGate( { now: clock.now, sleep: clock.sleep } );

		gate.noteRateLimited();

		expect( gate.schedule() ).toBeNull();
	} );

	it( 'reports the wait left on the current backoff and the spacing behind it', () => {
		const clock = createFakeClock();
		const gate = limitedGate( clock );

		gate.noteRateLimited();

		expect( gate.schedule() ).toEqual( { waitMs: 2000, intervalMs: 7500 } );
	} );

	it( 'counts the wait down as time passes', () => {
		const clock = createFakeClock();
		const gate = limitedGate( clock );

		gate.noteRateLimited();
		clock.advance( 1500 );

		expect( gate.schedule().waitMs ).toBe( 500 );
	} );

	it( 'offers no schedule once a full window has passed without a refusal', () => {
		const clock = createFakeClock();
		const gate = limitedGate( clock );

		gate.noteRateLimited();
		clock.advance( 120000 );

		expect( gate.schedule() ).toBeNull();
	} );

	it( 'offers no schedule once the batch has been given up on', () => {
		const clock = createFakeClock();
		const gate = limitedGate( clock, 1 );

		gate.noteRateLimited();
		expect( gate.schedule() ).not.toBeNull();

		// Past openAt, or the second refusal is dismissed as the same overrun.
		clock.advance( 2000 );
		gate.noteRateLimited();

		expect( gate.schedule() ).toBeNull();
	} );

	it( 'reports the spacing to the next slot once the backoff has expired', async () => {
		const clock = createFakeClock();
		const gate = limitedGate( clock );

		gate.noteRateLimited();
		await gate.wait();

		// openAt is now in the past; the spacing behind the slot just claimed
		// is the only thing left holding the next file up.
		expect( gate.schedule() ).toEqual( { waitMs: 7500, intervalMs: 7500 } );
	} );
} );
