## Release Notes

### Unreleased

* Added a new upload interface, built with Vue and Codex, replacing the jQuery File Upload widget
  * The whole list is the drop target, and dropping a folder adds what is inside it, subfolders included
  * Each file shows a preview, its size, and its upload progress
  * An uploaded file links to its page on the wiki
* Added a prompt before a file is uploaded over one the wiki already holds, instead of overwriting it
  * The file waits in the upload stash while it is asked about, so going ahead does not upload it again
* Added a prompt when files in one batch would be uploaded under the same name, instead of letting the
  last one win
* Files no longer upload as soon as they are added: they wait in the list until Upload is pressed, and a
  running batch can be paused and carried on
* Added a Rename files section, with Find and Replace with fields and an option for regular expressions;
  each file shows its new name before it is uploaded. A `+rename` parameter fills the fields in
* A `+rename` typed into the text for each file page is no longer read: the field warns that it would be
  published as written, and points to Rename files
* Added a button to take a file out of the batch before it is uploaded, and to add it back
* Added a button to try a failed file again
* Removed the vendored jQuery File Upload widget and the extension's own use of jQuery

Pages using `{{#batchupload:}}` should be purged after upgrading, or `$wgCacheEpoch` bumped. The markup
the parser function emits has changed, and a page served from the parser cache keeps the old markup for
up to `$wgParserCacheExpireTime`, during which the upload area on that page does not work.
`Special:BatchUpload` does not need purging.

Wikis that style the upload interface from `MediaWiki:Common.css`, or reach into it from
`MediaWiki:Common.js` or a gadget, will need to update those rules. The `fileupload-*`,
`fileinput-button` and `ful-*` classes are all gone; everything this extension renders now carries an
`ext-sbu-` prefix.

Wikis that customised any of `MediaWiki:Simplebatchupload-result-error`, `-result-not-uploaded`,
`-result-queued`, `-result-rate-limited`, `-result-rate-limit-stopped`, `-result-success` or
`-result-token-error` should delete those pages: the messages no longer exist.
`MediaWiki:Simplebatchupload-buttonlabel` should be checked instead of deleted — it now labels the file
picker alone, with dropping described beside it — and so should `-max-files-reached` and
`-error-rename-pattern`, which now say something different.

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
