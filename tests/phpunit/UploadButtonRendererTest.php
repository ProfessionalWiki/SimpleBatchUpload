<?php

namespace MediaWiki\Extension\SimpleBatchUpload\Tests;

use MediaWiki\Parser\ParserOptions;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

/**
 * Integration, for the parser that turns the arguments into strip markers, and
 * the database it looks the page up in while parsing.
 *
 * @covers \MediaWiki\Extension\SimpleBatchUpload\UploadButtonRenderer
 * @group SimpleBatchUpload
 * @group Database
 */
class UploadButtonRendererTest extends MediaWikiIntegrationTestCase {

	private function descriptionFrom( string $wikitext ): string {
		$html = $this->getServiceContainer()->getParserFactory()->create()
			->parse( $wikitext, Title::newFromText( 'Upload page' ), ParserOptions::newFromAnon() )
			->getContentHolderText();

		$this->assertSame( 1, preg_match( '/data-mw-sbu-description="([^"]*)"/', $html, $match ) );

		return html_entity_decode( $match[1], ENT_QUOTES | ENT_HTML5 );
	}

	public function testPutsBackWhatANowikiInAnArgumentHeld(): void {
		$this->assertSame(
			'{{Pics|note=a|b & x<y}}',
			$this->descriptionFrom( '{{#batchupload:Pics|note=<nowiki>a|b & x<y</nowiki>}}' )
		);
	}

	public function testDropsWhatAnyOtherTagInAnArgumentLeftBehind(): void {
		$this->assertStringNotContainsString(
			'UNIQ',
			$this->descriptionFrom( '{{#batchupload:Pics|note=<pre>x</pre>}}' )
		);
	}

	public function testLeavesTheRestOfAnArgumentAsWritten(): void {
		$this->assertSame(
			'{{Pics|plain=a &amp; b}}',
			$this->descriptionFrom( '{{#batchupload:Pics|plain=a &amp; b}}' )
		);
	}

}
