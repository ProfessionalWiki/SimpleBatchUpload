<?php
/**
 * File containing the ParameterProvider class
 *
 * @copyright (C) 2016 - 2017, Stephan Gambke
 * @license GPL-2.0-or-later
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

use MediaWiki\Html\Html;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\PPFrame;
use MediaWiki\Parser\Sanitizer;

/**
 * Class UploadButtonRenderer
 * @package SimpleBatchUpload
 */
class UploadButtonRenderer {

	/**
	 * @param Parser $parser
	 * @param PPFrame $frame
	 * @param $args
	 * @return array
	 */
	public function renderParserFunction( Parser $parser, PPFrame $frame, $args ): array {
		$stripState = $parser->getStripState();

		// The arguments end up in an attribute, where the quotes in a strip
		// marker are escaped and the parser can no longer put back what it set
		// aside. So it is put back here: for a <nowiki>, the text that was
		// written inside it, since this is wikitext for the file pages; anything
		// else a marker stands for is HTML, and has no place there.
		$args = array_map(
			static fn ( $arg ) => $stripState->killMarkers( $stripState->replaceNoWikis(
				$frame->expand( $arg ),
				static fn ( string $content ) => Sanitizer::decodeCharReferences( $content )
			) ),
			$args
		);
		$output = $parser->getOutput();

		$html = $this->renderUploadButton( $args, $output );

		return [ $html, 'isHTML' => true, 'noparse' => true, 'nowiki' => false ];
	}

	/**
	 * @param SpecialBatchUpload $specialPage
	 * @param string $templateName
	 */
	public function renderSpecialPage( SpecialBatchUpload $specialPage, $templateName ) {
		$args = [ $templateName ];
		$output = $specialPage->getOutput();

		$html = $this->renderUploadButton( $args, $output );

		$output->addHTML( $html );
	}

	/**
	 * @param string[] $args
	 * @param \ParserOutput | \OutputPage $output
	 * @return string
	 */
	protected function renderUploadButton( $args, $output ) {
		$paramProvider = $this->prepareParameterProvider( $args );

		$this->addModulesToOutput( $output );

		if ( method_exists( $output, 'setPageTitle' ) ) {
			$output->setPageTitle( $paramProvider->getSpecialPageTitle() );
		}

		return $this->getHtml( $paramProvider );
	}

	/**
	 * The element the upload panel is mounted on.
	 *
	 * Empty, and everything the panel needs is on it: the interface is drawn by
	 * ext.SimpleBatchUpload, and {{#batchupload:}} output is parser cached for
	 * up to a day, so any markup rendered here would outlive the script that
	 * understands it.
	 *
	 * @param ParameterProvider $paramProvider
	 * @return string
	 */
	protected function getHtml( ParameterProvider $paramProvider ): string {
		return Html::element( 'div', [
			'class' => 'ext-sbu-mount',
			'data-mw-sbu-description' => $paramProvider->getUploadPageText(),
			'data-mw-sbu-comment' => $paramProvider->getUploadComment(),
		] );
	}

	/**
	 * @param \ParserOutput | \OutputPage $output
	 */
	protected function addModulesToOutput( $output ) {
		$output->addModules( [ 'ext.SimpleBatchUpload' ] );
	}

	/**
	 * @param string[] $args
	 * @return ParameterProvider
	 */
	protected function prepareParameterProvider( $args ): ParameterProvider {
		$templateName = $args[ 0 ];

		$paramProvider = new ParameterProvider( $templateName );

		if ( $templateName !== '' ) {
			array_shift( $args );
			foreach ( $args as $node ) {
				$paramProvider->addTemplateParameter( $node );
			}
		}
		return $paramProvider;
	}

}
