<?php

namespace MediaWiki\Extension\SimpleBatchUpload\Tests;

use MediaWiki\Extension\SimpleBatchUpload\SpecialBatchUpload;
use MediaWiki\User\User;
use PermissionsError;
use SpecialPageTestBase;

/**
 * Integration, for MediaWiki's permission check on the special page, and the
 * database that holds the test users.
 *
 * @covers \MediaWiki\Extension\SimpleBatchUpload\SpecialBatchUpload
 * @group SimpleBatchUpload
 * @group Database
 */
class SpecialBatchUploadTest extends SpecialPageTestBase {

	protected function newSpecialPage(): SpecialBatchUpload {
		return new SpecialBatchUpload();
	}

	/**
	 * @param string[] $rights
	 */
	private function userWithRights( array $rights ): User {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, $rights );

		return $user;
	}

	public function testShowsTheUploadAreaToAUserWhoMayUpload(): void {
		[ $html ] = $this->executeSpecialPage( '', null, null, $this->userWithRights( [ 'upload' ] ) );

		$this->assertStringContainsString( 'ext-sbu-mount', $html );
	}

	public function testRefusesAUserWhoMayNotUpload(): void {
		$user = $this->userWithRights( [] );

		$this->expectException( PermissionsError::class );
		$this->executeSpecialPage( '', null, null, $user );
	}

}
