'use strict';

const { createThumbnailer } = require( '../../../res/ext.SimpleBatchUpload/thumbnailer.js' );

/**
 * A Worker whose replies this test decides.
 *
 * @return {Object}
 */
function fakeWorker() {
	const worker = {
		sent: [],
		onmessage: null,
		postMessage: ( message ) => {
			worker.sent.push( message );
		},

		/**
		 * @param {number} id
		 * @param {Object} payload
		 */
		reply: ( id, payload ) => {
			worker.onmessage( { data: Object.assign( { id: id }, payload ) } );
		}
	};

	return worker;
}

function jpeg( name ) {
	return { name: name, type: 'image/jpeg', size: 2048 };
}

describe( 'createThumbnailer', () => {
	it( 'reports itself unavailable where the browser cannot run the worker', () => {
		expect( createThumbnailer( { createWorker: () => null } ) ).toBeNull();
	} );

	it( 'reports itself unavailable when building the worker throws, which is how a strict CSP looks', () => {
		expect( createThumbnailer( {
			createWorker: () => {
				throw new Error( 'blocked by Content-Security-Policy' );
			}
		} ) ).toBeNull();
	} );

	it( 'hands a previewable file to the worker and returns what comes back', async () => {
		const worker = fakeWorker();
		const thumbnailer = createThumbnailer( { createWorker: () => worker } );

		const pending = thumbnailer.thumbnail( jpeg( 'a.jpg' ) );

		expect( worker.sent ).toHaveLength( 1 );
		// The size is what the worker draws at: without it, nothing is drawn.
		expect( worker.sent[ 0 ] ).toHaveProperty( 'px' );
		worker.reply( worker.sent[ 0 ].id, { dataUrl: 'data:image/jpeg;base64,AAA' } );

		expect( await pending ).toBe( 'data:image/jpeg;base64,AAA' );
	} );

	it( 'does not wake the worker for a file it would refuse anyway', async () => {
		const worker = fakeWorker();
		const thumbnailer = createThumbnailer( { createWorker: () => worker } );

		const pending = thumbnailer.thumbnail( { type: 'application/pdf', size: 2048 } );

		expect( worker.sent ).toHaveLength( 0 );
		expect( await pending ).toBeNull();
	} );

	it( 'keeps no more than the allowed number of decodes in flight', async () => {
		const worker = fakeWorker();
		const thumbnailer = createThumbnailer( { createWorker: () => worker, concurrency: 2 } );

		const all = [ 'a', 'b', 'c', 'd', 'e' ].map(
			( name ) => thumbnailer.thumbnail( jpeg( name + '.jpg' ) )
		);

		expect( worker.sent ).toHaveLength( 2 );

		worker.reply( worker.sent[ 0 ].id, { dataUrl: 'a' } );
		await all[ 0 ];
		expect( worker.sent ).toHaveLength( 3 );

		worker.reply( worker.sent[ 1 ].id, { dataUrl: 'b' } );
		await all[ 1 ];
		expect( worker.sent ).toHaveLength( 4 );
	} );

	it( 'matches each reply to its own request, however they interleave', async () => {
		const worker = fakeWorker();
		const thumbnailer = createThumbnailer( { createWorker: () => worker, concurrency: 3 } );

		const first = thumbnailer.thumbnail( jpeg( 'first.jpg' ) );
		const second = thumbnailer.thumbnail( jpeg( 'second.jpg' ) );
		const third = thumbnailer.thumbnail( jpeg( 'third.jpg' ) );

		worker.reply( worker.sent[ 2 ].id, { dataUrl: 'third' } );
		worker.reply( worker.sent[ 0 ].id, { dataUrl: 'first' } );
		worker.reply( worker.sent[ 1 ].id, { dataUrl: 'second' } );

		expect( await first ).toBe( 'first' );
		expect( await second ).toBe( 'second' );
		expect( await third ).toBe( 'third' );
	} );

	it( 'turns a decode the worker could not manage into no preview, not a rejection', async () => {
		const worker = fakeWorker();
		const thumbnailer = createThumbnailer( { createWorker: () => worker, concurrency: 2 } );

		const failing = thumbnailer.thumbnail( jpeg( 'broken.jpg' ) );
		const other = thumbnailer.thumbnail( jpeg( 'fine.jpg' ) );

		worker.reply( worker.sent[ 0 ].id, { error: 'InvalidStateError' } );
		worker.reply( worker.sent[ 1 ].id, { dataUrl: 'fine' } );

		expect( await failing ).toBeNull();
		expect( await other ).toBe( 'fine' );
	} );

	it( 'lets the queue keep moving after one file fails', async () => {
		const worker = fakeWorker();
		const thumbnailer = createThumbnailer( { createWorker: () => worker, concurrency: 1 } );

		const failing = thumbnailer.thumbnail( jpeg( 'broken.jpg' ) );
		const queued = thumbnailer.thumbnail( jpeg( 'next.jpg' ) );

		expect( worker.sent ).toHaveLength( 1 );
		worker.reply( worker.sent[ 0 ].id, { error: 'boom' } );
		await failing;

		expect( worker.sent ).toHaveLength( 2 );
		worker.reply( worker.sent[ 1 ].id, { dataUrl: 'next' } );
		expect( await queued ).toBe( 'next' );
	} );
} );
