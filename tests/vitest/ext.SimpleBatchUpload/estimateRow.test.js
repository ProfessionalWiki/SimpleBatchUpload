const { showEstimate } = require( '../../../res/ext.SimpleBatchUpload/estimateRow.js' );

function list() {
	return document.createElement( 'ul' );
}

function estimateIn( ul ) {
	return ul.querySelector( 'li.ful-estimate' );
}

describe( 'showEstimate', () => {
	it( 'shows the text above the rows', () => {
		const ul = list();
		ul.appendChild( document.createElement( 'li' ) );

		showEstimate( ul, 'About 3 minutes left.' );

		expect( estimateIn( ul ).textContent ).toBe( 'About 3 minutes left.' );
		expect( ul.firstChild.className ).toBe( 'ful-estimate' );
	} );

	it( 'keeps the row a list item and announces from inside it', () => {
		const ul = list();

		showEstimate( ul, 'About 3 minutes left.' );

		// role="status" on the <li> itself would replace its listitem role and
		// the list would announce one fewer item than it has.
		expect( estimateIn( ul ).getAttribute( 'role' ) ).toBeNull();
		expect( estimateIn( ul ).querySelector( '[role="status"]' ) ).not.toBeNull();
	} );

	it( 'updates the text in place rather than replacing the row', () => {
		const ul = list();

		showEstimate( ul, 'About 3 minutes left.' );
		const first = estimateIn( ul );
		showEstimate( ul, 'About 2 minutes left.' );

		expect( estimateIn( ul ) ).toBe( first );
		expect( estimateIn( ul ).textContent ).toBe( 'About 2 minutes left.' );
	} );

	it( 'leaves the text untouched when it has not changed', () => {
		const ul = list();

		showEstimate( ul, 'About 3 minutes left.' );
		const announced = estimateIn( ul ).querySelector( '[role="status"]' );
		const before = announced.textContent;
		showEstimate( ul, 'About 3 minutes left.' );

		// Rewriting an unchanged live region announces it again.
		expect( estimateIn( ul ).querySelector( '[role="status"]' ) ).toBe( announced );
		expect( announced.textContent ).toBe( before );
	} );

	it( 'takes the row away once there is nothing left to say', () => {
		const ul = list();

		showEstimate( ul, 'About 3 minutes left.' );
		showEstimate( ul, null );

		expect( estimateIn( ul ) ).toBeNull();
	} );

	it( 'does nothing when there was never anything to say', () => {
		const ul = list();

		showEstimate( ul, null );

		expect( ul.children.length ).toBe( 0 );
	} );
} );
