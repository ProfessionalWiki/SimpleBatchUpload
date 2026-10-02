'use strict';

const { mount } = require( '@vue/test-utils' );

let StatusDock;

beforeAll( async () => {
	StatusDock = ( await import( '../../../res/ext.SimpleBatchUpload/StatusDock.vue' ) ).default;
} );

function countsOf( counts ) {
	return Object.assign( {
		total: 0,
		queued: 0,
		uploading: 0,
		done: 0,
		failed: 0,
		skipped: 0,
		held: 0,
		clash: 0
	}, counts );
}

/**
 * @param {Object} [props]
 * @return {Object}
 */
function dock( props ) {
	const given = props || {};

	return mount( StatusDock, {
		props: Object.assign( {}, given, {
			counts: countsOf( given.counts ),
			phase: given.phase || 'idle'
		} )
	} );
}

function bandText( wrapper ) {
	return wrapper.findAll( '.ext-sbu-dock__band-part' ).map( ( part ) => part.text() );
}

function summaryText( wrapper ) {
	return wrapper.findAll( '.ext-sbu-dock__summary-part' ).map( ( part ) => part.text() );
}

describe( 'what is waiting on the user', () => {
	it( 'says nothing while nothing is waiting', () => {
		expect( dock( { counts: { total: 3, done: 3 } } ).find( '.ext-sbu-dock__band' ).exists() )
			.toBe( false );
	} );

	it( 'counts the files the wiki asked about together with the ones sharing a name', () => {
		const wrapper = dock( { counts: { total: 20, held: 3, clash: 7 } } );

		expect( bandText( wrapper )[ 0 ] ).toBe( 'simplebatchupload-dock-on-hold(10)' );
	} );

	it( 'says how many of them would overwrite each other', () => {
		const wrapper = dock( { counts: { total: 20, held: 3, clash: 7 } } );

		expect( bandText( wrapper ) ).toContain( 'simplebatchupload-dock-overwriting(7)' );
	} );

	it( 'leaves that out when every file on hold shares a name, which it just said', () => {
		const wrapper = dock( { counts: { total: 20, clash: 7 } } );

		expect( bandText( wrapper ) ).toEqual( [ 'simplebatchupload-dock-on-hold(7)' ] );
	} );

	it( 'leaves that out when the only question is about the wiki', () => {
		const wrapper = dock( { counts: { total: 20, held: 3 } } );

		expect( bandText( wrapper ) ).toEqual( [ 'simplebatchupload-dock-on-hold(3)' ] );
	} );

	it( 'offers to show only what is waiting', async () => {
		const wrapper = dock( { counts: { total: 20, held: 3 } } );

		expect( wrapper.find( '.ext-sbu-dock__filter' ).text() )
			.toBe( 'simplebatchupload-dock-show-on-hold(3)' );

		await wrapper.find( '.ext-sbu-dock__filter' ).trigger( 'click' );

		expect( wrapper.emitted( 'toggle-filter' ) ).toHaveLength( 1 );
	} );

	it( 'offers the way back once the list is showing only what is waiting', () => {
		const wrapper = dock( { counts: { total: 20, held: 3 }, filtered: true } );

		expect( wrapper.find( '.ext-sbu-dock__filter' ).text() )
			.toBe( 'simplebatchupload-dock-show-all(20)' );
	} );
} );

describe( 'uploading and pausing', () => {
	function action( wrapper ) {
		return wrapper.find( '.ext-sbu-dock__action' );
	}

	it( 'offers to upload what is waiting', async () => {
		const wrapper = dock( { counts: { total: 2, queued: 2 } } );

		expect( action( wrapper ).text() ).toBe( 'simplebatchupload-dock-upload' );

		await action( wrapper ).trigger( 'click' );

		expect( wrapper.emitted( 'start' ) ).toHaveLength( 1 );
	} );

	it( 'draws Upload as the button to press, and Pause quietly', () => {
		expect( action( dock( { counts: { total: 2, queued: 2 } } ) ).classes() )
			.toContain( 'cdx-button--weight-primary' );
		expect( action( dock( { counts: { total: 2, uploading: 2 }, phase: 'uploading' } ) ).classes() )
			.not.toContain( 'cdx-button--weight-primary' );
	} );

	it( 'offers nothing to press once the batch has run out of files', () => {
		const wrapper = dock( { counts: { total: 2, done: 2 } } );

		expect( action( wrapper ).exists() ).toBe( false );
	} );

	it( 'offers nothing to press while files wait on an answer rather than on Upload', () => {
		const wrapper = dock( { counts: { total: 3, done: 1, held: 2 } } );

		expect( action( wrapper ).exists() ).toBe( false );
	} );

	it( 'leaves the line out altogether when it has nothing to say and nothing to press', () => {
		// Everything that arrived is waiting on the user: the band above says
		// so, and an empty strip under it says nothing at the height of a row.
		const wrapper = dock( { counts: { total: 1, held: 1 } } );

		expect( wrapper.find( '.ext-sbu-dock__band' ).exists() ).toBe( true );
		expect( wrapper.find( '.ext-sbu-dock__status' ).exists() ).toBe( false );
	} );

	it( 'keeps the line while the batch is running, even before anything has settled', () => {
		const wrapper = dock( { counts: { total: 2, uploading: 2 }, phase: 'uploading' } );

		expect( wrapper.find( '.ext-sbu-dock__status' ).exists() ).toBe( true );
	} );

	it( 'offers to pause instead once it is running', async () => {
		const wrapper = dock( { counts: { total: 2, uploading: 1, queued: 1 }, phase: 'uploading' } );

		expect( action( wrapper ).text() ).toBe( 'simplebatchupload-dock-pause' );

		await action( wrapper ).trigger( 'click' );

		expect( wrapper.emitted( 'pause' ) ).toHaveLength( 1 );
	} );

	it( 'offers Upload again while a pause takes hold, so it can be taken back', async () => {
		const wrapper = dock( { counts: { total: 3, uploading: 1, queued: 2 }, phase: 'pausing' } );

		expect( action( wrapper ).text() ).toBe( 'simplebatchupload-dock-upload' );

		await action( wrapper ).trigger( 'click' );

		expect( wrapper.emitted( 'start' ) ).toHaveLength( 1 );
	} );

	it( 'says how many files are finishing while the batch pauses', () => {
		const wrapper = dock( { counts: { total: 6, done: 1, uploading: 2, queued: 3 }, phase: 'pausing' } );

		expect( summaryText( wrapper )[ 0 ] ).toBe( 'simplebatchupload-dock-pausing(2)' );
	} );

	it( 'keeps keyboard focus on the button when Upload turns into Pause', async () => {
		// One button changing its label, not one button swapped for another:
		// removing the focused element drops focus to the page body.
		const wrapper = dock( { counts: { total: 2, queued: 2 } } );
		// Placed by hand: attachTo needs app.onUnmount, which Vue 3.4 lacks.
		document.body.appendChild( wrapper.element );

		action( wrapper ).element.focus();
		await wrapper.setProps( { counts: countsOf( { total: 2, uploading: 2 } ), phase: 'uploading' } );

		expect( document.activeElement.textContent.trim() ).toBe( 'simplebatchupload-dock-pause' );

		wrapper.element.remove();
	} );

	it( 'hands keyboard focus to the dock when the button goes, rather than to the page', async () => {
		// The batch finishing takes the button away; the dock is still there,
		// and saying how it ended.
		const wrapper = dock( { counts: { total: 2, uploading: 2 }, phase: 'uploading' } );
		document.body.appendChild( wrapper.element );

		action( wrapper ).element.focus();
		await wrapper.setProps( { counts: countsOf( { total: 2, done: 2 } ), phase: 'idle' } );
		// Moved once the button is out of the page, a tick after the update.
		await wrapper.vm.$nextTick();

		expect( document.activeElement ).toBe( wrapper.element );

		wrapper.element.remove();
	} );

	it( 'leaves focus where it is when the button goes without having had it', async () => {
		const wrapper = dock( { counts: { total: 2, uploading: 2 }, phase: 'uploading' } );
		const elsewhere = document.createElement( 'button' );
		document.body.appendChild( wrapper.element );
		document.body.appendChild( elsewhere );

		elsewhere.focus();
		await wrapper.setProps( { counts: countsOf( { total: 2, done: 2 } ), phase: 'idle' } );
		await wrapper.vm.$nextTick();

		expect( document.activeElement ).toBe( elsewhere );

		wrapper.element.remove();
		elsewhere.remove();
	} );

	it( 'leaves focus on another of its buttons when the batch ends', async () => {
		const wrapper = dock( { counts: { total: 3, uploading: 2, held: 1 }, phase: 'uploading' } );
		document.body.appendChild( wrapper.element );
		const filter = wrapper.find( '.ext-sbu-dock__filter' ).element;

		filter.focus();
		await wrapper.setProps( { counts: countsOf( { total: 3, done: 2, held: 1 } ), phase: 'idle' } );
		await wrapper.vm.$nextTick();

		expect( document.activeElement ).toBe( filter );

		wrapper.element.remove();
	} );

	describe( 'a second press straight after the first', () => {
		beforeEach( () => {
			vi.useFakeTimers();
		} );

		afterEach( () => {
			vi.useRealTimers();
		} );

		async function justStarted() {
			const wrapper = dock( { counts: { total: 2, queued: 2 } } );

			await wrapper.setProps( { counts: countsOf( { total: 2, uploading: 2 } ), phase: 'uploading' } );

			return wrapper;
		}

		it( 'is not taken as Pause, since it was meant for Upload', async () => {
			const wrapper = await justStarted();

			await action( wrapper ).trigger( 'click' );

			expect( wrapper.emitted( 'pause' ) ).toBeUndefined();
		} );

		it( 'is not taken as Upload straight after Pause, since it was meant for Pause', async () => {
			const wrapper = await justStarted();

			vi.advanceTimersByTime( 1000 );
			await wrapper.setProps( {
				counts: countsOf( { total: 2, uploading: 1, queued: 1 } ),
				phase: 'pausing'
			} );
			await action( wrapper ).trigger( 'click' );

			expect( wrapper.emitted( 'start' ) ).toBeUndefined();
		} );

		it( 'is taken as Pause once the moment has passed', async () => {
			const wrapper = await justStarted();

			vi.advanceTimersByTime( 1000 );
			await action( wrapper ).trigger( 'click' );

			expect( wrapper.emitted( 'pause' ) ).toHaveLength( 1 );
		} );
	} );
} );

describe( 'how far the batch has got', () => {
	it( 'counts what is settled against the whole batch', () => {
		const wrapper = dock( {
			counts: { total: 10, done: 4, failed: 1, uploading: 2, queued: 3 },
			phase: 'uploading'
		} );

		expect( summaryText( wrapper )[ 0 ] ).toBe( 'simplebatchupload-dock-uploading(5|10)' );
	} );

	it( 'leaves skipped files out of the count, since they are not being uploaded', () => {
		const wrapper = dock( {
			counts: { total: 4, skipped: 1, uploading: 3 },
			phase: 'uploading'
		} );

		expect( summaryText( wrapper )[ 0 ] ).toBe( 'simplebatchupload-dock-uploading(0|3)' );
	} );

	it( 'draws no progress for a skipped file before anything has been sent', () => {
		const wrapper = dock( { counts: { total: 4, skipped: 1, queued: 3 } } );

		expect( wrapper.find( 'progress' ).attributes( 'value' ) ).toBe( '0' );
	} );

	it( 'draws no progress when every file was skipped', () => {
		const wrapper = dock( { counts: { total: 2, skipped: 2 } } );

		expect( wrapper.find( 'progress' ).attributes( 'value' ) ).toBe( '0' );
	} );

	it( 'gives the figure to a progress element rather than to a drawing alone', () => {
		const wrapper = dock( {
			counts: { total: 10, done: 5, queued: 5 },
			phase: 'uploading'
		} );

		expect( wrapper.find( 'progress' ).attributes( 'value' ) ).toBe( '50' );
	} );

	it( 'says how much is waiting to go before anything has been started', () => {
		const wrapper = dock( { counts: { total: 3, queued: 3 } } );

		expect( summaryText( wrapper ) ).toEqual( [ 'simplebatchupload-dock-ready(3)' ] );
	} );

	it( 'reports what came of the batch once it is over', () => {
		const wrapper = dock( { counts: { total: 10, done: 7, failed: 2, skipped: 1 } } );

		expect( summaryText( wrapper ) ).toEqual( [
			'simplebatchupload-dock-uploaded(7)',
			'simplebatchupload-dock-failed(2)',
			'simplebatchupload-dock-skipped(1)'
		] );
	} );

	it( 'leaves out a tally of nothing', () => {
		const wrapper = dock( { counts: { total: 7, done: 7 } } );

		expect( summaryText( wrapper ) ).toEqual( [ 'simplebatchupload-dock-uploaded(7)' ] );
	} );

	it( 'passes on how much longer the wiki\'s rate limit makes it', () => {
		const wrapper = dock( {
			counts: { total: 10, done: 5, queued: 5 },
			phase: 'uploading',
			remaining: 'About 9 minutes left.'
		} );

		expect( summaryText( wrapper ) ).toContain( 'About 9 minutes left.' );
	} );

	it( 'explains a batch the wiki stopped, which the user did not ask for', () => {
		const wrapper = dock( {
			counts: { total: 10, done: 5, queued: 5 },
			stoppedByLimit: true
		} );

		expect( wrapper.find( '.ext-sbu-dock__stopped' ).text() )
			.toBe( 'simplebatchupload-rate-limit-paused' );
	} );

	it( 'says nothing of the sort about a batch the user stopped', () => {
		const wrapper = dock( { counts: { total: 10, done: 5, queued: 5 } } );

		expect( wrapper.find( '.ext-sbu-dock__stopped' ).exists() ).toBe( false );
	} );
} );
