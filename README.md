# SimpleBatchUpload

[![Latest Stable Version](https://poser.pugx.org/mediawiki/simple-batch-upload/v/stable)](https://packagist.org/packages/mediawiki/simple-batch-upload)
[![Packagist download count](https://poser.pugx.org/mediawiki/simple-batch-upload/downloads)](https://packagist.org/packages/mediawiki/simple-batch-upload)
[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/s7eph4n/SimpleBatchUpload/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/s7eph4n/SimpleBatchUpload/?branch=master)
[![Dependency Status](https://www.versioneye.com/php/mediawiki:simple-batch-upload/badge.png)](https://www.versioneye.com/php/mediawiki:simple-batch-upload)

The [SimpleBatchUpload][mw-simple-batch-upload] extension provides basic,
no-frills uploading of multiple files to MediaWiki.

## Requirements

- PHP 5.4 or later
- MediaWiki 1.26 or later

## Installation

The recommended way to install this extension is by using [Composer][composer].
Just add the following to the MediaWiki `composer.local.json` file and run
`php composer.phar update mediawiki/simple-batch-upload` from the MediaWiki
installation directory.

```json
{
	"require": {
		"mediawiki/simple-batch-upload": "~1.0"
	}
}
```

(Alternatively you can download a tar ball or zip file from
[GitHub](https://github.com/s7eph4n/SimpleBatchUpload/releases/latest)
and extract it into the `extensions` directory of your MediaWiki installation.)

Then add the following line to your `LocalSettings.php`:
```php
wfLoadExtension('SimpleBatchUpload');
```

## License

[GNU General Public License 2.0][license] or later.

[license]: https://www.gnu.org/copyleft/gpl.html
[mw-simple-batch-upload]: https://www.mediawiki.org/wiki/Extension:Semantic_Glossary
[composer]: https://getcomposer.org/
