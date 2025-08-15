# SimpleBatchUpload

[![GitHub Workflow Status](https://github.com/ProfessionalWiki/SimpleBatchUpload/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfessionalWiki/SimpleBatchUpload/actions?query=workflow%3ACI)
[![Latest Stable Version](https://poser.pugx.org/mediawiki/simple-batch-upload/v/stable)](https://packagist.org/packages/mediawiki/simple-batch-upload)
[![Packagist download count](https://poser.pugx.org/mediawiki/simple-batch-upload/downloads)](https://packagist.org/packages/mediawiki/simple-batch-upload)

The [SimpleBatchUpload] extension provides basic,
no-frills uploading of multiple files to MediaWiki.

It is maintained by [Professional Wiki](https://professional.wiki/).
[Contact us](https://professional.wiki/en/contact) for commercial support or [MediaWiki development].

## Requirements

- PHP 8.0 or later
- MediaWiki 1.43 or later

Use SimpleBatchUpload 2.x for older versions

## Installation

### Composer
```sh
COMPOSER=composer.local.json composer require --no-update mediawiki/simple-batch-upload:^3.0
```
```sh
composer update mediawiki/simple-batch-upload --no-dev -o
```

### Manual installation

[Download](https://github.com/ProfessionalWiki/SimpleBatchUpload/releases) and place the files in a directory called `SimpleBatchUpload` in your `extensions/` folder.


Enable the extension by adding the following to your LocalSettings.php:
```php
wfLoadExtension( 'SimpleBatchUpload' );
```

## Usage

See the [SimpleBatchUpload usage documentation](https://professional.wiki/en/extension/simplebatchupload).

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

## Configuration

Available configuration options:

* `$wgSimpleBatchUploadMaxFilesPerBatch` - Array defining the maximum number of
files that can be uploaded each time depending on the user group. <br> Default:
``` php
$wgSimpleBatchUploadMaxFilesPerBatch = [
	'*' => 1000,
];
```

**Note:** Be aware that this is not the right setting to completely block file
uploads! Users can still use the normal file upload or the MediaWiki API. See
the paragraph on user permissions on
[Configuring file uploads](https://www.mediawiki.org/wiki/Manual:Configuring_file_uploads#Upload_permissions)
on mediawiki.org.


## License

[GNU General Public License 2.0][license] or later

[SimpleBatchUpload]: https://professional.wiki/en/extension/simplebatchupload
[license]: https://www.gnu.org/copyleft/gpl.html
[composer]: https://getcomposer.org/
[writeapi]: https://www.mediawiki.org/wiki/Manual:User_rights#List_of_permissions
[MediaWiki development]: https://professional.wiki/en/mediawiki-development
