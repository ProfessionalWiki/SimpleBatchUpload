# SimpleBatchUpload

[![GitHub Workflow Status](https://github.com/ProfessionalWiki/SimpleBatchUpload/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfessionalWiki/SimpleBatchUpload/actions?query=workflow%3ACI)
[![Latest Stable Version](https://poser.pugx.org/mediawiki/simple-batch-upload/v/stable)](https://packagist.org/packages/mediawiki/simple-batch-upload)
[![Packagist download count](https://poser.pugx.org/mediawiki/simple-batch-upload/downloads)](https://packagist.org/packages/mediawiki/simple-batch-upload)

The [SimpleBatchUpload][mw-simple-batch-upload] extension provides basic,
no-frills uploading of multiple files to MediaWiki.

It is maintained by [Professional.Wiki](https://professional.wiki/).
[Contact us](https://professional.wiki/en/contact) for commercial support or development work.

## Requirements

- PHP 8.0 or later
- MediaWiki 1.35 or later

## Installation

You need use [Composer][composer] to install this extension. Just add the
following to the MediaWiki "composer.local.json" file and run
`php composer.phar update mediawiki/simple-batch-upload` from the MediaWiki
installation directory.

```json
{
	"require": {
		"mediawiki/simple-batch-upload": "^2.0"
	}
}
```

Then add the following line to your "LocalSettings.php" file:
```php
wfLoadExtension( 'SimpleBatchUpload' );
```

**Note:** To use the extension the user needs the [`writeapi`][writeapi] right. This is the
default MediaWiki setting for registered users, but it may have been changed
during the configuration of the wiki.

## Usage

There are four ways to upload files using this extension:
* Go to _Special:BatchUpload_ to get a plain upload page
* Go to _Special:BatchUpload/Foo_ to get an upload page that sets `{{Foo}}` as
  the wikitext of the uploaded file's page
* Add `{{#batchupload:}}` to any wikipage to get a simple upload button
* Add `{{#batchupload:Foo|Bar|Baz}}` to any wikipage to get an upload button
  that sets `{{Foo|Bar|Baz}}` as the wikitext of the uploaded file's page  

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

[license]: https://www.gnu.org/copyleft/gpl.html
[mw-simple-batch-upload]: https://www.mediawiki.org/wiki/Extension:SimpleBatchUpload
[composer]: https://getcomposer.org/
[writeapi]: https://www.mediawiki.org/wiki/Manual:User_rights#List_of_permissions
