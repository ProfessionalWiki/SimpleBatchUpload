const {
	classifyUploadResponse,
	filePageUrl
} = require( '../../../res/ext.SimpleBatchUpload/uploadResult.js' );

describe( 'classifyUploadResponse', () => {
	it( 'reports a stored file as a success', () => {
		const outcome = classifyUploadResponse( {
			upload: { result: 'Success', filename: 'A.png' }
		} );

		expect( outcome.status ).toBe( 'success' );
		expect( outcome.filename ).toBe( 'A.png' );
	} );

	it( 'keeps the warnings the server reports next to a stored file', () => {
		const outcome = classifyUploadResponse( {
			upload: {
				result: 'Success',
				filename: 'A.png',
				warnings: { duplicate: [ 'B.png' ], exists: 'A.png' }
			}
		} );

		expect( outcome.warnings ).toEqual( { duplicate: [ 'B.png' ], exists: 'A.png' } );
	} );

	it( 'does not report a file the server only warned about as uploaded', () => {
		const outcome = classifyUploadResponse( {
			upload: { result: 'Warning', warnings: { exists: 'A.png' } }
		} );

		expect( outcome.status ).toBe( 'not-uploaded' );
	} );

	it( 'names a rate limit refusal so it can be retried', () => {
		const outcome = classifyUploadResponse( {
			error: { code: 'ratelimited', info: 'You have exceeded your rate limit.' }
		} );

		expect( outcome.status ).toBe( 'ratelimited' );
	} );

	it( 'passes the server explanation through for any other error', () => {
		const outcome = classifyUploadResponse( {
			error: { code: 'verification-error', info: 'This file did not pass file verification.' }
		} );

		expect( outcome.status ).toBe( 'error' );
		expect( outcome.info ).toBe( 'This file did not pass file verification.' );
	} );

	it( 'treats an answer it cannot interpret as an error', () => {
		expect( classifyUploadResponse( {} ).status ).toBe( 'error' );
	} );
} );

describe( 'filePageUrl', () => {
	it( 'links to the file page of an uploaded file', () => {
		expect( filePageUrl( 'Kitten.png' ) ).toBe( '/index.php/File:Kitten.png' );
	} );

	it( 'returns no link when the file name cannot be turned into a title', () => {
		mw.Title.newFromFileName.mockReturnValue( null );

		expect( filePageUrl( '<<<' ) ).toBeNull();
	} );

	it( 'returns no link when there is no file name', () => {
		expect( filePageUrl( null ) ).toBeNull();
	} );
} );
