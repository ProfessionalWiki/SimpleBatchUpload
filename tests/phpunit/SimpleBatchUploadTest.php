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

use SimpleBatchUpload\SimpleBatchUpload;

/**
 * @covers \SimpleBatchUpload\SimpleBatchUpload
 * @group SimpleBatchUpload
 *
 * @since 1.5
 */
class SimpleBatchUploadTest extends PHPUnit_Framework_TestCase {

	public function testCanConstruct() {

		$this->assertInstanceOf(
			'\SimpleBatchUpload\SimpleBatchUpload',
			new SimpleBatchUpload()
		);
	}

	public function testRegistersGlobals() {
		$this->assertJsonConfiguration( $GLOBALS );
		$this->assertEarlyConfiguration( $GLOBALS );
		$this->assertLateConfiguration( $GLOBALS );
	}

	public function testRegisterEarlyConfiguraion() {
		$sbu = new SimpleBatchUpload();
		$config = [];

		$sbu->registerEarlyConfiguration( $config );
		$this->assertEarlyConfiguration( $config );
	}

	public function testRegisterLateConfiguraion() {
		$sbu = new SimpleBatchUpload();
		$config = [];

		$sbu->registerLateConfiguration( $config );
		$this->assertLateConfiguration( $config );
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

		/**
	 * @param $configuration
	 */
	public function assertEarlyConfiguration( $configuration ) {

		//$configuration[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadAlias' ] = __DIR__ . '/SimpleBatchUpload.alias.php';
		//$configuration[ 'wgExtensionMessagesFiles' ][ 'SimpleBatchUploadMagic' ] = __DIR__ . '/SimpleBatchUpload.magic.php';
		$this->assertArrayHasKey( 'wgExtensionMessagesFiles', $configuration );
		$this->assertArrayHasKey( 'SimpleBatchUploadAlias', $configuration[ 'wgExtensionMessagesFiles' ] );
		$this->assertArrayHasKey( 'SimpleBatchUploadMagic', $configuration[ 'wgExtensionMessagesFiles' ] );

		//$configuration[ 'wgSpecialPages' ][ 'BatchUpload' ] = '\SimpleBatchUpload\SpecialBatchUpload';
		$this->assertArrayHasKey( 'wgSpecialPages', $configuration );
		$this->assertArrayHasKey( 'BatchUpload', $configuration[ 'wgSpecialPages' ] );

		//$configuration[ 'wgHooks' ][ 'ParserFirstCallInit' ][ 'ext.simplebatchupload' ] = [ $this, 'registerParserFunction' ];
		//$configuration[ 'wgHooks' ][ 'MakeGlobalVariablesScript' ][ 'ext.simplebatchupload' ] = [ $this, 'onMakeGlobalVariablesScript' ];
		//$configuration[ 'wgHooks' ][ 'SetupAfterCache' ][ 'ext.simplebatchupload' ] = [ $this, 'onSetupAfterCache'];
		$this->assertArrayHasKey( 'wgHooks', $configuration );

		foreach ( [ 'ParserFirstCallInit', 'MakeGlobalVariablesScript', 'SetupAfterCache' ] as $hook ) {
			$this->assertArrayHasKey( $hook, $configuration[ 'wgHooks' ] );
			$this->assertArrayHasKey( 'ext.simplebatchupload', $configuration[ 'wgHooks' ][ $hook ] );
			$this->assertTrue( is_callable( $configuration[ 'wgHooks' ][ $hook ][ 'ext.simplebatchupload' ] ) );
		}
	}

	/**
	 * @param $configuration
	 */
	public function assertLateConfiguration( $configuration ) {

		$this->assertArrayHasKey( 'wgResourceModules', $configuration );

		$this->assertArrayHasKey( 'ext.SimpleBatchUpload.jquery-file-upload', $configuration[ 'wgResourceModules' ] );
		$this->assertSame(
			$configuration[ 'wgResourceModules' ][ 'ext.SimpleBatchUpload.jquery-file-upload' ],
			[
				'localBasePath'  => dirname( dirname( __DIR__ ) ),
				'remoteBasePath' => $GLOBALS[ 'wgExtensionAssetsPath' ] . '/SimpleBatchUpload',
				'scripts'        => [ 'res/jquery.fileupload.js' ],
				'styles'         => [ 'res/jquery.fileupload.css' ],
				'position'       => 'top',
				'dependencies'   => [ 'jquery.ui' ],
			]
		);

		$this->assertArrayHasKey( 'ext.SimpleBatchUpload', $configuration[ 'wgResourceModules' ] );
		$this->assertSame(
			$configuration[ 'wgResourceModules' ][ 'ext.SimpleBatchUpload' ],
			[
				'localBasePath'  => dirname( dirname( __DIR__ ) ),
				'remoteBasePath' => $GLOBALS[ 'wgExtensionAssetsPath' ] . '/SimpleBatchUpload',
				'scripts'        => [ 'res/ext.SimpleBatchUpload.js' ],
				'styles'         => [ 'res/ext.SimpleBatchUpload.css' ],
				'position'       => 'top',
				'dependencies'   => [
					'ext.SimpleBatchUpload.jquery-file-upload',
					'mediawiki.Title',
					'mediawiki.jqueryMsg',
					'mediawiki.api'
				],
				'messages'       => [ 'simplebatchupload-comment', 'simplebatchupload-max-files-alert' ],
			]
		);

	}

}
