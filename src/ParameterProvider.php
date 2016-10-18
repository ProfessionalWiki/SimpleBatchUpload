<?php
/**
 * File containing the ParameterProvider class
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

use Message;

/**
 * Class ParameterProvider
 *
 * @package SimpleBatchUpload
 * @ingroup SimpleBatchUpload
 */
class ParameterProvider {

	private $parameterIndex;
	private $parameters = null;

	/**
	 * ParameterProvider constructor.
	 * @param string|null $parameterIndex
	 */
	public function __construct( $parameterIndex ) {
		$this->parameterIndex = $parameterIndex;
	}

	/**
	 * @return string
	 */
	public function getEscapedUploadPageText() {
		return $this->getEscapedParameter( 'pagetext' );
	}

	/**
	 * @return string
	 */
	public function getEscapedUploadComment() {
		return $this->getEscapedParameter( 'comment' );
	}

	/**
	 * @return string
	 */
	public function getSpecialPageTitle() {
		return $this->getParameter( 'title' );
	}

	/**
	 * @param string $key
	 * @return string
	 */
	private function getParameter( $key ) {
		if ( $this->parameters === null ) {
			$this->populateParameters();
		}
		return $this->parameters[ $key ];
	}

	/**
	 * @param string $pagetext
	 * @param string $comment
	 * @param string $title
	 */
	private function setParameters( $pagetext, $comment, $title ) {
		$this->parameters = [
			'pagetext' => $pagetext,
			'comment'  => $comment,
			'title'    => $title,
		];
	}

	/**
	 * @param string $key
	 * @return string
	 */
	private function getEscapedParameter( $key ) {
		return $this->escape( $this->getParameter( $key ) );
	}

	/**
	 * @param string $text
	 * @return string
	 */
	private function escape( $text ) {
		return htmlspecialchars( $text, ENT_QUOTES, 'UTF-8', false );
	}

	private function populateParameters() {

		if ( $this->parameterIndex === null || $this->populateParametersFromKey() === false ) {
			$this->populateParametersFromDefaults();
		}

	}

	/**
	 * @return bool
	 */
	private function populateParametersFromKey() {
		$paramMsg = Message::newFromKey( 'simplebatchupload-parameters' );

		if ( $paramMsg->exists() ) {

			$paramSet = explode( "\n", $paramMsg->plain() );
			$paramSet = array_map( [ $this, 'parseParamLine' ], $paramSet );
			$paramSet = array_combine( array_column( $paramSet, 0 ), $paramSet );

			if ( array_key_exists( $this->parameterIndex, $paramSet ) ) {
				$this->setParameters( '{{' . $this->parameterIndex . '}}', $paramSet[ $this->parameterIndex ][ 1 ], $paramSet[ $this->parameterIndex ][ 2 ] );
				return true;
			}
		}
		return false;
	}

	private function populateParametersFromDefaults() {
		$this->setParameters( '', Message::newFromKey( 'simplebatchupload-comment' )->text(), Message::newFromKey( 'batchupload' )->text() );
	}

	/**
	 * @param string $paramLine
	 * @return string[]
	 */
	private function parseParamLine( $paramLine ) {
		return array_map( 'trim', explode( '|', $paramLine, 3 ) );
	}

}
