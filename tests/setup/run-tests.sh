#!/bin/bash
set -ex

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
  # TODO
    echo Not implemented.
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
fetch_sbu_from_download
install

run_tests "$@"
