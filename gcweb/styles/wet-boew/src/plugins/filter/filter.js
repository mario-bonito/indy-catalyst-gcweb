( function( $, window, wb ) {
"use strict";

var componentName = "wb-filter",
	selector = "." + componentName,
	initEvent = "wb-init" + selector,
	$document = wb.doc,
	filterClass = "wb-fltr-out",
	notFilterClassSel = ":not(." + filterClass + ")",
	inputClass = "wb-fltr-inpt",
	dtNameFltrArea = "wbfltrid",
	visibleSelector = ":visible",
	selectorInput = "." + inputClass,
	defaults = {
		std: {
			selector: "li"
		},
		grp: {
			selector: "li",
			section: ">section"
		},
		tbl: {
			selector: "tr",
			section: ">tbody"
		},
		tblgrp: {
			selector: "th:not([scope])",
			hdnparentuntil: "tbody",
			section: ">tbody"
		}
	},
	i18n, i18nText,
	infoText,
	wait,

	init = function( event ) {
		var elm = wb.init( event, componentName, selector ),
			$elm, elmTagName, filterUI, prependUI,
			settings, setDefault,
			inptId, totalEntries;
		if ( elm ) {
			$elm = $( elm );

			elmTagName = elm.nodeName;
			if ( [ "DIV", "SECTION", "ARTICLE" ].indexOf( elm.nodeName ) >= 0 ) {
				setDefault = defaults.grp;
				prependUI = true;
			} else if ( elmTagName === "TABLE" ) {
				if ( $elm.find( "tbody" ).length > 1 ) {
					setDefault = defaults.tblgrp;
				} else {
					setDefault = defaults.tbl;
				}
			} else {
				setDefault = defaults.std;
			}

			settings = $.extend( true, {}, setDefault, window[ componentName ], wb.getData( $elm, componentName ) );
			$elm.data( settings );

			if ( !i18nText ) {
				i18n = wb.i18n;
				i18nText = {
					filter_label: i18n( "fltr-lbl" ),
					fltr_info: i18n( "fltr-info" )
				};

				infoText = i18nText.fltr_info;
			}

			Modernizr.addTest( "stringnormalize", "normalize" in String );
			Modernizr.load( {
				test: Modernizr.stringnormalize,
				nope: [
					"site!deps/unorm" + wb.getMode() + ".js"
				]
			} );

			if ( !elm.id ) {
				elm.id = wb.getId();
			}
			inptId = elm.id + "-inpt";

			totalEntries = $elm.find( ( settings.section || "" ) + " " + settings.selector ).length;

			filterUI = "<div class=\"input-group\"><label for=\"" + inptId + "\" class=\"input-group-addon\"><span class=\"glyphicon glyphicon-filter\" aria-hidden=\"true\"></span> " + i18nText.filter_label + "</label><input id=\"" + inptId + "\" class=\"form-control " + inputClass + "\" data-" + dtNameFltrArea + "=\"" + elm.id + "\" type=\"search\"></div>" + "<p aria-live=\"polite\" id=\"" + elm.id + "-info\">" + infoFormater( totalEntries, totalEntries ) + "</p>";

			if ( prependUI ) {
				$elm.prepend( filterUI );
			} else {
				$elm.before( filterUI );
			}

			wb.ready( $elm, componentName );
		}
	},
	infoFormater = function( nbItem, total ) {
		return infoText.
			replace( /_NBITEM_/g, nbItem ).
			replace( /_TOTAL_/g, total );
	},

	/*
	 * Takes in the text from the filter box
	 * Returns:
	 *  An array of search words
	 *      Special characters are escaped
	 *      Double and single quotes removed
	 */
	filterQueryParser = function( filter ) {

		// Pattern to seperate the filter text into "words"
		var pattern = /[^\s"]+|"([^"]*)"/gi;

		// Make strings safe again for regex
		// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
		filter = filter.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" );

		// Apply the word match pattern and return
		return filter.match( pattern );
	},

	/**
	 * Build the Regular Expression that we are going
	 * to use to filter content
	 * This involves identifying the type of search being
	 * applied and then breaking up the search string into
	 * words
	 */
	buildSearchFilterRegularExp =  function( filterType, filter ) {

		var words, wordRegExFilter = filter,
			i, i_len;

		switch ( filterType ) {

		case "and":
			words = filterQueryParser( filter );
			if ( words ) {
				wordRegExFilter = ".*";
				i_len = words.length;
				for ( i = 0; i < i_len; i++ ) {
					wordRegExFilter = wordRegExFilter + ( "(?=.*" + words[ i ] + ")" );
				}
			}
			break;

		case "or": // If one word fall back on default
			words = filterQueryParser( filter );
			if ( words ) {
				wordRegExFilter =  words.join( "|" );
			}
			break;

		default:
			break;

		}

		return new RegExp( wordRegExFilter, "i" );

	},

	filter = function( $field, $elm, settings ) {
		var unAccent = function( str ) {
				return str.normalize( "NFD" ).replace( /[\u0300-\u036f]/g, "" );
			},
			filter = unAccent( $field.val().trim() ),
			fCallBack = settings.filterCallback,
			secSelector = ( settings.section || "" )  + " ",
			hndParentSelector = settings.hdnparentuntil,
			$items = $elm.find( secSelector + settings.selector ),
			itemsLength = $items.length,
			i, $item, text, searchFilterRegularExp;

		$elm.find( "." + filterClass ).removeClass( filterClass );

		searchFilterRegularExp = buildSearchFilterRegularExp( settings.filterType, filter );

		for ( i = 0; i < itemsLength; i += 1 ) {
			$item = $items.eq( i );
			text = unAccent( $item.text() );

			if ( !text.match( searchFilterRegularExp ) ) {
				if ( hndParentSelector ) {
					$item = $item.parentsUntil( hndParentSelector );
				}
				$item.addClass( filterClass );
			}
		}

		if ( !fCallBack || typeof fCallBack !== "function"  ) {
			fCallBack = filterCallback;
		}
		fCallBack.apply( this, arguments );

		$( "#" + $elm.get( 0 ).id + "-info" ).html( infoFormater( $elm.find( secSelector + notFilterClassSel + settings.selector + visibleSelector ).length, itemsLength ) );
	},
	filterCallback = function( $field, $elm, settings ) {
		var $sections =	$elm.find( settings.section + visibleSelector ),
			sectionsLength = $sections.length,
			fndSelector = notFilterClassSel + settings.selector + visibleSelector,
			s, $section;

		for ( s = 0; s < sectionsLength; s += 1 ) {
			$section = $sections.eq( s );
			if ( $section.find( fndSelector ).length === 0 ) {
				$section.addClass( filterClass );
			}
		}
	};

$document.on( "keyup", selectorInput, function( event ) {
	var target = event.target,
		$input = $( target ),
		$elm = $( "#" + $input.data( dtNameFltrArea ) );

	if ( wait ) {
		clearTimeout( wait );
	}
	wait = setTimeout( filter.bind( this, $input, $elm, $elm.data() ), 250 );

} );

$document.on( "timerpoke.wb " + initEvent, selector, init );

wb.add( selector );
} )( jQuery, window, wb );
