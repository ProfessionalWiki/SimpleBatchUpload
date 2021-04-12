<?php
/**
 * File containing the SimpleBatchUpload class
 *
 * @copyright (C) 2016 - 2019, Stephan Gambke
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

use Parser;

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
		$simpleBatchUpload->registerEarlyConfiguration( $GLOBALS );
	}

	public function registerEarlyConfiguration( &$targetConfiguration ){
		$sourceConfiguration = $this->getEarlyConfiguration();
		$this->mergeConfiguration( $sourceConfiguration, $targetConfiguration );
	}

	public function registerLateConfiguration( &$targetConfiguration ){
		$sourceConfiguration = $this->getLateConfiguration();
		$this->mergeConfiguration( $sourceConfiguration, $targetConfiguration );
	}

	/**
	 * @param array $targetConfiguration
	 */
	protected function mergeConfiguration( $sourceConfiguration, &$targetConfiguration ) {
		foreach ( $sourceConfiguration as $varname => $value ) {
			$targetConfiguration[ $varname ] = array_key_exists( $varname, $targetConfiguration )?array_replace_recursive( $targetConfiguration[ $varname ], $value ):$value;
		}
	}

	protected function getEarlyConfiguration(): array {

		$configuration = [];

		$configuration[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadAlias' ] = __DIR__ . '/SimpleBatchUpload.alias.php';
		$configuration[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadMagic' ] = __DIR__ . '/SimpleBatchUpload.magic.php';

		$configuration[ 'wgSpecialPages' ][ 'BatchUpload' ] = '\SimpleBatchUpload\SpecialBatchUpload';

		$configuration[ 'wgHooks' ][ 'ParserFirstCallInit' ][ 'ext.simplebatchupload' ] = [ $this, 'registerParserFunction' ];
		$configuration[ 'wgHooks' ][ 'MakeGlobalVariablesScript' ][ 'ext.simplebatchupload' ] = [ $this, 'onMakeGlobalVariablesScript' ];
		$configuration[ 'wgHooks' ][ 'SetupAfterCache' ][ 'ext.simplebatchupload' ] = [ $this, 'onSetupAfterCache'];

		return $configuration;
	}

	protected function getLateConfiguration(): array {

		$configuration = [];
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
		$parser->setFunctionHook( 'batchupload', [ new UploadButtonRenderer(), 'renderParserFunction' ], Parser::SFH_OBJECT_ARGS );
		return true;
	}

	protected function getUploadSupportModuleDefinition(): array {
		if ( version_compare( $GLOBALS[ 'wgVersion' ], '1.35.0', '>' ) ) {
			$dependencies = [ 'jquery.ui' ];
		} else {
			$dependencies = [ 'jquery.ui.widget' ];
		}

		return [ 'ext.SimpleBatchUpload.jquery-file-upload' =>

			$this->getBasePathsForNonComposerModules() +

			[
				'scripts' => [ 'res/jquery.fileupload.js' ],
				'styles' => [ 'res/jquery.fileupload.css' ],
				'position' => 'top',
				'dependencies' => $dependencies,
			],
		];
	}

	protected function getUploadModuleDefinition(): array {

		$dependencies = [ 'ext.SimpleBatchUpload.jquery-file-upload', 'mediawiki.Title', 'mediawiki.jqueryMsg' ];

		if ( version_compare( $GLOBALS[ 'wgVersion' ], '1.32.0', '>' ) ) {
			$dependencies[] = 'mediawiki.api';
		} else {
			$dependencies[] = 'mediawiki.api.edit';
		}

		return [ 'ext.SimpleBatchUpload' =>

			$this->getBasePathsForNonComposerModules() +

			[
				'scripts' => [ 'res/ext.SimpleBatchUpload.js' ],
				'styles' => [ 'res/ext.SimpleBatchUpload.css' ],
				'position' => 'top',
				'dependencies' => $dependencies,
				'messages' => [ 'simplebatchupload-comment', 'simplebatchupload-max-files-alert' ],
			],
		];
	}

	/**
	 * @return string[]
	 */
	protected function getBasePathsForNonComposerModules(): array {
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
		$this->registerLateConfiguration( $GLOBALS );
	}

	/**
	 * @return array
	 */
	public function getMaxFilesPerBatchConfig() {

		if ( $this->maxFilesPerBatchConfig === null ) {
			$this->maxFilesPerBatchConfig = $GLOBALS[ 'wgSimpleBatchUploadMaxFilesPerBatch' ];
		}

		return $this->maxFilesPerBatchConfig;
	}
}
