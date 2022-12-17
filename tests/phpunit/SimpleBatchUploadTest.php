<?php
/**
 * File containing the SimpleBatchUploadTest class
 *
 * @copyright (C) 2016 - 2019, Stephan Gambke
 * @license   GNU General Public License, version 2 (or any later version)
 *
 * This software is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @ingroup SimpleBatchUpload
 */

namespace SimpleBatchUpload\Tests;

use OutputPage;
use Parser;
use SimpleBatchUpload\SimpleBatchUpload;

/**
 * @covers \SimpleBatchUpload\SimpleBatchUpload
 * @group SimpleBatchUpload
 *
 * @since 1.5
 */
class SimpleBatchUploadTest extends \PHPUnit\Framework\TestCase {

	public function testCanConstruct() {

		$this->assertInstanceOf(
			'\SimpleBatchUpload\SimpleBatchUpload',
			new SimpleBatchUpload()
		);
	}

	public function testRegisterParserFunction() {

		$parser = $this->getMockBuilder( Parser::class )
			->disableOriginalConstructor()
			->getMock();

		$parser->expects( $this->once() )
			->method( 'setFunctionHook' )
			->with(
				$this->equalTo( 'batchupload' ),
				$this->callback( function ( $param ) {
					return is_callable( $param );
				} ),
				$this->equalTo( Parser::SFH_OBJECT_ARGS ) )
			->willReturn( null );

		$sbu = new SimpleBatchUpload();
		$sbu->registerParserFunction( $parser );
	}

	public function testOnMakeGlobalVariablesScript() {
		$vars = [];
		$out = $this->getMockBuilder( OutputPage::class )
			->disableOriginalConstructor()
			->getMock();

		$sbu = new SimpleBatchUpload();
		$sbu->onMakeGlobalVariablesScript( $vars, $out );

		$this->assertArrayHasKey( 'simpleBatchUploadMaxFilesPerBatch', $vars );
	}

	/**
	 * @param $configuration
	 */
	public function assertJsonConfiguration( $configuration ) {
		$this->assertArrayHasKey( 'wgSimpleBatchUploadMaxFilesPerBatch', $configuration );
	}

}
