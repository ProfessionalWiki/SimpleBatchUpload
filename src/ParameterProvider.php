<?php
/**
 * File containing the ParameterProvider class
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

namespace SimpleBatchUpload;

use Message;

/**
 * Class ParameterProvider
 *
 * @package SimpleBatchUpload
 */
class ParameterProvider {

	const IDX_TEMPLATENAME = 0;
	const IDX_TEMPLATEPARAMETERS = 1;
	const IDX_COMMENT = 2;
	const IDX_SPECIALPAGETITLE = 3;

	private $templateName;
	private $parameters = null;

	/**
	 * ParameterProvider constructor.
	 * @param string|null $templateName
	 */
	public function __construct( $templateName ) {
		$this->templateName = $templateName ? $templateName : '';
	}

	/**
	 * @return string
	 */
	public function getEscapedUploadPageText() {

		if ( $this->templateName === '' ) {
			return '';
		}

		return '{{' . $this->getEscapedParameter( self::IDX_TEMPLATENAME ) . $this->getEscapedParameter( self::IDX_TEMPLATEPARAMETERS ) . '}}';
	}

	/**
	 * @param int $key
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

	/**
	 * @param int $key
	 * @return string
	 */
	private function getParameter( $key ) {
		if ( $this->parameters === null ) {
			$this->populateParameters();
		}
		return $this->parameters[ $key ];
	}

	private function populateParameters() {

		if ( $this->templateName === '' || $this->populateParametersFromKey() === false ) {
			$this->populateParametersFromDefaults();
		}

	}

	/**
	 */
	private function populateParametersFromKey() {
		$paramMsg = Message::newFromKey( 'simplebatchupload-parameters' );

		if ( $paramMsg->exists() ) {

			$paramSet = explode( "\n", $paramMsg->plain() );
			$paramSet = array_map( [ $this, 'parseParamLine' ], $paramSet );
			$paramSet = array_combine( array_column( $paramSet, 0 ), $paramSet );

			if ( array_key_exists( $this->templateName, $paramSet ) ) {
				$this->setParameters( $this->templateName, '', $paramSet[ $this->templateName ][ 1 ], $paramSet[ $this->templateName ][ 2 ] );
				return true;
			}
		}
		return false;
	}

	private function populateParametersFromDefaults() {
		$this->setParameters( $this->templateName, '', Message::newFromKey( 'simplebatchupload-comment' )->text(), Message::newFromKey( 'batchupload' )->text() );
	}

	/**
	 * @param string $templateName
	 * @param string $templateParameters
	 * @param string $uploadComment
	 * @param string $specialPageTitle
	 */
	private function setParameters( $templateName, $templateParameters, $uploadComment, $specialPageTitle ) {
		$this->parameters = [
			self::IDX_TEMPLATENAME => $templateName,
			self::IDX_TEMPLATEPARAMETERS => $templateParameters,
			self::IDX_COMMENT => $uploadComment,
			self::IDX_SPECIALPAGETITLE => $specialPageTitle,
		];
	}

	/**
	 * @return string
	 */
	public function getEscapedUploadComment() {
		return $this->getEscapedParameter( self::IDX_COMMENT );
	}

	/**
	 * @return string
	 */
	public function getSpecialPageTitle() {
		return $this->getParameter( self::IDX_SPECIALPAGETITLE );
	}

	/**
	 * @param string $parameter
	 */
	public function addTemplateParameter( $parameter ) {

		if ( $this->parameters === null ) {
			$this->populateParameters();
		}

		$this->parameters[ self::IDX_TEMPLATEPARAMETERS ] .= '|' . $parameter;
	}

	/**
	 * @param string $paramLine
	 * @return string[]
	 */
	private function parseParamLine( $paramLine ) {
		return array_replace( [ '', '', '' ], array_map( 'trim', explode( '|', $paramLine, 3 ) ) );
	}

}
