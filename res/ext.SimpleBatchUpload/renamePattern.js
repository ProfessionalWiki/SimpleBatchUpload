'use strict';

/**
 * The optional "+rename" directive in the upload description, e.g.
 *
 *   {{Template| +rename = !(\w+)[ -_/]*! --> $1-}}
 *
 * The directive is stripped from the text that ends up on the file page.
 * An unusable pattern is reported rather than thrown, so it fails one file
 * instead of the batch.
 */
const RENAME_DIRECTIVE =
	/\|\s*\+rename\s*=\s*([#/@!])(.+)\1([gimuy]{0,5})\s*-->(.*?)(?=\||}}\s*$)/;

function keepName( name ) {
	return name;
}

/**
 * @param {?string} description
 * @return {{text: string, renameFile: Function, invalid: boolean}}
 */
function parseRenameDirective( description ) {
	const text = description || '';
	const match = RENAME_DIRECTIVE.exec( text );

	if ( !match ) {
		return { text: text, renameFile: keepName, invalid: false };
	}

	const strippedText = text.replace( RENAME_DIRECTIVE, '' );
	let pattern;

	try {
		pattern = new RegExp( match[ 2 ], match[ 3 ] );
	} catch ( unusablePattern ) {
		return { text: strippedText, renameFile: keepName, invalid: true };
	}

	const replacement = match[ 4 ];

	return {
		text: strippedText,
		renameFile: ( name ) => name.replace( pattern, replacement ),
		invalid: false
	};
}

module.exports = { parseRenameDirective: parseRenameDirective };
