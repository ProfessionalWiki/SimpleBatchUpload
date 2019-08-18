#!/bin/bash
# Run tests
# (assumes to be run on scrutinizer.org)
#
# @copyright (C) 2016 - 2019, Stephan Gambke
# @license   GNU General Public License, version 2 (or any later version)

set -xe

function fetch_mw_from_download() {

  wget "https://releases.wikimedia.org/mediawiki/${MW%.*}/mediawiki-$MW.tar.gz"
  tar -zxf "mediawiki-$MW.tar.gz"
  mv "mediawiki-$MW" ~/mw

  cd ~/mw
  composer require "phpunit/phpunit:^6.5" --update-no-dev --no-scripts
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

  if [[ "$SCRUTINIZER_PR_SOURCE_BRANCH" == '' ]]
  then
    COMPOSER_VERSION="dev-${SCRUTINIZER_BRANCH}#${SCRUTINIZER_SHA1}"
  else
    COMPOSER_VERSION="dev-${SCRUTINIZER_PR_SOURCE_BRANCH}#${SCRUTINIZER_SHA1}"
  fi

  php ~/build/tests/setup/fix-composer.php "mediawiki/simple-batch-upload" "$COMPOSER_VERSION" "$SCRUTINIZER_PROJECT" <~/mw/composer.local.json-sample >~/mw/composer.local.json

  cd ~/mw
  composer update "mediawiki/simple-batch-upload"
}

function install() {
  mysql -e 'create database wikidb;'
  php ~/mw/maintenance/install.php --dbserver $SERVICE_MARIADB_IP --dbuser root --dbname wikidb --pass hugo TestWiki admin
  echo "wfLoadExtension( 'SimpleBatchUpload' );" >>~/mw/LocalSettings.php
}

function run_tests() {
  php ~/mw/tests/phpunit/phpunit.php -c ~/mw/extensions/SimpleBatchUpload/phpunit.xml.dist "$@"
}

function prepare_analysis() {
  cd ~/build
  mv ~/mw ~/build
}

if [[ "$MW" =~ 1.[[:digit:]][[:digit:]].[[:digit:]][[:digit:]]? ]]  # e.g. 1.33.0
then
  fetch_mw_from_download
else
  fetch_mw_from_composer
fi

if [[ "$SBU" == "download" ]]
then
  fetch_sbu_from_download
else
  fetch_sbu_from_composer
fi

install

run_tests "$@"

prepare_analysis