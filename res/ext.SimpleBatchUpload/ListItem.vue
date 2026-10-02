<template>
	<component :is="tag" class="ext-sbu-item">
		<span class="ext-sbu-item__lead" :class="'ext-sbu-item__lead--' + lead">
			<slot name="lead"></slot>
		</span>
		<span class="ext-sbu-item__text">
			<slot name="text"></slot>
		</span>
		<span class="ext-sbu-item__end">
			<slot name="end"></slot>
		</span>
	</component>
</template>

<script>
const { defineComponent } = require( 'vue' );

module.exports = exports = defineComponent( {
	name: 'ListItem',

	props: {
		/**
		 * What to render as. A line of the file list is a list item; the line
		 * that adds more sits above the list and is not.
		 */
		tag: {
			type: String,
			default: 'li',
			validator: ( value ) => [ 'li', 'div' ].includes( value )
		},

		/**
		 * How the leading box is drawn: plain where what goes in it draws its
		 * own frame, outlined for somewhere something could go.
		 */
		lead: {
			type: String,
			default: 'plain',
			validator: ( value ) => [ 'plain', 'outlined' ].includes( value )
		}
	}
} );
</script>

<style lang="less">
@import 'mediawiki.skin.variables.less';

/**
 * One line of the file list, whatever the line is about.
 *
 * Two kinds of line are drawn with this -- a file, and the way to add more --
 * and they have to line up with each other: a leading box of one size, a text
 * column that takes the rest, and controls at the end. Kept here so the two
 * cannot drift apart: nothing catches that until the columns visibly disagree.
 */
.ext-sbu-item {
	display: grid;
	// The text is the only column allowed to grow, and minmax( 0, 1fr ) rather
	// than 1fr so a long file name ellipses instead of pushing the controls out
	// of the line.
	grid-template-columns: auto minmax( 0, 1fr ) auto;
	align-items: center;
	gap: @spacing-75;
	padding: @spacing-50 @spacing-75;
}

.ext-sbu-item__lead {
	display: flex;
	align-items: center;
	justify-content: center;
	width: @size-250;
	height: @size-250;
	border-radius: @border-radius-base;
}

// Holding nothing yet, and saying so.
.ext-sbu-item__lead--outlined {
	color: @color-subtle;
	border: @border-width-base dashed @border-color-subtle;
}

// Codex sets a colour on .cdx-icon itself, so the box's own never reaches it.
// Only this lead has one to hand on: a thumbnail's placeholder keeps its own.
.ext-sbu-item__lead--outlined .cdx-icon {
	color: inherit;
}

.ext-sbu-item__text {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.ext-sbu-item__end {
	display: flex;
	align-items: center;
}

// What the line is about, in one weight wherever it appears. The size is left to
// the line, which knows its own layout. A line whose file is not going anywhere
// says so by giving the weight up.
.ext-sbu-item__title {
	color: @color-base;
	font-weight: bold;
	line-height: @line-height-xx-small;
}
</style>
