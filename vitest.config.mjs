import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

/**
 * Rewrites the CommonJS that ResourceLoader expects inside a .vue file into the
 * ESM that Vite's SFC compiler expects.
 *
 * ResourceLoader serves single-file components by splitting them server-side and
 * appending `module.exports.template = "..."`, so the script block has to be
 * CommonJS. Vite compiles the same block as ESM, where `module` and `exports`
 * do not exist. Three rewrites bridge that:
 *
 *   1. `module.exports = exports = X`  ->  `export default X`
 *   2. `const Foo = require( './Foo.vue' )`  ->  a hoisted `import`, because a
 *      required .vue file would never reach the SFC compiler
 *   3. `require( './codex.js' )`  ->  `require( '@wikimedia/codex' )`, and
 *      `require( './icons.json' )`  ->  the stub under tests/vitest/mocks.
 *      Both are virtual files that `CodexModule` plants at the module root while
 *      a request is served -- a tree-shaken component subset and the icons named
 *      in extension.json. Neither exists on disk for a test to resolve.
 *
 * Rewriting rather than aliasing, because vite-node's CJS shim resolves
 * `require()` through Node rather than through Vite, so `resolve.alias` never
 * sees these. That is also why plain `require( 'vue' )` works untouched: `vue`
 * is a real devDependency pinned to the version core ships.
 *
 * The `<style>` block is dropped rather than compiled. It is LESS written
 * against `mediawiki.skin.variables.less`, a name only ResourceLoader can
 * resolve -- it maps to whichever skin is rendering. Nothing here asserts on
 * styles; that the block compiles at all has to be checked by hand, by running
 * ResourceLoader's own LESS compiler over the file for each skin.
 *
 * @return {Object} A Vite plugin
 */
function mediaWikiVueCjs() {
	const CODEX_VIRTUAL_PATH = /require\(\s*(['"])\.{1,2}\/(?:\.\.\/)*codex\.js\1\s*\)/g;
	const ICONS_VIRTUAL_PATH = /require\(\s*(['"])\.{1,2}\/(?:\.\.\/)*icons\.json\1\s*\)/g;
	const ICONS_STUB = fileURLToPath(
		new URL( 'tests/vitest/mocks/icons.json', import.meta.url )
	);
	const MODULE_EXPORTS = /module\.exports\s*=\s*exports\s*=\s*/g;
	const REQUIRE_VUE_FILE = /^[ \t]*const\s+(\w+)\s*=\s*require\(\s*'([^']+\.vue)'\s*\);?[ \t]*$/gm;
	const STYLE_BLOCK = /\n*<style[^>]*>[\s\S]*?<\/style>/g;

	return {
		name: 'mediawiki-vue-cjs',
		enforce: 'pre',

		transform( code, id ) {
			if ( !id.endsWith( '.vue' ) ) {
				return null;
			}

			const hoisted = [];
			let out = code
				.replace( CODEX_VIRTUAL_PATH, 'require( \'@wikimedia/codex\' )' )
				.replace( ICONS_VIRTUAL_PATH, `require( '${ ICONS_STUB }' )` )
				.replace( STYLE_BLOCK, '' )
				.replace( MODULE_EXPORTS, 'export default ' )
				.replace( REQUIRE_VUE_FILE, ( match, name, path ) => {
					hoisted.push( `import ${ name } from '${ path }';` );
					return '';
				} );

			if ( hoisted.length ) {
				out = out.replace( /<script>/, '<script>\n' + hoisted.join( '\n' ) );
			}

			return out === code ? null : { code: out, map: null };
		}
	};
}

export default defineConfig( {
	plugins: [ mediaWikiVueCjs(), vue() ],
	test: {
		environment: 'jsdom',
		include: [ 'tests/vitest/**/*.test.js' ],
		globals: true,
		passWithNoTests: true,
		restoreMocks: true,
		setupFiles: [ 'tests/vitest/setup.js' ],
		testTimeout: 10000,
		hookTimeout: 15000
	}
} );
