const {
	findRenameDirective,
	createRenamer,
	looksLikeDirective
} = require( '../../../res/ext.SimpleBatchUpload/renamePattern.js' );

function rule( parts ) {
	return Object.assign( { find: '', replace: '', regex: false, flags: '' }, parts );
}

describe( 'findRenameDirective', () => {
	it( 'finds nothing in a description without one', () => {
		expect( findRenameDirective( '{{Photo|author=Ada}}' ) ).toBeNull();
	} );

	it( 'takes the pattern, its flags and the replacement out of the text', () => {
		expect( findRenameDirective( '{{Photo| +rename = !^IMG_!g -->Holiday-|author=Ada}}' ) )
			.toMatchObject( { text: '{{Photo|author=Ada}}', find: '^IMG_', flags: 'g', replace: 'Holiday-' } );
	} );

	it( 'treats a space after the arrow as part of the replacement', () => {
		expect( findRenameDirective( '{{Photo| +rename = !^IMG_! --> Holiday-}}' ).replace )
			.toBe( ' Holiday-' );
	} );

	it( 'leaves alone a directive missing the pipe before it', () => {
		expect( findRenameDirective( '{{Photo +rename = /^IMG_/-->Trip-}}' ) ).toBeNull();
	} );
} );

describe( 'createRenamer', () => {
	describe( 'with plain text', () => {
		it( 'leaves names alone when there is nothing to find or put', () => {
			expect( createRenamer( rule( {} ) ).renameFile( 'IMG_1.jpg' ) ).toBe( 'IMG_1.jpg' );
		} );

		it( 'replaces every occurrence', () => {
			const renamer = createRenamer( rule( { find: 'a', replace: 'o' } ) );

			expect( renamer.renameFile( 'banana.jpg' ) ).toBe( 'bonono.jpg' );
		} );

		it( 'matches case for case', () => {
			const renamer = createRenamer( rule( { find: 'img', replace: 'Trip' } ) );

			expect( renamer.renameFile( 'IMG_1.jpg' ) ).toBe( 'IMG_1.jpg' );
		} );

		it( 'never touches the extension', () => {
			const renamer = createRenamer( rule( { find: 'p', replace: 'b' } ) );

			expect( renamer.renameFile( 'pip.jpg' ) ).toBe( 'bib.jpg' );
		} );

		it( 'takes a dollar sign in the replacement as itself', () => {
			const renamer = createRenamer( rule( { find: 'IMG', replace: '$&' } ) );

			expect( renamer.renameFile( 'IMG_1.jpg' ) ).toBe( '$&_1.jpg' );
		} );

		it( 'adds the replacement to the start when there is nothing to find', () => {
			const renamer = createRenamer( rule( { replace: 'Trip-' } ) );

			expect( renamer.renameFile( 'IMG_1.jpg' ) ).toBe( 'Trip-IMG_1.jpg' );
		} );

		it( 'works on the whole of a name without an extension', () => {
			const renamer = createRenamer( rule( { find: 'E', replace: 'e' } ) );

			expect( renamer.renameFile( 'README' ) ).toBe( 'ReADMe' );
		} );
	} );

	describe( 'with a regular expression', () => {
		it( 'works on the whole name, extension included, as a directive always has', () => {
			const renamer = createRenamer( rule( { find: '\\.jpeg$', replace: '.jpg', regex: true } ) );

			expect( renamer.renameFile( 'A.jpeg' ) ).toBe( 'A.jpg' );
		} );

		it( 'takes JavaScript replacement syntax', () => {
			const renamer = createRenamer( rule( { find: '^IMG_(\\d+)', replace: 'Trip-$1', regex: true } ) );

			expect( renamer.renameFile( 'IMG_0042.jpg' ) ).toBe( 'Trip-0042.jpg' );
		} );

		it( 'follows the flags it is given', () => {
			const renamer = createRenamer( rule( { find: 'a', replace: 'o', regex: true, flags: 'gi' } ) );

			expect( renamer.renameFile( 'bAnana.jpg' ) ).toBe( 'bonono.jpg' );
		} );

		it( 'renames every file alike under the sticky flag a directive may carry', () => {
			// A sticky pattern starts where its last match ended, and one
			// pattern renames the whole batch.
			const renamer = createRenamer( rule( { find: 'IMG_', replace: 'X', regex: true, flags: 'y' } ) );

			expect( [ renamer.renameFile( 'IMG_1.jpg' ), renamer.renameFile( 'IMG_2.jpg' ) ] )
				.toEqual( [ 'X1.jpg', 'X2.jpg' ] );
		} );

		it( 'replaces only the first match without the g flag, as a directive does', () => {
			const renamer = createRenamer( rule( { find: 'a', replace: 'o', regex: true } ) );

			expect( renamer.renameFile( 'banana.jpg' ) ).toBe( 'bonana.jpg' );
		} );

		it( 'reports an unusable pattern rather than throwing, and renames nothing', () => {
			const renamer = createRenamer( rule( { find: '([a-', replace: 'x', regex: true } ) );

			expect( renamer.invalid ).toBe( true );
			expect( renamer.renameFile( 'IMG_1.jpg' ) ).toBe( 'IMG_1.jpg' );
		} );

		it( 'adds the replacement to the start when there is nothing to find', () => {
			// With the g flag the form gives every typed pattern, an empty one
			// matches between every two characters.
			const renamer = createRenamer( rule( { replace: 'Trip-', regex: true, flags: 'g' } ) );

			expect( renamer.invalid ).toBe( false );
			expect( renamer.renameFile( 'IMG_1.jpg' ) ).toBe( 'Trip-IMG_1.jpg' );
		} );
	} );
} );

describe( 'looksLikeDirective', () => {
	it( 'spots a directive that is not one, which would be published as written', () => {
		expect( looksLikeDirective( '{{Pics}}\n+rename = /^IMG_/-->Trip-' ) ).toBe( true );
	} );

	it( 'spots one written with a capital', () => {
		expect( looksLikeDirective( '{{Pics|+Rename = /x/-->y}}' ) ).toBe( true );
	} );

	it( 'spots a working one too, since a directive is read only from what the wiki sent', () => {
		expect( looksLikeDirective( '{{Pics|+rename = /^IMG_/-->Trip-}}' ) ).toBe( true );
	} );

	it( 'finds nothing in ordinary text', () => {
		expect( looksLikeDirective( '{{Pics}}' ) ).toBe( false );
	} );
} );
