/**
 * Factory for a stub of MediaWiki's `mw` global.
 *
 * Covers only what the ext.SimpleBatchUpload package files touch. setup.js calls
 * this before every test, so there is no shared registry to reset and no way for
 * one test to leak call history or a stubbed return value into the next.
 *
 * msg() renders the key and its parameters rather than English text, so tests
 * assert which message was chosen and with what, and do not break when
 * i18n/en.json is reworded.
 */

function formatMessage( key, params ) {
	return params.length === 0 ? key : key + '(' + params.join( '|' ) + ')';
}

/**
 * MediaWiki normalises a file name before it becomes a title: underscores are
 * spaces, runs of whitespace collapse, and the first letter is capitalised on a
 * wiki with the default $wgCapitalLinks. Two uploads whose names differ only by
 * those things land on one file page, so anything comparing names has to see
 * the normalised form or it will miss real collisions.
 *
 * @param {string} fileName
 * @return {string}
 */
function normaliseFileName( fileName ) {
	const spaced = fileName.replace( /[_\s]+/g, ' ' ).trim();

	return spaced.charAt( 0 ).toUpperCase() + spaced.slice( 1 );
}

function createTitleStub( fileName ) {
	const normalised = normaliseFileName( fileName );

	return {
		getUrl: () => '/index.php/File:' + normalised.replace( / /g, '_' ),
		getPrefixedText: () => 'File:' + normalised,
		getMain: () => normalised
	};
}

function createMwMock() {
	return {
		config: {
			get: vi.fn( () => null )
		},

		// Monotonic in the real thing (navigationStart + performance.now()).
		// Anything under test that cares about elapsed time takes an injected
		// clock instead, so this only has to exist, not advance realistically.
		now: vi.fn( () => 0 ),

		msg: vi.fn( ( key, ...params ) => formatMessage( key, params ) ),

		message: vi.fn( ( key, ...params ) => ( {
			text: () => formatMessage( key, params ),
			escaped: () => formatMessage( key, params ),
			parse: () => formatMessage( key, params )
		} ) ),

		Api: vi.fn( function MwApiMock() {
			this.getToken = vi.fn( () => Promise.resolve( '+\\' ) );
			this.badToken = vi.fn();
			this.post = vi.fn( () => Promise.resolve( {} ) );
			this.postWithToken = vi.fn( () => Promise.resolve( {} ) );
		} ),

		Title: {
			// The real mw.Title.newFromFileName cleans most of what a title
			// cannot hold -- a # becomes a dash, as the upload API does too --
			// and returns null for what it cannot clean: a name with no
			// extension after its last dot, or nothing at all.
			newFromFileName: vi.fn( ( fileName ) => {
				const trimmed = ( fileName || '' ).trim();
				const lastDot = trimmed.lastIndexOf( '.' );

				return lastDot === -1 || lastDot === trimmed.length - 1 ?
					null :
					createTitleStub( trimmed );
			} )
		},

		language: {
			convertNumber: vi.fn( ( number ) => String( number ) )
		},

		log: {
			warn: vi.fn(),
			error: vi.fn()
		}
	};
}

module.exports = { createMwMock: createMwMock };
