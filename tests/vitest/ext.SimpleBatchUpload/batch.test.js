'use strict';

const { watch, nextTick } = require( 'vue' );
const { createBatch } = require( '../../../res/ext.SimpleBatchUpload/batch.js' );
const { createUploadQueue } = require( '../../../res/ext.SimpleBatchUpload/uploadQueue.js' );
const { createRateLimitGate } = require( '../../../res/ext.SimpleBatchUpload/rateLimitGate.js' );

/**
 * @param {string} name
 * @param {number} [bytes]
 * @return {File}
 */
function fileNamed( name, bytes ) {
	return new File( [ new Uint8Array( bytes || 8 ) ], name, { type: 'image/jpeg' } );
}

/**
 * @param {string[]} paths Slash separated, the last part being the file name
 * @return {{file: File, path: string}[]}
 */
function dropped( paths ) {
	return paths.map( ( name ) => {
		const parts = name.split( '/' );

		return { file: fileNamed( parts.pop() ), path: parts.length ? parts.join( '/' ) + '/' : '' };
	} );
}

function stored( filename ) {
	return { upload: { result: 'Success', filename: filename } };
}

function alreadyThere( filename ) {
	return {
		upload: {
			result: 'Warning',
			filekey: filename + '.key',
			warnings: { exists: filename }
		}
	};
}

/**
 * A warning with nothing kept: the stash failed, which it always does for a
 * user who is not logged in.
 *
 * @param {Object} warnings
 * @return {Object}
 */
function unstashed( warnings ) {
	return {
		upload: {
			result: 'Warning',
			warnings: warnings,
			stasherrors: [ { code: 'uploadstash-exception' } ]
		}
	};
}

function refused( code, info ) {
	return { error: { code: code, info: info } };
}

/**
 * Answers one canned response per call, per file name. The last answer for a
 * name is repeated, so a name that always succeeds needs only one. An answer
 * given as a function is called for a promise, so a test can hold it back.
 *
 * @param {Object} answers Name to a response, or to a list of responses
 * @return {Object}
 */
function wikiAnswering( answers ) {
	const remaining = {};

	Object.keys( answers ).forEach( ( name ) => {
		remaining[ name ] = [].concat( answers[ name ] );
	} );

	const calls = [];

	return {
		calls: calls,

		upload( params, onProgress ) {
			calls.push( params );

			if ( onProgress ) {
				onProgress( 0.5 );
			}

			const queued = remaining[ params.filename ] || [ stored( params.filename ) ];
			const answer = queued.length > 1 ? queued.shift() : queued[ 0 ];

			return typeof answer === 'function' ? answer() : Promise.resolve( answer );
		}
	};
}

function openGate() {
	return {
		wait: () => Promise.resolve( true ),
		resume() {},
		noteRateLimited() {},
		noteProgress() {},
		schedule: () => null,
		stopped: () => false
	};
}

/**
 * A real gate, pacing to the wiki's limit, on a clock that moves only when the
 * test wakes the files sleeping on it.
 *
 * @return {{gate: Object, sleepers: Object[], now: Function, wakeAll: Function}}
 */
function pacedGate() {
	let time = 0;
	const sleepers = [];
	const gate = createRateLimitGate( {
		now: () => time,
		sleep: ( ms ) => new Promise( ( wake ) => {
			sleepers.push( { at: time + ms, wake: wake } );
		} ),
		limit: { intervalMs: 5000, windowMs: 60000 }
	} );
	gate.noteRateLimited();

	return {
		gate: gate,
		sleepers: sleepers,
		now: () => time,
		wakeAll: () => {
			time = Math.max.apply( null, sleepers.map( ( sleeper ) => sleeper.at ) );
			sleepers.forEach( ( sleeper ) => sleeper.wake() );
		}
	};
}

/**
 * @param {Object} [answers]
 * @param {Object} [extras]
 * @return {Object}
 */
function batchAgainst( answers, extras ) {
	const gate = ( extras && extras.gate ) || openGate();
	const uploader = wikiAnswering( answers || {} );
	const batch = createBatch( Object.assign( {
		gate: gate,
		uploader: uploader,
		queue: createUploadQueue( { limit: 2 } ),
		getToken: () => Promise.resolve( 'TOKEN' ),
		description: '{{Photo}}',
		comment: 'Uploaded in a batch'
	}, extras || {} ) );

	batch.uploader = uploader;
	batch.gate = gate;

	return batch;
}

function statuses( batch ) {
	return batch.rows.map( ( row ) => row.status );
}

function names( batch ) {
	return batch.rows.map( ( row ) => row.name );
}

function sentNames( batch ) {
	return batch.uploader.calls.map( ( call ) => call.filename );
}

/**
 * @param {Object} batch
 * @return {Promise} Resolves once nothing is in flight
 */
function settled( batch ) {
	// Idle already, it still lets a turn of the event loop pass: a file sent
	// when it should not have been is otherwise sent after the test looked.
	if ( batch.state.phase === 'idle' ) {
		return new Promise( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
	}

	return new Promise( ( resolve ) => {
		const stop = watch( () => batch.state.phase, ( phase ) => {
			if ( phase === 'idle' ) {
				stop();
				resolve();
			}
		}, { flush: 'sync' } );
	} );
}

// Presses Upload and waits for everything it sent to come back.
async function uploadEverything( batch ) {
	batch.start();
	await settled( batch );
}

/**
 * @return {{promise: Promise, resolve: Function}}
 */
function deferred() {
	let resolve;
	const promise = new Promise( ( settle ) => {
		resolve = settle;
	} );

	return { promise: promise, resolve: resolve };
}

describe( 'adding files', () => {
	it( 'gives every file a row', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );

		expect( names( batch ) ).toEqual( [ 'A.png', 'B.png' ] );
	} );

	it( 'keeps the folder a file came from, which is all that separates two of one name', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png' ] ) );

		expect( batch.rows[ 0 ].path ).toBe( 'Holiday/' );
	} );

	it( 'keeps the file size, so two files of one name can be told apart', () => {
		const batch = batchAgainst();

		batch.addFiles( [ { file: fileNamed( 'A.png', 2048 ), path: '' } ] );

		expect( batch.rows[ 0 ].size ).toBe( 2048 );
	} );

	it( 'waits for Upload rather than sending files as they arrive', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await settled( batch );

		expect( batch.uploader.calls ).toHaveLength( 0 );
		expect( statuses( batch ) ).toEqual( [ 'queued' ] );
	} );
} );

describe( 'the description the files are uploaded with', () => {
	it( 'puts it on every file page', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 0 ].text ).toBe( '{{Photo}}' );
	} );

	it( 'keeps a directive in what it reports back until it is read into the rule', () => {
		const batch = batchAgainst();

		batch.setDescription( '{{Photo| +rename = !^!-->Trip-}}' );

		expect( batch.description ).toBe( '{{Photo| +rename = !^!-->Trip-}}' );
	} );

	it( 'takes an edit to it after files were selected', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.setDescription( '{{Scan}}' );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 0 ].text ).toBe( '{{Scan}}' );
	} );

	it( 'reads a directive still in the text into the rule before anything is sent', async () => {
		const batch = batchAgainst();

		batch.setDescription( '{{Photo| +rename = !^!-->Trip-}}' );
		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 0 ] ).toMatchObject( { filename: 'Trip-A.png', text: '{{Photo}}' } );
	} );
} );

describe( 'the rule the files are renamed by', () => {
	function rule( parts ) {
		return Object.assign( { find: '', replace: '', regex: false }, parts );
	}

	function targets( batch ) {
		return batch.rows.map( ( row ) => row.targetName );
	}

	it( 'starts with the one a directive in the wiki\'s description brought', () => {
		const batch = batchAgainst( {}, { description: '{{Photo| +rename = !^!-->Trip-}}' } );

		expect( batch.description ).toBe( '{{Photo}}' );
		expect( batch.rule ).toMatchObject( { find: '^', replace: 'Trip-', regex: true } );
	} );

	it( 'takes a directive typed into the text in place of the rule there was', () => {
		const batch = batchAgainst();

		batch.setRule( rule( { find: 'x', replace: 'y' } ) );
		batch.setDescription( '{{Photo| +rename = /a/i-->b}}' );
		batch.liftDirective();

		expect( batch.rule ).toMatchObject( { find: 'a', replace: 'b', regex: true, flags: 'i' } );
		expect( batch.description ).toBe( '{{Photo}}' );
	} );

	it( 'says whether there was a directive to read', () => {
		const batch = batchAgainst();

		batch.setDescription( '{{Scan}}' );
		const withNone = batch.liftDirective();
		batch.setDescription( '{{Scan| +rename = /a/-->b}}' );
		const withOne = batch.liftDirective();

		expect( [ withNone, withOne ] ).toEqual( [ false, true ] );
	} );

	it( 'leaves the rule alone when the text has no directive to read', () => {
		const batch = batchAgainst();

		batch.setRule( rule( { find: 'x', replace: 'y' } ) );
		batch.setDescription( '{{Scan}}' );
		batch.liftDirective();

		expect( batch.rule ).toMatchObject( { find: 'x', replace: 'y' } );
	} );

	it( 'renames the files that have not gone up yet, since a rename can create a clash', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A/1.png', 'B/1.png' ] ) );
		batch.setRule( rule( { find: '1', replace: 'one' } ) );

		expect( targets( batch ) ).toEqual( [ 'one.png', 'one.png' ] );
		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] );
	} );

	it( 'can take a clash away again', () => {
		const batch = batchAgainst();

		batch.setRule( rule( { find: '\\d', replace: 'same', regex: true } ) );
		batch.addFiles( dropped( [ 'A/1.png', 'B/2.png' ] ) );
		batch.setRule( rule( {} ) );

		expect( statuses( batch ) ).toEqual( [ 'queued', 'queued' ] );
	} );

	it( 'replaces every match of a regular expression typed into the form', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'banana.png' ] ) );
		batch.setRule( rule( { find: 'a', replace: 'o', regex: true } ) );

		expect( targets( batch ) ).toEqual( [ 'bonono.png' ] );
	} );

	it( 'keeps the flags a directive brought while its rule is edited', () => {
		// Without the g flag a directive replaces the first match only, and an
		// edit to the fields should not quietly change that.
		const batch = batchAgainst( {}, { description: '{{Photo| +rename = /a/-->o}}' } );

		batch.addFiles( dropped( [ 'banana.png' ] ) );
		batch.setRule( rule( { find: 'a', replace: 'u', regex: true } ) );

		expect( targets( batch ) ).toEqual( [ 'bunana.png' ] );
	} );

	it( 'sends nothing while the pattern is not one, rather than every file unrenamed', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'IMG_1.png' ] ) );
		batch.setRule( rule( { find: '(', replace: 'Trip-', regex: true } ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls ).toHaveLength( 0 );
		expect( statuses( batch ) ).toEqual( [ 'queued' ] );
	} );

	it( 'leaves the names alone and says so when the pattern is not one', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.setRule( rule( { find: '([', replace: '$1', regex: true } ) );

		expect( batch.state.renamePatternInvalid ).toBe( true );
		expect( targets( batch ) ).toEqual( [ 'A.png' ] );
	} );

	it( 'renames nothing that is already on the wiki', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.setRule( { find: '', replace: 'Trip-', regex: false } );

		expect( targets( batch ) ).toEqual( [ 'A.png' ] );
	} );

	it( 'counts how many of the files waiting it renames', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'IMG_1.png', 'IMG_2.png', 'IMG_3.png' ] ) );
		batch.skipFile( batch.rows[ 3 ].id );
		batch.setRule( rule( { find: 'IMG_', replace: 'Trip-' } ) );

		expect( batch.renameCount ).toMatchObject( { changed: 2, of: 3 } );
	} );

	it( 'lists the files waiting that it renames, leaving out skipped and sent ones', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'IMG_1.png' ] ) );
		batch.setRule( rule( { find: 'IMG_', replace: 'Trip-' } ) );
		await uploadEverything( batch );
		batch.addFiles( dropped( [ 'IMG_2.png', 'IMG_3.png', 'x.png' ] ) );
		batch.skipFile( batch.rows[ 2 ].id );

		expect( batch.renamedRows.map( ( row ) => row.name ) ).toEqual( [ 'IMG_2.png' ] );
		expect( batch.renameCount ).toMatchObject( { changed: 1, of: 2 } );
	} );

	it( 'marks a name left without a file extension, before anything is sent', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		batch.setRule( rule( { find: '^A\\.png$', replace: 'A', regex: true } ) );

		expect( batch.rows.map( ( row ) => row.noExtension ) ).toEqual( [ true, false ] );
	} );

	it( 'stops marking it once the rule leaves the extension alone', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.setRule( rule( { find: '\\.png$', replace: '', regex: true } ) );
		batch.setRule( rule( {} ) );

		expect( batch.rows[ 0 ].noExtension ).toBe( false );
	} );

	it( 'says when the text holds what looks like a directive but is not one', () => {
		const batch = batchAgainst();

		batch.setDescription( '{{Photo}}\n+rename = /^IMG_/-->Trip-' );

		expect( batch.textLooksLikeDirective ).toBe( true );
	} );
} );

describe( 'previews', () => {
	it( 'shows one on the row as soon as it has been made', async () => {
		const batch = batchAgainst( {}, {
			thumbnailer: { thumbnail: () => Promise.resolve( 'data:image/jpeg;base64,AAA' ) }
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await Promise.resolve();

		expect( batch.rows[ 0 ].thumbnail ).toBe( 'data:image/jpeg;base64,AAA' );
	} );

	it( 'leaves the row without one rather than failing over a file it cannot draw', async () => {
		const batch = batchAgainst( {}, {
			thumbnailer: { thumbnail: () => Promise.reject( new Error( 'not an image' ) ) }
		} );

		batch.addFiles( dropped( [ 'A.zip' ] ) );
		await uploadEverything( batch );

		expect( batch.rows[ 0 ].thumbnail ).toBe( '' );
		expect( batch.rows[ 0 ].status ).toBe( 'done' );
	} );

	it( 'asks for each preview once, not again every time more files arrive', () => {
		const asked = [];
		const batch = batchAgainst( {}, {
			thumbnailer: {
				thumbnail: ( file ) => {
					asked.push( file.name );

					return Promise.resolve( '' );
				}
			}
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.addFiles( [] );
		batch.addFiles( dropped( [ 'B.png' ] ) );

		expect( asked ).toEqual( [ 'A.png', 'B.png' ] );
	} );
} );

describe( 'the most files the wiki lets one batch hold', () => {
	it( 'takes everything when the wiki sets no limit', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );

		expect( batch.rows ).toHaveLength( 3 );
		expect( batch.state.turnedAway ).toBe( 0 );
	} );

	it( 'takes nothing when the wiki gives this user no room at all', () => {
		// resolveUserLimit() answers 0 for a user in no configured group, which
		// has to mean none rather than falling through to unlimited.
		const batch = batchAgainst( {}, { maxFiles: 0 } );

		batch.addFiles( dropped( [ 'A.png' ] ) );

		expect( batch.rows ).toHaveLength( 0 );
		expect( batch.room ).toBe( 0 );
		expect( batch.state.turnedAway ).toBe( 1 );
	} );

	it( 'takes only as many files as there is room for', () => {
		const batch = batchAgainst( {}, { maxFiles: 2 } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );

		expect( names( batch ) ).toEqual( [ 'A.png', 'B.png' ] );
	} );

	it( 'says how many it had to turn away, so the user is not left guessing', () => {
		const batch = batchAgainst( {}, { maxFiles: 2 } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );

		expect( batch.state.turnedAway ).toBe( 1 );
		expect( batch.state.admitted ).toBe( 2 );
	} );

	it( 'forgets a refusal once the user selects again', () => {
		const batch = batchAgainst( {}, { maxFiles: 3 } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png', 'D.png' ] ) );
		batch.addFiles( [] );

		expect( batch.state.turnedAway ).toBe( 0 );
	} );

	it( 'counts an uploaded file as no longer taking up room', async () => {
		const batch = batchAgainst( {}, { maxFiles: 2 } );

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		await uploadEverything( batch );
		batch.addFiles( dropped( [ 'C.png' ] ) );

		expect( names( batch ) ).toEqual( [ 'A.png', 'B.png', 'C.png' ] );
	} );

	it( 'counts a file still waiting for an answer as taking up room', async () => {
		const batch = batchAgainst(
			{ 'A.png': alreadyThere( 'A.png' ) },
			{ maxFiles: 1 }
		);

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.addFiles( dropped( [ 'B.png' ] ) );

		expect( names( batch ) ).toEqual( [ 'A.png' ] );
	} );

	it( 'reports how much room is left, so the drop target can say so', () => {
		const batch = batchAgainst( {}, { maxFiles: 5 } );

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );

		expect( batch.room ).toBe( 3 );
	} );
} );

describe( 'two files that would land on one page', () => {
	it( 'holds both back rather than letting the later one win silently', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] );
	} );

	it( 'counts each file within its group, since the names are identical by definition', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );

		expect( batch.rows.map( ( row ) => [ row.position, row.outOf ] ) )
			.toEqual( [ [ 1, 2 ], [ 2, 2 ] ] );
	} );

	it( 'groups on the name the wiki would give the file, not the name on disk', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'a_photo.png', 'A photo.png' ] ) );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] );
	} );

	it( 'uploads nothing from a group until one is chosen', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls ).toHaveLength( 0 );
	} );

	it( 'leaves the rest of the batch to upload around the group', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png', 'B.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash', 'done' ] );
	} );

	it( 'uploads the one the user keeps and leaves the others alone', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );
		batch.keepFile( batch.rows[ 1 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'skipped', 'done' ] );
	} );

	it( 'waits for Upload after the user keeps one of a group', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );
		batch.keepFile( batch.rows[ 1 ].id );
		await settled( batch );

		expect( batch.uploader.calls ).toHaveLength( 0 );
		expect( statuses( batch ) ).toEqual( [ 'skipped', 'queued' ] );
	} );

	it( 'sends the file the user keeps while the batch runs, and skips the rest', async () => {
		const slow = deferred();
		const batch = batchAgainst( { 'S.png': () => slow.promise } );

		batch.addFiles( dropped( [ 'S.png', 'A/X.png', 'B/X.png' ] ) );
		batch.start();
		batch.keepFile( batch.rows[ 1 ].id );

		expect( statuses( batch )[ 2 ] ).toBe( 'skipped' );
		await vi.waitFor( () => expect( sentNames( batch ) ).toContain( 'X.png' ), { timeout: 500 } );
		slow.resolve( stored( 'S.png' ) );
		await settled( batch );
	} );

	it( 'uploads none of a group the user skips whole, not the last one standing', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A/X.png', 'B/X.png', 'C/X.png' ] ) );
		batch.skipFiles( batch.rows.map( ( row ) => row.id ) );

		expect( statuses( batch ) ).toEqual( [ 'skipped', 'skipped', 'skipped' ] );
	} );

	it( 'skips the siblings of a kept file even where only normalisation joins them', async () => {
		// The group is built on the name the wiki would give the file, so the
		// decision has to be resolved on that name too. Matching the names on
		// disk leaves the others clashing, and uploading one of those later
		// overwrites the file that was kept.
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A/my_file.png', 'B/my file.png' ] ) );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] );

		batch.keepFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'skipped' ] );
		expect( batch.rows[ 1 ].outOf ).toBe( 0 );
	} );

	it( 'leaves a group using a different name to be decided on its own', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A/X.png', 'B/X.png', 'A/Y.png', 'B/Y.png' ] ) );
		batch.keepFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'skipped', 'clash', 'clash' ] );
	} );

	it( 'stops calling it a clash once only one file is left using the name', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );
		batch.skipFiles( [ batch.rows[ 0 ].id ] );

		expect( batch.rows[ 1 ].outOf ).toBe( 0 );
	} );

	it( 'takes a later file into the group it belongs to', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A/X.png', 'B/X.png' ] ) );
		batch.addFiles( dropped( [ 'C/X.png' ] ) );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash', 'clash' ] );
		expect( batch.rows.map( ( row ) => [ row.position, row.outOf ] ) )
			.toEqual( [ [ 1, 3 ], [ 2, 3 ], [ 3, 3 ] ] );
	} );

	it( 'does not hold a file back over a name that is already on the wiki', async () => {
		// The wiki is the one to answer for that, and it does: the second file
		// comes back as one that would overwrite something.
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.addFiles( dropped( [ 'Garden/A.png' ] ) );

		expect( statuses( batch ) ).not.toContain( 'clash' );
	} );
} );

describe( 'uploading', () => {
	it( 'uploads every waiting file', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'done' ] );
	} );

	it( 'links an uploaded file to its page on the wiki', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.rows[ 0 ].href ).toBe( '/index.php/File:A.png' );
	} );

	it( 'sends the wikitext and the comment the wiki was configured with', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 0 ] ).toMatchObject( {
			filename: 'A.png',
			token: 'TOKEN',
			text: '{{Photo}}',
			comment: 'Uploaded in a batch'
		} );
	} );

	it( 'sends the bytes, not a stash key, the first time it offers a file', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 0 ].file ).toBeTruthy();
		expect( batch.uploader.calls[ 0 ].filekey ).toBeFalsy();
	} );

	it( 'never waives the wiki\'s warnings unasked', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 0 ].ignoreWarnings ).toBeFalsy();
	} );

	it( 'follows the upload along, so the ring has a figure to draw', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.rows[ 0 ].progress ).toBe( 0.5 );
	} );

	it( 'passes on what the wiki said about a file it stored anyway', async () => {
		const batch = batchAgainst( {
			'A.png': {
				upload: {
					result: 'Success',
					filename: 'A.png',
					warnings: { duplicate: [ 'B.png' ] }
				}
			}
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.rows[ 0 ].detail ).toBe( 'simplebatchupload-warning-duplicate(B.png|1)' );
	} );

	it( 'calls a file waiting for a free slot waiting, not uploading', async () => {
		// The queue sends two at a time here. A file behind them has not
		// started, and a pause has to be able to tell it apart from one that
		// has, since that is the file Upload can still take back.
		const held = deferred();
		const batch = batchAgainst( {
			'A.png': () => held.promise,
			'B.png': () => held.promise,
			'C.png': () => held.promise
		} );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls ).toHaveLength( 2 ) );

		expect( statuses( batch ) ).toEqual( [ 'uploading', 'uploading', 'queued' ] );

		held.resolve( stored( 'A.png' ) );
		await settled( batch );
	} );

	it( 'sends a file waiting for a slot once, even when more files arrive meanwhile', async () => {
		const held = deferred();
		const batch = batchAgainst( {
			'A.png': () => held.promise,
			'B.png': () => held.promise
		} );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();
		batch.addFiles( dropped( [ 'D.png' ] ) );
		held.resolve( stored( 'A.png' ) );
		await settled( batch );

		expect( batch.uploader.calls.map( ( call ) => call.filename ).sort() )
			.toEqual( [ 'A.png', 'B.png', 'C.png', 'D.png' ] );
	} );

	it( 'leaves a file already handed to the queue out of a name clash found later', async () => {
		// It is the wiki's to answer for now, as an upload under a name that
		// exists. Pulled into a group it could be skipped and still go up, or
		// strand the file it was grouped with.
		const held = deferred();
		const batch = batchAgainst( { 'A.png': () => held.promise }, {
			queue: createUploadQueue( { limit: 1 } )
		} );

		batch.addFiles( dropped( [ 'A.png', 'Holiday/B.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls ).toHaveLength( 1 ) );
		batch.addFiles( dropped( [ 'Garden/B.png' ] ) );

		expect( statuses( batch ) ).not.toContain( 'clash' );

		held.resolve( stored( 'A.png' ) );
		await settled( batch );
	} );

	it( 'groups a file a pause sent back with the one it shares a name with', async () => {
		const held = deferred();
		const batch = batchAgainst( { 'A.png': () => held.promise }, {
			queue: createUploadQueue( { limit: 1 } )
		} );

		batch.addFiles( dropped( [ 'A.png', 'Holiday/B.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls ).toHaveLength( 1 ) );
		batch.addFiles( dropped( [ 'Garden/B.png' ] ) );
		batch.pause();
		held.resolve( stored( 'A.png' ) );
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'clash', 'clash' ] );
	} );

	it( 'asks about a file a pause sent back and its namesake before Upload sends either', async () => {
		const first = deferred();
		const second = deferred();
		const batch = batchAgainst( {
			'A.png': () => first.promise,
			'C.png': () => second.promise
		}, { queue: createUploadQueue( { limit: 2 } ) } );

		batch.addFiles( dropped( [ 'A.png', 'C.png', 'Holiday/B.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls ).toHaveLength( 2 ) );
		batch.addFiles( dropped( [ 'Garden/B.png' ] ) );
		batch.pause();
		first.resolve( stored( 'A.png' ) );
		await vi.waitFor( () => expect( statuses( batch )[ 0 ] ).toBe( 'done' ) );
		batch.start();
		second.resolve( stored( 'C.png' ) );
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'done', 'clash', 'clash' ] );
	} );

	it( 'keeps sending a file the wiki refuses many times while the rest of the batch gets through', async () => {
		// The runner's own cap on attempts, reached while the gate stays open
		// because other files are succeeding, is not the batch giving up.
		const turnedAway = Array( 40 ).fill( refused( 'ratelimited', 'Slow down.' ) );
		const batch = batchAgainst( { 'A.png': turnedAway.concat( [ stored( 'A.png' ) ] ) } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
	} );

	it( 'shows a file the wiki turned away for its rate limit as waiting again', async () => {
		const retry = deferred();
		let waits = 0;
		const gate = openGate();
		gate.wait = () => {
			waits += 1;
			return waits === 1 ? Promise.resolve( true ) : retry.promise;
		};
		const batch = batchAgainst(
			{ 'A.png': [ refused( 'ratelimited', 'Slow down.' ), stored( 'A.png' ) ] },
			{ gate: gate }
		);

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( waits ).toBe( 2 ) );

		expect( batch.rows[ 0 ] ).toMatchObject( { status: 'queued', progress: 0 } );

		retry.resolve( true );
		await settled( batch );
	} );

	it( 'sends one file at a time under any one name, so the wiki sees the first before the second', async () => {
		// A warning settled without asking is published with ignorewarnings,
		// which would also wave through a same-named file overwriting it.
		const first = deferred();
		const batch = batchAgainst( {
			'IMG_1.jpg': [ () => first.promise, alreadyThere( 'IMG_1.jpg' ) ]
		} );

		batch.addFiles( dropped( [ 'Day1/IMG_1.jpg' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls ).toHaveLength( 1 ) );
		batch.addFiles( dropped( [ 'Day2/IMG_1.jpg' ] ) );
		await new Promise( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );

		expect( batch.uploader.calls ).toHaveLength( 1 );

		first.resolve( stored( 'IMG_1.jpg' ) );
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'held' ] );
	} );

	it( 'sends a file added while the batch is already running', async () => {
		const slow = deferred();
		const batch = batchAgainst( { 'A.png': () => slow.promise } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		batch.addFiles( dropped( [ 'B.png' ] ) );

		await vi.waitFor( () => expect( sentNames( batch ) ).toContain( 'B.png' ), { timeout: 500 } );
		slow.resolve( stored( 'A.png' ) );
		await settled( batch );
	} );

	it( 'sends a file waiting for a free slot once, however often more files arrive', async () => {
		const held = deferred();
		const batch = batchAgainst( { 'A.png': () => held.promise, 'B.png': () => held.promise } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'README' ] ) );
		batch.start();
		batch.addFiles( dropped( [ 'D.png' ] ) );
		held.resolve( stored( 'A.png' ) );
		await settled( batch );

		expect( sentNames( batch ).filter( ( name ) => name === 'README' ) ).toHaveLength( 1 );
	} );

	it( 'leaves the name an uploaded file went up under alone when more files arrive', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.setRule( { find: '', replace: 'Trip-', regex: false } );
		batch.addFiles( dropped( [ 'B.png' ] ) );

		expect( batch.rows[ 0 ].targetName ).toBe( 'A.png' );
	} );

	it( 'links an uploaded file to the name the wiki stored it under', async () => {
		const batch = batchAgainst( { 'A.png': stored( 'B.png' ) } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.rows[ 0 ].href ).toContain( 'B.png' );
	} );
} );

describe( 'taking a waiting file out', () => {
	it( 'leaves it out of the upload', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		batch.skipFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'skipped', 'done' ] );
		expect( batch.uploader.calls.map( ( call ) => call.filename ) ).toEqual( [ 'B.png' ] );
	} );

	it( 'leaves it in once Upload has been pressed, since its turn can come at any moment', async () => {
		const held = deferred();
		const batch = batchAgainst( {
			'A.png': () => held.promise,
			'B.png': () => held.promise
		} );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();
		batch.skipFile( batch.rows[ 2 ].id );

		expect( statuses( batch )[ 2 ] ).not.toBe( 'skipped' );

		held.resolve( stored( 'A.png' ) );
		await settled( batch );
	} );

	it( 'puts it back when the user adds it back', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.skipFile( batch.rows[ 0 ].id );
		batch.addFileBack( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
	} );

	it( 'brings back the name clash it was part of', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'Holiday/A.png', 'Garden/A.png' ] ) );
		batch.skipFiles( [ batch.rows[ 0 ].id ] );
		batch.addFileBack( batch.rows[ 0 ].id );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] );
	} );

	it( 'adds it back under the name the rule now gives it', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.skipFile( batch.rows[ 0 ].id );
		batch.setRule( { find: '', replace: 'Trip-', regex: false } );
		batch.addFileBack( batch.rows[ 0 ].id );

		expect( batch.rows[ 0 ].targetName ).toBe( 'Trip-A.png' );
	} );

	it( 'does not add it back past the most the wiki lets the batch hold', () => {
		const batch = batchAgainst( {}, { maxFiles: 1 } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.skipFile( batch.rows[ 0 ].id );
		batch.addFiles( dropped( [ 'B.png' ] ) );
		batch.addFileBack( batch.rows[ 0 ].id );

		expect( statuses( batch ) ).toEqual( [ 'skipped', 'queued' ] );
	} );

	it( 'sends a file added back into a batch that is running', async () => {
		const slow = deferred();
		const batch = batchAgainst( { 'B.png': () => slow.promise } );

		batch.addFiles( dropped( [ 'B.png', 'C.png' ] ) );
		batch.skipFile( batch.rows[ 1 ].id );
		batch.start();
		batch.addFileBack( batch.rows[ 1 ].id );

		await vi.waitFor( () => expect( sentNames( batch ) ).toContain( 'C.png' ), { timeout: 500 } );
		slow.resolve( stored( 'B.png' ) );
		await settled( batch );
	} );
} );

describe( 'a file the wiki already holds', () => {
	it( 'asks rather than overwriting it', async () => {
		const batch = batchAgainst( { 'A.png': alreadyThere( 'A.png' ) } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'held' ] );
	} );

	it( 'keeps the key to what the wiki stashed, so saying yes costs no second upload', async () => {
		const batch = batchAgainst( { 'A.png': alreadyThere( 'A.png' ) } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.replaceFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 1 ] ).toMatchObject( {
			filekey: 'A.png.key',
			ignoreWarnings: true
		} );
		expect( batch.uploader.calls[ 1 ].file ).toBeFalsy();
	} );

	it( 'stores the file once the user says yes', async () => {
		const batch = batchAgainst( {
			'A.png': [ alreadyThere( 'A.png' ), stored( 'A.png' ) ]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.replaceFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
	} );

	it( 'holds a file the user says yes to against a newer one under the same name', async () => {
		const batch = batchAgainst( { 'A.png': alreadyThere( 'A.png' ) } );

		batch.addFiles( dropped( [ 'Holiday/A.png' ] ) );
		await uploadEverything( batch );
		batch.addFiles( dropped( [ 'Garden/A.png' ] ) );
		batch.replaceFile( batch.rows[ 0 ].id );

		expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] );
	} );

	it( 'asks again once a rename gives a file the user said yes to another name', async () => {
		// The yes was to overwriting A.png. Carried over to B.png it would
		// overwrite a file nobody was asked about.
		const batch = batchAgainst( {
			'A.png': alreadyThere( 'A.png' ),
			'B.png': alreadyThere( 'B.png' )
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.replaceFile( batch.rows[ 0 ].id );
		batch.setRule( { find: 'A', replace: 'B', regex: false } );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 1 ].filename ).toBe( 'B.png' );
		expect( batch.uploader.calls[ 1 ].ignoreWarnings ).toBeFalsy();
		expect( statuses( batch ) ).toEqual( [ 'held' ] );
	} );

	it( 'waits for Upload after the user says yes to a batch that has finished', async () => {
		const batch = batchAgainst( { 'A.png': alreadyThere( 'A.png' ) } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.replaceFile( batch.rows[ 0 ].id );
		await settled( batch );

		expect( batch.uploader.calls ).toHaveLength( 1 );
		expect( statuses( batch ) ).toEqual( [ 'queued' ] );
	} );

	it( 'takes a file the user says yes to into a batch that is still running', async () => {
		const slow = deferred();
		const batch = batchAgainst( {
			'A.png': [ alreadyThere( 'A.png' ), stored( 'A.png' ) ],
			'B.png': () => slow.promise
		} );

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.rows[ 0 ].status ).toBe( 'held' ) );
		batch.replaceFile( batch.rows[ 0 ].id );
		await vi.waitFor(
			() => expect( sentNames( batch ).filter( ( name ) => name === 'A.png' ) ).toHaveLength( 2 ),
			{ timeout: 500 }
		);
		slow.resolve( stored( 'B.png' ) );
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'done' ] );
	} );

	it( 'offers the wiki nothing more once the user says no', async () => {
		const batch = batchAgainst( { 'A.png': alreadyThere( 'A.png' ) } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.skipFile( batch.rows[ 0 ].id );
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'skipped' ] );
		expect( batch.uploader.calls ).toHaveLength( 1 );
	} );

	it( 'settles a warning that puts nothing at risk without asking', async () => {
		const batch = batchAgainst( {
			'A.png': [
				{
					upload: {
						result: 'Warning',
						filekey: 'A.png.key',
						warnings: { duplicate: [ 'B.png' ] }
					}
				},
				stored( 'A.png' )
			]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
		expect( batch.uploader.calls[ 1 ] ).toMatchObject( {
			filekey: 'A.png.key',
			ignoreWarnings: true
		} );
	} );

	it( 'sends the file again to settle a warning the wiki could not stash', async () => {
		// The stash refuses anyone not logged in, so an anonymous upload gets
		// its warning with no key to go ahead with.
		const batch = batchAgainst( {
			'A.png': [ unstashed( { duplicate: [ 'B.png' ] } ), stored( 'A.png' ) ]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
		expect( batch.uploader.calls[ 1 ].file ).toBeTruthy();
		expect( batch.uploader.calls[ 1 ].ignoreWarnings ).toBe( true );
	} );

	it( 'sends the file again to replace one when the wiki could not stash it', async () => {
		const batch = batchAgainst( {
			'A.png': [ unstashed( { exists: 'A.png' } ), stored( 'A.png' ) ]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.replaceFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
		expect( batch.uploader.calls[ 1 ].file ).toBeTruthy();
		expect( batch.uploader.calls[ 1 ].ignoreWarnings ).toBe( true );
	} );
} );

describe( 'a file that would not upload', () => {
	it( 'says what the wiki said', async () => {
		const batch = batchAgainst( {
			'A.png': refused( 'verification-error', 'This file did not pass file verification.' )
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'failed' ] );
		expect( batch.rows[ 0 ].detail ).toBe( 'This file did not pass file verification.' );
	} );

	it( 'falls back to its own words when the wiki gave none', async () => {
		const batch = batchAgainst( { 'A.png': {} } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.rows[ 0 ].detail ).toBe( 'simplebatchupload-result-unknown-error' );
	} );

	it( 'fails a file whose token could not be renewed, rather than hanging the batch on it', async () => {
		const batch = batchAgainst( { 'A.png': { error: { code: 'badtoken' } } }, {
			getToken: ( refresh ) => ( refresh ?
				Promise.reject( new Error( 'The session has ended.' ) ) :
				Promise.resolve( 'STALE' ) )
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'failed' ] );
		expect( batch.rows[ 0 ].detail ).toBe( 'The session has ended.' );
		expect( batch.state.phase ).toBe( 'idle' );
	} );

	it( 'offers the file again from the start when the user retries', async () => {
		const batch = batchAgainst( {
			'A.png': [ refused( 'internal_api_error', 'Something broke.' ), stored( 'A.png' ) ]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.retryFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
		expect( batch.uploader.calls[ 1 ].file ).toBeTruthy();
		expect( batch.uploader.calls[ 1 ].ignoreWarnings ).toBeFalsy();
	} );

	it( 'waits for Upload before offering a failed file again', async () => {
		const batch = batchAgainst( {
			'A.png': [ refused( 'internal_api_error', 'Something broke.' ), stored( 'A.png' ) ]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.retryFile( batch.rows[ 0 ].id );
		await settled( batch );

		expect( batch.uploader.calls ).toHaveLength( 1 );
		expect( statuses( batch ) ).toEqual( [ 'queued' ] );
	} );

	it( 'offers a failed file again under the name the rule now gives it', async () => {
		const batch = batchAgainst( {
			'A.png': refused( 'verification-error', 'This file did not pass file verification.' )
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.setRule( { find: '', replace: 'Trip-', regex: false } );
		batch.retryFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 1 ].filename ).toBe( 'Trip-A.png' );
	} );

	it( 'does not offer a failed file again past the most the wiki lets the batch hold', async () => {
		const batch = batchAgainst(
			{ 'A.png': refused( 'verification-error', 'Bad file.' ) },
			{ maxFiles: 2 }
		);

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		await uploadEverything( batch );
		batch.addFiles( dropped( [ 'C.png', 'D.png' ] ) );
		batch.retryFile( batch.rows[ 0 ].id );

		expect( batch.rows[ 0 ].status ).toBe( 'failed' );
	} );

	it( 'goes back to the bytes after a replacement failed, not to the stale key', async () => {
		const batch = batchAgainst( {
			'A.png': [
				alreadyThere( 'A.png' ),
				refused( 'protectedpage', 'This page is protected.' ),
				stored( 'A.png' )
			]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.replaceFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );
		batch.retryFile( batch.rows[ 0 ].id );
		await uploadEverything( batch );

		expect( batch.uploader.calls[ 2 ].filekey ).toBeFalsy();
		expect( batch.uploader.calls[ 2 ].file ).toBeTruthy();
		expect( batch.uploader.calls[ 2 ].ignoreWarnings ).toBeFalsy();
	} );

	it( 'clears the reason it failed when it goes round again', async () => {
		const batch = batchAgainst( {
			'A.png': [ refused( 'internal_api_error', 'Something broke.' ), stored( 'A.png' ) ]
		} );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.retryFile( batch.rows[ 0 ].id );

		expect( batch.rows[ 0 ].detail ).toBe( '' );
	} );
} );

describe( 'pausing', () => {
	it( 'leaves what has not been uploaded waiting rather than failed', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();
		batch.pause();
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'queued', 'queued', 'queued' ] );
	} );

	it( 'picks the rest up where it left off', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		batch.pause();
		await settled( batch );
		batch.start();
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
	} );

	it( 'carries on when Upload is pressed again before the pause has taken hold', async () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		batch.start();
		batch.pause();
		batch.start();
		await settled( batch );

		expect( statuses( batch ) ).toEqual( [ 'done', 'done' ] );
	} );

	it( 'lets go at once of files waiting for their turn under the wiki\'s rate limit', async () => {
		// A paced gate can keep a file asleep for a long time. Pause has to
		// take hold now, not when the file's turn would have come.
		const gate = openGate();
		gate.wait = () => new Promise( () => {} );
		const batch = batchAgainst( {}, { gate: gate } );

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		batch.start();
		batch.pause();
		await vi.waitFor( () => expect( batch.state.phase ).toBe( 'idle' ), { timeout: 500 } );

		expect( statuses( batch ) ).toEqual( [ 'queued', 'queued' ] );
	} );

	it( 'takes a file asleep at the gate straight back when Upload undoes a pause', async () => {
		const paced = pacedGate();
		const batch = batchAgainst( {}, { gate: paced.gate } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( paced.sleepers ).toHaveLength( 1 ) );
		batch.pause();
		batch.start();
		await vi.waitFor( () => expect( paced.sleepers ).toHaveLength( 2 ) );
		paced.wakeAll();

		// Its turn, not one the abandoned wait took for nobody first: that one
		// would leave it asleep for a second turn nobody wakes.
		await vi.waitFor( () => expect( statuses( batch ) ).toEqual( [ 'done' ] ), { timeout: 500 } );
	} );

	it( 'asks about a file asleep at the gate and its namesake once Upload undoes a pause', async () => {
		const paced = pacedGate();
		const batch = batchAgainst( {}, { gate: paced.gate } );

		batch.addFiles( dropped( [ 'Holiday/B.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( paced.sleepers ).toHaveLength( 1 ) );
		batch.addFiles( dropped( [ 'Garden/B.png' ] ) );
		batch.pause();
		batch.start();

		await vi.waitFor( () => expect( statuses( batch ) ).toEqual( [ 'clash', 'clash' ] ), { timeout: 500 } );
	} );

	it( 'is pausing until the files already sent have finished', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		batch.pause();

		expect( batch.state.phase ).toBe( 'pausing' );
	} );
} );

describe( 'how much longer the wiki\'s rate limit makes it', () => {
	it( 'says nothing while the wiki advertises no limit', async () => {
		const slow = deferred();
		const batch = batchAgainst( { 'A.png': () => slow.promise } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls.length ).toBeGreaterThan( 0 ) );

		expect( batch.remaining ).toBe( '' );
		slow.resolve( stored( 'A.png' ) );
		await settled( batch );
	} );

	it( 'counts the files still to go against the pace the wiki allows', () => {
		const gate = openGate();
		gate.schedule = () => ( { waitMs: 0, intervalMs: 60000 } );

		const batch = batchAgainst( {}, { gate: gate } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();

		// The first file goes at once, so three files at one a minute is two
		// minutes of waiting, not three.
		expect( batch.remaining ).toBe( 'simplebatchupload-estimate-minutes(2)' );
	} );

	it( 'says nothing before Upload is pressed, since nothing is left until it is', () => {
		const gate = openGate();
		gate.schedule = () => ( { waitMs: 0, intervalMs: 60000 } );

		const batch = batchAgainst( {}, { gate: gate } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );

		expect( batch.remaining ).toBe( '' );
	} );

	it( 'counts the files on their way, and stops counting one that has landed', async () => {
		const gate = openGate();
		gate.schedule = () => ( { waitMs: 0, intervalMs: 60000 } );
		const slow = deferred();
		const batch = batchAgainst( { 'B.png': () => slow.promise, 'C.png': () => slow.promise }, { gate: gate } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( statuses( batch ) ).toEqual( [ 'done', 'uploading', 'uploading' ] ) );

		expect( batch.remaining ).toBe( 'simplebatchupload-estimate-minutes(1)' );
		slow.resolve( stored( 'B.png' ) );
		await settled( batch );
	} );
} );

describe( 'when the wiki itself gives up on the batch', () => {
	function gateThatGivesUp() {
		const gate = openGate();
		let halted = false;

		gate.noteRateLimited = () => {
			halted = true;
		};
		gate.wait = () => Promise.resolve( !halted );
		gate.stopped = () => halted;
		gate.resume = () => {
			halted = false;
		};

		return gate;
	}

	it( 'says the wiki stopped it, which the user did not ask for', async () => {
		const gate = gateThatGivesUp();
		const batch = batchAgainst(
			{ 'A.png': { error: { code: 'ratelimited' } } },
			{ gate: gate }
		);

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		await uploadEverything( batch );

		expect( batch.state.stoppedByLimit ).toBe( true );
	} );

	it( 'does not blame the wiki for a pause the user asked for, even if it had given up too', async () => {
		const gate = openGate();
		// The limiter had already given up, but the user pressed Pause, and
		// that is what they are owed an explanation of.
		gate.stopped = () => true;

		const batch = batchAgainst( {}, { gate: gate } );

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		batch.start();
		batch.pause();
		await settled( batch );

		expect( batch.state.stoppedByLimit ).toBe( false );
	} );

	it( 'tries again when Upload is pressed after the wiki gave up', async () => {
		const gate = gateThatGivesUp();
		const batch = batchAgainst(
			{ 'A.png': [ { error: { code: 'ratelimited' } }, stored( 'A.png' ) ] },
			{ gate: gate }
		);

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'done' ] );
		expect( batch.state.stoppedByLimit ).toBe( false );
	} );

	it( 'stops saying the wiki stopped it as soon as Upload is pressed again', async () => {
		const batch = batchAgainst(
			{ 'A.png': [ { error: { code: 'ratelimited' } }, stored( 'A.png' ) ] },
			{ gate: gateThatGivesUp() }
		);

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );
		batch.start();

		expect( batch.state.stoppedByLimit ).toBe( false );
		await settled( batch );
	} );

	it( 'says nothing of the sort about a batch that simply finished', async () => {
		const batch = batchAgainst( {}, { gate: gateThatGivesUp() } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( batch.state.stoppedByLimit ).toBe( false );
	} );
} );

describe( 'a token the wiki no longer accepts', () => {
	it( 'asks for a fresh one rather than the cached one it just used', async () => {
		const asked = [];
		const batch = batchAgainst(
			{ 'A.png': [ { error: { code: 'badtoken' } }, stored( 'A.png' ) ] },
			{
				getToken: ( refresh ) => {
					asked.push( refresh === true );

					return Promise.resolve( refresh ? 'FRESH' : 'STALE' );
				}
			}
		);

		batch.addFiles( dropped( [ 'A.png' ] ) );
		await uploadEverything( batch );

		expect( asked ).toEqual( [ false, true ] );
		expect( batch.uploader.calls[ 1 ].token ).toBe( 'FRESH' );
		expect( statuses( batch ) ).toEqual( [ 'done' ] );
	} );
} );

describe( 'a file whose upload throws rather than answering', () => {
	it( 'fails that row and lets the batch settle, rather than hanging on it', async () => {
		const batch = batchAgainst( {}, {
			uploader: {
				calls: [],
				upload: () => {
					throw new TypeError( 'something in the transport broke' );
				}
			}
		} );

		batch.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		await uploadEverything( batch );

		expect( statuses( batch ) ).toEqual( [ 'failed', 'failed' ] );
		expect( batch.rows[ 0 ].detail ).toBe( 'simplebatchupload-result-network-error' );
		expect( batch.state.phase ).toBe( 'idle' );
	} );
} );

describe( 'two batches sharing one wiki', () => {
	// The rate limit is per user, so every panel on the page shares one gate.
	// Pause is per panel, and must not reach through it.
	function twoBatchesOnOneGate() {
		const queue = createUploadQueue( { limit: 2 } );
		const gate = openGate();
		let halted = false;
		gate.halt = () => {
			halted = true;
		};
		gate.resume = () => {
			halted = false;
		};
		gate.wait = () => Promise.resolve( !halted );
		gate.stopped = () => halted;

		return {
			gate: gate,
			first: batchAgainst( {}, { gate: gate, queue: queue } ),
			second: batchAgainst( {}, { gate: gate, queue: queue } )
		};
	}

	it( 'pauses only the batch that was paused', async () => {
		const { first, second } = twoBatchesOnOneGate();

		first.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		second.addFiles( dropped( [ 'C.png', 'D.png' ] ) );
		first.start();
		second.start();
		first.pause();
		await settled( first );
		await settled( second );

		expect( statuses( second ) ).toEqual( [ 'done', 'done' ] );
	} );

	it( 'does not blame the wiki for a batch the user paused next door', async () => {
		const { first, second } = twoBatchesOnOneGate();

		first.addFiles( dropped( [ 'A.png' ] ) );
		second.addFiles( dropped( [ 'B.png' ] ) );
		first.start();
		second.start();
		first.pause();
		await settled( first );
		await settled( second );

		expect( first.state.stoppedByLimit ).toBe( false );
		expect( second.state.stoppedByLimit ).toBe( false );
	} );

	it( 'keeps a paused batch paused when the other one starts something', async () => {
		const { first, second } = twoBatchesOnOneGate();

		first.addFiles( dropped( [ 'A.png', 'B.png' ] ) );
		first.start();
		first.pause();
		await settled( first );

		second.addFiles( dropped( [ 'C.png' ] ) );
		await uploadEverything( second );

		expect( statuses( first ) ).toEqual( [ 'queued', 'queued' ] );
	} );
} );

describe( 'what the batch says about itself', () => {
	it( 'says all of it in a way a template can follow', async () => {
		// Everything the interface draws is read off the batch, so a value it
		// reports through a plain variable would be drawn once and never again.
		const batch = batchAgainst( {}, { maxFiles: 5 } );
		const seen = [];

		watch( () => batch.description, () => seen.push( 'description' ) );
		watch( () => batch.counts.total, () => seen.push( 'counts' ) );
		watch( () => batch.room, () => seen.push( 'room' ) );
		watch( () => batch.state.phase, () => seen.push( 'phase' ) );

		batch.setDescription( '{{Scan}}' );
		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		await nextTick();

		expect( seen.sort() ).toEqual( [ 'counts', 'description', 'phase', 'room' ] );
	} );

	it( 'counts what is done, what is waiting and what wants an answer', async () => {
		const batch = batchAgainst( { 'B.png': alreadyThere( 'B.png' ) } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C/D.png', 'E/D.png' ] ) );
		await uploadEverything( batch );

		expect( batch.counts ).toMatchObject( {
			total: 4,
			done: 1,
			held: 1,
			clash: 2
		} );
	} );

	it( 'counts the files leaving the page would lose: waiting, on their way, or on hold', async () => {
		const batch = batchAgainst( { 'B.png': alreadyThere( 'B.png' ) } );

		batch.addFiles( dropped( [ 'A.png', 'B.png', 'C/D.png', 'E/D.png' ] ) );

		expect( batch.unsent ).toBe( 4 );

		await uploadEverything( batch );

		// A is on the wiki, B is on hold, and the two D files still share a name.
		expect( batch.unsent ).toBe( 3 );
	} );

	it( 'counts a file on its way as one that leaving the page would lose', async () => {
		const slow = deferred();
		const batch = batchAgainst( { 'A.png': () => slow.promise } );

		batch.addFiles( dropped( [ 'A.png' ] ) );
		batch.start();
		await vi.waitFor( () => expect( batch.uploader.calls ).toHaveLength( 1 ) );

		expect( batch.unsent ).toBe( 1 );
		slow.resolve( stored( 'A.png' ) );
		await settled( batch );
	} );

	it( 'stays idle when everything that arrived is waiting on an answer', () => {
		const batch = batchAgainst();

		batch.addFiles( dropped( [ 'A/X.png', 'B/X.png' ] ) );
		batch.start();

		expect( batch.state.phase ).toBe( 'idle' );
	} );
} );
