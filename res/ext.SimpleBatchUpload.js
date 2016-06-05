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

;( function ( $, mw, undefined ) {

	'use strict';

	$( function () {
		$( '#fileupload' ).fileupload( {
			dataType: 'json',

			add: function ( e, data ) {
				data.formData = {
					format: 'json',
					action: 'upload',
					token: $( this ).fileupload( 'option', 'token' ),
					ignorewarnings: 1,
					filename: data.files[ 0 ].name
				};
				// data.submit();
				var jqXHR = data.submit()
					.success( function ( result, textStatus, jqXHR ) {
						alert( 'SUCCESS!' );
						/* ... */
					} )
					.error( function ( jqXHR, textStatus, errorThrown ) {
						alert( 'ERROR!' );
						/* ... */
					} )
					.complete( function ( result, textStatus, jqXHR ) {
						alert( 'COMPLETE!' );
						/* ... */
					} );
			},

			done: function ( e, data ) {
				alert( 'DONE!' );
			}
		} );
	} );

}( jQuery, mediaWiki ));
