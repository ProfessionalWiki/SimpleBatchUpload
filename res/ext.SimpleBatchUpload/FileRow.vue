<template>
	<list-item class="ext-sbu-row" :class="'ext-sbu-row--' + row.status">
		<template #lead>
			<!-- Keyed on the preview because CdxThumbnail only loads one in
			onMounted, with no watcher: a preview drawn in the worker arrives
			after the row is on the page, and without the key it would never be
			picked up. -->
			<cdx-thumbnail
				:key="row.thumbnail"
				class="ext-sbu-row__thumb"
				:thumbnail="row.thumbnail ? { url: row.thumbnail } : null"
				:placeholder-icon="icons.cdxIconImage"
			></cdx-thumbnail>
		</template>

		<template #text>
			<a
				v-if="row.href"
				class="ext-sbu-item__title ext-sbu-row__title"
				:href="row.href">{{ title }}</a>
			<span v-else class="ext-sbu-item__title ext-sbu-row__title">{{ title }}</span>
			<span v-if="meta.length" class="ext-sbu-row__meta">
				<span
					v-for="part in meta"
					:key="part"
					class="ext-sbu-row__meta-part">{{ part }}</span>
			</span>
		</template>

		<template #end>
			<span v-if="showsRing" class="ext-sbu-slot ext-sbu-slot--ring">
				<progress
					class="ext-sbu-visually-hidden"
					:value="percent"
					max="100"
					:aria-label="statusLabel"
				></progress>
				<svg
					width="20"
					height="20"
					viewBox="0 0 20 20"
					aria-hidden="true">
					<circle
						class="ext-sbu-slot__track"
						cx="10"
						cy="10"
						:r="radius"
						fill="none" />
					<circle
						class="ext-sbu-slot__fill"
						:class="{ 'ext-sbu-slot__fill--idle': row.status === 'queued' }"
						cx="10"
						cy="10"
						:r="radius"
						fill="none"
						stroke-linecap="round"
						:stroke-dasharray="circumference"
						:stroke-dashoffset="dashOffset"
						transform="rotate(-90 10 10)"
					/>
				</svg>
			</span>
			<span
				v-else
				class="ext-sbu-slot"
				:class="'ext-sbu-slot--' + row.status">
				<cdx-icon :icon="statusIcon" :icon-label="statusLabel"></cdx-icon>
			</span>

			<cdx-button
				v-for="action in actions"
				:key="action.name"
				class="ext-sbu-row__action"
				:class="'ext-sbu-row__action--' + action.name"
				weight="quiet"
				:action="action.progressive ? 'progressive' : 'default'"
				:aria-label="action.ariaLabel"
				@click="$emit( action.name )"
			>
				<cdx-icon v-if="action.icon" :icon="action.icon"></cdx-icon>
				<template v-else>
					<span class="ext-sbu-row__action-label">{{ action.label }}</span>
					<span class="ext-sbu-visually-hidden">{{ action.forFile }}</span>
				</template>
			</cdx-button>
		</template>
	</list-item>
</template>

<script>
const { defineComponent, computed } = require( 'vue' );
const { CdxButton, CdxIcon, CdxThumbnail } = require( './codex.js' );
const ListItem = require( './ListItem.vue' );
const icons = require( './icons.json' );
const { describeSize } = require( './fileSize.js' );

// The circle cdxIconSuccess fills in when the file lands, so one resolves into
// the other. That icon is a disc of r=10 in a 20 box, so a stroke of
// @border-width-thick centred on r=9 shares its outer edge.
const RING_RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Which mark stands in for the ring once there is nothing left to count. A
// status not listed here is one that still has a figure to show.
const STATUS_ICONS = {
	done: 'cdxIconSuccess',
	failed: 'cdxIconError',
	skipped: 'cdxIconCancel',
	held: 'cdxIconAlert',
	clash: 'cdxIconAlert'
};

module.exports = exports = defineComponent( {
	name: 'FileRow',

	components: { CdxButton, CdxIcon, CdxThumbnail, ListItem },

	props: {
		// One of the batch's rows, as it is: read here rather than handed over
		// field by field, so a file's progress redraws this row alone and not
		// the panel drawing all of them.
		row: { type: Object, required: true }
	},

	emits: [ 'retry', 'replace', 'skip', 'keep', 'add-back' ],

	setup( props ) {
		// Both names, where they differ: the one the user recognises and the
		// one the wiki will hold it under.
		const title = computed( () => (
			props.row.targetName && props.row.targetName !== props.row.name ?
				mw.msg( 'simplebatchupload-rename-label', props.row.name, props.row.targetName ) :
				props.row.name
		) );

		const showsRing = computed(
			() => props.row.status === 'queued' || props.row.status === 'uploading'
		);

		// A file put back in the queue keeps the fraction it reached, which is
		// no longer true of it. The ring and the figure behind it both read
		// this, so they cannot disagree.
		const shown = computed( () => ( props.row.status === 'queued' ? 0 : props.row.progress ) );

		const percent = computed( () => Math.round( shown.value * 100 ) );

		const dashOffset = computed( () => CIRCUMFERENCE * ( 1 - shown.value ) );

		const statusIcon = computed( () => icons[ STATUS_ICONS[ props.row.status ] ] );

		// The status is a mark rather than a word, so the mark has to carry its
		// own name or a screen reader reaches an unlabelled image.
		// Messages that reach this:
		// * simplebatchupload-status-queued
		// * simplebatchupload-status-uploading
		// * simplebatchupload-status-done
		// * simplebatchupload-status-failed
		// * simplebatchupload-status-skipped
		// * simplebatchupload-status-held
		// * simplebatchupload-status-clash
		const statusLabel = computed( () => mw.msg( 'simplebatchupload-status-' + props.row.status ) );

		// Everything after the file name, in one slot rather than one each.
		const meta = computed( () => {
			const parts = [];

			if ( props.row.path ) {
				parts.push( props.row.path );
			}

			if ( props.row.size !== null ) {
				parts.push( describeSize( props.row.size ) );
			}

			// Said while there is still time to change the rule. Once the file
			// has been sent, the wiki's own reason is the one worth reading.
			if ( props.row.noExtension && ( props.row.status === 'queued' || props.row.status === 'clash' ) ) {
				parts.push( mw.msg( 'simplebatchupload-row-no-extension' ) );
			}

			if ( props.row.outOf > 1 ) {
				parts.push( mw.msg(
					'simplebatchupload-row-nth-of', props.row.position, props.row.outOf
				) );
			}

			if ( props.row.detail ) {
				parts.push( props.row.detail );
			}

			return parts;
		} );

		const actions = computed( () => {
			const forFile = mw.msg( 'simplebatchupload-action-for-file', props.row.name );

			// An icon-only button has no visible word for the file name to
			// follow, so one message names the whole thing and can put the two
			// in whichever order the language wants. Codex reads the same
			// attribute to decide the button is icon-only.
			// Messages that reach this:
			// * simplebatchupload-action-retry
			// * simplebatchupload-action-skip-file
			function iconAction( name, icon, message ) {
				return {
					name: name,
					icon: icons[ icon ],
					ariaLabel: mw.msg( message, props.row.name )
				};
			}

			if ( props.row.status === 'failed' ) {
				return [ iconAction(
					'retry', 'cdxIconReload', 'simplebatchupload-action-retry'
				) ];
			}

			// Put away by the panel once Upload is pressed, see the style.
			if ( props.row.status === 'queued' ) {
				return [ iconAction(
					'skip', 'cdxIconClose', 'simplebatchupload-action-skip-file'
				) ];
			}

			if ( props.row.status === 'skipped' ) {
				return [ {
					name: 'add-back',
					label: mw.msg( 'simplebatchupload-action-add-back' ),
					progressive: true,
					forFile: forFile
				} ];
			}

			if ( props.row.status === 'held' ) {
				return [
					{
						name: 'replace',
						label: mw.msg( 'simplebatchupload-action-replace' ),
						progressive: true,
						forFile: forFile
					},
					{
						name: 'skip',
						label: mw.msg( 'simplebatchupload-action-skip' ),
						forFile: forFile
					}
				];
			}

			if ( props.row.status === 'clash' ) {
				return [ {
					name: 'keep',
					label: mw.msg( 'simplebatchupload-action-keep' ),
					progressive: true,
					forFile: forFile
				} ];
			}

			return [];
		} );

		return {
			icons,
			title,
			showsRing,
			percent,
			dashOffset,
			statusIcon,
			statusLabel,
			meta,
			actions,
			circumference: CIRCUMFERENCE,
			radius: RING_RADIUS
		};
	}
} );
</script>

<style lang="less">
// Codex tokens, by way of the skin, so a skin that redefines them -- Citizen and
// Vector 2022 both do, for dark mode -- redefines them here too. Importing
// @wikimedia/codex-design-tokens directly is refused by ResourceLoader.
@import 'mediawiki.skin.variables.less';

.ext-sbu-row + .ext-sbu-row {
	border-top: @border-width-base @border-style-base @border-color-subtle;
}

// Only the rows that want the user's attention are tinted; the marks say the rest.
.ext-sbu-row--held,
.ext-sbu-row--clash {
	background-color: @background-color-warning-subtle;
}

.ext-sbu-row--failed {
	background-color: @background-color-error-subtle;
}

.ext-sbu-row .ext-sbu-row__title {
	font-size: @font-size-small;
}

// Once the file is on the wiki its name is a link to it, which the shared
// title's own colour would otherwise hide.
a.ext-sbu-row__title {
	color: @color-progressive;
}

.ext-sbu-row__title {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

// Not going to the wiki, so it gives up the weight the others carry.
.ext-sbu-row--skipped .ext-sbu-item__title {
	color: @color-subtle;
	font-weight: normal;
}

.ext-sbu-row__meta {
	display: flex;
	flex-wrap: wrap;
	color: @color-subtle;
	font-size: @font-size-small;
}

.ext-sbu-row__meta-part + .ext-sbu-row__meta-part::before {
	content: '·';
	margin: 0 @spacing-25;
}

// Spaced with a margin rather than a flex container with `gap`: `gap` on a flex
// container is above the Safari 11.1 baseline ResourceLoader still serves, and
// would silently collapse to nothing there.
//
// One class deeper than the element needs, because the element also carries
// .cdx-button: any other module on the page may ship Codex's stylesheet too,
// and one of them will be inserted after this one. Measured on a Citizen page,
// `.cdx-button { margin: 0 }` appears in three sheets, the last of them after
// this module's. A tie here is not winnable by source order.
.ext-sbu-row .ext-sbu-row__action {
	margin-left: @spacing-25;
}

// Once Upload is pressed a waiting file's turn can come at any moment, so it can
// no longer be skipped. Put away from the panel rather than by each row, so a
// thousand rows are not all drawn again when Upload is pressed and again when a
// pause takes hold. Two classes deep for the same reason as the rule above.
.ext-sbu-panel--running .ext-sbu-row__action--skip {
	display: none;
}

.ext-sbu-slot {
	display: flex;
	align-items: center;
	justify-content: center;
	// Matched to the buttons beside it, so a row keeps its height whether or not
	// it is offering anything.
	width: @min-size-interactive-pointer;
	height: @min-size-interactive-pointer;
}

// Codex only makes an icon inherit its colour inside a button, so a mark
// standing on its own resets to the base colour and loses whatever the status
// said. The slot carries the colour; this lets the mark take it.
.ext-sbu-slot .cdx-icon {
	color: inherit;
}

.ext-sbu-slot--done {
	color: @color-success;
}

.ext-sbu-slot--failed {
	color: @color-error;
}

.ext-sbu-slot--held,
.ext-sbu-slot--clash {
	color: @color-warning;
}

.ext-sbu-slot--skipped {
	color: @color-subtle;
}

.ext-sbu-slot__track {
	stroke: @border-color-subtle;
	stroke-width: @border-width-thick;
}

.ext-sbu-slot__fill {
	stroke: @color-progressive;
	stroke-width: @border-width-thick;
	transition: stroke-dashoffset @transition-duration-base linear;
}

// A file waiting its turn draws no arc at all, so there is nothing to animate,
// and animating from its earlier figure would read as progress.
.ext-sbu-slot__fill--idle {
	transition: none;
}

@media ( prefers-reduced-motion: reduce ) {
	.ext-sbu-slot__fill {
		transition: none;
	}
}
</style>
