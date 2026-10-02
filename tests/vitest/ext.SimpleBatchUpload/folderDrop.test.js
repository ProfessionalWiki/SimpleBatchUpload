'use strict';

const {
	collectDroppedEntries,
	readEntryTree
} = require( '../../../res/ext.SimpleBatchUpload/folderDrop.js' );

/**
 * A stand-in for a FileSystemFileEntry. The real one hands the File to a
 * callback rather than returning it, and reports failures on a second callback.
 *
 * @param {string} name
 * @param {Object} [options]
 * @param {boolean} [options.fails] Report an error instead of a file
 * @return {Object}
 */
function fileEntry( name, options ) {
	const settings = options || {};

	return {
		isFile: true,
		isDirectory: false,
		name: name,
		file: ( onFile, onError ) => {
			if ( settings.fails ) {
				onError( new Error( 'gone' ) );
				return;
			}

			onFile( { name: name } );
		}
	};
}

/**
 * A stand-in for a FileSystemDirectoryEntry.
 *
 * Chromium's readEntries() returns at most 100 entries per call and signals the
 * end with an empty array, so the fake hands its children out in slices to keep
 * that loop under test.
 *
 * @param {string} name
 * @param {Object[]} children
 * @param {Object} [options]
 * @param {number} [options.sliceSize] Entries per readEntries() call
 * @param {boolean} [options.fails] Report an error on the first read
 * @return {Object}
 */
function directoryEntry( name, children, options ) {
	const settings = options || {};
	const sliceSize = settings.sliceSize || children.length || 1;

	return {
		isFile: false,
		isDirectory: true,
		name: name,
		createReader: () => {
			let offset = 0;

			return {
				readEntries: ( onEntries, onError ) => {
					if ( settings.fails ) {
						onError( new Error( 'unreadable' ) );
						return;
					}

					const slice = children.slice( offset, offset + sliceSize );
					offset += slice.length;
					onEntries( slice );
				}
			};
		}
	};
}

function namesOf( found ) {
	return found.map( ( entry ) => entry.file.name );
}

function pathsOf( found ) {
	return found.map( ( entry ) => entry.path );
}

describe( 'readEntryTree', () => {
	it( 'returns nothing for nothing', async () => {
		expect( await readEntryTree( [] ) ).toEqual( [] );
	} );

	it( 'reads loose files, and gives them no path', async () => {
		const found = await readEntryTree( [ fileEntry( 'a.jpg' ), fileEntry( 'b.jpg' ) ] );

		expect( namesOf( found ) ).toEqual( [ 'a.jpg', 'b.jpg' ] );
		expect( pathsOf( found ) ).toEqual( [ '', '' ] );
	} );

	it( 'descends into a folder and records where each file came from', async () => {
		const found = await readEntryTree( [
			directoryEntry( 'Holiday', [ fileEntry( 'a.jpg' ), fileEntry( 'b.jpg' ) ] )
		] );

		expect( namesOf( found ) ).toEqual( [ 'a.jpg', 'b.jpg' ] );
		expect( pathsOf( found ) ).toEqual( [ 'Holiday/', 'Holiday/' ] );
	} );

	it( 'descends through nested folders', async () => {
		const found = await readEntryTree( [
			directoryEntry( 'Trip', [
				fileEntry( 'top.jpg' ),
				directoryEntry( 'Day one', [ fileEntry( 'deep.jpg' ) ] )
			] )
		] );

		expect( namesOf( found ) ).toEqual( [ 'top.jpg', 'deep.jpg' ] );
		expect( pathsOf( found ) ).toEqual( [ 'Trip/', 'Trip/Day one/' ] );
	} );

	it( 'keeps reading a folder until it reports no more, because a reader returns a page at a time', async () => {
		const children = [];

		for ( let i = 0; i < 250; i++ ) {
			children.push( fileEntry( 'f' + i + '.jpg' ) );
		}

		const found = await readEntryTree(
			[ directoryEntry( 'Big', children, { sliceSize: 100 } ) ]
		);

		expect( found ).toHaveLength( 250 );
	} );

	it( 'stops reading once it has as many files as the batch will take', async () => {
		// A folder of forty thousand files is not read to take ten of them.
		const read = [];
		const children = [];

		for ( let i = 0; i < 50; i++ ) {
			const entry = fileEntry( 'f' + i + '.jpg' );
			const readFile = entry.file;

			entry.file = ( onFile, onError ) => {
				read.push( entry.name );
				readFile( onFile, onError );
			};
			children.push( entry );
		}

		const found = await readEntryTree( [ directoryEntry( 'Big', children ) ], { limit: 10 } );

		expect( found ).toHaveLength( 10 );
		expect( read ).toHaveLength( 10 );
	} );

	it( 'skips a file it cannot read rather than abandoning the rest', async () => {
		const found = await readEntryTree( [
			fileEntry( 'good.jpg' ),
			fileEntry( 'gone.jpg', { fails: true } ),
			fileEntry( 'alsogood.jpg' )
		] );

		expect( namesOf( found ) ).toEqual( [ 'good.jpg', 'alsogood.jpg' ] );
	} );

	it( 'skips a folder it cannot read rather than abandoning the rest', async () => {
		const found = await readEntryTree( [
			fileEntry( 'good.jpg' ),
			directoryEntry( 'Locked', [ fileEntry( 'hidden.jpg' ) ], { fails: true } ),
			fileEntry( 'alsogood.jpg' )
		] );

		expect( namesOf( found ) ).toEqual( [ 'good.jpg', 'alsogood.jpg' ] );
	} );

	it( 'stops descending past a depth, so a symlink loop cannot hang the browser', async () => {
		let deepest = directoryEntry( 'bottom', [ fileEntry( 'deep.jpg' ) ] );

		for ( let i = 0; i < 40; i++ ) {
			deepest = directoryEntry( 'level' + i, [ deepest ] );
		}

		const found = await readEntryTree( [ deepest ], { maxDepth: 5 } );

		expect( found ).toEqual( [] );
	} );
} );

describe( 'collectDroppedEntries', () => {
	/**
	 * @param {Object[]} items
	 * @return {Object}
	 */
	function dataTransfer( items ) {
		return { items: items };
	}

	function entryItem( entry ) {
		return { kind: 'file', webkitGetAsEntry: () => entry };
	}

	it( 'takes the entry out of every dropped file', () => {
		const one = { isFile: true };
		const two = { isDirectory: true };

		expect( collectDroppedEntries( dataTransfer( [ entryItem( one ), entryItem( two ) ] ) ) )
			.toEqual( [ one, two ] );
	} );

	it( 'ignores dragged text, which arrives alongside files and has no entry', () => {
		const file = { isFile: true };

		expect( collectDroppedEntries( dataTransfer( [
			{ kind: 'string', webkitGetAsEntry: () => ( { isFile: true } ) },
			entryItem( file )
		] ) ) ).toEqual( [ file ] );
	} );

	it( 'ignores an item that reports no entry, which is how a neutered drop looks', () => {
		expect( collectDroppedEntries( dataTransfer( [ entryItem( null ) ] ) ) ).toEqual( [] );
	} );

	it( 'reports nothing on a browser without the API, so the caller can fall back', () => {
		expect( collectDroppedEntries( dataTransfer( [ { kind: 'file' } ] ) ) ).toEqual( [] );
	} );
} );
