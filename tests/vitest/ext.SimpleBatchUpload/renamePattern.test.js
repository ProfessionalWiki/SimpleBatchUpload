const {
	parseRenameDirective
} = require( '../../../res/ext.SimpleBatchUpload/renamePattern.js' );

describe( 'parseRenameDirective', () => {
	it( 'leaves the file name alone when the description has no directive', () => {
		const directive = parseRenameDirective( '{{Photo|author=Ada}}' );

		expect( directive.renameFile( 'holiday snap.jpg' ) ).toBe( 'holiday snap.jpg' );
		expect( directive.text ).toBe( '{{Photo|author=Ada}}' );
	} );

	it( 'renames the file according to the directive', () => {
		const directive = parseRenameDirective( '{{Photo| +rename = !^IMG_!g -->Holiday-}}' );

		expect( directive.renameFile( 'IMG_0042.jpg' ) ).toBe( 'Holiday-0042.jpg' );
	} );

	it( 'treats a space after the arrow as part of the replacement', () => {
		const directive = parseRenameDirective( '{{Photo| +rename = !^IMG_!g --> Holiday-}}' );

		expect( directive.renameFile( 'IMG_0042.jpg' ) ).toBe( ' Holiday-0042.jpg' );
	} );

	it( 'keeps the directive out of the text stored on the file page', () => {
		const directive = parseRenameDirective(
			'{{Photo| +rename = !^IMG_!g --> Holiday-|author=Ada}}'
		);

		expect( directive.text ).toBe( '{{Photo|author=Ada}}' );
	} );

	it( 'reports an unusable pattern instead of throwing', () => {
		const directive = parseRenameDirective( '{{Photo| +rename = !([a-!g --> x}}' );

		expect( directive.invalid ).toBe( true );
	} );

	it( 'uploads under the selected name when the pattern is unusable', () => {
		const directive = parseRenameDirective( '{{Photo| +rename = !([a-!g --> x}}' );

		expect( directive.renameFile( 'IMG_0042.jpg' ) ).toBe( 'IMG_0042.jpg' );
	} );
} );
