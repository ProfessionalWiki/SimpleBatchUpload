'use strict';

const { groupNameClashes, pageName } = require( '../../../res/ext.SimpleBatchUpload/nameClash.js' );

/**
 * The grouper works on whatever the batch will send, so a test entry is just the
 * page name a target name gives and something to identify it by.
 *
 * @param {...string} targetNames
 * @return {Object[]}
 */
function batch( ...targetNames ) {
	return targetNames.map( ( targetName, index ) => (
		{ id: index, pageName: pageName( targetName ) }
	) );
}

function idsOf( members ) {
	return members.map( ( member ) => member.id );
}

describe( 'groupNameClashes', () => {
	it( 'finds nothing in a batch where every name is distinct', () => {
		expect( groupNameClashes( batch( 'a.jpg', 'b.jpg', 'c.jpg' ) ) ).toEqual( [] );
	} );

	it( 'groups two files that would land on the same file page', () => {
		const groups = groupNameClashes( batch( 'a.jpg', 'shared.jpg', 'shared.jpg' ) );

		expect( groups ).toHaveLength( 1 );
		expect( idsOf( groups[ 0 ] ) ).toEqual( [ 1, 2 ] );
	} );

	it( 'groups names that differ only in the first letter, which the wiki capitalises', () => {
		const groups = groupNameClashes( batch( 'photo.jpg', 'Photo.jpg' ) );

		expect( groups ).toHaveLength( 1 );
		expect( idsOf( groups[ 0 ] ) ).toEqual( [ 0, 1 ] );
	} );

	it( 'keeps separate groups separate', () => {
		const groups = groupNameClashes(
			batch( 'one.jpg', 'two.jpg', 'one.jpg', 'two.jpg', 'one.jpg' )
		);

		expect( groups.map( idsOf ) ).toEqual( [ [ 0, 2, 4 ], [ 1, 3 ] ] );
	} );

	it( 'orders groups by where each one first appears, so the list does not jump about', () => {
		const groups = groupNameClashes( batch( 'later.jpg', 'first.jpg', 'first.jpg', 'later.jpg' ) );

		expect( groups.map( idsOf ) ).toEqual( [ [ 0, 3 ], [ 1, 2 ] ] );
	} );

	it( 'leaves a name the wiki cannot turn into a title alone rather than grouping it', () => {
		const groups = groupNameClashes( batch( '', '', 'real.jpg' ) );

		expect( groups ).toEqual( [] );
	} );
} );
