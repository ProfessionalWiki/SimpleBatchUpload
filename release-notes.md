## Release Notes

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
