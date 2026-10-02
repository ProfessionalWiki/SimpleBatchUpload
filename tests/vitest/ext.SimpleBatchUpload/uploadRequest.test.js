'use strict';

const { createUploader } = require( '../../../res/ext.SimpleBatchUpload/uploadRequest.js' );

/**
 * A stand-in for XMLHttpRequest that lets a test decide what the server did.
 *
 * @return {Object}
 */
function fakeXhr() {
	const xhr = {
		upload: {},
		opened: null,
		sent: null,
		status: 0,
		responseText: '',
		onload: null,
		onerror: null,
		ontimeout: null,

		open: ( method, url ) => {
			xhr.opened = { method: method, url: url };
		},
		send: ( body ) => {
			xhr.sent = body;
		},

		/**
		 * @param {number} status
		 * @param {string} body
		 */
		respond: ( status, body ) => {
			xhr.status = status;
			xhr.responseText = body;
			xhr.onload();
		},

		/**
		 * @param {number} loaded
		 * @param {number} total
		 */
		progress: ( loaded, total ) => {
			xhr.upload.onprogress( { lengthComputable: true, loaded: loaded, total: total } );
		}
	};

	return xhr;
}

/**
 * @param {Object} xhr
 * @return {Object}
 */
function uploaderUsing( xhr ) {
	return createUploader( { url: '/w/api.php', createRequest: () => xhr } );
}

function fieldsOf( formData ) {
	const fields = {};

	formData.forEach( ( value, key ) => {
		fields[ key ] = value;
	} );

	return fields;
}

describe( 'createUploader', () => {
	it( 'posts to the API with the fields an upload needs', async () => {
		const xhr = fakeXhr();
		const file = new File( [ 'x' ], 'local.jpg', { type: 'image/jpeg' } );

		const pending = uploaderUsing( xhr ).upload( {
			file: file,
			filename: 'Target.jpg',
			text: '{{Pics}}',
			comment: 'Uploaded with SimpleBatchUpload',
			token: 'abc+\\'
		} );

		expect( xhr.opened ).toEqual( { method: 'POST', url: '/w/api.php' } );

		const fields = fieldsOf( xhr.sent );

		expect( fields.action ).toBe( 'upload' );
		expect( fields.format ).toBe( 'json' );
		expect( fields.token ).toBe( 'abc+\\' );
		expect( fields.filename ).toBe( 'Target.jpg' );
		expect( fields.text ).toBe( '{{Pics}}' );
		expect( fields.comment ).toBe( 'Uploaded with SimpleBatchUpload' );
		expect( fields.file.size ).toBe( file.size );

		xhr.respond( 200, '{"upload":{"result":"Success"}}' );
		await pending;
	} );

	it( 'does not silence the wiki\'s warnings by default', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't'
		} );

		expect( fieldsOf( xhr.sent ).ignorewarnings ).toBeUndefined();

		xhr.respond( 200, '{"upload":{"result":"Warning"}}' );
		await pending;
	} );

	it( 'silences them only when the user has answered', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't', ignoreWarnings: true
		} );

		expect( fieldsOf( xhr.sent ).ignorewarnings ).toBe( '1' );

		xhr.respond( 200, '{"upload":{"result":"Success"}}' );
		await pending;
	} );

	it( 'sends the key instead of the bytes when confirming a file the wiki already holds', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ),
			filename: 'A.jpg',
			token: 't',
			filekey: '1cvv.abc.1.jpg',
			ignoreWarnings: true
		} );

		const fields = fieldsOf( xhr.sent );

		expect( fields.filekey ).toBe( '1cvv.abc.1.jpg' );
		expect( fields.file ).toBeUndefined();

		xhr.respond( 200, '{"upload":{"result":"Success"}}' );
		await pending;
	} );

	it( 'sends an empty text rather than none, so the wiki does not use the summary instead', async () => {
		// ApiUpload takes the comment as the page text when no text is given.
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't', text: '', comment: 'c'
		} );

		expect( fieldsOf( xhr.sent ).text ).toBe( '' );

		xhr.respond( 200, '{"upload":{"result":"Success"}}' );
		await pending;
	} );

	it( 'resolves with an API error\'s body, which comes with a 200 like any other answer', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't'
		} );

		xhr.respond( 200, '{"error":{"code":"ratelimited","info":"slow down"}}' );

		expect( await pending ).toEqual( { error: { code: 'ratelimited', info: 'slow down' } } );
	} );

	it( 'reports how much has gone, so a row can show a ring', async () => {
		const xhr = fakeXhr();
		const seen = [];
		const pending = uploaderUsing( xhr ).upload(
			{ file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't' },
			( fraction ) => seen.push( fraction )
		);

		xhr.progress( 0, 100 );
		xhr.progress( 41, 100 );
		xhr.progress( 100, 100 );

		expect( seen ).toEqual( [ 0, 0.41, 1 ] );

		xhr.respond( 200, '{"upload":{"result":"Success"}}' );
		await pending;
	} );

	it( 'ignores a progress event that cannot say how big the file is', async () => {
		const xhr = fakeXhr();
		const seen = [];
		const pending = uploaderUsing( xhr ).upload(
			{ file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't' },
			( fraction ) => seen.push( fraction )
		);

		xhr.upload.onprogress( { lengthComputable: false, loaded: 10, total: 0 } );

		expect( seen ).toEqual( [] );

		xhr.respond( 200, '{"upload":{"result":"Success"}}' );
		await pending;
	} );

	it( 'rejects with the status when a proxy sheds the request, so the runner can see a 429', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't'
		} );

		xhr.respond( 429, '<html>Too Many Requests</html>' );

		await expect( pending ).rejects.toMatchObject( { status: 429 } );
	} );

	it( 'rejects when the connection fails, with no status to report', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't'
		} );

		xhr.onerror();

		await expect( pending ).rejects.toMatchObject( { status: 0 } );
	} );

	it( 'rejects when a 200 carries something that is not JSON, which is what an HTML error page looks like', async () => {
		const xhr = fakeXhr();
		const pending = uploaderUsing( xhr ).upload( {
			file: new File( [ 'x' ], 'a.jpg' ), filename: 'A.jpg', token: 't'
		} );

		xhr.respond( 200, '<!DOCTYPE html><title>Fatal exception</title>' );

		await expect( pending ).rejects.toMatchObject( { status: 200 } );
	} );
} );
