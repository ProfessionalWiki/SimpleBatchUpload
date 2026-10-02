'use strict';

/**
 * Walking a dropped folder.
 *
 * DataTransfer.files contains no folders at all, which is why nothing else in
 * MediaWiki reads one. The only way in is webkitGetAsEntry(): non-standard,
 * universally supported, and full of edges.
 *
 * Two of those edges are handled here. A directory reader returns a page of
 * entries at a time -- Chromium caps a page at 100 -- and signals the end with
 * an empty array, so a single readEntries() call silently truncates a large
 * folder. And a tree can be deeper than it looks, or cyclic through symlinks,
 * so the descent is bounded.
 *
 * The third edge is the caller's: webkitGetAsEntry() has to be called
 * synchronously while the drop event is still being dispatched, or the
 * DataTransfer is neutered and every folder vanishes without an error. That is
 * collectDroppedEntries()'s job, and it is deliberately the only function here
 * that touches the DataTransfer, so the walking stays testable.
 */

const DEFAULT_MAX_DEPTH = 20;

/**
 * @param {Object} entry A FileSystemFileEntry
 * @return {Promise<?File>} Null if the file could not be read, which happens
 *  when it was moved or unmounted between the drop and the read
 */
function readFile( entry ) {
	return new Promise( ( resolve ) => {
		entry.file( resolve, () => resolve( null ) );
	} );
}

/**
 * One page of a directory's contents.
 *
 * @param {Object} reader A FileSystemDirectoryReader
 * @return {Promise<Object[]>} Empty when there is no more to read, and also when
 *  the directory could not be read at all
 */
function readPage( reader ) {
	return new Promise( ( resolve ) => {
		reader.readEntries( resolve, () => resolve( [] ) );
	} );
}

/**
 * Every entry in a directory, across as many pages as it takes.
 *
 * @param {Object} entry A FileSystemDirectoryEntry
 * @return {Promise<Object[]>}
 */
async function readDirectory( entry ) {
	const reader = entry.createReader();
	const children = [];

	for ( ;; ) {
		const page = await readPage( reader );

		if ( page.length === 0 ) {
			return children;
		}

		children.push.apply( children, page );
	}
}

/**
 * Every file under a set of dropped entries, depth first, in the order the
 * browser reports them.
 *
 * @param {Object[]} entries FileSystemEntry objects, as returned by
 *  collectDroppedEntries()
 * @param {Object} [options]
 * @param {number} [options.limit] Stop once this many files have been found.
 *  The batch has a cap, and there is no point walking a 40,000 file tree to
 *  throw most of it away
 * @param {number} [options.maxDepth] How far to descend before giving up on a
 *  branch
 * @return {Promise<{file: File, path: string}[]>} `path` is the folder the file
 *  came from, ending in a slash, or empty for a file dropped loose. It is what
 *  tells two files of the same name apart in the UI
 */
async function readEntryTree( entries, options ) {
	const settings = options || {};
	const limit = settings.limit === undefined ? Infinity : settings.limit;
	const maxDepth = settings.maxDepth === undefined ? DEFAULT_MAX_DEPTH : settings.maxDepth;
	const found = [];

	async function walk( entry, path, depth ) {
		if ( found.length >= limit ) {
			return;
		}

		if ( entry.isFile ) {
			const file = await readFile( entry );

			if ( file && found.length < limit ) {
				found.push( { file: file, path: path } );
			}

			return;
		}

		if ( !entry.isDirectory || depth >= maxDepth ) {
			return;
		}

		const children = await readDirectory( entry );

		for ( let i = 0; i < children.length; i++ ) {
			await walk( children[ i ], path + entry.name + '/', depth + 1 );
		}
	}

	for ( let i = 0; i < entries.length; i++ ) {
		await walk( entries[ i ], '', 0 );
	}

	return found;
}

/**
 * The dropped entries, taken out of the event while that is still possible.
 *
 * Must be called synchronously from the drop handler. Every webkitGetAsEntry()
 * has to happen before control returns to the browser, so the whole list is
 * mapped in one pass with no await in sight -- an await here loses every folder
 * after the first, silently.
 *
 * @param {?DataTransfer} dataTransfer
 * @return {Object[]} FileSystemEntry objects. Empty on a browser without the
 *  API, where the caller should fall back to dataTransfer.files
 */
function collectDroppedEntries( dataTransfer ) {
	const items = dataTransfer && dataTransfer.items;

	if ( !items ) {
		return [];
	}

	const entries = [];

	for ( let i = 0; i < items.length; i++ ) {
		const item = items[ i ];

		if ( item.kind === 'file' && item.webkitGetAsEntry ) {
			const entry = item.webkitGetAsEntry();

			if ( entry ) {
				entries.push( entry );
			}
		}
	}

	return entries;
}

module.exports = {
	collectDroppedEntries: collectDroppedEntries,
	readEntryTree: readEntryTree
};
