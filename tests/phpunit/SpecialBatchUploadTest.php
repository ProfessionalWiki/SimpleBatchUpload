<?php

namespace MediaWiki\Extension\SimpleBatchUpload\Tests;

use MediaWiki\Extension\SimpleBatchUpload\SpecialBatchUpload;

/**
 * @covers \MediaWiki\Extension\SimpleBatchUpload\SpecialBatchUpload
 * @group SimpleBatchUpload
 */
class SpecialBatchUploadTest extends \PHPUnit\Framework\TestCase {

	public function testRequiresUploadRight() {
		$this->assertSame( 'upload', ( new SpecialBatchUpload() )->getRestriction() );
	}

}
