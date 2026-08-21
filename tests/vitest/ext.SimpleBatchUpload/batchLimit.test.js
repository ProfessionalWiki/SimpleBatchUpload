const {
	resolveUserLimit,
	createBatchLimit
} = require( '../../../res/ext.SimpleBatchUpload/batchLimit.js' );

describe( 'resolveUserLimit', () => {
	it( 'grants the highest limit of any group the user is in', () => {
		const limit = resolveUserLimit(
			{ '*': 5, user: 50, autoconfirmed: 20, sysop: 500 },
			[ '*', 'user', 'autoconfirmed' ]
		);

		expect( limit ).toBe( 50 );
	} );

	it( 'ignores limits of groups the user is not in', () => {
		expect( resolveUserLimit( { sysop: 500 }, [ '*', 'user' ] ) ).toBe( 0 );
	} );

	it( 'grants nothing when no limits are configured', () => {
		expect( resolveUserLimit( null, [ '*', 'user' ] ) ).toBe( 0 );
	} );
} );

describe( 'createBatchLimit', () => {
	it( 'admits files up to the limit', () => {
		const batch = createBatchLimit( 2 );

		expect( [ batch.admit(), batch.admit(), batch.admit() ] )
			.toEqual( [ true, true, false ] );
	} );

	it( 'counts uploads that are still running against a later selection', () => {
		const batch = createBatchLimit( 3 );
		batch.admit();
		batch.admit();

		expect( batch.remaining() ).toBe( 1 );
	} );

	it( 'frees the slot of a finished upload', () => {
		const batch = createBatchLimit( 1 );
		batch.admit();
		batch.release();

		expect( batch.admit() ).toBe( true );
	} );
} );
