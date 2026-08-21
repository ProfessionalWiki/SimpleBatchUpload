const {
	bindingLimit
} = require( '../../../res/ext.SimpleBatchUpload/rateLimits.js' );

describe( 'bindingLimit', () => {
	it( 'reports no limit when the wiki applies none', () => {
		// meta=userinfo&uiprop=ratelimits returns an empty object for users
		// holding noratelimit, which means "unlimited", not "zero".
		expect( bindingLimit( {} ) ).toBeNull();
	} );

	it( 'reports no limit when the query failed and nothing came back', () => {
		expect( bindingLimit( null ) ).toBeNull();
	} );

	it( 'reads the limit that applies to uploading', () => {
		const limit = bindingLimit( { upload: { user: { hits: 90, seconds: 60 } } } );

		expect( limit.hits ).toBe( 90 );
		expect( limit.seconds ).toBe( 60 );
	} );

	it( 'takes the most restrictive of several categories of one action', () => {
		// A registered newbie is charged under all three at once.
		const limit = bindingLimit( {
			upload: {
				ip: { hits: 8, seconds: 60 },
				newbie: { hits: 4, seconds: 60 },
				user: { hits: 90, seconds: 60 }
			}
		} );

		expect( limit.hits ).toBe( 4 );
	} );

	it( 'takes the most restrictive across edit and upload, because an upload charges both', () => {
		const limit = bindingLimit( {
			upload: { user: { hits: 90, seconds: 60 } },
			edit: { user: { hits: 10, seconds: 60 } }
		} );

		expect( limit.hits ).toBe( 10 );
	} );

	it( 'compares rates rather than counts, so a long window can be the binding one', () => {
		// 100/day is far more restrictive than 8/minute despite the larger count.
		const limit = bindingLimit( {
			upload: { user: { hits: 100, seconds: 86400 } },
			edit: { user: { hits: 8, seconds: 60 } }
		} );

		expect( limit.seconds ).toBe( 86400 );
	} );

	it( 'ignores actions that an upload does not charge', () => {
		const limit = bindingLimit( {
			move: { user: { hits: 1, seconds: 86400 } },
			upload: { user: { hits: 90, seconds: 60 } }
		} );

		expect( limit.hits ).toBe( 90 );
	} );

	it( 'gives the spacing needed to stay inside the limit', () => {
		const limit = bindingLimit( { upload: { user: { hits: 8, seconds: 60 } } } );

		expect( limit.intervalMs ).toBe( 7500 );
		expect( limit.windowMs ).toBe( 60000 );
	} );

	it( 'ignores a malformed bucket rather than pacing on a NaN', () => {
		expect( bindingLimit( { upload: { user: { hits: 0, seconds: 60 } } } ) ).toBeNull();
	} );
} );
