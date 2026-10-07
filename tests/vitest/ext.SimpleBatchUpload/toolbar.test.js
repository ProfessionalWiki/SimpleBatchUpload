const { wantsToolbar } = require( '../../../res/ext.SimpleBatchUpload/toolbar.js' );

/**
 * A page with one panel and WikiEditor installed but not yet loaded, seen by a
 * user who can upload, on the default preference.
 *
 * @param {Object} [overrides]
 * @return {Object}
 */
function page( overrides ) {
	return Object.assign( {
		moduleState: 'registered',
		preference: true,
		canUpload: true,
		panels: 1
	}, overrides );
}

describe( 'wantsToolbar', () => {
	it( 'wants it for a user who kept the default', () => {
		expect( wantsToolbar( page() ) ).toBe( true );
	} );

	it( 'wants it for a user who turned it on where the wiki has it off', () => {
		expect( wantsToolbar( page( { preference: '1' } ) ) ).toBe( true );
	} );

	it( 'wants it for a preference saved through the API, which stores the string "true"', () => {
		expect( wantsToolbar( page( { preference: 'true' } ) ) ).toBe( true );
	} );

	it.each( [ '0', '', 0, false ] )( 'does not want it for a user who turned it off (%j)', ( preference ) => {
		expect( wantsToolbar( page( { preference: preference } ) ) ).toBe( false );
	} );

	it( 'does not want it where WikiEditor is not installed', () => {
		expect( wantsToolbar( page( { moduleState: null } ) ) ).toBe( false );
	} );

	it.each( [ 'loading', 'ready' ] )( 'does not want it where something else on the page loads WikiEditor (%s), whose toolbar would share its dialogs', ( moduleState ) => {
		expect( wantsToolbar( page( { moduleState: moduleState } ) ) ).toBe( false );
	} );

	it( 'does not want it for a user who cannot upload, and so creates no file page', () => {
		expect( wantsToolbar( page( { canUpload: false } ) ) ).toBe( false );
	} );

	it( 'does not want it on a page with several panels, since only one field can have it', () => {
		expect( wantsToolbar( page( { panels: 2 } ) ) ).toBe( false );
	} );
} );
