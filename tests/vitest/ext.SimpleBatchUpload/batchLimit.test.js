const { resolveUserLimit } = require( '../../../res/ext.SimpleBatchUpload/batchLimit.js' );

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
