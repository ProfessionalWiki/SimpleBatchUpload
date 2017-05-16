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
## Usage

* Go to _Special:BatchUpload_ to get a plain upload page
* Go to _Special:BatchUpload/Foo_ to get an upload page that sets `{{Foo}}` as
  the wikitext of the uploaded file's page
* Add `{{#batchupload:}}` to any wikipage to get a simple upload button
* Add `{{#batchupload:Foo|Bar|Baz}}` to any wikipage to get an upload button
  that sets `{{Foo|Bar|Baz}}` as the wikitext of the uploaded file's page  

**Note:** The wikitext will only be set for newly uploaded files. If the file
exists already, subsequent uploads of new versions of the file will not change
the wikitext.

## Customization

It is possible to specify dedicated parameter sets for the upload of specific
file types by editing the _MediaWiki:Simplebatchupload-parameters_ page. Each
line of that page is considered as one set of parameters.

Available parameters are:
 * Name of template to be stored as text on initial upload
 * Upload comment
 * Title line of the Special:BatchUpload page

Parameters should be separated by pipes (|).

The line to be used is selected by appending the name of the template as the
subpage to the URL of the Special:BatchUpload page.

__Example:__

Consider the parameter line
```
Pics | These pics were uploaded using [[mw:Extension:SimpleBatchUpload{{!}}SimpleBatchUpload]] | Upload some pics!
```

* This can be selected by going to _Special:BatchUpload/Pics_.
* The title of this page will be _Upload some pics!_.
* The comment for the upload will be _These pics were uploaded using [[mw:Extension:SimpleBatchUpload{{!}}SimpleBatchUpload]]_.
* If a file with that name is uploaded for the first time it will have `{{Pics}}` as wikitext.

## License

[GNU General Public License 2.0][license] or later.

[license]: https://www.gnu.org/copyleft/gpl.html
[mw-simple-batch-upload]: https://www.mediawiki.org/wiki/Extension:SimpleBatchUpload
[composer]: https://getcomposer.org/
