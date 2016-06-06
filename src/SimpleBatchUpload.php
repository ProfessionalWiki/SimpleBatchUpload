<?php
/**
 * File containing the SimpleBatchUpload class
 *
 * @copyright (C) 2016, Stephan Gambke
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

	private static $singleton;

	/**
	 * @return SimpleBatchUpload
	 */
	public static function singleton() {
		if ( !isset( self::$singleton ) ) {
			self::$singleton = new self();
		}

		return self::$singleton;
	}

	public static function initCallback() {
		$GLOBALS[ 'wgHooks' ][ 'SetupAfterCache' ][ ] = function() {
			self::singleton()->init();
		};
	}

	public function init() {

		$GLOBALS[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadAlias' ] = __DIR__ . '/SimpleBatchUpload.alias.php';
		$GLOBALS[ 'wgSpecialPages' ][ 'BatchUpload' ] = '\SimpleBatchUpload\SpecialBatchUpload';

		$this->registerUploadProvidingModule();
		$this->registerUploadUtilizingModule();
	}

	protected function registerUploadProvidingModule() {

		$moduleDescription = [
			'scripts' => [ '/vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js' ],
			'styles'       => [	'/vendor/blueimp/jquery-file-upload/css/jquery.fileupload.css' ],
			'position'     => 'top',
			'dependencies' => [ 'jquery.ui.widget' ],
		];

		$this->registerResourceModule( 'ext.SimpleBatchUpload.jquery-file-upload', $moduleDescription, true );

	}

	protected function registerUploadUtilizingModule() {

		$moduleDescription = [
			'scripts'       => [ 'res/ext.SimpleBatchUpload.js' ],
			'styles'        => [ 'res/ext.SimpleBatchUpload.css' ],
			'position'      => 'top',
			'dependencies'  => [ 'ext.SimpleBatchUpload.jquery-file-upload', 'mediawiki.Title' ],
		];

		$this->registerResourceModule( 'ext.SimpleBatchUpload', $moduleDescription, false );
	}

	/**
	 * @return array
	 */
	protected function registerResourceModule( $moduleName, $moduleDefinition, $isDependency = false ) {

		if ( file_exists( dirname( __DIR__ ) . '/vendor' ) || !$isDependency ) {
			$localBasePath = dirname( __DIR__ );
			$remoteBasePath = $GLOBALS[ 'wgExtensionAssetsPath' ] . '/SimpleBatchUpload';
		} else {
			$localBasePath = $GLOBALS[ 'IP' ];
			$remoteBasePath = $GLOBALS[ 'wgScriptPath' ];
		}

		$GLOBALS[ 'wgResourceModules' ][ $moduleName ] =
			array_merge( [ 'localBasePath'  => $localBasePath, 'remoteBasePath' => $remoteBasePath ], $moduleDefinition );

	}
}
