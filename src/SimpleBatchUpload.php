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

	/**
	 * @var array Max files could be uploaded per batch
	 */
	protected $maxFilesPerBatchConfig;

	public static function initCallback() {

		$simpleBatchUpload = new self();

		$configuration = $simpleBatchUpload->getConfiguration();

		self::mergeConfiguration( $configuration );
	}


	/**
	 * @param $configuration
	 */
	public static function mergeConfiguration( $configuration ) {
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
		$configuration[ 'wgHooks' ][ 'MakeGlobalVariablesScript' ][ 'ext.simplebatchupload' ] = [ $this, 'onMakeGlobalVariablesScript' ];
		$configuration[ 'wgHooks' ][ 'SetupAfterCache' ][ 'ext.simplebatchupload' ] = [ $this, 'onSetupAfterCache'];

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

			$this->getBasePathsForNonComposerModules() +

			[
				'scripts' => [ 'res/jquery.fileupload.js' ],
				'styles' => [ 'res/jquery.fileupload.css' ],
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
				'messages' => [ 'simplebatchupload-comment', 'simplebatchupload-max-files-alert' ],
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
	 * @param array &$vars
	 * @param \OutputPage $out
	 */
	public function onMakeGlobalVariablesScript( &$vars, $out ) {
		$vars['simpleBatchUploadMaxFilesPerBatch'] = $this->getMaxFilesPerBatchConfig();
	}

	public function onSetupAfterCache() {

		$configuration = [ 'wgResourceModules' => $this->getUploadSupportModuleDefinition() + $this->getUploadModuleDefinition() ];
		self::mergeConfiguration( $configuration );

	}

	/**
	 * @return array
	 */
	public function getMaxFilesPerBatchConfig() {
		global $wgSimpleBatchUploadMaxFilesPerBatch;
		if ( $this->maxFilesPerBatchConfig === null ) {
			$this->maxFilesPerBatchConfig = $wgSimpleBatchUploadMaxFilesPerBatch;
		}
		return $this->maxFilesPerBatchConfig;
	}

	/**
	 * @param $maxFilesPerBatchConfig
	 */
	public function setMaxFilesPerBatchConfig( $maxFilesPerBatchConfig ) {
		$this->maxFilesPerBatchConfig = $maxFilesPerBatchConfig;
	}

}
