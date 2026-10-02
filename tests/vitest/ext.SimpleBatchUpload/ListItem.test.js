'use strict';

const { mount } = require( '@vue/test-utils' );

let ListItem;

beforeAll( async () => {
	ListItem = ( await import( '../../../res/ext.SimpleBatchUpload/ListItem.vue' ) ).default;
} );

/**
 * @param {Object} [props]
 * @return {Object}
 */
function item( props ) {
	return mount( ListItem, {
		props: props || {},
		slots: {
			lead: '<i class="probe-lead"></i>',
			text: '<i class="probe-text"></i>',
			end: '<i class="probe-end"></i>'
		}
	} );
}

describe( 'ListItem', () => {
	it( 'is a line of the list, so it is a list item', () => {
		expect( item().element.tagName ).toBe( 'LI' );
	} );

	it( 'puts what it is given in the order a line reads', () => {
		const found = item().findAll( '.probe-lead, .probe-text, .probe-end' )
			.map( ( probe ) => probe.classes()[ 0 ] );

		expect( found ).toEqual( [ 'probe-lead', 'probe-text', 'probe-end' ] );
	} );

	it( 'leaves the leading box plain by default, for content that frames itself', () => {
		expect( item().find( '.ext-sbu-item__lead' ).classes() )
			.toContain( 'ext-sbu-item__lead--plain' );
	} );

	it( 'outlines the leading box where nothing is in it yet', () => {
		expect( item( { lead: 'outlined' } ).find( '.ext-sbu-item__lead' ).classes() )
			.toContain( 'ext-sbu-item__lead--outlined' );
	} );

	it( 'keeps the classes the line is given, which a wiki may be styling', () => {
		const wrapper = mount( ListItem, { attrs: { class: 'ext-sbu-row ext-sbu-row--done' } } );

		expect( wrapper.classes() ).toEqual(
			expect.arrayContaining( [ 'ext-sbu-item', 'ext-sbu-row', 'ext-sbu-row--done' ] )
		);
	} );
} );
