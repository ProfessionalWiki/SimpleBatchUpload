const { createResultRow, pruneFinishedRows } = require( '../../../res/ext.SimpleBatchUpload/resultRow.js' );

function statusOf( row ) {
	return row.element.querySelector( '.fileupload-result-status' ).textContent;
}

function nameOf( row ) {
	return row.element.querySelector( '.fileupload-result-name' ).textContent;
}

describe( 'createResultRow', () => {
	it( 'shows the file name on its own when the file is not renamed', () => {
		expect( nameOf( createResultRow( 'A.png', 'A.png' ) ) ).toBe( 'A.png' );
	} );

	it( 'shows both names when the file is renamed', () => {
		expect( nameOf( createResultRow( 'IMG_1.png', 'Holiday-1.png' ) ) )
			.toBe( 'simplebatchupload-rename-label(IMG_1.png|Holiday-1.png)' );
	} );

	it( 'keeps the file name while the upload progresses', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.showProgress( 0.42 );

		expect( nameOf( row ) ).toBe( 'A.png' );
		expect( statusOf( row ) ).toBe( '42%' );
	} );

	it( 'keeps the file name after an error', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.show( { status: 'network-error', warnings: {} }, null );

		expect( nameOf( row ) ).toBe( 'A.png' );
	} );

	it( 'links the file name to the uploaded file', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.show( { status: 'success', filename: 'A.png', warnings: {} }, '/wiki/File:A.png' );

		const link = row.element.querySelector( 'a' );
		expect( link.getAttribute( 'href' ) ).toBe( '/wiki/File:A.png' );
		expect( link.textContent ).toBe( 'A.png' );
	} );

	it( 'shows the file name unlinked when the title cannot be built', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.show( { status: 'success', filename: 'A.png', warnings: {} }, null );

		expect( row.element.querySelector( 'a' ) ).toBeNull();
		expect( nameOf( row ) ).toBe( 'A.png' );
	} );

	it( 'reports the files a successful upload duplicates', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.show(
			{ status: 'success', filename: 'A.png', warnings: { duplicate: [ 'B.png' ] } },
			'/wiki/File:A.png'
		);

		expect( statusOf( row ) ).toContain( 'simplebatchupload-warning-duplicate(B.png|1)' );
	} );

	it( 'reports the file a successful upload overwrote', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.show(
			{ status: 'success', filename: 'A.png', warnings: { exists: 'A.png' } },
			'/wiki/File:A.png'
		);

		expect( statusOf( row ) ).toContain( 'simplebatchupload-warning-exists(A.png)' );
	} );

	it( 'marks a stopped batch as an error rather than leaving the row blank', () => {
		const row = createResultRow( 'A.png', 'A.png' );

		row.show( { status: 'stopped', warnings: {} }, null );

		expect( row.element.classList.contains( 'ful-error' ) ).toBe( true );
		expect( statusOf( row ) )
			.toBe( 'simplebatchupload-result-error(simplebatchupload-result-rate-limit-stopped)' );
	} );
} );

describe( 'pruneFinishedRows', () => {
	function listWith( classNames ) {
		const list = document.createElement( 'ul' );
		classNames.forEach( ( name ) => {
			const row = document.createElement( 'li' );
			row.className = name;
			list.appendChild( row );
		} );
		return list;
	}

	it( 'clears rows from earlier selections that have finished', () => {
		const list = listWith( [ 'ful-success', 'ful-error api-error', 'ful-notice' ] );

		pruneFinishedRows( list );

		expect( list.children.length ).toBe( 0 );
	} );

	it( 'keeps the rate limit estimate, which is not an upload row', () => {
		const list = listWith( [ 'ful-estimate', 'ful-success' ] );

		pruneFinishedRows( list );

		expect( list.children.length ).toBe( 1 );
		expect( list.children[ 0 ].className ).toBe( 'ful-estimate' );
	} );

	it( 'keeps rows whose upload is still running', () => {
		const list = listWith( [ 'ful-success', '', 'ful-error' ] );

		pruneFinishedRows( list );

		expect( list.children.length ).toBe( 1 );
		expect( list.children[ 0 ].className ).toBe( '' );
	} );
} );
