'use strict';

const { mount } = require( '@vue/test-utils' );
const { reactive } = require( 'vue' );
const { pageName } = require( '../../../res/ext.SimpleBatchUpload/nameClash.js' );

let UploadPanel;

beforeAll( async () => {
	UploadPanel = ( await import( '../../../res/ext.SimpleBatchUpload/UploadPanel.vue' ) ).default;
} );

/**
 * A stand-in for the batch, so the panel is tested on what it draws and what it
 * asks for rather than on what an upload does.
 *
 * @param {Object[]} [rows]
 * @param {Object} [extra]
 * @return {Object}
 */
/**
 * What the batch would count for these rows.
 *
 * @param {Object[]} rows
 * @return {Object}
 */
function countsFor( rows ) {
	const counts = { total: rows.length, queued: 0, uploading: 0, done: 0, failed: 0,
		skipped: 0, held: 0, clash: 0 };

	rows.forEach( ( row ) => {
		counts[ row.status ] += 1;
	} );

	return counts;
}

function batchHolding( rows, extra ) {
	const held = reactive( ( rows || [] ).map( ( row, index ) => {
		const filled = Object.assign( {
			id: index + 1,
			name: 'File' + index + '.png',
			targetName: 'File' + index + '.png',
			status: 'queued',
			path: '',
			size: 1024,
			detail: '',
			progress: 0,
			thumbnail: '',
			href: '',
			position: 0,
			outOf: 0
		}, row );

		return Object.assign( filled, { pageName: pageName( filled.targetName ) } );
	} ) );

	const asked = [];

	return Object.assign( {
		rows: held,
		asked: asked,
		room: 100,
		maxFiles: 100,
		state: {
			phase: 'idle',
			stoppedByLimit: false,
			admitted: 0,
			turnedAway: 0,
			renamePatternInvalid: false
		},
		counts: countsFor( held ),
		addFiles: ( entries ) => asked.push( [ 'addFiles', entries ] ),
		retryFile: ( id ) => asked.push( [ 'retryFile', id ] ),
		replaceFile: ( id ) => asked.push( [ 'replaceFile', id ] ),
		replaceFiles: ( ids ) => asked.push( [ 'replaceFiles', ids ] ),
		addFileBack: ( id ) => asked.push( [ 'addFileBack', id ] ),
		skipFile: ( id ) => asked.push( [ 'skipFile', id ] ),
		skipFiles: ( ids ) => asked.push( [ 'skipFiles', ids ] ),
		keepFile: ( id ) => asked.push( [ 'keepFile', id ] ),
		description: '{{Pics}}',
		rule: { find: '', replace: '', regex: false, flags: '' },
		renameCount: { changed: 0, of: held.length },
		renamedRows: [],
		textLooksLikeDirective: false,
		remaining: '',
		setDescription: ( text ) => asked.push( [ 'setDescription', text ] ),
		setRule: ( given ) => asked.push( [ 'setRule', given ] ),
		liftDirective: () => {
			asked.push( [ 'liftDirective' ] );
			return false;
		},
		start: () => asked.push( [ 'start' ] ),
		pause: () => asked.push( [ 'pause' ] )
	}, extra || {} );
}

function panelFor( batch, props ) {
	return mount( UploadPanel, {
		props: Object.assign( { batch: batch }, props || {} )
	} );
}

/**
 * The container that is both the list and the drop target. The description
 * folds away above it, outside the target.
 *
 * @param {Object} wrapper
 * @return {Object}
 */
function target( wrapper ) {
	return wrapper.find( '.ext-sbu-panel' );
}

function rowNames( wrapper ) {
	return wrapper.findAll( '.ext-sbu-row__title' ).map( ( title ) => title.text() );
}

function headings( wrapper ) {
	return wrapper.findAll( '.ext-sbu-group__text' ).map( ( text ) => text.text() );
}

function announced( wrapper ) {
	return wrapper.find( '.ext-sbu-panel [role="status"]' ).text();
}

function turnedAway( wrapper ) {
	return wrapper.find( '.ext-sbu-panel__turned-away' );
}

/**
 * A drop of plain files read the way a folder's are, through entries.
 *
 * @param {string[]} names
 * @return {Object} What to pass to trigger( 'drop' )
 */
function entriesDropped( names ) {
	return {
		dataTransfer: {
			items: names.map( ( name ) => ( {
				kind: 'file',
				webkitGetAsEntry: () => ( {
					isFile: true,
					isDirectory: false,
					name: name,
					file: ( ok ) => ok( new File( [ 'x' ], name ) )
				} )
			} ) ),
			files: []
		}
	};
}

/**
 * Lets a drop's entries be read, which takes a turn of the event loop.
 *
 * @param {Object} wrapper
 */
async function afterReading( wrapper ) {
	await new Promise( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await wrapper.vm.$nextTick();
}

describe( 'the way to add files', () => {
	it( 'is one generous target rather than a box beside a list', () => {
		const wrapper = panelFor( batchHolding() );

		expect( wrapper.find( '.ext-sbu-add--empty' ).exists() ).toBe( true );
		expect( wrapper.findAll( '.ext-sbu-row' ) ).toHaveLength( 0 );
	} );

	it( 'is itself the way to open the file picker, not just a box beside one', async () => {
		const wrapper = panelFor( batchHolding() );
		const opened = [];

		wrapper.find( 'input[type="file"]' ).element.addEventListener(
			'click', () => opened.push( 'picker' )
		);
		await wrapper.find( '.ext-sbu-add__all' ).trigger( 'click' );

		expect( opened ).toEqual( [ 'picker' ] );
	} );

	it( 'opens the picker from the add line once the list has files in it too', async () => {
		const wrapper = panelFor( batchHolding( [ {} ] ) );
		const opened = [];

		wrapper.find( 'input[type="file"]' ).element.addEventListener(
			'click', () => opened.push( 'picker' )
		);
		await wrapper.find( '.ext-sbu-add__select' ).trigger( 'click' );

		expect( opened ).toEqual( [ 'picker' ] );
	} );

	it( 'still shows the word that says so, without a button inside a button', () => {
		const wrapper = panelFor( batchHolding() );

		expect( wrapper.find( '.ext-sbu-add__select' ).text() )
			.toBe( 'simplebatchupload-buttonlabel' );
		expect( wrapper.findAll( '.ext-sbu-add__all button' ) ).toHaveLength( 0 );
	} );

	it( 'takes the dashed edge itself, rather than framing the icon inside it', () => {
		const wrapper = panelFor( batchHolding() );

		expect( wrapper.find( '.ext-sbu-panel' ).classes() ).toContain( 'ext-sbu-panel--empty' );
		expect( wrapper.find( '.ext-sbu-add .ext-sbu-item__lead' ).exists() ).toBe( false );
	} );

	it( 'puts the way to add files above the dock, and outside the list of files', () => {
		// Adding files belongs with the description; what is worth pinning as
		// the list scrolls is the state of the batch. The add line goes with
		// the first, so it is not a list item and not inside the list.
		const wrapper = panelFor( batchHolding( [ {} ] ) );
		const named = [ 'ext-sbu-add', 'ext-sbu-dock', 'ext-sbu-list' ];
		const order = Array.from( wrapper.element.querySelectorAll( named
			.map( ( name ) => '.' + name ).join( ', ' ) ) )
			.map( ( el ) => named.find( ( name ) => el.classList.contains( name ) ) );

		expect( order ).toEqual( [ 'ext-sbu-add', 'ext-sbu-dock', 'ext-sbu-list' ] );
		expect( wrapper.find( '.ext-sbu-list .ext-sbu-add' ).exists() ).toBe( false );
		expect( wrapper.find( '.ext-sbu-add' ).element.tagName ).toBe( 'DIV' );
	} );

	it( 'keeps the file rows as list items, which the add line no longer is', () => {
		const wrapper = panelFor( batchHolding( [ {}, {} ] ) );

		expect( wrapper.findAll( '.ext-sbu-list > li' ) ).toHaveLength( 2 );
	} );

	it( 'builds the add line out of the same frame as a file line, so the two line up', () => {
		// The whole reason the frame is its own component: the icon column and
		// the text column have to agree between the two kinds of line, and
		// nothing notices when they stop agreeing until it is visible.
		const wrapper = panelFor( batchHolding( [ {} ] ) );

		expect( wrapper.find( '.ext-sbu-add' ).classes() ).toContain( 'ext-sbu-item' );
		expect( wrapper.find( '.ext-sbu-row' ).classes() ).toContain( 'ext-sbu-item' );
	} );

	it( 'goes back to a framed icon and a button of its own once there are files', () => {
		const wrapper = panelFor( batchHolding( [ {} ] ) );

		expect( wrapper.find( '.ext-sbu-panel' ).classes() ).not.toContain( 'ext-sbu-panel--empty' );
		expect( wrapper.find( '.ext-sbu-add .ext-sbu-item__lead' ).exists() ).toBe( true );
		expect( wrapper.find( '.ext-sbu-add__all' ).exists() ).toBe( false );
	} );

	it( 'shows no dock while there is no file to say anything about', () => {
		const dock = panelFor( batchHolding() ).find( '.ext-sbu-dock' );

		expect( dock.exists() && dock.isVisible() ).toBe( false );
	} );

	it( 'asks for a first selection while there is none, and for more once there is', () => {
		expect( panelFor( batchHolding() ).find( '.ext-sbu-item__title' ).text() )
			.toBe( 'simplebatchupload-add-first' );
		expect( panelFor( batchHolding( [ {} ] ) ).find( '.ext-sbu-item__title' ).text() )
			.toBe( 'simplebatchupload-add-more' );
	} );

	it( 'gives a first selection its own hint, not the one for adding more', () => {
		expect( panelFor( batchHolding() ).find( '.ext-sbu-add__hint' ).text() )
			.toBe( 'simplebatchupload-add-hint' );
	} );

	it( 'says how many files a first selection may hold, where the wiki sets a limit', () => {
		expect( panelFor( batchHolding( [], { room: 5 } ) ).text() )
			.toContain( 'simplebatchupload-add-capacity(5)' );
	} );

	it( 'says nothing of a limit where there is none', () => {
		expect( panelFor( batchHolding( [], { room: Infinity } ) ).text() ).not.toContain( 'add-capacity' );
	} );
} );

describe( 'putting the list in order', () => {
	it( 'leads with the files sharing a name, which nothing but this page can see', () => {
		const wrapper = panelFor( batchHolding( [
			{ name: 'Plain.png', targetName: 'Plain.png' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'B.png', targetName: 'B.png', status: 'held' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' }
		] ) );

		expect( rowNames( wrapper ) ).toEqual( [ 'A.png', 'A.png', 'B.png', 'Plain.png' ] );
	} );

	it( 'puts files sharing a name next to each other, however they were selected', () => {
		const wrapper = panelFor( batchHolding( [
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'B.png', targetName: 'B.png', status: 'clash' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'B.png', targetName: 'B.png', status: 'clash' }
		] ) );

		expect( rowNames( wrapper ) ).toEqual( [ 'A.png', 'A.png', 'B.png', 'B.png' ] );
	} );

	it( 'heads each kind of question with what it is and how to answer it at once', () => {
		const wrapper = panelFor( batchHolding( [
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'B.png', targetName: 'B.png', status: 'held' }
		] ) );

		expect( headings( wrapper ) ).toEqual( [
			'simplebatchupload-group-clash(1)',
			'simplebatchupload-group-held(1)'
		] );
	} );

	it( 'heads nothing when there is nothing to answer', () => {
		expect( headings( panelFor( batchHolding( [ {}, {} ] ) ) ) ).toEqual( [] );
	} );

	it( 'skips a whole group at once rather than one file at a time', async () => {
		const batch = batchHolding( [
			{},
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' }
		] );

		await panelFor( batch ).find( '.ext-sbu-group--clash .ext-sbu-group__action' ).trigger( 'click' );

		expect( batch.asked ).toEqual( [ [ 'skipFiles', [ 2, 3 ] ] ] );
	} );

	it( 'replaces every file the wiki asked about at once', async () => {
		const batch = batchHolding( [
			{},
			{ name: 'A.png', targetName: 'A.png', status: 'held' },
			{ name: 'B.png', targetName: 'B.png', status: 'held' }
		] );

		await panelFor( batch ).find( '.ext-sbu-group--held .ext-sbu-group__action' ).trigger( 'click' );

		expect( batch.asked ).toEqual( [ [ 'replaceFiles', [ 2, 3 ] ] ] );
	} );

	it( 'says on each group\'s button what it does to the group', () => {
		const wrapper = panelFor( batchHolding( [
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'B.png', targetName: 'B.png', status: 'held' }
		] ) );

		expect( wrapper.find( '.ext-sbu-group--clash .ext-sbu-group__action' ).text() )
			.toContain( 'simplebatchupload-group-skip-all' );
		expect( wrapper.find( '.ext-sbu-group--held .ext-sbu-group__action' ).text() )
			.toContain( 'simplebatchupload-group-replace-all(1)' );
	} );
} );

describe( 'narrowing the list to what is waiting', () => {
	it( 'drops everything that is not waiting on an answer', async () => {
		const wrapper = panelFor( batchHolding( [
			{ name: 'Plain.png', targetName: 'Plain.png' },
			{ name: 'A.png', targetName: 'A.png', status: 'held' }
		] ) );

		await wrapper.find( '.ext-sbu-dock__filter' ).trigger( 'click' );

		expect( rowNames( wrapper ) ).toEqual( [ 'A.png' ] );
		expect( wrapper.find( '.ext-sbu-dock__filter' ).text() )
			.toContain( 'simplebatchupload-dock-show-all' );
	} );

	it( 'shows everything again once the last file on hold has been answered', async () => {
		// The button that turns the filter off lives on the band, and the band
		// is only there while something is on hold. Working through the holds
		// -- which is what the filter is for -- always ends at none, and would
		// otherwise leave a list showing nothing with no way back.
		const rows = [
			{ name: 'Plain.png', targetName: 'Plain.png', status: 'done' },
			{ name: 'A.png', targetName: 'A.png', status: 'held' }
		];
		const batch = batchHolding( rows );
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-dock__filter' ).trigger( 'click' );

		expect( rowNames( wrapper ) ).toEqual( [ 'A.png' ] );

		batch.rows[ 1 ].status = 'skipped';
		batch.counts.held = 0;
		batch.counts.skipped = 1;
		await wrapper.vm.$nextTick();

		expect( rowNames( wrapper ) ).toEqual( [ 'Plain.png', 'A.png' ] );
	} );
} );

describe( 'what a row asks the batch to do', () => {
	it( 'passes each decision on with the file it is about', async () => {
		const batch = batchHolding( [
			{ status: 'failed' },
			{ status: 'clash', name: 'A.png', targetName: 'A.png' },
			{ status: 'clash', name: 'A.png', targetName: 'A.png' },
			{ status: 'held' }
		] );
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-row__action--retry' ).trigger( 'click' );
		await wrapper.find( '.ext-sbu-row__action--keep' ).trigger( 'click' );
		await wrapper.find( '.ext-sbu-row__action--replace' ).trigger( 'click' );

		expect( batch.asked ).toEqual( [ [ 'retryFile', 1 ], [ 'keepFile', 2 ], [ 'replaceFile', 4 ] ] );
	} );

	it( 'skips a waiting file and adds a skipped one back', async () => {
		const batch = batchHolding( [ { status: 'queued' }, { status: 'skipped' } ] );
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-row__action--skip' ).trigger( 'click' );
		await wrapper.find( '.ext-sbu-row__action--add-back' ).trigger( 'click' );

		expect( batch.asked ).toEqual( [ [ 'skipFile', 1 ], [ 'addFileBack', 2 ] ] );
	} );

} );

describe( 'a file going up', () => {
	it( 'redraws its own row, not the whole panel, as its progress moves', async () => {
		// Two hundred rows, four of them moving every fifty milliseconds: a
		// panel that redrew on each tick would be the page's main cost.
		let panelUpdates = 0;
		const batch = batchHolding( [ { status: 'uploading' }, {} ] );
		const wrapper = mount( UploadPanel, {
			props: { batch: batch },
			global: {
				mixins: [ {
					updated() {
						if ( this.$options.name === 'UploadPanel' ) {
							panelUpdates += 1;
						}
					}
				} ]
			}
		} );

		batch.rows[ 0 ].progress = 0.5;
		await wrapper.vm.$nextTick();

		expect( wrapper.find( '.ext-sbu-row progress' ).attributes( 'value' ) ).toBe( '50' );
		expect( panelUpdates ).toBe( 0 );
	} );

	it( 'draws no waiting row again when Upload is pressed', async () => {
		// A thousand rows drawn again is a freeze of a third of a second, and
		// the same again when a pause takes hold.
		let rowUpdates = 0;
		const batch = batchHolding( [ {}, {}, {} ] );
		batch.state = reactive( batch.state );
		const wrapper = mount( UploadPanel, {
			props: { batch: batch },
			global: {
				mixins: [ {
					updated() {
						if ( 'row' in ( this.$props || {} ) ) {
							rowUpdates += 1;
						}
					}
				} ]
			}
		} );

		batch.state.phase = 'uploading';
		await wrapper.vm.$nextTick();

		expect( wrapper.find( '.ext-sbu-panel' ).classes() ).toContain( 'ext-sbu-panel--running' );
		expect( rowUpdates ).toBe( 0 );
	} );
} );

describe( 'what the dock is told', () => {
	it( 'passes on how long the wiki\'s rate limit makes the batch, and why it stopped', () => {
		const batch = batchHolding( [ { status: 'uploading' } ], {
			remaining: 'About 9 minutes left.'
		} );
		batch.state.phase = 'uploading';
		batch.state.stoppedByLimit = true;
		const text = panelFor( batch ).find( '.ext-sbu-dock' ).text();

		expect( text ).toContain( 'About 9 minutes left.' );
		expect( text ).toContain( 'simplebatchupload-rate-limit-paused' );
	} );
} );

describe( 'what the dock asks the batch to do', () => {
	it( 'uploads what is waiting', async () => {
		const batch = batchHolding( [ {}, {} ] );
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-dock__action' ).trigger( 'click' );

		expect( batch.asked ).toEqual( [ [ 'start' ] ] );
	} );

	it( 'pauses a batch that is running', async () => {
		const batch = batchHolding( [ { status: 'uploading' } ] );
		batch.state.phase = 'uploading';
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-dock__action' ).trigger( 'click' );

		expect( batch.asked ).toEqual( [ [ 'pause' ] ] );
	} );
} );

function section( wrapper, name ) {
	return wrapper.find( 'details.ext-sbu-' + name );
}

function ruleField( wrapper, index ) {
	return wrapper.findAll( '.ext-sbu-rename input' )[ index ];
}

describe( 'the text for each file page', () => {
	it( 'starts open when the wiki put text in it, so it is seen before Upload', () => {
		expect( section( panelFor( batchHolding() ), 'text' ).attributes( 'open' ) ).toBeDefined();
	} );

	it( 'starts closed when there is none', () => {
		const wrapper = panelFor( batchHolding( [], { description: '' } ) );

		expect( section( wrapper, 'text' ).attributes( 'open' ) ).toBeUndefined();
	} );

	it( 'follows the batch, so an edit made anywhere shows in the field', async () => {
		const held = reactive( { description: '{{Pics}}' } );
		const batch = batchHolding();

		Object.defineProperty( batch, 'description', {
			get: () => held.description,
			configurable: true
		} );

		const wrapper = panelFor( batch );
		held.description = '{{Scan}}';
		await wrapper.vm.$nextTick();

		expect( wrapper.find( '.ext-sbu-text textarea' ).element.value ).toBe( '{{Scan}}' );
	} );

	it( 'hands an edit straight to the batch, which owns it', async () => {
		const batch = batchHolding();
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-text textarea' ).setValue( '{{Scan}}' );

		expect( batch.asked ).toEqual( [ [ 'setDescription', '{{Scan}}' ] ] );
	} );

	it( 'reads a directive typed into it into the rule once the field is left', async () => {
		const batch = batchHolding();
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-text textarea' ).trigger( 'blur' );

		expect( batch.asked ).toEqual( [ [ 'liftDirective' ] ] );
	} );

	it( 'opens Rename files when leaving it read a directive into the rule', async () => {
		const batch = batchHolding();
		batch.liftDirective = () => true;
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-text textarea' ).trigger( 'blur' );

		expect( section( wrapper, 'rename' ).attributes( 'open' ) ).toBeDefined();
	} );

	it( 'leaves Rename files as the user left it when there was no directive to read', async () => {
		const batch = batchHolding( [], { rule: { find: 'x', replace: 'y', regex: false, flags: '' } } );
		const wrapper = panelFor( batch );

		section( wrapper, 'rename' ).element.open = false;
		await section( wrapper, 'rename' ).trigger( 'toggle' );
		await wrapper.find( '.ext-sbu-text textarea' ).trigger( 'blur' );

		expect( section( wrapper, 'rename' ).attributes( 'open' ) ).toBeUndefined();
	} );

	it( 'warns when it holds what looks like a directive but is not one', () => {
		const wrapper = panelFor( batchHolding( [], { textLooksLikeDirective: true } ) );

		expect( section( wrapper, 'text' ).text() ).toContain( 'simplebatchupload-text-looks-like-directive' );
	} );

	it( 'warns of nothing in ordinary text', () => {
		expect( section( panelFor( batchHolding() ), 'text' ).text() )
			.not.toContain( 'simplebatchupload-text-looks-like-directive' );
	} );

	it( 'is named after its title', () => {
		expect( panelFor( batchHolding() ).find( '.ext-sbu-text textarea' ).attributes( 'aria-label' ) )
			.toBe( 'simplebatchupload-text-title' );
	} );
} );

describe( 'the rule the files are renamed by', () => {
	function withRule( rule, extra ) {
		return batchHolding( [ {}, {}, {} ], Object.assign( {
			rule: Object.assign( { find: '', replace: '', regex: false, flags: '' }, rule )
		}, extra ) );
	}

	it( 'starts closed when there is no rule', () => {
		expect( section( panelFor( withRule( {} ) ), 'rename' ).attributes( 'open' ) ).toBeUndefined();
	} );

	it( 'starts open when the page brought a rule that only adds to the start', () => {
		expect( section( panelFor( withRule( { replace: 'Trip-' } ) ), 'rename' ).attributes( 'open' ) )
			.toBeDefined();
	} );

	it( 'starts open when the page brought one', () => {
		const wrapper = panelFor( withRule( { find: '^IMG_', replace: 'Trip-', regex: true } ) );

		expect( section( wrapper, 'rename' ).attributes( 'open' ) ).toBeDefined();
	} );

	it( 'shows the rule it holds', () => {
		const wrapper = panelFor( withRule( { find: '^IMG_', replace: 'Trip-', regex: true } ) );

		expect( ruleField( wrapper, 0 ).element.value ).toBe( '^IMG_' );
		expect( ruleField( wrapper, 1 ).element.value ).toBe( 'Trip-' );
		expect( ruleField( wrapper, 2 ).element.checked ).toBe( true );
	} );

	it( 'hands each field to the batch with the rest of the rule', async () => {
		const batch = withRule( { find: 'IMG_', replace: '', regex: false } );
		const wrapper = panelFor( batch );

		await ruleField( wrapper, 1 ).setValue( 'Trip-' );
		await ruleField( wrapper, 2 ).setValue( true );

		expect( batch.asked ).toEqual( [
			[ 'setRule', expect.objectContaining( { find: 'IMG_', replace: 'Trip-', regex: false } ) ],
			[ 'setRule', expect.objectContaining( { find: 'IMG_', replace: '', regex: true } ) ]
		] );
	} );

	it( 'says that an empty Find adds to the start, which nobody would guess', () => {
		expect( ruleField( panelFor( withRule( {} ) ), 0 ).attributes( 'placeholder' ) )
			.toBe( 'simplebatchupload-rename-find-placeholder' );
	} );

	it( 'counts the names it changes among the files waiting', () => {
		const wrapper = panelFor( withRule( { find: 'IMG_' }, { renameCount: { changed: 9, of: 11 } } ) );

		expect( wrapper.find( '.ext-sbu-rename [role="status"]' ).text() )
			.toBe( 'simplebatchupload-rename-count(9|11)' );
	} );

	it( 'says when Find matches no file name, which no syntax check would', () => {
		const wrapper = panelFor( withRule( { find: 'XYZ' }, { renameCount: { changed: 0, of: 3 } } ) );

		expect( wrapper.find( '.ext-sbu-rename [role="status"]' ).text() )
			.toBe( 'simplebatchupload-rename-matches-nothing' );
	} );

	it( 'says nothing about names while there is no rule', () => {
		expect( panelFor( withRule( {} ) ).find( '.ext-sbu-rename [role="status"]' ).text() ).toBe( '' );
	} );

	it( 'says nothing about names while there are no files to rename', () => {
		const wrapper = panelFor( batchHolding( [], {
			rule: { find: 'IMG_', replace: 'Trip-', regex: false, flags: '' }
		} ) );

		expect( wrapper.find( '.ext-sbu-rename [role="status"]' ).text() ).toBe( '' );
	} );

	it( 'says nothing about names while the pattern is not one, which the field says', () => {
		const wrapper = panelFor( withRule( { find: '(IMG', regex: true }, {
			state: { phase: 'idle', stoppedByLimit: false, admitted: 0, turnedAway: 0,
				renamePatternInvalid: true }
		} ) );

		expect( wrapper.find( '.ext-sbu-rename [role="status"]' ).text() ).toBe( '' );
	} );

	it( 'narrows the list to the files it renames, and widens it again', async () => {
		const batch = batchHolding( [
			{ name: 'IMG_1.png', targetName: 'Trip-1.png' },
			{ name: 'Plain.png', targetName: 'Plain.png' },
			// Renamed under an earlier rule, but skipped: not one of them.
			{ name: 'IMG_9.png', targetName: 'Trip-9.png', status: 'skipped' }
		], {
			rule: { find: 'IMG_', replace: 'Trip-', regex: false, flags: '' },
			renameCount: { changed: 1, of: 2 }
		} );
		batch.renamedRows = [ batch.rows[ 0 ] ];
		const wrapper = panelFor( batch );
		const toggle = () => wrapper.find( '.ext-sbu-rename__filter' );

		expect( toggle().text() ).toBe( 'simplebatchupload-rename-show-only(1)' );

		await toggle().trigger( 'click' );

		expect( rowNames( wrapper ) ).toEqual( [ 'simplebatchupload-rename-label(IMG_1.png|Trip-1.png)' ] );
		expect( toggle().text() ).toBe( 'simplebatchupload-dock-show-all(3)' );

		await toggle().trigger( 'click' );

		expect( rowNames( wrapper ) ).toHaveLength( 3 );
	} );

	it( 'keeps the way back while the list is narrowed, even once every file is renamed', async () => {
		const counted = reactive( { renameCount: { changed: 1, of: 2 } } );
		const batch = batchHolding( [ { name: 'IMG_1.png', targetName: 'Trip-1.png' }, {} ], {
			rule: { find: 'IMG_', replace: 'Trip-', regex: false, flags: '' }
		} );
		Object.defineProperty( batch, 'renameCount', { get: () => counted.renameCount } );
		batch.renamedRows = [ batch.rows[ 0 ] ];
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-rename__filter' ).trigger( 'click' );
		counted.renameCount = { changed: 2, of: 2 };
		await wrapper.vm.$nextTick();

		expect( wrapper.find( '.ext-sbu-rename__filter' ).exists() ).toBe( true );
	} );

	it( 'shows every file again once the rule renames none of them', async () => {
		const renamed = reactive( { rows: [] } );
		const batch = batchHolding( [ { name: 'IMG_1.png', targetName: 'Trip-1.png' }, {} ], {
			rule: { find: 'IMG_', replace: 'Trip-', regex: false, flags: '' },
			renameCount: { changed: 1, of: 2 }
		} );
		renamed.rows = [ batch.rows[ 0 ] ];
		Object.defineProperty( batch, 'renamedRows', { get: () => renamed.rows } );
		const wrapper = panelFor( batch );

		await wrapper.find( '.ext-sbu-rename__filter' ).trigger( 'click' );
		renamed.rows = [];
		await wrapper.vm.$nextTick();

		expect( wrapper.findAll( '.ext-sbu-row' ) ).toHaveLength( 2 );
	} );

	it( 'offers no narrowing when Find matches nothing', () => {
		const wrapper = panelFor( withRule( { find: 'XYZ' }, { renameCount: { changed: 0, of: 3 } } ) );

		expect( wrapper.find( '.ext-sbu-rename__filter' ).exists() ).toBe( false );
	} );

	it( 'offers no narrowing when every file waiting is renamed, which would change nothing', () => {
		const wrapper = panelFor( withRule( { replace: 'Trip-' }, { renameCount: { changed: 3, of: 3 } } ) );

		expect( wrapper.find( '.ext-sbu-rename__filter' ).exists() ).toBe( false );
	} );

	describe( 'a pattern that is not one', () => {
		beforeEach( () => {
			vi.useFakeTimers();
		} );

		afterEach( () => {
			vi.useRealTimers();
			document.body.innerHTML = '';
		} );

		function invalid() {
			return withRule( { find: '(IMG', regex: true }, {
				state: { phase: 'idle', stoppedByLimit: false, admitted: 0,
					turnedAway: 0, renamePatternInvalid: true }
			} );
		}

		function errorShown( wrapper ) {
			return section( wrapper, 'rename' ).text().includes( 'simplebatchupload-error-rename-pattern' );
		}

		it( 'is said once typing has paused rather than on every key', async () => {
			const wrapper = panelFor( invalid() );

			await ruleField( wrapper, 0 ).trigger( 'input' );

			expect( errorShown( wrapper ) ).toBe( false );

			vi.advanceTimersByTime( 600 );
			await wrapper.vm.$nextTick();

			expect( errorShown( wrapper ) ).toBe( true );
		} );

		it( 'is said at once when the field is left', async () => {
			const wrapper = panelFor( invalid() );

			await ruleField( wrapper, 0 ).trigger( 'input' );
			await ruleField( wrapper, 0 ).trigger( 'blur' );

			expect( errorShown( wrapper ) ).toBe( true );
		} );

		it( 'is not said in the middle of composing a character', async () => {
			const wrapper = panelFor( invalid() );

			await ruleField( wrapper, 0 ).trigger( 'compositionstart' );
			vi.advanceTimersByTime( 600 );
			await wrapper.vm.$nextTick();

			expect( errorShown( wrapper ) ).toBe( false );
		} );

		it( 'is said once a composed character is finished and typing pauses', async () => {
			const wrapper = panelFor( invalid() );

			await ruleField( wrapper, 0 ).trigger( 'compositionstart' );
			await ruleField( wrapper, 0 ).trigger( 'compositionend' );
			vi.advanceTimersByTime( 600 );
			await wrapper.vm.$nextTick();

			expect( errorShown( wrapper ) ).toBe( true );
		} );

		it( 'is said when the page brought it, with nothing typed', () => {
			expect( errorShown( panelFor( invalid() ) ) ).toBe( true );
		} );

		it( 'is where Upload takes the user, instead of uploading every file unrenamed', async () => {
			const batch = invalid();
			const wrapper = panelFor( batch );
			document.body.appendChild( wrapper.element );

			section( wrapper, 'rename' ).element.open = false;
			await section( wrapper, 'rename' ).trigger( 'toggle' );
			await ruleField( wrapper, 0 ).trigger( 'input' );
			await wrapper.find( '.ext-sbu-dock__action' ).trigger( 'click' );
			await wrapper.vm.$nextTick();

			expect( section( wrapper, 'rename' ).attributes( 'open' ) ).toBeDefined();
			expect( errorShown( wrapper ) ).toBe( true );
			expect( document.activeElement ).toBe( ruleField( wrapper, 0 ).element );
		} );
	} );
} );

describe( 'once Upload is pressed', () => {
	it( 'locks the text and the rule, since each file takes what is there when it is sent', () => {
		const batch = batchHolding( [ { status: 'uploading' } ] );
		batch.state.phase = 'uploading';
		const wrapper = panelFor( batch );

		expect( wrapper.find( '.ext-sbu-text textarea' ).attributes( 'disabled' ) ).toBeDefined();
		expect( wrapper.findAll( '.ext-sbu-rename input' ).every(
			( input ) => input.attributes( 'disabled' ) !== undefined
		) ).toBe( true );
	} );

	it( 'keeps them locked while a pause takes hold', () => {
		const batch = batchHolding( [ { status: 'uploading' } ] );
		batch.state.phase = 'pausing';

		expect( panelFor( batch ).find( '.ext-sbu-text textarea' ).attributes( 'disabled' ) ).toBeDefined();
	} );

	it( 'puts away the skip buttons, since a waiting file\'s turn can come at any moment', () => {
		const batch = batchHolding( [ { status: 'queued' } ] );
		batch.state.phase = 'uploading';

		expect( panelFor( batch ).find( '.ext-sbu-panel' ).classes() ).toContain( 'ext-sbu-panel--running' );
	} );

	it( 'offers the skip buttons while the batch waits for Upload', () => {
		expect( panelFor( batchHolding( [ {} ] ) ).find( '.ext-sbu-panel' ).classes() )
			.not.toContain( 'ext-sbu-panel--running' );
	} );
} );

describe( 'what a screen reader is told', () => {
	it( 'is not a paragraph, which a skin would style as prose', () => {
		// Citizen pulls a list up under the paragraph before it. The live
		// region sits directly before the file list, so as a <p> it would slide
		// the first row under the sticky dock.
		const region = panelFor( batchHolding() ).find( '.ext-sbu-panel [role="status"]' );

		expect( region.element.tagName ).not.toBe( 'P' );
	} );

	it( 'keeps a place to say it, mounted before there is anything to say', () => {
		// A live region added at the moment it fills is not announced.
		const wrapper = panelFor( batchHolding() );

		expect( wrapper.find( '.ext-sbu-panel [role="status"]' ).exists() ).toBe( true );
	} );

	it( 'says how many files are ready as they arrive, since Upload is waiting for them', () => {
		const wrapper = panelFor( batchHolding( [ {}, {} ] ) );

		expect( wrapper.find( '.ext-sbu-panel [role="status"]' ).text() ).toBe( 'simplebatchupload-dock-ready(2)' );
	} );

	it( 'says what came of the batch once it has run out of things to do', () => {
		const wrapper = panelFor( batchHolding( [ {}, {}, {} ], {
			counts: { total: 3, queued: 0, uploading: 0, done: 1, failed: 1,
				skipped: 0, held: 1, clash: 0 }
		} ) );

		expect( wrapper.find( '.ext-sbu-panel [role="status"]' ).text() ).toBe( [
			'simplebatchupload-dock-uploaded(1)',
			'simplebatchupload-dock-failed(1)',
			'simplebatchupload-dock-on-hold(1)'
		].join( 'comma-separator' ) );
	} );

	it( 'counts the files sharing a name as on hold, and says what was skipped', () => {
		const wrapper = panelFor( batchHolding( [
			{ status: 'done' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ name: 'A.png', targetName: 'A.png', status: 'clash' },
			{ status: 'skipped' }
		] ) );

		expect( announced( wrapper ) ).toContain( 'simplebatchupload-dock-on-hold(2)' );
		expect( announced( wrapper ) ).toContain( 'simplebatchupload-dock-skipped(1)' );
	} );

	it( 'keeps quiet while the batch is still running', () => {
		const wrapper = panelFor( batchHolding( [ {} ], {
			state: { phase: 'uploading', stoppedByLimit: false, admitted: 1,
				turnedAway: 0, renamePatternInvalid: false }
		} ) );

		expect( wrapper.find( '.ext-sbu-panel [role="status"]' ).text() ).toBe( '' );
	} );

	it( 'keeps the file picker out of the way, since the buttons stand for it', () => {
		const input = panelFor( batchHolding() ).find( 'input[type="file"]' );

		expect( input.attributes( 'tabindex' ) ).toBe( '-1' );
		expect( input.attributes( 'aria-hidden' ) ).toBe( 'true' );
	} );
} );

describe( 'taking files in', () => {
	it( 'adds what the file picker gives it', async () => {
		const batch = batchHolding();
		const wrapper = panelFor( batch );
		const file = new File( [ 'x' ], 'A.png' );

		Object.defineProperty( wrapper.find( 'input[type="file"]' ).element, 'files', {
			value: [ file ],
			writable: true
		} );
		await wrapper.find( 'input[type="file"]' ).trigger( 'change' );

		expect( batch.asked ).toEqual( [ [ 'addFiles', [ { file: file, path: '' } ] ] ] );
	} );

	it( 'clears the picker, so choosing the same file again is still a change', async () => {
		// A file input that keeps its value fires no change event for the same
		// selection, so a file removed from the list could not be put back
		// without going through another one first.
		const wrapper = panelFor( batchHolding() );
		const input = wrapper.find( 'input[type="file"]' );
		const cleared = [];

		Object.defineProperty( input.element, 'files', { value: [], writable: true } );
		Object.defineProperty( input.element, 'value', {
			get: () => 'C:\\fakepath\\A.png',
			set: ( value ) => {
				cleared.push( value );
			}
		} );
		await input.trigger( 'change' );

		expect( cleared ).toEqual( [ '' ] );
	} );

	it( 'shows the whole panel as the target while something is over it', async () => {
		// Said with the border alone: anything that adds a line to the panel
		// moves every row under it the moment the pointer arrives.
		const wrapper = panelFor( batchHolding( [ {}, {} ] ) );

		await target( wrapper ).trigger( 'dragenter' );

		expect( target( wrapper ).classes() ).toContain( 'ext-sbu-panel--dragging' );
		expect( wrapper.findAll( '.ext-sbu-row' ) ).toHaveLength( 2 );
	} );

	it( 'stays the target while the pointer crosses the rows inside it', async () => {
		const wrapper = panelFor( batchHolding( [ {}, {} ] ) );

		await target( wrapper ).trigger( 'dragenter' );
		await target( wrapper ).trigger( 'dragenter' );
		await target( wrapper ).trigger( 'dragleave' );

		expect( target( wrapper ).classes() ).toContain( 'ext-sbu-panel--dragging' );
	} );

	it( 'stops being the target after a hover, which fires dragover repeatedly', async () => {
		const wrapper = panelFor( batchHolding( [ {}, {} ] ) );

		await target( wrapper ).trigger( 'dragenter' );
		await target( wrapper ).trigger( 'dragover' );
		await target( wrapper ).trigger( 'dragover' );
		await target( wrapper ).trigger( 'dragover' );
		await target( wrapper ).trigger( 'dragleave' );

		expect( target( wrapper ).classes() ).not.toContain( 'ext-sbu-panel--dragging' );
	} );

	it( 'stops being the target once something is dropped', async () => {
		const wrapper = panelFor( batchHolding( [ {} ] ) );

		await target( wrapper ).trigger( 'dragenter' );
		await target( wrapper ).trigger( 'drop', { dataTransfer: { items: [], files: [] } } );

		expect( target( wrapper ).classes() ).not.toContain( 'ext-sbu-panel--dragging' );
	} );

	it( 'stops being the target once the pointer has left for good', async () => {
		const wrapper = panelFor( batchHolding( [ {}, {} ] ) );

		await target( wrapper ).trigger( 'dragenter' );
		await target( wrapper ).trigger( 'dragleave' );

		expect( target( wrapper ).classes() ).not.toContain( 'ext-sbu-panel--dragging' );
	} );

	it( 'adds plainly dropped files without going looking for folders', async () => {
		const batch = batchHolding();
		const wrapper = panelFor( batch );
		const file = new File( [ 'x' ], 'A.png' );

		await target( wrapper ).trigger( 'drop', {
			dataTransfer: { items: [], files: [ file ] }
		} );

		expect( batch.asked ).toEqual( [ [ 'addFiles', [ { file: file, path: '' } ] ] ] );
	} );

	it( 'says a dropped folder was cut short, without a count it cannot have', async () => {
		// readEntryTree stops at the batch's room, so what was left out was
		// never seen and cannot be counted -- only reported.
		const wrapper = panelFor( batchHolding( [], { room: 1, maxFiles: 5 } ) );

		await target( wrapper ).trigger( 'drop', entriesDropped( [ 'A.png', 'B.png' ] ) );
		await afterReading( wrapper );

		expect( turnedAway( wrapper ).text() ).toBe( 'simplebatchupload-drop-truncated(5)' );
	} );

	it( 'says nothing of the sort when a dropped folder just fits', async () => {
		const wrapper = panelFor( batchHolding( [], { room: 1 } ) );

		await target( wrapper ).trigger( 'drop', entriesDropped( [ 'A.png' ] ) );
		await afterReading( wrapper );

		expect( turnedAway( wrapper ).exists() ).toBe( false );
	} );

	it( 'forgets a folder was cut short once the next files are picked or dropped', async () => {
		const picked = panelFor( batchHolding( [], { room: 1, maxFiles: 5 } ) );
		const dropped = panelFor( batchHolding( [], { room: 1, maxFiles: 5 } ) );

		await target( picked ).trigger( 'drop', entriesDropped( [ 'A.png', 'B.png' ] ) );
		await target( dropped ).trigger( 'drop', entriesDropped( [ 'A.png', 'B.png' ] ) );
		await afterReading( picked );
		await afterReading( dropped );
		Object.defineProperty( picked.find( 'input[type="file"]' ).element, 'files', { value: [] } );
		await picked.find( 'input[type="file"]' ).trigger( 'change' );
		await target( dropped ).trigger( 'drop', { dataTransfer: { items: [], files: [] } } );

		expect( turnedAway( picked ).exists() ).toBe( false );
		expect( turnedAway( dropped ).exists() ).toBe( false );
	} );

	it( 'says how much of a selection was taken when it did not all fit', () => {
		const wrapper = panelFor( batchHolding( [ {} ], {
			state: { phase: 'idle', stoppedByLimit: false, admitted: 100, turnedAway: 50,
				renamePatternInvalid: false }
		} ) );

		expect( turnedAway( wrapper ).text() ).toContain( 'simplebatchupload-max-files-reached(100|150)' );
	} );

	it( 'adds what it finds in a dropped folder', async () => {
		const batch = batchHolding();
		const wrapper = panelFor( batch );

		await target( wrapper ).trigger( 'drop', entriesDropped( [ 'A.png' ] ) );
		await afterReading( wrapper );

		expect( batch.asked.map( ( asked ) => asked[ 0 ] ) ).toEqual( [ 'addFiles' ] );
		expect( batch.asked[ 0 ][ 1 ].map( ( entry ) => entry.file.name ) ).toEqual( [ 'A.png' ] );
	} );

	it( 'says nothing of the sort when everything was taken', () => {
		expect( turnedAway( panelFor( batchHolding( [ {} ] ) ) ).exists() ).toBe( false );
	} );
} );
