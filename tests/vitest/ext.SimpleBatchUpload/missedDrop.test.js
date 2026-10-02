'use strict';

const { catchMissedDrops } = require( '../../../res/ext.SimpleBatchUpload/missedDrop.js' );

/**
 * @param {string} type dragover or drop
 * @param {string[]} carrying What the drag holds, as DataTransfer.types says it
 * @return {Event}
 */
function drag( type, carrying ) {
	const event = new Event( type, { bubbles: true, cancelable: true } );

	Object.defineProperty( event, 'dataTransfer', { value: { types: carrying } } );

	return event;
}

describe( 'catchMissedDrops', () => {
	let page;

	beforeEach( () => {
		page = document.createElement( 'div' );
		catchMissedDrops( page );
	} );

	it( 'keeps the browser from opening a file dropped beside a panel', () => {
		const drop = drag( 'drop', [ 'Files' ] );

		page.dispatchEvent( drop );

		expect( drop.defaultPrevented ).toBe( true );
	} );

	it( 'keeps the browser from offering to open a file dragged over the page', () => {
		const over = drag( 'dragover', [ 'Files' ] );

		page.dispatchEvent( over );

		expect( over.defaultPrevented ).toBe( true );
	} );

	it( 'leaves dragged text to land where it is dropped', () => {
		const drop = drag( 'drop', [ 'text/plain' ] );

		page.dispatchEvent( drop );

		expect( drop.defaultPrevented ).toBe( false );
	} );
} );
