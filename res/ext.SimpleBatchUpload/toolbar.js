'use strict';

/**
 * Whether the text for each file page gets WikiEditor's toolbar, as the edit
 * page would give it: only where WikiEditor is installed, and only to a user
 * who has not turned the toolbar off. Only to a user who can upload, too, as
 * no one else creates the pages the text is for.
 *
 * Only where nothing else on the page loads WikiEditor. Its dialogs are shared
 * by every toolbar on the page and write to whichever field first opened them,
 * so a link inserted here could land in the edit box, or the reverse. As only
 * one field can have it, a page with several panels gives it to none of them
 * rather than to whichever comes first.
 *
 * @param {Object} page
 * @param {string|null} page.moduleState What mw.loader.getState() says of ext.wikiEditor
 * @param {*} page.preference The usebetatoolbar option as stored, which may be
 *  a boolean, a number or a string; read as PHP casts it to a boolean
 * @param {boolean} page.canUpload Whether the user has the upload right
 * @param {number} page.panels How many upload panels the page has
 * @return {boolean}
 */
function wantsToolbar( page ) {
	return page.moduleState === 'registered' &&
		Boolean( page.preference ) && page.preference !== '0' &&
		page.canUpload &&
		page.panels === 1;
}

module.exports = { wantsToolbar };
