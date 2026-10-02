const {
	classifyUploadResponse,
	describeWarnings,
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

	it( 'treats an answer that belongs to an upload it never makes as an error', () => {
		// Poll and Continue are for chunked and asynchronous uploads.
		expect( classifyUploadResponse( { upload: { result: 'Poll' } } ).status ).toBe( 'error' );
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
} );

describe( 'a file the wiki already holds unchanged', () => {
	it( 'counts an identical re-upload as stored rather than as an error', () => {
		// MediaWiki refuses a byte-identical re-upload to the same title before
		// it writes anything, so the file is on the wiki with exactly the
		// content that was selected. That is what makes retrying safe.
		const outcome = classifyUploadResponse( {
			error: {
				code: 'fileexists-no-change',
				info: 'The upload is an exact duplicate of the current version of [[:File:A.png]].'
			}
		} );

		expect( outcome.status ).toBe( 'success' );
	} );
} );

describe( 'a file the wiki stashed instead of storing', () => {
	it( 'holds a file that would overwrite one already on the wiki, for the user to decide', () => {
		const outcome = classifyUploadResponse( {
			upload: {
				result: 'Warning',
				filekey: '1a2b3c.png.1',
				warnings: { exists: 'A.png' }
			}
		} );

		expect( outcome.status ).toBe( 'held' );
		expect( outcome.filekey ).toBe( '1a2b3c.png.1' );
	} );

	it( 'settles a warning about a similarly named file without asking, since nothing is replaced', () => {
		// The wiki raises it only when the exact name is free: a file whose
		// extension is written differently, or one with the same name and
		// another extension, is already there. The upload goes to its own page.
		const outcome = classifyUploadResponse( {
			upload: {
				result: 'Warning',
				filekey: '1a2b3c.png.1',
				warnings: { 'exists-normalized': 'Diagram.svg' }
			}
		} );

		expect( outcome.status ).toBe( 'confirmable' );
	} );

	it( 'settles a warning that is not about overwriting anything without asking', () => {
		// The wiki holds the same bytes under another name. Nothing is at risk
		// of being lost by going ahead, so the batch confirms the stashed file
		// itself and reports the note.
		const outcome = classifyUploadResponse( {
			upload: {
				result: 'Warning',
				filekey: '1a2b3c.png.1',
				warnings: { duplicate: [ 'B.png' ] }
			}
		} );

		expect( outcome.status ).toBe( 'confirmable' );
		expect( outcome.filekey ).toBe( '1a2b3c.png.1' );
		expect( outcome.warnings ).toEqual( { duplicate: [ 'B.png' ] } );
	} );

	it( 'asks about a file that would overwrite one, even alongside a warning it could settle', () => {
		const outcome = classifyUploadResponse( {
			upload: {
				result: 'Warning',
				filekey: '1a2b3c.png.1',
				warnings: { duplicate: [ 'B.png' ], exists: 'A.png' }
			}
		} );

		expect( outcome.status ).toBe( 'held' );
	} );

	it( 'still asks about an overwrite the wiki could not stash, as for an anonymous uploader', () => {
		const outcome = classifyUploadResponse( {
			upload: { result: 'Warning', warnings: { exists: 'A.png' }, stasherrors: [ {} ] }
		} );

		expect( outcome.status ).toBe( 'held' );
		expect( outcome.filekey ).toBeNull();
	} );

	it( 'still settles a warning the wiki could not stash', () => {
		const outcome = classifyUploadResponse( {
			upload: { result: 'Warning', warnings: { duplicate: [ 'B.png' ] }, stasherrors: [ {} ] }
		} );

		expect( outcome.status ).toBe( 'confirmable' );
		expect( outcome.filekey ).toBeNull();
	} );
} );

describe( 'describeWarnings', () => {
	it( 'says a file overwrote one, which is the thing Replace asked for', () => {
		expect( describeWarnings( { exists: 'A.png' } ) ).toEqual( [ 'simplebatchupload-warning-exists(A.png)' ] );
	} );

	it( 'says a file was already on the wiki unchanged', () => {
		expect( describeWarnings( { 'no-change': true } ) ).toEqual( [ 'simplebatchupload-warning-no-change' ] );
	} );

	it( 'names every file the upload duplicates', () => {
		expect( describeWarnings( { duplicate: [ 'B.png', 'C.png' ] } ).join( ' ' ) ).toContain( 'C.png' );
	} );

	it( 'names any other warning rather than dropping it', () => {
		expect( describeWarnings( { 'bad-prefix': 'DSC_' } ) )
			.toEqual( [ 'simplebatchupload-warning-other(bad-prefix|1)' ] );
	} );
} );
