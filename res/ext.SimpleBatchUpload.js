/**
 * File containing the SimpleBatchUpload class
 *
 * @copyright (C) 2016, Stephan Gambke
 * @license   GNU General Public License, version 2 (or any later version)
 *
 * This software is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @ingroup SimpleBatchUpload
 */

/** global: jQuery, mediaWiki */

;( function ( $, mw, undefined ) {

	'use strict';

	$( function () {
		$( '#fileupload' ).fileupload( {
			dataType: 'json',
			dropZone: $( '#fileupload-dropzone' ),

			add: function ( e, data ) {

				var status = $( '<li>' ).text( data.files[ 0 ].name );
				$( '#fileupload-results' ).append( status );

				data.formData = {
					format: 'json',
					action: 'upload',
					token: $( this ).fileupload( 'option', 'token' ),
					ignorewarnings: 1,
					filename: data.files[ 0 ].name
				};

				data.submit()
					.success( function ( result /*, textStatus, jqXHR */ ) {

						if ( result.error != undefined ) {

							status.text( status.text() + " ERROR: " + result.error.info ).addClass( 'ful-error' );

						} else {
							var link = $( '<a>' );
							link
								.attr( 'href', mw.Title.makeTitle( mw.config.get( 'wgNamespaceIds' ).file, result.upload.filename ).getUrl() )
								.text( result.upload.filename );

							status
								.addClass( 'ful-success' )
								.text( ' OK' )
								.prepend( link );
						}

					} )
					.error( function ( /* jqXHR, textStatus, errorThrown */ ) {
						status.text( status.text() + " ERROR" ).addClass( 'ful-error' );
					} );

			}
		} );

		$( document ).bind( 'drop dragover', function ( e ) {
			e.preventDefault();
		} );
	} );

}( jQuery, mediaWiki ));
