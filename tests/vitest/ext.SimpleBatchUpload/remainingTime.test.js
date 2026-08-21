const {
	estimateRemainingMs,
	describeRemaining
} = require( '../../../res/ext.SimpleBatchUpload/remainingTime.js' );

const PACED = { waitMs: 10000, intervalMs: 5000 };

describe( 'estimateRemainingMs', () => {
	it( 'counts only the current wait when one file is left', () => {
		expect( estimateRemainingMs( 1, PACED ) ).toBe( 10000 );
	} );

	it( 'adds one interval for every file queued behind the next release', () => {
		expect( estimateRemainingMs( 4, PACED ) ).toBe( 10000 + 3 * 5000 );
	} );

	it( 'says nothing while the wiki has refused nothing', () => {
		// No schedule means no pacing, so there is no wait to describe.
		expect( estimateRemainingMs( 20, null ) ).toBeNull();
	} );

	it( 'says nothing once no files are left', () => {
		expect( estimateRemainingMs( 0, PACED ) ).toBeNull();
	} );
} );

describe( 'describeRemaining', () => {
	it( 'rounds up to whole minutes rather than inventing precision', () => {
		expect( describeRemaining( 61000 ) ).toBe( 'simplebatchupload-estimate-minutes(2)' );
	} );

	it( 'says less than a minute rather than counting seconds down', () => {
		expect( describeRemaining( 4000 ) ).toBe( 'simplebatchupload-estimate-under-a-minute' );
	} );

	it( 'never reads as no time left while files remain', () => {
		expect( describeRemaining( 60000 ) ).toBe( 'simplebatchupload-estimate-minutes(1)' );
	} );

	it( 'says nothing when there is nothing to estimate', () => {
		expect( describeRemaining( null ) ).toBeNull();
	} );
} );
