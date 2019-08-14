#!/bin/bash
set -x

function fetch_mw_from_download() {
    #TODO
    echo Not implemented.
}

function fetch_mw_from_composer() {

  wget https://github.com/wikimedia/mediawiki/archive/$MW.tar.gz
  tar -zxf $MW.tar.gz
  mv mediawiki-$MW ~/mw

  cd ~/mw
  composer install

}

function fetch_sbu_from_download() {
  cp -R ~/build ~/mw/extensions/SimpleBatchUpload
}

function fetch_sbu_from_composer() {

  local COMPOSER_VERSION=''

  if [ "$SCRUTINIZER_PR_SOURCE_BRANCH" == '' ]
  then
    COMPOSER_VERSION="dev-${SCRUTINIZER_BRANCH}#${SCRUTINIZER_SHA1}"
  else
    COMPOSER_VERSION="dev-${SCRUTINIZER_PR_SOURCE_BRANCH}#${SCRUTINIZER_SHA1}"
  fi

  php ~/build/tests/setup/fix-composer.php "mediawiki/simple-batch-upload" "$COMPOSER_VERSION" "$SCRUTINIZER_PROJECT" < ~/mw/composer.local.json-sample > ~/mw/composer.local.json

  cd ~/mw
  composer update "mediawiki/simple-batch-upload"
}

function install() {
  mysql -e 'create database wikidb;'
  php ~/mw/maintenance/install.php --dbserver $SERVICE_MARIADB_IP --dbuser root --dbname wikidb --pass hugo TestWiki admin
  echo "wfLoadExtension( 'SimpleBatchUpload' );" >> ~/mw/LocalSettings.php
}

function run_tests() {
  php ~/mw/tests/phpunit/phpunit.php -c ~/mw/extensions/SimpleBatchUpload/phpunit.xml.dist "$@"
}

fetch_mw_from_composer
fetch_sbu_from_composer
install

run_tests "$@"
