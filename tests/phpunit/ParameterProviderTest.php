<?php

namespace MediaWiki\Extension\SimpleBatchUpload\Tests;

use MediaWiki\Extension\SimpleBatchUpload\ParameterProvider;
use MediaWiki\MainConfigNames;
use MediaWikiIntegrationTestCase;

/**
 * Integration, for the message the wiki overrides on one of its own pages.
 *
 * @covers \MediaWiki\Extension\SimpleBatchUpload\ParameterProvider
 * @group SimpleBatchUpload
 * @group Database
 */
class ParameterProviderTest extends MediaWikiIntegrationTestCase {

	protected function setUp(): void {
		parent::setUp();
		// Off in tests, and setUserLang() rebuilds the message cache from it.
		$this->overrideConfigValue( MainConfigNames::UseDatabaseMessages, true );
	}

	public function testDefaultSummaryIsTheWikisOwnInAnyInterfaceLanguage(): void {
		$this->editPage( 'MediaWiki:Simplebatchupload-comment', 'Uploaded to the harbour archive' );
		$this->setUserLang( 'qqx' );

		$this->assertSame( 'Uploaded to the harbour archive', ( new ParameterProvider( '' ) )->getUploadComment() );
	}

	public function testParameterSetIsTheWikisOwnInAnyInterfaceLanguage(): void {
		$this->editPage(
			'MediaWiki:Simplebatchupload-parameters',
			"Maps|Map summary|Map title\nPics|Harbour summary|Harbour title\nScans|Scan summary|Scan title"
		);
		$this->setUserLang( 'qqx' );

		$this->assertSame( 'Harbour summary', ( new ParameterProvider( 'Pics' ) )->getUploadComment() );
	}

	public function testPageTitleIsInTheReadersLanguage(): void {
		$this->setUserLang( 'qqx' );

		$this->assertSame( '(batchupload)', ( new ParameterProvider( '' ) )->getSpecialPageTitle() );
	}

}
