'use strict';

const { mount } = require( '@vue/test-utils' );
const icons = require( '../mocks/icons.json' );

let FileRow;

beforeAll( async () => {
	FileRow = ( await import( '../../../res/ext.SimpleBatchUpload/FileRow.vue' ) ).default;
} );

/**
 * A row as the batch holds one, with the given fields in place of the defaults.
 *
 * @param {Object} fields
 * @return {Object}
 */
function rowOf( fields ) {
	return Object.assign( {
		name: 'Photo.jpg',
		targetName: '',
		status: 'queued',
		path: '',
		size: null,
		detail: '',
		progress: 0,
		thumbnail: '',
		href: '',
		position: 0,
		outOf: 0,
		noExtension: false
	}, fields );
}

/**
 * @param {Object} fields The row's fields
 * @return {Object}
 */
function row( fields ) {
	return mount( FileRow, { props: { row: rowOf( fields ) } } );
}

/**
 * What a sighted user reads on the buttons, without the name each one carries
 * for a screen reader.
 *
 * @param {Object} wrapper
 * @return {string[]}
 */
function actionLabels( wrapper ) {
	return wrapper.findAll( '.ext-sbu-row__action-label' ).map( ( label ) => label.text() );
}

/**
 * Which icon a row settled on, as the one thing that tells two of them apart.
 *
 * @param {Object} wrapper
 * @return {string}
 */
function markShape( wrapper ) {
	return wrapper.find( '.ext-sbu-slot path' ).attributes( 'd' );
}

/**
 * The mark the stub draws for an icon, to compare a row's against.
 *
 * @param {string} icon
 * @return {string}
 */
function shapeOf( icon ) {
	return icons[ icon ].match( /d="([^"]+)"/ )[ 1 ];
}

/**
 * How much of the ring is drawn, from 0 to 1, whatever units it is drawn in.
 *
 * @param {Object} wrapper
 * @return {number}
 */
function drawn( wrapper ) {
	const fill = wrapper.find( '.ext-sbu-slot__fill' );

	return 1 - Number( fill.attributes( 'stroke-dashoffset' ) ) /
		Number( fill.attributes( 'stroke-dasharray' ) );
}

function metaParts( wrapper ) {
	return wrapper.findAll( '.ext-sbu-row__meta-part' ).map( ( part ) => part.text() );
}

describe( 'FileRow', () => {
	it( 'shows the file name', () => {
		expect( row( {} ).find( '.ext-sbu-row__title' ).text() ).toBe( 'Photo.jpg' );
	} );

	it( 'shows what a renamed file will be called, which is what the wiki will hold', () => {
		const wrapper = row( { name: 'IMG_1.jpg', targetName: 'Trip-IMG_1.jpg' } );

		expect( wrapper.find( '.ext-sbu-row__title' ).text() )
			.toBe( 'simplebatchupload-rename-label(IMG_1.jpg|Trip-IMG_1.jpg)' );
	} );

	it( 'shows the name once where nothing renamed it', () => {
		expect( row( { name: 'Photo.jpg', targetName: 'Photo.jpg' } )
			.find( '.ext-sbu-row__title' ).text() ).toBe( 'Photo.jpg' );
	} );

	it( 'takes its title from the list line, so every line reads at one weight', () => {
		expect( row( {} ).find( '.ext-sbu-row__title' ).classes() )
			.toContain( 'ext-sbu-item__title' );
	} );

	it( 'carries its state as a class, so a wiki can still style rows from Common.css', () => {
		expect( row( { status: 'failed' } ).find( 'li' ).classes() ).toContain( 'ext-sbu-row--failed' );
	} );

	describe( 'the status slot', () => {
		it( 'is a ring while the file is queued or uploading', () => {
			expect( row( { status: 'queued' } ).find( 'svg circle' ).exists() ).toBe( true );
			expect( row( { status: 'uploading' } ).find( 'svg circle' ).exists() ).toBe( true );
		} );

		it( 'stops the ring animating while a file only waits its turn', () => {
			const fill = row( { status: 'queued', progress: 0.4 } ).find( '.ext-sbu-slot__fill' );

			expect( fill.classes() ).toContain( 'ext-sbu-slot__fill--idle' );
		} );

		it( 'empties the ring again for a file put back in the queue after a failure', () => {
			expect( drawn( row( { status: 'queued', progress: 0.4 } ) ) ).toBeCloseTo( 0, 3 );
		} );

		it( 'hangs the mark inside the slot rather than being it, so both are one size', () => {
			// A CdxIcon that is itself the slot stretches its 20 unit viewBox to
			// the slot's size, which would draw the mark half again as large as
			// the ring it replaces.
			const wrapper = row( { status: 'done' } );

			expect( wrapper.find( '.ext-sbu-slot' ).classes() ).not.toContain( 'cdx-icon' );
			expect( wrapper.find( '.ext-sbu-slot .cdx-icon' ).exists() ).toBe( true );
		} );

		it( 'winds the ring round as the file goes up', () => {
			expect( drawn( row( { status: 'uploading', progress: 0.5 } ) ) ).toBeCloseTo( 0.5, 3 );
			expect( drawn( row( { status: 'uploading', progress: 1 } ) ) ).toBeCloseTo( 1, 3 );
		} );

		it( 'reports the same nothing to a screen reader that the ring draws', () => {
			// A file refused by the rate limit goes back to queued with the
			// figure it reached; the ring empties, and the number has to agree.
			const progress = row( { status: 'queued', progress: 1 } ).find( 'progress' );

			expect( progress.attributes( 'value' ) ).toBe( '0' );
		} );

		it( 'exposes the figure through a real progress element rather than a role', () => {
			const progress = row( { status: 'uploading', progress: 0.41 } ).find( 'progress' );

			expect( progress.attributes( 'value' ) ).toBe( '41' );
			expect( progress.attributes( 'max' ) ).toBe( '100' );
		} );

		it( 'becomes a mark once there is nothing left to count', () => {
			expect( row( { status: 'done' } ).find( 'svg circle' ).exists() ).toBe( false );
			expect( row( { status: 'done' } ).find( '.ext-sbu-slot--done' ).exists() ).toBe( true );
			expect( row( { status: 'failed' } ).find( '.ext-sbu-slot--failed' ).exists() ).toBe( true );
			expect( row( { status: 'skipped' } ).find( '.ext-sbu-slot--skipped' ).exists() ).toBe( true );
		} );

		it( 'marks a file on the wiki as a success and one that failed as an error', () => {
			expect( markShape( row( { status: 'done' } ) ) ).toBe( shapeOf( 'cdxIconSuccess' ) );
			expect( markShape( row( { status: 'failed' } ) ) ).toBe( shapeOf( 'cdxIconError' ) );
		} );

		it( 'gives a decision its own mark rather than the one for a file that was dropped', () => {
			const skipped = markShape( row( { status: 'skipped' } ) );

			expect( markShape( row( { status: 'held' } ) ) ).not.toBe( skipped );
			expect( markShape( row( { status: 'clash' } ) ) ).not.toBe( skipped );
		} );

		it( 'draws the mark inside an svg, without which the path data is not a shape', () => {
			expect( row( { status: 'done' } ).find( '.ext-sbu-slot svg path' ).exists() ).toBe( true );
		} );

		it( 'names the mark, because the word it replaced is gone', () => {
			expect( row( { status: 'done' } ).find( '.ext-sbu-slot' ).text() )
				.toContain( 'simplebatchupload-status-done' );
		} );

		it( 'leaves the figure itself readable rather than hidden behind the drawing', () => {
			const progress = row( { status: 'uploading', progress: 0.41 } ).find( 'progress' );

			expect( progress.attributes( 'aria-label' ) ).toBe( 'simplebatchupload-status-uploading' );
			expect( row( { status: 'uploading' } ).find( '.ext-sbu-slot svg' ).attributes( 'aria-hidden' ) )
				.toBe( 'true' );
		} );
	} );

	describe( 'what the row offers to do', () => {
		it( 'draws Retry as a reload icon, inside an svg like every other icon on the row', () => {
			expect( row( { status: 'failed' } ).find( '.ext-sbu-row__action svg path' ).attributes( 'd' ) )
				.toBe( shapeOf( 'cdxIconReload' ) );
		} );

		it( 'offers to skip a waiting file before Upload is pressed', async () => {
			const wrapper = row( { status: 'queued', name: 'Cat.jpg' } );
			const button = wrapper.find( '.ext-sbu-row__action' );

			expect( button.attributes( 'aria-label' ) ).toBe( 'simplebatchupload-action-skip-file(Cat.jpg)' );

			await button.trigger( 'click' );

			expect( wrapper.emitted( 'skip' ) ).toHaveLength( 1 );
		} );

		it( 'marks the skip button, for the panel to put away once Upload is pressed', () => {
			// Its turn can come at any moment from then on. Put away by the
			// panel rather than by each row, so a thousand rows are not all
			// drawn again when Upload is pressed.
			expect( row( { status: 'queued' } ).find( '.ext-sbu-row__action--skip' ).exists() ).toBe( true );
		} );

		it( 'offers to add a skipped file back', async () => {
			const wrapper = row( { status: 'skipped' } );

			expect( actionLabels( wrapper ) ).toEqual( [ 'simplebatchupload-action-add-back' ] );

			await wrapper.find( '.ext-sbu-row__action' ).trigger( 'click' );

			expect( wrapper.emitted( 'add-back' ) ).toHaveLength( 1 );
		} );

		it( 'offers a retry once a file has failed', async () => {
			const wrapper = row( { status: 'failed' } );

			await wrapper.find( '.ext-sbu-row__action' ).trigger( 'click' );

			expect( wrapper.emitted( 'retry' ) ).toHaveLength( 1 );
		} );

		it( 'asks yes or no about a file the wiki already holds', () => {
			expect( actionLabels( row( { status: 'held' } ) ) ).toEqual( [
				'simplebatchupload-action-replace', 'simplebatchupload-action-skip'
			] );
		} );

		it( 'overwrites the file on the wiki when the user says yes', async () => {
			const wrapper = row( { status: 'held' } );

			await wrapper.findAll( '.ext-sbu-row__action' )[ 0 ].trigger( 'click' );

			expect( wrapper.emitted( 'replace' ) ).toHaveLength( 1 );
		} );

		it( 'leaves the file on the wiki as it is when the user says no', async () => {
			const wrapper = row( { status: 'held' } );

			await wrapper.findAll( '.ext-sbu-row__action' )[ 1 ].trigger( 'click' );

			expect( wrapper.emitted( 'skip' ) ).toHaveLength( 1 );
		} );

		it( 'asks which one to keep when a name is used twice, rather than asking about each', async () => {
			const wrapper = row( { status: 'clash' } );

			expect( actionLabels( wrapper ) ).toEqual( [ 'simplebatchupload-action-keep' ] );

			await wrapper.find( '.ext-sbu-row__action' ).trigger( 'click' );

			expect( wrapper.emitted( 'keep' ) ).toHaveLength( 1 );
		} );

		it( 'offers nothing on a file that is uploading or finished with', () => {
			expect( row( { status: 'done' } ).findAll( '.ext-sbu-row__action' ) ).toHaveLength( 0 );
			expect( row( { status: 'uploading' } ).findAll( '.ext-sbu-row__action' ) ).toHaveLength( 0 );
		} );

		it( 'names an icon-only button, which has no word to hang the file name on', () => {
			const button = row( { status: 'failed', name: 'Cat.jpg' } ).find( '.ext-sbu-row__action' );

			expect( button.attributes( 'aria-label' ) )
				.toBe( 'simplebatchupload-action-retry(Cat.jpg)' );
		} );

		it( 'names the file in every button, so they are not all called the same thing', () => {
			const held = row( { status: 'held', name: 'Cat.jpg' } ).findAll( '.ext-sbu-row__action' );
			const skipped = row( { status: 'skipped', name: 'Cat.jpg' } ).find( '.ext-sbu-row__action' );
			const naming = expect.stringContaining( 'simplebatchupload-action-for-file(Cat.jpg)' );

			expect( held.map( ( button ) => button.text() ) ).toEqual( [ naming, naming ] );
			expect( skipped.text() ).toEqual( naming );
		} );

		it( 'draws Replace as the choice to make, and Skip quietly beside it', () => {
			const wrapper = row( { status: 'held' } );

			expect( wrapper.find( '.ext-sbu-row__action--replace' ).classes() )
				.toContain( 'cdx-button--action-progressive' );
			expect( wrapper.find( '.ext-sbu-row__action--skip' ).classes() )
				.not.toContain( 'cdx-button--action-progressive' );
		} );
	} );

	describe( 'what the row says about the file', () => {
		it( 'says nothing it was not told', () => {
			expect( metaParts( row( {} ) ) ).toEqual( [] );
		} );

		it( 'gives the size in the wiki\'s own words', () => {
			expect( metaParts( row( { size: 1024 * 1024 } ) ) ).toEqual( [ 'size-megabytes(1)' ] );
		} );

		it( 'leads with the folder, which is all that separates two files sharing a name', () => {
			expect( metaParts( row( { path: 'Holiday/', size: 1024 } ) ) )
				.toEqual( [ 'Holiday/', 'size-kilobytes(1)' ] );
		} );

		it( 'counts a file within its clash group', () => {
			expect( metaParts( row( { status: 'clash', position: 2, outOf: 3 } ) ) )
				.toEqual( [ 'simplebatchupload-row-nth-of(2|3)' ] );
		} );

		it( 'keeps quiet about a position when the name is only used once', () => {
			expect( metaParts( row( { position: 1, outOf: 1 } ) ) ).toEqual( [] );
		} );

		it( 'says before Upload that the name it is getting has no file extension', () => {
			expect( metaParts( row( { status: 'queued', noExtension: true } ) ) )
				.toEqual( [ 'simplebatchupload-row-no-extension' ] );
			expect( metaParts( row( { status: 'clash', noExtension: true } ) ) )
				.toContain( 'simplebatchupload-row-no-extension' );
		} );

		it( 'leaves that to the wiki once the file has been sent', () => {
			expect( metaParts( row( { status: 'failed', noExtension: true, detail: 'Bad name.' } ) ) )
				.toEqual( [ 'Bad name.' ] );
		} );

		it( 'passes on whatever the wiki said about the file', () => {
			expect( metaParts( row( { status: 'failed', detail: 'The file is corrupt.' } ) ) )
				.toEqual( [ 'The file is corrupt.' ] );
		} );
	} );

	describe( 'the preview', () => {
		it( 'hands the preview to Codex rather than drawing a box of its own', () => {
			const wrapper = row( { thumbnail: 'data:image/jpeg;base64,AAA' } );

			expect( wrapper.findComponent( { name: 'CdxThumbnail' } ).props( 'thumbnail' ) )
				.toEqual( { url: 'data:image/jpeg;base64,AAA' } );
		} );

		it( 'loads a preview that arrives after the row is drawn', async () => {
			// CdxThumbnail loads its image in onMounted and never watches the
			// prop, and a preview drawn in the worker always arrives after the
			// row is on the page.
			const { reactive } = require( 'vue' );
			const loads = [];
			const RealImage = globalThis.Image;
			globalThis.Image = function () {
				return {
					set src( url ) {
						loads.push( url );
					}
				};
			};
			const file = reactive( rowOf( {} ) );
			const wrapper = mount( FileRow, { props: { row: file } } );

			file.thumbnail = 'data:image/jpeg;base64,AAA';
			await wrapper.vm.$nextTick();
			globalThis.Image = RealImage;

			expect( loads ).toContain( 'data:image/jpeg;base64,AAA' );
		} );

		it( 'falls back to an icon rather than a gap where a preview was not made', () => {
			const thumb = row( {} ).findComponent( { name: 'CdxThumbnail' } );

			expect( thumb.props( 'thumbnail' ) ).toBe( null );
		} );
	} );

	describe( 'the link to the file page', () => {
		it( 'appears once the file is on the wiki', () => {
			const wrapper = row( { status: 'done', href: '/wiki/File:Photo.jpg' } );

			expect( wrapper.find( 'a.ext-sbu-row__title' ).attributes( 'href' ) ).toBe( '/wiki/File:Photo.jpg' );
		} );

		it( 'keeps the new name on the link', () => {
			const wrapper = row( {
				name: 'IMG_1.jpg',
				targetName: 'Trip-IMG_1.jpg',
				status: 'done',
				href: '/wiki/File:Trip-IMG_1.jpg'
			} );

			expect( wrapper.find( 'a.ext-sbu-row__title' ).text() )
				.toBe( 'simplebatchupload-rename-label(IMG_1.jpg|Trip-IMG_1.jpg)' );
		} );

		it( 'is absent while there is no page to link to', () => {
			expect( row( { status: 'uploading' } ).find( 'a.ext-sbu-row__title' ).exists() ).toBe( false );
		} );
	} );
} );
