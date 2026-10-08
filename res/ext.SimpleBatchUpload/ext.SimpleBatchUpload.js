'use strict';

/**
 * Mounts the upload panel on every place the extension put one:
 * Special:BatchUpload and its subpages, and each {{#batchupload:}} on a page.
 *
 * This file is the only one that touches the page or the wiki directly.
 * Everything a batch decides is in batch.js, everything it draws is in the
 * components, and both are tested without a browser.
 *
 * @license GPL-2.0-or-later
 */

const Vue = require( 'vue' );
const UploadPanel = require( './UploadPanel.vue' );
const { createBatch } = require( './batch.js' );
const { createUploader } = require( './uploadRequest.js' );
const { createUploadQueue } = require( './uploadQueue.js' );
const { createRateLimitGate } = require( './rateLimitGate.js' );
const { limitFromUserInfo } = require( './rateLimits.js' );
const { resolveUserLimit } = require( './batchLimit.js' );
const { createThumbnailer } = require( './thumbnailer.js' );
const { catchMissedDrops } = require( './missedDrop.js' );
const { wantsToolbar } = require( './toolbar.js' );

// Four at a time is the most a batch gains from before the wiki's own limits
// become the bound. The gate paces below this whenever the wiki says so.
const MAX_CONCURRENT_UPLOADS = 4;

// The rate limit is per user, so one gate and one queue serve every panel on the
// page: two {{#batchupload:}} on one page share a budget. Each batch wraps the
// gate with a halt of its own, so Pause on one panel does not pause the other.
const gate = createRateLimitGate();
const queue = createUploadQueue( { limit: MAX_CONCURRENT_UPLOADS } );

const thumbnailer = createThumbnailer();

const api = new mw.Api();

// The wiki publishes the limits it will enforce, so the gate can pace uploads
// to them rather than discover them by being refused. Deliberately not waited
// on: a panel has to work the moment the page is ready, and the gate does not
// pace until something is refused anyway. A failed query means no pacing, and
// no toolbar, which waits on the rights the same query reads.
const userInfo = api.get( { action: 'query', meta: 'userinfo', uiprop: [ 'ratelimits', 'rights' ] } );

userInfo.then(
	( response ) => gate.useLimit( limitFromUserInfo( response ) ),
	( error ) => mw.log.warn( 'SimpleBatchUpload: could not read the rate limits', error )
);

const batches = [];

catchMissedDrops( document );

// Every file still waiting exists only on this page, so leaving the page asks
// first while there is anything to lose.
window.addEventListener( 'beforeunload', ( event ) => {
	if ( batches.some( ( batch ) => batch.unsent > 0 ) ) {
		event.preventDefault();
		// Older browsers ask only when this is set; none shows its text.
		event.returnValue = '';
	}
} );

/**
 * @param {boolean} [refresh] After the wiki reported the batch's token as stale
 * @return {Promise<string>}
 */
function getToken( refresh ) {
	if ( refresh ) {
		api.badToken( 'csrf' );
	}

	return api.getToken( 'csrf' );
}

/**
 * @param {HTMLElement} element The mount point the extension rendered
 * @param {number} panels How many panels the page has
 */
function mountPanel( element, panels ) {
	const batch = createBatch( {
		gate: gate,
		queue: queue,
		uploader: createUploader( { url: mw.util.wikiScript( 'api' ) } ),
		thumbnailer: thumbnailer,
		getToken: getToken,
		description: element.dataset.mwSbuDescription || '',
		comment: element.dataset.mwSbuComment || '',
		rename: element.dataset.mwSbuRename || '',
		maxFiles: resolveUserLimit(
			mw.config.get( 'simpleBatchUploadMaxFilesPerBatch' ),
			mw.config.get( 'wgUserGroups' )
		)
	} );

	batches.push( batch );
	Vue.createMwApp( UploadPanel, {
		batch: batch,
		// Special:BatchUpload is there to upload. A {{#batchupload:}} sits among
		// a page's own content, sometimes dozens of them to a page.
		startsCompact: mw.config.get( 'wgCanonicalSpecialPageName' ) !== 'BatchUpload',
		onEditDetailsOnce: ( textarea ) => offerToolbar( textarea, panels )
	} ).mount( element );
}

function mountAll() {
	const mounts = document.querySelectorAll( '.ext-sbu-mount' );

	Array.prototype.forEach.call( mounts, ( element ) => mountPanel( element, mounts.length ) );
}

/**
 * WikiEditor brings jQuery UI and OOUI with it, so the toolbar waits until the
 * details form is first opened, which may be never.
 *
 * @param {HTMLTextAreaElement} textarea The file page text
 * @param {number} panels How many panels the page has
 */
function offerToolbar( textarea, panels ) {
	userInfo.then( ( response ) => {
		const page = {
			moduleState: mw.loader.getState( 'ext.wikiEditor' ),
			preference: mw.user.options.get( 'usebetatoolbar' ),
			canUpload: response.query.userinfo.rights.includes( 'upload' ),
			panels: panels
		};

		if ( wantsToolbar( page ) ) {
			addToolbar( textarea );
		}
	} );
}

/**
 * @param {HTMLTextAreaElement} textarea The file page text
 */
function addToolbar( textarea ) {
	mw.loader.using( 'ext.wikiEditor' ).then(
		// WikiEditor takes a jQuery object. jQuery is on every page WikiEditor
		// loads on; this module only keeps out of it everywhere else.
		//
		// From MediaWiki 1.46 the drag bar would replace the field's four rows
		// with the height the user last dragged their edit box to, which it
		// stores under the same key. Earlier versions ignore the option.
		() => mw.addWikiEditor( window.jQuery( textarea ), { resizingdragbar: false } )
	).catch(
		( error ) => mw.log.warn( 'SimpleBatchUpload: could not add WikiEditor', error )
	);
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mountAll );
} else {
	mountAll();
}
