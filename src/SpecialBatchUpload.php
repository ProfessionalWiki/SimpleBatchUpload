<?php
/**
 * File containing the SpecialBatchUpload class
 *
 * @copyright (C) 2016, Stephan Gambke
 * @license   GNU General Public License, version 2 (or any later version)
 *
 * This software is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @ingroup SimpleBatchUpload
 */

namespace SimpleBatchUpload;

use SpecialPage;

/**
 * Class SpecialBatchUpload
 *
 * @package SimpleBatchUpload
 * @ingroup SimpleBatchUpload
 */
class SpecialBatchUpload extends SpecialPage {

	/**
	 * @param string $name Name of the special page, as seen in links and URLs
	 * @param string $restriction User right required, e.g. "block" or "delete"
	 * @param bool $listed Whether the page is listed in Special:Specialpages
	 */
	public function __construct( $name = '', $restriction = '', $listed = true ) {
		parent::__construct( 'BatchUpload', 'upload', $listed );
	}

	/**
	 * Under which header this special page is listed in Special:SpecialPages
	 * See messages 'specialpages-group-*' for valid names
	 * This method defaults to group 'other'
	 *
	 * @return string
	 */
	protected function getGroupName() {
		return 'media';
	}

	/**
	 * @param null|string $par
	 * @throws \MWException
	 */
	public function execute( $par ) {

		$this->setHeaders();
		$this->checkPermissions();

		$output = $this->getOutput();

		$html = '<span id="fileupload-dropzone" class="fileinput-button">
        <i class="glyphicon glyphicon-plus"></i>
        <span>' . \Message::newFromKey( 'simplebatchupload-buttonlabel' )->escaped() . '</span>
        <!-- The file input field used as target for the file upload widget -->
        <input id="fileupload" type="file" name="file" data-url="' . wfScript( 'api' ) . '" data-token="' . $this->getUser()->getEditToken() . '" multiple>
        </span><ul id="fileupload-results"></ul>';

		$output->addHTML( $html );
		$output->addModules( 'ext.SimpleBatchUpload' );
		$output->addModuleStyles( [ 'ext.SimpleBatchUpload', 'ext.SimpleBatchUpload.jquery-file-upload' ] );
	}

}
