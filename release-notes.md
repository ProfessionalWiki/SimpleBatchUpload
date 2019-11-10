## Release Notes

### SimpleBatchUpload 1.5.1

Released on tbd

Changes:
- None yet.

### SimpleBatchUpload 1.5.0

Released on 10-Nov-2019

Changes:
* Raise minimum required versions to
  * MediaWiki 1.31
  * PHP 7.0
* Add CI testing
* Ensure compatibility with MediaWiki 1.32+ ([#21](https://github.com/s7eph4n/SimpleBatchUpload/issues/21))

### SimpleBatchUpload 1.4.0

Released on 24-Oct-2018

Changes:
* New configuration setting `$wgSimpleBatchUploadMaxFilesPerBatch`

### SimpleBatchUpload 1.3.2

Released on 12-Oct-2018

Changes:
* Fix for unauthenticated arbitrary file upload vulnerability in Blueimp
  jQuery-File-Upload <= v9.22.0 ([CVE-2018-9206](https://nvd.nist.gov/vuln/detail/CVE-2018-9206))
  (this also fixes the issue where the extension does not work in debug=true mode)

### SimpleBatchUpload 1.3.1

Released on 18-Apr-2018

Changes:
* Fix tarball installation

### SimpleBatchUpload 1.3.0

Released on 30-Mar-2018

Changes:
* Add parser function `#batchupload`
* Improved error messages

### SimpleBatchUpload 1.2.0

Released on 09-Feb-2017

Changes:
* Add a summary/comment for each upload
* Read upload parameters from MediaWiki:Simplebatchupload-parameters
* Improved build script
* Fix failed uploads due timed-out edit token
* Fix extension.json for MW 1.26: Remove `load_composer_autoloader`
* Enable linting of JS, JSON and i18n files:
  Run `npm install && npm run lint` from the extension directory
* Improved code quality

### SimpleBatchUpload 1.1.0

Released on 10-Jun-2016

Changes:
* Add progress indicators
* Delete result list before initiating new upload

### SimpleBatchUpload 1.0.1

Released on 07-Jun-2016

Changes:
* Add documentration
* Fix error handling
* Fix minimum MW version to 1.26
* Fix i18n of upload button label

### SimpleBatchUpload 1.0.0

Released on 06-Jun-2016

First version
