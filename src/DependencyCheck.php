<?php
/**
 * Verify that dependencies are present
 *
 * @copyright (C) 2017  Mark A. Hershberger
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
 * 02110-1301, USA.
 *
 * @file
 * @ingroup SimpleBatchUpload
 */

namespace SimpleBatchUpload;

use PHPVersionCheck;

/**
 * Class ExtensionManager
 *
 * @package SimpleBatchUploadCheck
 */
class DependencyCheck extends PHPVersionCheck {
	/**
	 * Displays an error.
	 */
	function checkVendorExistence() {
		global $wgResourceModules, $wgScriptPath, $IP;
		if ( !file_exists( __DIR__ . '/../vendor/autoload.php' ) ) {
			if ( !file_exists( "$IP/vendor/blueimp" ) ) {
				$shortText = "SimpleBatchUpload requires some external dependencies." .
						   " Please run composer.";

				$longText = "Error: You are missing some external dependencies.\n"
						  . "SimpleBatchUpload has some external dependencies that\n"
						  . "need to be installed via composer.";

				$longHtml = <<<HTML
		MediaWiki now also has some external dependencies that need to be installed via
		composer.
HTML;

				$this->triggerError( 'External dependencies', $shortText, $longText,
									 $longHtml );
			}
			// HACK!
			$mod = $wgResourceModules['ext.SimpleBatchUpload.jquery-file-upload'];
			$mod['localBasePath'] = $IP;
			$mod['remoteBasePath'] = $wgScriptPath;
			$wgResourceModules['ext.SimpleBatchUpload.jquery-file-upload'] = $mod;
		}
	}

	/**
	 * Callback hook
	 */
	public static function initCallback() {
		$singleton = new self();
		$singleton->checkVendorExistence();
	}
}
