#!/bin/bash
set -ex

cd ~

wget https://github.com/wikimedia/mediawiki/archive/$MW.tar.gz
tar -zxf $MW.tar.gz
mv mediawiki-$MW mw

cd mw

composer install

mysql -e 'create database wikidb;'
php maintenance/install.php --dbserver $SERVICE_MARIADB_IP --dbuser root --dbname wikidb --pass hugo TestWiki admin

cp -R ~/build ~/mw/extensions/SimpleBatchUpload
echo "wfLoadExtension( 'SimpleBatchUpload' );" >> ~/mw/LocalSettings.php

php ~/mw/tests/phpunit/phpunit.php -c ~/mw/extensions/SimpleBatchUpload/phpunit.xml.dist "$@"
