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
* Both can be changed under **Edit details** before **Upload** is pressed: the
  wikitext as **File page text**, the comment as **Summary**.

## Renaming files on upload

Select **Edit details** above the file list; **Rename files** is in the form it
opens. Each row shows the name its file will be uploaded under before **Upload**
is pressed.

| To | Find | Replace with | Use regular expressions | `IMG_0001.jpeg` uploads as |
|---|---|---|---|---|
| Add a prefix | | `Trip-` | no | `Trip-IMG_0001.jpeg` |
| Replace text | `IMG_` | `Trip-` | no | `Trip-0001.jpeg` |
| Change the extension | `\.jpeg$` | `.jpg` | yes | `IMG_0001.jpg` |
| Keep part of the name | `^IMG_(\d+)` | `Trip-$1` | yes | `Trip-0001.jpeg` |

* An empty **Find** puts **Replace with** in front of the name.
* Plain text replaces every occurrence, matching case, and never changes the
  file extension.
* A regular expression searches the whole name, extension included, and
  replaces every match. In **Replace with**, `$1` stands for the first `(...)`
  group, along with the rest of
  [JavaScript's replacement syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_the_replacement).
* Files that end up sharing a name wait on their rows for a choice.
* A name left without an extension is marked on its row. The file is still
  sent, and the wiki adds an extension from what the file turns out to be.

### A rule from the page

A `+rename` parameter fills in the fields when the page opens, with **Use regular
expressions** ticked. The uploader can still change them. Here `Pics` names the
template every uploaded file's page contains:

```
{{#batchupload:Pics|+rename = /^IMG_(\d+)/-->Trip-$1}}
```

| Part | In the example | Written as |
|---|---|---|
| Delimiters | `/` | `#`, `/`, `@` or `!`; use one that is not in the pattern |
| Pattern | `^IMG_(\d+)` | A regular expression |
| Flags | none | Any of `g`, `i`, `m`, `u` and `y`, right after the closing delimiter. Without `g` only the first match is replaced, even after **Find** or **Replace with** is edited |
| Replacement | `Trip-$1` | Everything after `-->`, spaces included |

* A rule containing `|` goes inside `<nowiki>` whole:
  `+rename = <nowiki>/IMG_|DSC_/-->Trip-</nowiki>`.
* A rule not written this way renames nothing, and the upload area says so.
* The parameter is not passed to the template.
* A parameter line on _MediaWiki:Simplebatchupload-parameters_ cannot set a
  rule, and a `+rename` typed into **File page text** is published as written.

## Uploading files as they are added

```
{{#batchupload:Pics|+autoupload}}
```

Files added to this upload area start uploading straight away, without
**Upload** being pressed.

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
