<?php
# Usage: php extensions/SimpleBatchUpload/tests/setup/fix-composer.php mediawiki/simple-batch-upload dev-master g/s7eph4n/SimpleBatchUpload < composer.local.json-sample > composer.local.json
#
# * Reads composer.json-like from stdin
# * Adds requirement for the specified composer package ($argv[1] and $argv[2]) and a repo ($argv[3])
# * Writes the result to stdout
#
# @copyright (C) 2016 - 2019, Stephan Gambke
# @license   GNU General Public License, version 2 (or any later version)

error_reporting( E_ALL | E_STRICT );

/**
 * @return string
 */
function read(): string {
	$in = '';

	while ( $f = fgets( STDIN ) ) {
		$in .= $f;
	}

	return $in;
}

/**
 * @param string $in
 * @param string[] $params
 *
 * @return array
 */
function process( string $in, array $params ) {
	$json = json_decode( $in, true );

	$json[ 'require' ][ $params[ 1 ] ] = $params[ 2 ];

	$json[ 'repositories' ] = [
		[
			'type' => 'vcs',
			'url'  => 'https://github.com' . substr( $params[ 3 ], 1 ) . '.git',
		],
	];

	return $json;
}


/**
 * @param $json
 */
function write( $json ) {
	print json_encode( $json, JSON_PRETTY_PRINT );
}

$in = read();
$out = process( $in, $argv );
write( $out );