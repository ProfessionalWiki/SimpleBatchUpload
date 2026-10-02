'use strict';

/**
 * Finds files in one batch that would land on the same file page.
 *
 * The File namespace is flat, so two files dropped from different folders under
 * one name are not two files to the wiki: they are two uploads of one file, and
 * the later one wins. Unlike a name already on the wiki, that is never
 * intentional.
 *
 * Grouping is on the name the wiki will see, which is two things. The *target*
 * name, after any rename, because a rename both creates and removes
 * collisions. And the *normalised* name: MediaWiki reads underscores as spaces
 * and capitalises the first letter, so photo.jpg and Photo.jpg are one page.
 */

/**
 * The title the wiki would give a file, or null where the name has no
 * extension and only the upload can tell what the wiki will add.
 *
 * @param {string} targetName
 * @return {?string}
 */
function pageName( targetName ) {
	const title = mw.Title.newFromFileName( targetName );

	return title ? title.getPrefixedText() : null;
}

/**
 * @param {Object[]} entries Anything carrying the `pageName` above; returned
 *  untouched, so callers can pass their own row objects
 * @return {Object[][]} The entries sharing each page name used by more than one
 *  of them, in the order those names first appear. Names used once, and names
 *  with no extension, are absent.
 */
function groupNameClashes( entries ) {
	const byPageName = new Map();

	entries.forEach( ( entry ) => {
		if ( entry.pageName === null ) {
			return;
		}

		if ( !byPageName.has( entry.pageName ) ) {
			byPageName.set( entry.pageName, [] );
		}

		byPageName.get( entry.pageName ).push( entry );
	} );

	return Array.from( byPageName.values() ).filter( ( members ) => members.length > 1 );
}

module.exports = {
	groupNameClashes: groupNameClashes,
	pageName: pageName
};
