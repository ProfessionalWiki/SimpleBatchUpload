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
		$description = $this->attributeFrom( $wikitext, 'data-mw-sbu-description' );
		$this->assertNotNull( $description );

		return $description;
	}

	private function attributeFrom( string $wikitext, string $attribute ): ?string {
		$html = $this->getServiceContainer()->getParserFactory()->create()
			->parse( $wikitext, Title::newFromText( 'Upload page' ), ParserOptions::newFromAnon() )
			->getContentHolderText();

		if ( preg_match( '/' . $attribute . '="([^"]*)"/', $html, $match ) !== 1 ) {
			return null;
		}

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

	public function testSendsTheRenameRuleOnItsOwnRatherThanToTheTemplate(): void {
		$wikitext = '{{#batchupload:Pics|by=Ann|+rename = /^IMG_/-->Trip-}}';

		$this->assertSame( '/^IMG_/-->Trip-', $this->attributeFrom( $wikitext, 'data-mw-sbu-rename' ) );
		$this->assertSame( '{{Pics|by=Ann}}', $this->descriptionFrom( $wikitext ) );
	}

	public function testPassesAPlainRenameParameterToTheTemplate(): void {
		$wikitext = '{{#batchupload:Pics|rename=yes}}';

		$this->assertNull( $this->attributeFrom( $wikitext, 'data-mw-sbu-rename' ) );
		$this->assertSame( '{{Pics|rename=yes}}', $this->descriptionFrom( $wikitext ) );
	}

	public function testLeavesARenameParameterOfANestedTemplateToThatTemplate(): void {
		$wikitext = '{{#batchupload:Pics|note=<nowiki>{{Note|+rename=yes}}</nowiki>}}';

		$this->assertNull( $this->attributeFrom( $wikitext, 'data-mw-sbu-rename' ) );
		$this->assertSame( '{{Pics|note={{Note|+rename=yes}}}}', $this->descriptionFrom( $wikitext ) );
	}

	public function testMarksAnUploadAreaThatUploadsFilesAsTheyAreAdded(): void {
		$wikitext = '{{#batchupload:Pics|by=Ann|+autoupload}}';

		$this->assertNotNull( $this->attributeFrom( $wikitext, 'data-mw-sbu-autoupload' ) );
		$this->assertSame( '{{Pics|by=Ann}}', $this->descriptionFrom( $wikitext ) );
	}

	public function testLeavesAnUploadAreaWithoutItToWaitForUpload(): void {
		$this->assertNull( $this->attributeFrom( '{{#batchupload:Pics|by=Ann}}', 'data-mw-sbu-autoupload' ) );
	}

	public function testPassesAPlainAutouploadToTheTemplate(): void {
		$wikitext = '{{#batchupload:Pics|autoupload}}';

		$this->assertNull( $this->attributeFrom( $wikitext, 'data-mw-sbu-autoupload' ) );
		$this->assertSame( '{{Pics|autoupload}}', $this->descriptionFrom( $wikitext ) );
	}

	public function testPutsBackWhatANowikiInTheRenameRuleHeld(): void {
		$this->assertSame(
			'/IMG_|DSC_/-->Trip-',
			$this->attributeFrom( '{{#batchupload:Pics|+rename=<nowiki>/IMG_|DSC_/-->Trip-</nowiki>}}', 'data-mw-sbu-rename' )
		);
	}

}
