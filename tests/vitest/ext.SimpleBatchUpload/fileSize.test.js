'use strict';

const { describeSize } = require( '../../../res/ext.SimpleBatchUpload/fileSize.js' );

describe( 'describeSize', () => {
	it( 'counts small files in bytes', () => {
		expect( describeSize( 0 ) ).toBe( 'size-bytes(0)' );
		expect( describeSize( 1 ) ).toBe( 'size-bytes(1)' );
		expect( describeSize( 1023 ) ).toBe( 'size-bytes(1023)' );
	} );

	it( 'moves up a unit at 1024, not at 1000', () => {
		expect( describeSize( 1024 ) ).toBe( 'size-kilobytes(1)' );
		expect( describeSize( 1024 * 1024 ) ).toBe( 'size-megabytes(1)' );
		expect( describeSize( 1024 * 1024 * 1024 ) ).toBe( 'size-gigabytes(1)' );
	} );

	it( 'keeps a decimal from megabytes up, because that is what tells two photos apart', () => {
		expect( describeSize( Math.round( 2.1 * 1024 * 1024 ) ) ).toBe( 'size-megabytes(2.1)' );
		expect( describeSize( Math.round( 1.8 * 1024 * 1024 ) ) ).toBe( 'size-megabytes(1.8)' );
		expect( describeSize( Math.round( 1.25 * 1024 * 1024 * 1024 ) ) ).toBe( 'size-gigabytes(1.3)' );
	} );

	it( 'writes the number as the wiki\'s language does', () => {
		mw.language.convertNumber = ( number ) => String( number ).replace( '.', ',' );

		expect( describeSize( Math.round( 2.1 * 1024 * 1024 ) ) ).toBe( 'size-megabytes(2,1)' );
	} );

	it( 'rounds kilobytes whole, where a decimal would be noise', () => {
		expect( describeSize( 1536 ) ).toBe( 'size-kilobytes(2)' );
		expect( describeSize( 40 * 1024 ) ).toBe( 'size-kilobytes(40)' );
	} );

	it( 'drops a decimal that would only ever read as .0', () => {
		expect( describeSize( 3 * 1024 * 1024 ) ).toBe( 'size-megabytes(3)' );
	} );

	it( 'stops at gigabytes rather than inventing a unit nobody uploads', () => {
		expect( describeSize( 2 * 1024 * 1024 * 1024 * 1024 ) ).toBe( 'size-gigabytes(2048)' );
	} );
} );
