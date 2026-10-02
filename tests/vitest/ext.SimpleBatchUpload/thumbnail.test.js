'use strict';

const { isThumbnailable } = require( '../../../res/ext.SimpleBatchUpload/thumbnail.js' );

// The same cap core puts on its own Special:Upload preview.
const TEN_MIB = 10 * 1024 * 1024;

/**
 * @param {string} type
 * @param {number} size
 * @return {Object} Enough of a File for the policy to judge
 */
function file( type, size ) {
	return { type: type, size: size };
}

describe( 'isThumbnailable', () => {
	it( 'accepts the raster formats a browser can decode', () => {
		expect( isThumbnailable( file( 'image/jpeg', 2048 ) ) ).toBe( true );
		expect( isThumbnailable( file( 'image/png', 2048 ) ) ).toBe( true );
		expect( isThumbnailable( file( 'image/gif', 2048 ) ) ).toBe( true );
		expect( isThumbnailable( file( 'image/webp', 2048 ) ) ).toBe( true );
	} );

	it( 'refuses formats the browser will not draw, so a batch of them costs nothing', () => {
		expect( isThumbnailable( file( 'application/pdf', 2048 ) ) ).toBe( false );
		expect( isThumbnailable( file( 'video/mp4', 2048 ) ) ).toBe( false );
		expect( isThumbnailable( file( 'image/tiff', 2048 ) ) ).toBe( false );
		expect( isThumbnailable( file( 'image/svg+xml', 2048 ) ) ).toBe( false );
	} );

	it( 'refuses a file with no type, which is what an unknown extension reports', () => {
		expect( isThumbnailable( file( '', 2048 ) ) ).toBe( false );
	} );

	it( 'refuses an empty file rather than drawing nothing', () => {
		expect( isThumbnailable( file( 'image/jpeg', 0 ) ) ).toBe( false );
	} );

	it( 'refuses a file large enough to stall the page while it decodes', () => {
		expect( isThumbnailable( file( 'image/jpeg', TEN_MIB - 1 ) ) ).toBe( true );
		expect( isThumbnailable( file( 'image/jpeg', TEN_MIB ) ) ).toBe( false );
		expect( isThumbnailable( file( 'image/jpeg', TEN_MIB + 1 ) ) ).toBe( false );
	} );
} );
