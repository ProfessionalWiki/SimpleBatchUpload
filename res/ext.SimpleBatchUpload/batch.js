'use strict';

/**
 * The state of one batch: what was selected, what the wiki said about it, and
 * what is still waiting on the user.
 *
 * Everything the interface draws is read from here, and every decision the user
 * makes is made here. The components hold no state about the batch, so the whole
 * of what a batch can do is in one file and can be tested without a DOM.
 *
 * Two rules run through it. A file is never uploaded over another without
 * someone saying so -- neither over a file already on the wiki, which the API
 * stashes and asks about, nor over another file in the same batch, which only
 * this code can see. And a decision is always reversible while the file is
 * still on this page: nothing is thrown away, so Pause leaves the queue where it
 * was rather than failing it.
 *
 * Nothing is sent until Upload is pressed. From then on a file that arrives or
 * is decided about while the batch runs joins it.
 */

const { reactive, computed, ref } = require( 'vue' );
const { groupNameClashes, pageName } = require( './nameClash.js' );
const { findRenameDirective, looksLikeDirective, createRenamer } = require( './renamePattern.js' );
const { estimateRemainingMs, describeRemaining } = require( './remainingTime.js' );
const { createUploadRunner } = require( './uploadRunner.js' );
const { describeWarnings, filePageUrl } = require( './uploadResult.js' );

// Rows that are still only an intention. A name is a clash between these and
// nothing else: a file in flight or already uploaded is the wiki's business
// now, and comes back as a warning about a file that exists.
const UNDECIDED = [ 'queued', 'clash' ];

// Rows nobody is waiting on any more, however they turned out. Everything else
// is work in hand, which is what the per-batch limit counts.
const SETTLED = [ 'done', 'failed', 'skipped' ];

/**
 * The shared gate, with a halt of this batch's own.
 *
 * The wiki's rate limit is per user, so one gate paces every panel on the page.
 * Pause is one panel's button, and closing the shared gate would pause the
 * panel next door and tell it the wiki had refused it. So a halt answers this
 * batch's waits itself, at once: a paced gate can keep a file asleep for as
 * long as the wiki's window, and a file still asleep there when its batch was
 * paused takes no turn when it wakes.
 *
 * @param {Object} shared From createRateLimitGate()
 * @return {Object}
 */
function haltableGate( shared ) {
	let halted = false;
	const waiting = new Set();

	return {
		wait: () => new Promise( ( answer ) => {
			if ( halted ) {
				answer( false );
				return;
			}

			// Its own flag rather than the batch's: if Upload takes the pause
			// back before this wait wakes, the batch is no longer halted, but
			// this wait has still been answered and must not take a turn.
			let abandoned = false;
			const abandon = () => {
				abandoned = true;
				answer( false );
			};

			waiting.add( abandon );
			shared.wait( () => abandoned ).then( ( allowed ) => {
				waiting.delete( abandon );
				answer( allowed );
			} );
		} ),
		halt: () => {
			halted = true;
			waiting.forEach( ( abandon ) => abandon() );
			waiting.clear();
		},
		// Upload pressed again is also the user asking the wiki to try again,
		// so this lifts the limiter's own halt along with this one.
		resume: () => {
			halted = false;
			shared.resume();
		},
		noteRateLimited: () => shared.noteRateLimited(),
		noteProgress: () => shared.noteProgress(),
		schedule: () => shared.schedule()
	};
}

/**
 * @param {Object[]} undecided Rows still waiting for Upload or for an answer
 */
function regroupClashes( undecided ) {
	const places = new Map();

	groupNameClashes( undecided ).forEach( ( members ) => {
		members.forEach( ( row, index ) => {
			places.set( row, { status: 'clash', position: index + 1, outOf: members.length } );
		} );
	} );

	// Each row is written once, with where it ends up, so one whose place has
	// not changed is not drawn again.
	undecided.forEach( ( row ) => {
		Object.assign( row, places.get( row ) || { status: 'queued', position: 0, outOf: 0 } );
	} );
}

/**
 * @param {Object} options
 * @param {Object} options.queue From createUploadQueue(), shared by every panel
 *  on the page because the wiki counts uploads per user
 * @param {Object} options.uploader From createUploader()
 * @param {Object} options.gate From createRateLimitGate(), likewise shared
 * @param {Function} options.getToken Called with true to force a fresh one
 * @param {string} [options.description] Wikitext for each file page, which may
 *  carry a +rename directive; it is read into the rule at once
 * @param {string} [options.comment] Upload summary
 * @param {number} [options.maxFiles] How many unfinished files the wiki lets
 *  this user hold at once
 * @param {?Object} [options.thumbnailer] From createThumbnailer(), or absent
 *  where the browser cannot draw previews
 * @return {Object}
 */
function createBatch( options ) {
	const rows = reactive( [] );
	// What the Rename files fields hold. The flags are a regular expression's:
	// one typed into the form replaces every match, like plain text, and one
	// read from a directive keeps the directive's own.
	const rule = reactive( { find: '', replace: '', regex: false, flags: '' } );
	const renamer = computed( () => createRenamer( rule ) );
	const state = reactive( {
		phase: 'idle',
		stoppedByLimit: false,
		// The last selection, as offered and as taken: what the user needs
		// told is how much of what they chose got in.
		admitted: 0,
		turnedAway: 0,
		renamePatternInvalid: computed( () => renamer.value.invalid )
	} );
	// Absent means no limit; zero means no room. resolveUserLimit() answers zero
	// for a user in no configured group, and `|| Infinity` would turn exactly
	// the groups an administrator meant to restrict into unrestricted ones.
	const maxFiles = options.maxFiles === undefined || options.maxFiles === null ?
		Infinity :
		options.maxFiles;

	let token = null;
	// Rows handed to the queue and not yet back. A row waiting there for a free
	// slot is still queued as far as the user can see -- nothing of it has
	// gone -- so its status cannot be what keeps it from being sent twice.
	const sent = new Set();
	// The page names of the rows in `sent`: see nameInFlight().
	const namesSent = new Set();

	/**
	 * Rows that are still only an intention. A row handed to the queue is not
	 * one of them, even while it waits there for a slot: the wiki answers for a
	 * name it shares from then on, and pulled into a group it could be skipped
	 * and go up anyway.
	 *
	 * @return {Object[]}
	 */
	function undecided() {
		return rows.filter( ( row ) => UNDECIDED.includes( row.status ) && !sent.has( row ) );
	}
	const gate = haltableGate( options.gate );
	const runner = createUploadRunner( { gate: gate, queue: options.queue } );
	// Bumped every time the wiki refuses an upload, only so the estimate below
	// recomputes: the gate starts pacing after a refusal, and the gate is not
	// something the estimate can watch.
	const refusals = ref( 0 );
	// The wikitext every file page gets. A ref rather than a plain variable
	// because the field renders it: read through a bare getter, Vue has
	// nothing to track and an edit would never reach the page.
	const description = ref( options.description || '' );

	// Work in hand rather than files ever added: a limit of a thousand with 999
	// still running leaves room for one, and for a thousand once they land.
	const room = computed( () => {
		const inHand = rows.filter( ( row ) => !SETTLED.includes( row.status ) ).length;

		return Math.max( 0, maxFiles - inHand );
	} );

	/**
	 * The row a decision is about, if the decision is one that row is currently
	 * offering.
	 *
	 * Every action here is reachable only from the status whose row draws the
	 * button for it, so asking again is the answer to a double click: the
	 * second one finds a row that has already moved on and does nothing. Without
	 * this a second Replace would upload the file a second time.
	 *
	 * @param {number} id
	 * @param {string[]} from Statuses the action is offered from
	 * @return {?Object}
	 */
	function rowOffering( id, from ) {
		const row = rows[ id - 1 ];

		return row && from.includes( row.status ) ? row : null;
	}

	/**
	 * @param {string} written The wikitext every file page gets. A directive
	 *  typed into it stays there as text: rules are set in the fields.
	 */
	function setDescription( written ) {
		description.value = written;
	}

	/**
	 * The name the wiki will hold a file under, and whether a rule has left it
	 * without a file extension -- almost always a mistake in the rule, and said
	 * before anything is sent. The file still goes; the wiki adds an extension
	 * from what the file turns out to be.
	 *
	 * @param {Object} row
	 */
	function target( row ) {
		const name = renamer.value.renameFile( row.name );

		// A yes to overwriting was a yes about one name. Carried to another, it
		// would overwrite a file nobody was asked about, so the wiki is asked
		// again: the stashed bytes still save sending the file twice.
		if ( name !== row.targetName ) {
			row.ignoreWarnings = false;
		}

		row.targetName = name;
		// Kept rather than parsed wherever files are grouped by it: with a
		// thousand files, that is every keystroke in Find.
		row.pageName = pageName( name );
		row.noExtension = row.pageName === null;
	}

	/**
	 * Renaming is applied to the files waiting rather than as each is sent,
	 * because a rename both creates and removes collisions within the batch and
	 * those have to be settled before anything goes. The files already on the
	 * wiki keep the names they went up under.
	 */
	function retarget() {
		const waiting = undecided();

		waiting.forEach( target );
		regroupClashes( waiting );
	}

	/**
	 * @param {{find: string, replace: string, regex: boolean}} given What the
	 *  Rename files fields hold
	 */
	function setRule( given ) {
		if ( given.regex !== rule.regex ) {
			rule.flags = given.regex ? 'g' : '';
		}

		rule.find = given.find;
		rule.replace = given.replace;
		rule.regex = given.regex;
		retarget();
	}

	/**
	 * Reads a +rename directive out of the text the wiki sent, where a
	 * {{#batchupload:}} parameter puts it, and into the rule.
	 */
	function liftDirective() {
		const directive = findRenameDirective( description.value );

		if ( !directive ) {
			return;
		}

		description.value = directive.text;
		rule.find = directive.find;
		rule.replace = directive.replace;
		rule.regex = true;
		rule.flags = directive.flags;
		retarget();
	}

	/**
	 * @param {{file: File, path: string}[]} entries
	 */
	function addFiles( entries ) {
		const admitted = entries.slice( 0, room.value );

		state.admitted = admitted.length;
		state.turnedAway = entries.length - admitted.length;

		const firstNewRow = rows.length;

		admitted.forEach( ( entry ) => {
			rows.push( {
				// Rows are never taken out, so an id is a place in the list.
				id: rows.length + 1,
				file: entry.file,
				name: entry.file.name,
				targetName: entry.file.name,
				pageName: null,
				noExtension: false,
				path: entry.path || '',
				size: entry.file.size,
				status: 'queued',
				progress: 0,
				detail: '',
				thumbnail: '',
				href: '',
				filekey: '',
				ignoreWarnings: false,
				position: 0,
				outOf: 0
			} );
		} );

		rows.slice( firstNewRow ).forEach( target );
		regroupClashes( undecided() );
		rows.slice( firstNewRow ).forEach( previewFor );
		dispatchWaiting();
	}

	/**
	 * Asks for a preview, if anything can draw one. Failure is not reported:
	 * a file without one keeps the placeholder, which is a fine thing to be.
	 *
	 * @param {Object} row
	 */
	function previewFor( row ) {
		if ( !options.thumbnailer ) {
			return;
		}

		options.thumbnailer.thumbnail( row.file ).then( ( url ) => {
			row.thumbnail = url || '';
		}, () => {} );
	}

	/**
	 * Picks one file out of the group sharing its name. The group is one page
	 * on the wiki, so choosing one is choosing against the others.
	 *
	 * @param {number} id
	 */
	function keepFile( id ) {
		const kept = rowOffering( id, [ 'clash' ] );

		if ( !kept ) {
			return;
		}

		// By page name, which the clash was found by: two names that differ
		// only in what MediaWiki normalises away are one page, and matching the
		// names as typed would leave the losers clashing.
		skipFiles( rows
			.filter( ( row ) => row.status === 'clash' && row !== kept && row.pageName === kept.pageName )
			.map( ( row ) => row.id ) );

		dispatchWaiting();
	}

	/**
	 * Leaves files where they are: the one on the wiki, the others sharing this
	 * name, or a file the user has changed their mind about. That last only
	 * until Upload is pressed: after that its turn can come at any moment, and
	 * a skip would be racing the upload.
	 *
	 * Plural because a group has to be skipped at once. One at a time, the
	 * second skip leaves the third file alone with the name, which is no
	 * longer a clash, and it uploads.
	 *
	 * @param {number[]} ids
	 */
	function skipFiles( ids ) {
		const from = state.phase === 'idle' ? [ 'queued', 'held', 'clash' ] : [ 'held', 'clash' ];

		ids.forEach( ( id ) => {
			const row = rowOffering( id, from );

			if ( row ) {
				row.status = 'skipped';
				row.position = 0;
				row.outOf = 0;
			}
		} );

		regroupClashes( undecided() );
	}

	function skipFile( id ) {
		skipFiles( [ id ] );
	}

	/**
	 * Puts a skipped file back among the ones waiting, if the batch has room
	 * for it.
	 *
	 * @param {number} id
	 */
	function addFileBack( id ) {
		offerAgain( id, 'skipped' );
	}

	/**
	 * Goes ahead with files the wiki asked about. Where the wiki stashed the
	 * bytes, each costs a request carrying the key rather than the file again.
	 *
	 * @param {number[]} ids
	 */
	function replaceFiles( ids ) {
		ids.forEach( ( id ) => {
			const row = rowOffering( id, [ 'held' ] );

			if ( row ) {
				row.ignoreWarnings = true;
				row.status = 'queued';
			}
		} );

		// Back among the files waiting, they can share a name with one that
		// arrived while the wiki's question was open.
		regroupClashes( undecided() );
		dispatchWaiting();
	}

	function replaceFile( id ) {
		replaceFiles( [ id ] );
	}

	/**
	 * Offers a failed file again, if the batch has room for it: a failed file
	 * gave up its place, and other files may have taken it since.
	 *
	 * @param {number} id
	 */
	function retryFile( id ) {
		offerAgain( id, 'failed' );
	}

	/**
	 * Puts a file back among the ones waiting, from the bytes: whatever the
	 * wiki stashed for it before is not worth trusting. It goes under the name
	 * the rule gives it now, which may not be the one it had, and so may share
	 * a name with another file waiting.
	 *
	 * @param {number} id
	 * @param {string} from The status it is offered back from
	 */
	function offerAgain( id, from ) {
		const row = rowOffering( id, [ from ] );

		if ( !row || room.value === 0 ) {
			return;
		}

		row.filekey = '';
		row.ignoreWarnings = false;
		row.detail = '';
		target( row );
		row.status = 'queued';
		regroupClashes( undecided() );
		dispatchWaiting();
	}

	async function currentToken() {
		if ( token === null ) {
			token = await options.getToken();
		}

		return token;
	}

	async function refreshToken() {
		token = await options.getToken( true );
	}

	/**
	 * Called by the runner once the row's turn has come, which is the moment it
	 * starts uploading.
	 *
	 * @param {Object} row
	 * @return {Promise}
	 */
	function submitFor( row ) {
		row.status = 'uploading';
		row.progress = 0;

		return currentToken().then( ( csrfToken ) => options.uploader.upload( {
			file: row.filekey ? null : row.file,
			filekey: row.filekey,
			filename: row.targetName,
			token: csrfToken,
			text: description.value,
			comment: options.comment,
			ignoreWarnings: row.ignoreWarnings
		}, ( fraction ) => {
			row.progress = fraction;
		} ) );
	}

	function applyOutcome( row, outcome ) {
		if ( outcome.status === 'success' ) {
			row.status = 'done';
			row.href = filePageUrl( outcome.filename || row.targetName ) || '';
			row.detail = describeWarnings( outcome.warnings ).join( ' ' );
			return;
		}

		if ( outcome.status === 'held' ) {
			row.status = 'held';
			row.filekey = outcome.filekey;
			return;
		}

		// Nothing was stored: the batch was halted while this file waited its
		// turn, or the wiki refused it often enough that it goes to the back
		// of the queue. It is still a file the user chose.
		if ( outcome.status === 'stopped' ) {
			row.status = 'queued';
			return;
		}

		row.status = 'failed';
		row.detail = failureReason( outcome );
	}

	function failureReason( outcome ) {
		if ( outcome.status === 'network-error' ) {
			return mw.msg( 'simplebatchupload-result-network-error' );
		}

		return outcome.info || mw.msg( 'simplebatchupload-result-unknown-error' );
	}

	async function runRow( row ) {
		// Turned away by the wiki's rate limit, the file goes to the back of
		// the queue to wait for another turn: it is waiting again, not
		// uploading, until that turn comes.
		const refusedFor = () => {
			row.status = 'queued';
			row.progress = 0;
			refusals.value += 1;
		};

		let outcome = await runner.run( () => submitFor( row ), refusedFor, refreshToken );

		// A warning that puts nothing at risk. Going ahead is a second request,
		// carrying the key where the wiki kept the bytes, and the note it
		// warned about is reported next to the stored file.
		if ( outcome.status === 'confirmable' ) {
			row.filekey = outcome.filekey;
			row.ignoreWarnings = true;
			outcome = await runner.run( () => submitFor( row ), refusedFor, refreshToken );
		}

		applyOutcome( row, outcome );
	}

	// A file confirmed without asking goes ahead with ignorewarnings, which
	// would also wave through a same-named file sent alongside it. So one
	// waits for the other, and then hears from the wiki that the name is taken.
	function nameInFlight( row ) {
		return row.pageName !== null && namesSent.has( row.pageName );
	}

	function dispatch( row ) {
		if ( state.phase !== 'uploading' || sent.has( row ) || nameInFlight( row ) ) {
			return;
		}

		sent.add( row );
		namesSent.add( row.pageName );

		runRow( row ).then( () => finishOne( row ), ( unexpected ) => {
			row.status = 'failed';
			row.detail = ( unexpected && unexpected.message ) ||
				mw.msg( 'simplebatchupload-result-unknown-error' );
			finishOne( row );
		} );
	}

	/**
	 * Sends what is waiting, if the batch is running.
	 */
	function dispatchWaiting() {
		rows.filter( ( row ) => row.status === 'queued' ).forEach( dispatch );
	}

	function finishOne( row ) {
		sent.delete( row );
		namesSent.delete( row.pageName );

		// What waited for this file's name can go, and so can the file itself
		// if it came back from a pause Upload has since taken back -- but not
		// when it was the wiki's own limiter that gave up, which would only
		// refuse them at once.
		if ( state.phase === 'uploading' && !options.gate.stopped() ) {
			if ( row.status === 'queued' ) {
				regroupClashes( undecided() );
			}

			dispatchWaiting();
		}

		// Sent back by a pause, files are intentions again, and may share a
		// name with one that arrived while they were out. Settled once, when
		// the last is back: a thousand files come back one at a time.
		if ( sent.size === 0 ) {
			regroupClashes( undecided() );
			goIdle();
		}
	}

	function goIdle() {
		// Read off the shared gate rather than this batch's: that one halts only
		// when the wiki has refused too often to be worth another try, which is
		// the thing worth explaining. A batch the user paused says nothing.
		state.stoppedByLimit = state.phase === 'uploading' && options.gate.stopped();
		state.phase = 'idle';
	}

	/**
	 * Upload: sends everything that is waiting, whether it has just arrived or
	 * was paused. Pressed while a pause is still waiting for the files already
	 * sent, it takes the pause back.
	 */
	function start() {
		// A rule that is not one renames nothing, and every file would go up
		// under its own name: not what anyone who typed a rule asked for.
		if ( state.renamePatternInvalid ) {
			return;
		}

		if ( state.phase !== 'uploading' ) {
			state.phase = 'uploading';
			state.stoppedByLimit = false;
			gate.resume();
		}

		// Pressed while a pause is taking hold, some files are back that have
		// not been grouped with what arrived while they were out.
		regroupClashes( undecided() );
		dispatchWaiting();

		if ( sent.size === 0 ) {
			goIdle();
		}
	}

	/**
	 * Closes the gate. Files already in flight finish -- there is no way to
	 * take back a request the wiki is already reading -- and everything behind
	 * them stays queued for Upload.
	 */
	function pause() {
		if ( state.phase !== 'uploading' ) {
			return;
		}

		state.phase = 'pausing';
		gate.halt();
	}

	const counts = computed( () => {
		const tally = {
			total: rows.length,
			queued: 0,
			uploading: 0,
			done: 0,
			failed: 0,
			skipped: 0,
			held: 0,
			clash: 0
		};

		rows.forEach( ( row ) => {
			tally[ row.status ] += 1;
		} );

		return tally;
	} );

	// Files that exist only on this page: waiting for Upload, on their way, or
	// on hold. Leaving the page loses them.
	const unsent = computed( () => counts.value.queued + counts.value.uploading +
		counts.value.held + counts.value.clash );

	// How much longer the batch has to run at the pace the wiki allows, in
	// words. Absent unless the wiki advertises a limit tight enough to pace to,
	// and until Upload is pressed: before that nothing is running down.
	const remaining = computed( () => {
		if ( state.phase === 'idle' ) {
			return '';
		}

		const togo = counts.value.queued + counts.value.uploading;
		// Read, not used: the gate's schedule changes when an upload is
		// refused, and nothing about that is reactive on its own.
		const schedule = refusals.value >= 0 ? gate.schedule() : null;

		return describeRemaining( estimateRemainingMs( togo, schedule ) ) || '';
	} );

	// The files waiting, and of them the ones the rule gives a new name: what
	// Rename files counts, and what Show only these shows. Files already sent
	// or skipped keep whatever name an earlier rule gave them, and are neither.
	const waitingRows = computed( () => rows.filter( ( row ) => UNDECIDED.includes( row.status ) ) );
	const renamedRows = computed(
		() => waitingRows.value.filter( ( row ) => row.targetName !== row.name )
	);
	const renameCount = computed( () => ( {
		changed: renamedRows.value.length,
		of: waitingRows.value.length
	} ) );

	liftDirective();

	return {
		rows: rows,
		state: state,
		setDescription: setDescription,
		setRule: setRule,
		addFiles: addFiles,
		keepFile: keepFile,
		skipFile: skipFile,
		skipFiles: skipFiles,
		addFileBack: addFileBack,
		replaceFile: replaceFile,
		replaceFiles: replaceFiles,
		retryFile: retryFile,
		start: start,
		pause: pause,

		get counts() {
			return counts.value;
		},

		get room() {
			return room.value;
		},

		get maxFiles() {
			return maxFiles;
		},

		get description() {
			return description.value;
		},

		get rule() {
			return rule;
		},

		get renameCount() {
			return renameCount.value;
		},

		get renamedRows() {
			return renamedRows.value;
		},

		get textLooksLikeDirective() {
			return looksLikeDirective( description.value );
		},

		get remaining() {
			return remaining.value;
		},

		get unsent() {
			return unsent.value;
		}
	};
}

module.exports = { createBatch: createBatch };
