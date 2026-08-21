const { createUploadQueue } = require( '../../../res/ext.SimpleBatchUpload/uploadQueue.js' );

function deferred() {
	let settle;
	const promise = new Promise( ( resolve ) => {
		settle = resolve;
	} );

	return { promise: promise, resolve: settle };
}

describe( 'createUploadQueue', () => {
	it( 'runs no more tasks at a time than the limit allows', async () => {
		const queue = createUploadQueue( { limit: 2 } );
		const first = deferred();
		const second = deferred();
		const firstTask = vi.fn( () => first.promise );
		const secondTask = vi.fn( () => second.promise );
		const thirdTask = vi.fn( () => Promise.resolve() );

		queue.run( firstTask );
		queue.run( secondTask );
		queue.run( thirdTask );
		await Promise.resolve();

		expect( firstTask ).toHaveBeenCalled();
		expect( secondTask ).toHaveBeenCalled();
		expect( thirdTask ).not.toHaveBeenCalled();
		expect( queue.running() ).toBe( 2 );
		expect( queue.waiting() ).toBe( 1 );
	} );

	it( 'starts a waiting task as soon as a running one finishes', async () => {
		const queue = createUploadQueue( { limit: 1 } );
		const first = deferred();
		const second = vi.fn( () => Promise.resolve() );

		const running = queue.run( () => first.promise );
		queue.run( second );
		first.resolve();
		await running;
		await Promise.resolve();

		expect( second ).toHaveBeenCalled();
	} );

	it( 'hands the task result back to the caller', async () => {
		const queue = createUploadQueue( { limit: 1 } );

		await expect( queue.run( () => Promise.resolve( 'done' ) ) ).resolves.toBe( 'done' );
	} );

	it( 'frees the slot when a task fails', async () => {
		const queue = createUploadQueue( { limit: 1 } );
		const second = vi.fn( () => Promise.resolve() );

		await expect( queue.run( () => Promise.reject( new Error( 'boom' ) ) ) ).rejects.toThrow();
		await queue.run( second );

		expect( second ).toHaveBeenCalled();
	} );
} );
