<?php
/**
 * File containing the SimpleBatchUpload class
 *
 * @copyright (C) 2016 - 2017, Stephan Gambke
 * @license   GNU General Public License, version 2 (or any later version)
 *
 * This software is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @ingroup SimpleBatchUpload
 */

namespace SimpleBatchUpload;

/**
 * Class ExtensionManager
 *
 * @package SimpleBatchUpload
 */
class SimpleBatchUpload {

	public static function initCallback() {

			$configuration = ( new self() )->getConfiguration();

			foreach ( $configuration as $varname => $value ) {
				$GLOBALS[ $varname ] = array_replace_recursive( $GLOBALS[ $varname ], $value );
			}

	}

	/**
	 * @return array
	 */
	public function getConfiguration() {

		$configuration = [];

		$configuration[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadAlias' ] = __DIR__ . '/SimpleBatchUpload.alias.php';
		$configuration[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadMagic' ] = __DIR__ . '/SimpleBatchUpload.magic.php';

		$configuration[ 'wgSpecialPages' ][ 'BatchUpload' ] = '\SimpleBatchUpload\SpecialBatchUpload';

		$configuration[ 'wgHooks' ][ 'ParserFirstCallInit' ][ 'ext.simplebatchupload' ] = [ $this, 'registerParserFunction' ];

		$configuration[ 'wgResourceModules' ] = $this->getUploadSupportModuleDefinition() + $this->getUploadModuleDefinition();

		return $configuration;

	}

	/**
	 * @param \Parser $parser
	 *
	 * @return bool
	 * @throws \MWException
	 */
	public function registerParserFunction( &$parser ) {
		$parser->setFunctionHook( 'batchupload', [ new UploadButtonRenderer(), 'renderParserFunction' ], SFH_OBJECT_ARGS );
		return true;
	}


	/**
	 * @return array
	 */
	protected function getUploadSupportModuleDefinition() {

		return [ 'ext.SimpleBatchUpload.jquery-file-upload' =>

			$this->getBasePathsForComposerModules() +

			[
				'scripts' => [ '/vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js' ],
				'styles' => [ '/vendor/blueimp/jquery-file-upload/css/jquery.fileupload.css' ],
				'position' => 'top',
				'dependencies' => [ 'jquery.ui.widget' ],
			],
		];

	}

	/**
	 * @return array
	 */
	protected function getUploadModuleDefinition() {

		return [ 'ext.SimpleBatchUpload' =>

			$this->getBasePathsForNonComposerModules() +

			[
				'scripts' => [ 'res/ext.SimpleBatchUpload.js' ],
				'styles' => [ 'res/ext.SimpleBatchUpload.css' ],
				'position' => 'top',
				'dependencies' => [ 'ext.SimpleBatchUpload.jquery-file-upload', 'mediawiki.Title', 'mediawiki.api.edit', 'mediawiki.jqueryMsg' ],
				'messages' => [ 'simplebatchupload-comment' ],
			],
		];
	}

	/**
	 * @return string[]
	 */
	protected function getBasePathsForNonComposerModules() {
		return [
			'localBasePath' => dirname( __DIR__ ),
			'remoteBasePath' => $GLOBALS[ 'wgExtensionAssetsPath' ] . '/SimpleBatchUpload',
		];
	}

	/**
	 * @return string[]
	 */
	protected function getBasePathsForComposerModules() {

		if ( file_exists( dirname( __DIR__ ) . '/vendor' ) ) {
			return $this->getBasePathsForNonComposerModules();
		}

		return [
			'localBasePath' => $GLOBALS[ 'IP' ],
			'remoteBasePath' => $GLOBALS[ 'wgScriptPath' ],
		];
	}

}
