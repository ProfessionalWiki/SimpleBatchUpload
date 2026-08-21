/**
 * Vitest setup file.
 *
 * Installs a fresh `mw` stub on globalThis before every test. Rebuilding it per
 * test means there is no shared registry to reset and no way for one test to
 * leak call history or a stubbed return value into the next.
 *
 * `$` and `jQuery` are deliberately NOT stubbed. Everything under test here is
 * jQuery free by construction — res/ext.SimpleBatchUpload/.eslintrc.json
 * enforces that for every file except ext.SimpleBatchUpload.js, which stays
 * untestable DOM wiring. An accidental jQuery call should throw a
 * ReferenceError, not quietly hit a shim.
 */

const { createMwMock } = require( './mocks/mw.js' );

// Assigned once up front as well, so a module that reads mw at require time
// rather than at call time still finds a stub.
globalThis.mw = createMwMock();

beforeEach( () => {
	globalThis.mw = createMwMock();
} );

afterEach( () => {
	vi.useRealTimers();
} );
