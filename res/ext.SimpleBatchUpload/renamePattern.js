'use strict';

/**
 * Renaming the files of a batch: the rule the Rename files fields hold, and the
 * "+rename" directive a {{#batchupload:}} parameter puts in the description, e.g.
 *
 *   {{Template| +rename = !^IMG_(\d+)! -->Trip-$1}}
 *
 * A directive is read into the fields and taken out of the text, never written
 * back, so the fields are the one place a rule lives.
 */

const RENAME_DIRECTIVE =
	/\|\s*\+rename\s*=\s*([#/@!])(.+)\1([gimuy]{0,5})\s*-->(.*?)(?=\||}}\s*$)/;

// Anything a person might have meant as a directive, correct or not.
const LOOKS_LIKE_DIRECTIVE = /\+\s*rename\s*=/i;

/**
 * @param {string} text
 * @return {?{text: string, find: string, flags: string, replace: string}} The
 *  directive's parts, with the text it leaves behind; null if there is none
 */
function findRenameDirective( text ) {
	const match = RENAME_DIRECTIVE.exec( text );

	if ( !match ) {
		return null;
	}

	return {
		text: text.replace( RENAME_DIRECTIVE, '' ),
		find: match[ 2 ],
		flags: match[ 3 ],
		replace: match[ 4 ]
	};
}

/**
 * Whether the text holds something meant as a directive. Typed into the text,
 * even a working one is not read, and would be published on every file page
 * as written.
 *
 * @param {string} text
 * @return {boolean}
 */
function looksLikeDirective( text ) {
	return LOOKS_LIKE_DIRECTIVE.test( text );
}

function keepName( name ) {
	return name;
}

/**
 * Plain text: every occurrence, case for case, and never in the extension.
 * Nothing to find means the replacement goes in front.
 *
 * @param {string} find
 * @param {string} replace
 * @return {Function}
 */
function plainRenamer( find, replace ) {
	return ( name ) => {
		const lastDot = name.lastIndexOf( '.' );
		const base = lastDot > 0 ? name.slice( 0, lastDot ) : name;
		const extension = lastDot > 0 ? name.slice( lastDot ) : '';
		const renamed = find ? base.split( find ).join( replace ) : replace + base;

		return renamed + extension;
	};
}

/**
 * @param {{find: string, replace: string, regex: boolean, flags: string}} rule
 *  The flags are a regular expression's; a directive brings its own
 * @return {{renameFile: Function, invalid: boolean}} An unusable pattern is
 *  reported rather than thrown, and renames nothing
 */
function createRenamer( rule ) {
	// Nothing to find puts the replacement in front, in either mode: an empty
	// regular expression would match between every two characters.
	if ( !rule.regex || !rule.find ) {
		return {
			renameFile: plainRenamer( rule.find, rule.replace ),
			invalid: false
		};
	}

	let pattern;

	try {
		pattern = new RegExp( rule.find, rule.flags );
	} catch ( unusablePattern ) {
		return { renameFile: keepName, invalid: true };
	}

	return {
		renameFile: ( name ) => {
			// One pattern renames the whole batch, and a sticky one would
			// otherwise start each name where the last match ended.
			pattern.lastIndex = 0;

			return name.replace( pattern, rule.replace );
		},
		invalid: false
	};
}

module.exports = {
	findRenameDirective: findRenameDirective,
	looksLikeDirective: looksLikeDirective,
	createRenamer: createRenamer
};
