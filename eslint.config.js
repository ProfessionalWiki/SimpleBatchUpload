'use strict';

const { defineConfig, globalIgnores } = require( 'eslint/config' );
const wikimedia = require( 'eslint-config-wikimedia/flat' );

module.exports = defineConfig( [
	globalIgnores( [
		'coverage/',
		'i18n/',
		'package-lock.json',
		'vendor/'
	] ),

	// res/ runs in the browser and has its own config below
	{
		ignores: [ 'res/**' ],
		extends: [ wikimedia( 'server' ) ]
	},
	{
		files: [ 'tests/vitest/**/*.js' ],
		languageOptions: {
			globals: {
				vi: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly'
			}
		},
		rules: {
			'n/no-missing-require': 'off',
			'no-undef': 'off',
			strict: 'off',
			'no-underscore-dangle': 'off'
		}
	},

	{
		files: [ 'res/**' ],
		extends: [ wikimedia( 'client/es2017', 'mediawiki', 'vue3/es2017' ) ],
		languageOptions: {
			globals: {
				$: 'off',
				jQuery: 'off'
			}
		},
		rules: {
			'jsdoc/no-undefined-types': 'off',
			'max-len': 'off'
		}
	},
	{
		files: [ 'res/**/*.vue' ],
		rules: {
			'vue/component-name-in-template-casing': [ 'error', 'kebab-case' ]
		}
	}
] );
