## Release Notes

### Unreleased

When upgrading:

* Purge pages using `{{#batchupload:}}`, or bump `$wgCacheEpoch`. Until then, their upload areas can stay broken for
  up to `$wgParserCacheExpireTime`, while the parser cache serves the old markup. `Special:BatchUpload` does not need
  purging
* Update anything in `MediaWiki:Common.css`, `MediaWiki:Common.js` or a gadget that targets the upload interface. The
  `fileupload-*`, `fileinput-button` and `ful-*` classes are gone; everything this extension renders now carries an
  `ext-sbu-` prefix
* Delete any customised `MediaWiki:Simplebatchupload-result-error`, `-result-not-uploaded`, `-result-queued`,
  `-result-rate-limited`, `-result-rate-limit-stopped`, `-result-success` and `-result-token-error`: those messages
  no longer exist
* Check any customised `MediaWiki:Simplebatchupload-buttonlabel`, which now labels the file picker alone, with
  dropping described beside it
* Check any customised `MediaWiki:Simplebatchupload-max-files-reached` and `-error-rename-pattern`, which now say
  something different

Changes:

* Added a new upload interface, built with Vue and Codex, replacing the jQuery File Upload widget
  * The whole list is the drop target, and dropping a folder adds what is inside it, subfolders included
  * Each file shows a preview, its size, and its upload progress
  * An uploaded file links to its page on the wiki
  * A file can be taken out of the batch before it is uploaded, and added back; a failed file can be tried again
  * A block above the file list shows the file page text, the upload summary and the rename rule, one line each,
    with **Edit details** to change them. The summary can now be changed before uploading
  * Where WikiEditor is installed, the file page text gets its toolbar, following each user's toolbar preference,
    except on a page with more than one upload area
  * An upload area added with `{{#batchupload:}}` starts small and opens out once files are added to it, so a page
    holding many stays short. On `Special:BatchUpload` it is full size from the start
* Files no longer upload as soon as they are added: they wait in the list until **Upload** is pressed, and a running
  batch can be paused and carried on
* Added a `+autoupload` parameter to `{{#batchupload:}}`: files added to that upload area start uploading straight
  away, without **Upload** being pressed
* Added **Rename files**, with **Find** and **Replace with** fields and an option for regular expressions. Each file
  shows its new name before it is uploaded. A `+rename` parameter fills the fields in
* A `+rename` typed into the file page text is no longer read: the field warns that it would be published as written,
  and points to **Rename files**
* A `+rename` rule that is not written correctly is warned about rather than published on every file page, and a
  rule wrapped in `<nowiki>` can contain `|`
* Added a prompt before a file is uploaded over one the wiki already holds, instead of overwriting it
* Added a prompt when files in one batch would be uploaded under the same name, instead of letting the last one win
* Fixed the default upload summary being in a user's interface language rather than the wiki's content language,
  which usually also ignored a summary customised in `MediaWiki:Simplebatchupload-comment`

### SimpleBatchUpload 3.1.0

Released on August 21, 2026.

* Added an estimate of how much longer a batch has left while the wiki is rate limiting it
* Added the wiki's upload warnings, such as a duplicate or an overwrite, to the result list
* Made the upload status messages translatable
* Changed the maximum files per batch to count uploads that are still in progress
* Changed uploading to pace itself to the rate limit the wiki advertises, once the wiki has refused an upload
  * Batches that fit inside the limit are unaffected and still upload at full speed
  * Batches on wikis with a long limit window now retry for much longer before giving up
* Fixed uploads refused by the wiki's rate limit being reported as permanent errors
  * Refused files are now retried, so a rate-limited batch takes longer rather than partly failing
  * A batch that keeps hitting the limit stops and asks for the remaining files to be selected again
* Fixed files reported as uploaded when the wiki did not store them
* Fixed an invalid `+rename` pattern cancelling the rest of the batch with no error shown
* Fixed the result list losing uploads that were still running when more files were selected

Wikis that customised `MediaWiki:Simplebatchupload-max-files-alert` should move that customisation to
`MediaWiki:Simplebatchupload-max-files-reached`, which replaces it and takes different parameters.

### SimpleBatchUpload 3.0.3

Released on August 5, 2026.

* Fixed deprecation warning shown on MediaWiki 1.46

### SimpleBatchUpload 3.0.2

Released on July 1, 2026.

* Re-release of 3.0.1 to correct a bad release tag; no code changes

### SimpleBatchUpload 3.0.1

Released on July 1, 2026.

* Fixed ResourceLoader errors logged on pages that display the upload button

### SimpleBatchUpload 3.0.0

Released on August 15, 2025.

* Raised minimum MediaWiki version to 1.43
* Added support for MediaWiki 1.44

### SimpleBatchUpload 2.0.1

Released on December 7, 2023.

* Added support for Composer 2.2 and above
* Improved support for MediaWiki 1.41 and above

### SimpleBatchUpload 2.0.0

Released on January 10, 2023.

* Raised minimum required versions to
  * MediaWiki 1.35
  * PHP 8.0
* Added PHP 8.1 support (thanks @malberts)
* Fixed deprecation warning in MediaWiki 1.38 (thanks @malberts)

### SimpleBatchUpload 1.9.0

Released on December 14, 2022.

* Fixed jQuery Promise methods (thanks @malberts)
* Updated `blueimp-file-upload` dependency to v10.32.0 (thanks @malberts)

### SimpleBatchUpload 1.8.2

Released on May 5, 2021.

* Fixed JavaScript loading issue on MediaWiki 1.35.x (thanks @MtMNC)

### SimpleBatchUpload 1.8.1

Released on May 3, 2021.

* Fix an issue in the previous patch causing batch uploading to break.

### SimpleBatchUpload 1.8.0

Released on April 30, 2021.

* Fix issues with multiple instances of `#batchupload` always inserting the content of the first instance.

### SimpleBatchUpload 1.7.0

Released on April 13, 2021.

* Added description field to the file upload form (by @thijskh)
* Added `+rename` parameter to `#batchupload` to enable renaming of files via regex (by @ankostis)
* Added file number to alert message (by @Abijeet)
* Fixed compatibility issue with MediaWiki 1.35+ (by @thijskh)

### SimpleBatchUpload 1.6.0

Released on March 24, 2020.

* Added translations (via [translatewiki.net](https://translatewiki.net))

### SimpleBatchUpload 1.5.0

Released on November 10, 2019.

Changes:
* Raise minimum required versions to
  * MediaWiki 1.31
  * PHP 7.0
* Add CI testing
* Ensure compatibility with MediaWiki 1.32+ ([#21](https://github.com/ProfessionalWiki/SimpleBatchUpload/issues/21))

### SimpleBatchUpload 1.4.0

Released on October 24, 2018.

Changes:
* New configuration parameter `$wgSimpleBatchUploadMaxFilesPerBatch`

### SimpleBatchUpload 1.3.2

Released on October 12, 2018.

Changes:
* Fix for unauthenticated arbitrary file upload vulnerability in Blueimp
  jQuery-File-Upload <= v9.22.0 ([CVE-2018-9206](https://nvd.nist.gov/vuln/detail/CVE-2018-9206))
  (this also fixes the issue where the extension does not work in debug=true mode)

### SimpleBatchUpload 1.3.1

Released on April 18, 2018.

Changes:
* Fix tarball installation

### SimpleBatchUpload 1.3.0

Released on March 30, 2018.

Changes:
* Add parser function `#batchupload`
* Improve error messages

### SimpleBatchUpload 1.2.0

Released on February 9, 2017.

Changes:
* Add a summary/comment for each upload
* Read upload parameters from system message "MediaWiki:Simplebatchupload-parameters"
* Improved build script
* Fix failed uploads due timed-out edit token
* Fix "extension.json" for MW 1.26: Remove `load_composer_autoloader`
* Enable linting of JS, JSON and i18n files:
  Run `npm install && npm run lint` from the extension directory
* Improve code quality

### SimpleBatchUpload 1.1.0

Released on June 10, 2016.

Changes:
* Add progress indicators
* Delete result list before initiating new upload

### SimpleBatchUpload 1.0.1

Released on June 6, 2016.

Changes:
* Add documentation
* Fix error handling
* Fix minimum MW version to 1.26
* Fix i18n of upload button label

### SimpleBatchUpload 1.0.0

Released on June 6, 2016.

First version
