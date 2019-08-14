<?php

error_reporting( E_ALL | E_STRICT );

$in = '';

while ( $f = fgets( STDIN ) ) {
	$in .= $f;
}

$json = json_decode( $in, true );

$json[ 'require' ][ $argv[ 1 ] ] = $argv[ 2 ];
$json[ 'repositories' ] = [
	[
		'type' => 'vcs',
		'url'  => 'https://github.com' . substr( $argv[3], 1 ) . '.git',
	],
];

print json_encode( $json, JSON_PRETTY_PRINT );