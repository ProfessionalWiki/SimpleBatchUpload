/**
 * Vitest setup file.
 *
 * Installs a fresh `mw` stub on globalThis before every test. Rebuilding it per
 * test means there is no shared registry to reset and no way for one test to
 * leak call history or a stubbed return value into the next.
 *
 * `$i18n` is registered as a global mixin. In MediaWiki it comes from the i18n
 * plugin `Vue.createMwApp()` installs, which plain Vue does not have, so a
 * component template calling `$i18n( key ).text()` works in both places.
 *
 * `$` and `jQuery` are deliberately NOT stubbed. Everything under test here is
 * jQuery free by construction — res/ext.SimpleBatchUpload/.eslintrc.json
 * enforces that for every file except ext.SimpleBatchUpload.js, which stays
 * untestable DOM wiring. An accidental jQuery call should throw a
 * ReferenceError, not quietly hit a shim.
 */

const { config } = require( '@vue/test-utils' );
const { createMwMock } = require( './mocks/mw.js' );

config.global.mixins = [ {
	methods: {
		$i18n( key, ...params ) {
			return mw.message( key, ...params );
		}
	}
} ];

// Assigned once up front as well, so a module that reads mw at require time
// rather than at call time still finds a stub.
globalThis.mw = createMwMock();

beforeEach( () => {
	globalThis.mw = createMwMock();
} );

afterEach( () => {
	vi.useRealTimers();
} );
