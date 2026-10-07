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
COMPOSER=composer.local.json composer require --no-update mediawiki/simple-batch-upload:^4.0
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

## Renaming files on upload

Files are renamed under **Rename files**, above the file list: **Find** is
looked for in each file name and replaced with **Replace with**. Each row shows
the name its file will be uploaded under before **Upload** is pressed, and
renaming is applied before the batch checks whether two files would be uploaded
under one name.

* As plain text, every occurrence is replaced, matching case, and the file
  extension is left alone. An empty **Find** puts **Replace with** in front:
  `Trip-` uploads `IMG_0001.jpg` as `Trip-IMG_0001.jpg`.
* With **Use regular expressions** ticked, **Find** is a JavaScript regular
  expression matched against the whole name, extension included, and every match
  is replaced. In **Replace with**, `$1` stands for the text matched by the first
  `(...)` group, along with the rest of
  [JavaScript's replacement syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_the_replacement).

A name left without a file extension is marked on its row. The file is still
sent, and the wiki adds an extension from what the file turns out to be.

A page can bring a rule with it, as a `+rename` parameter in the parser function:

```
{{#batchupload:Pics|+rename = /^IMG_/-->Holiday-}}
```

The parameter fills in the fields when the page opens, with **Use regular
expressions** ticked, and is not stored on the file page. It takes a regular
expression and a replacement separated by `-->`. The pattern is delimited by
`#`, `/`, `@` or `!` — whichever does not appear in the pattern itself — and may
be followed by any of the flags `g` (replace every match, not just the first),
`i` (ignore case), `m`, `u` and `y`. A `+rename` typed into **Text for each file
page** is not read, and is published on every file page as written. It cannot
be set in a parameter line on _MediaWiki:Simplebatchupload-parameters_, whose
first field is the template name alone.

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
