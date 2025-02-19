<?php
/**
 * File containing the SpecialBatchUpload class
 *
 * @copyright (C) 2016 - 2017, Stephan Gambke
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

namespace MediaWiki\Extension\SimpleBatchUpload;

use SpecialPage;

/**
 * Class SpecialBatchUpload
 *
 * @package SimpleBatchUpload
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
	 * @param null|string $subpage
	 * @throws \MWException
	 */
	public function execute( $subpage ) {

		$this->setHeaders();
		$this->checkPermissions();

		$this->addPageContentToOutput( $subpage );
	}

	/**
	 * @param string|null $subpage
	 */
	private function addPageContentToOutput( $subpage ) {
		$renderer = new UploadButtonRenderer();
		$renderer->renderSpecialPage( $this, $subpage );
	}

}
