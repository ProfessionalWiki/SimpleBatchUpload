<template>
	<div
		ref="root"
		class="ext-sbu-dock mw-sticky-header-element"
		tabindex="-1"
	>
		<!-- Focusable only from script: it takes keyboard focus when the
		button that had it goes. -->
		<div v-if="onHold" class="ext-sbu-dock__band">
			<cdx-icon
				class="ext-sbu-dock__band-icon"
				:icon="icons.cdxIconAlert"
				:icon-label="$i18n( 'simplebatchupload-dock-attention' ).text()"
			></cdx-icon>
			<span class="ext-sbu-dock__band-text">
				<span
					v-for="( part, index ) in bandParts"
					:key="index"
					class="ext-sbu-dock__band-part"
				>{{ part }}</span>
			</span>
			<cdx-button
				class="ext-sbu-dock__filter"
				weight="quiet"
				action="progressive"
				@click="$emit( 'toggle-filter' )"
			>
				{{ filterLabel }}
			</cdx-button>
		</div>

		<!-- Nothing to say and nothing to press means no line: with every file
		waiting on an answer, the band above has said it, and an empty strip
		below would say it again at the height of a row. -->
		<div v-if="summaryParts.length" class="ext-sbu-dock__status">
			<progress
				class="ext-sbu-dock__bar"
				:value="percent"
				max="100"
				:aria-label="$i18n( 'simplebatchupload-dock-batch-progress' ).text()"
			></progress>
			<span class="ext-sbu-dock__summary">
				<span
					v-for="( part, index ) in summaryParts"
					:key="index"
					class="ext-sbu-dock__summary-part"
				>{{ part }}</span>
			</span>
			<!-- One button that changes, never two that swap and never one
			that is disabled: either way the focused element goes and keyboard
			focus falls to the page body. -->
			<cdx-button
				v-if="offersPause || offersUpload"
				class="ext-sbu-dock__action"
				:weight="offersPause ? 'quiet' : 'primary'"
				:action="offersPause ? 'default' : 'progressive'"
				@click="press"
			>
				{{ actionLabel }}
			</cdx-button>
		</div>

		<p v-if="stoppedByLimit" class="ext-sbu-dock__stopped">
			{{ $i18n( 'simplebatchupload-rate-limit-paused' ).text() }}
		</p>
	</div>
</template>

<script>
const { defineComponent, computed, nextTick, ref, watch } = require( 'vue' );
const { CdxButton, CdxIcon } = require( './codex.js' );
const icons = require( './icons.json' );

// Pause appears under the pointer that has just pressed Upload, so the second
// click of a double click lands on it. A press this soon after the button
// changed was meant for the button it was before.
const DOUBLE_PRESS_MS = 500;

module.exports = exports = defineComponent( {
	name: 'StatusDock',

	components: { CdxButton, CdxIcon },

	props: {
		counts: { type: Object, required: true },
		phase: { type: String, required: true },
		filtered: { type: Boolean, default: false },
		stoppedByLimit: { type: Boolean, default: false },
		// How much longer the wiki's rate limit makes the batch, in words.
		// Absent unless the wiki advertises a limit tight enough to pace to.
		remaining: { type: String, default: '' }
	},

	emits: [ 'start', 'pause', 'toggle-filter' ],

	setup( props, { emit } ) {
		const onHold = computed( () => props.counts.held + props.counts.clash );

		const bandParts = computed( () => {
			const parts = [ mw.msg( 'simplebatchupload-dock-on-hold', onHold.value ) ];

			// Only when both kinds are waiting: where every file on hold
			// shares a name, saying so twice says nothing.
			if ( props.counts.clash && props.counts.held ) {
				parts.push( mw.msg( 'simplebatchupload-dock-overwriting', props.counts.clash ) );
			}

			return parts;
		} );

		const filterLabel = computed( () => ( props.filtered ?
			mw.msg( 'simplebatchupload-dock-show-all', props.counts.total ) :
			mw.msg( 'simplebatchupload-dock-show-on-hold', onHold.value )
		) );

		// Files on hold are not counted: a batch gets no closer to finished
		// while it waits for an answer. Skipped files are not part of it at
		// all, or one skipped before Upload would draw progress before
		// anything had been sent.
		const settled = computed( () => props.counts.done + props.counts.failed );
		const sending = computed( () => props.counts.total - props.counts.skipped );

		const percent = computed( () => ( sending.value ?
			Math.round( ( settled.value / sending.value ) * 100 ) :
			0
		) );

		const summaryParts = computed( () => {
			const parts = [];

			if ( props.phase === 'idle' ) {
				tally( parts, 'simplebatchupload-dock-ready', props.counts.queued );
				tally( parts, 'simplebatchupload-dock-uploaded', props.counts.done );
				tally( parts, 'simplebatchupload-dock-failed', props.counts.failed );
				tally( parts, 'simplebatchupload-dock-skipped', props.counts.skipped );
			} else if ( props.phase === 'pausing' ) {
				parts.push( mw.msg( 'simplebatchupload-dock-pausing', props.counts.uploading ) );
			} else {
				parts.push( mw.msg(
					'simplebatchupload-dock-uploading', settled.value, sending.value
				) );
			}

			if ( props.remaining ) {
				parts.push( props.remaining );
			}

			return parts;
		} );

		// Messages that reach this:
		// * simplebatchupload-dock-ready
		// * simplebatchupload-dock-uploaded
		// * simplebatchupload-dock-failed
		// * simplebatchupload-dock-skipped
		function tally( parts, message, count ) {
			if ( count ) {
				parts.push( mw.msg( message, count ) );
			}
		}

		// The queue is either open, and can be paused, or closed with files
		// waiting behind it. A pause is closed from the moment it is asked
		// for, so Upload is back while the files already sent finish.
		const offersPause = computed( () => props.phase === 'uploading' );
		const offersUpload = computed(
			() => props.phase !== 'uploading' && props.counts.queued > 0
		);

		const actionLabel = computed( () => mw.msg( offersPause.value ?
			'simplebatchupload-dock-pause' :
			'simplebatchupload-dock-upload'
		) );

		let changedAt = 0;

		watch( offersPause, () => {
			changedAt = Date.now();
		} );

		// When the batch runs out of files the button goes, and keyboard focus
		// with it, to the page body. The dock stays, saying how the batch
		// ended, so focus goes there instead. Checked before the button is
		// removed, while it can still be the focused element.
		const root = ref( null );

		watch( () => offersPause.value || offersUpload.value, ( offered ) => {
			const focused = document.activeElement;
			const hadFocus = !!root.value && !!focused && root.value.contains( focused ) &&
				focused.classList.contains( 'ext-sbu-dock__action' );

			if ( !offered && hadFocus ) {
				nextTick( () => root.value.focus() );
			}
		} );

		function press() {
			if ( Date.now() - changedAt < DOUBLE_PRESS_MS ) {
				return;
			}

			emit( offersPause.value ? 'pause' : 'start' );
		}

		return {
			root,
			icons,
			onHold,
			bandParts,
			filterLabel,
			percent,
			summaryParts,
			offersPause,
			offersUpload,
			actionLabel,
			press
		};
	}
} );
</script>

<style lang="less">
@import 'mediawiki.skin.variables.less';

.ext-sbu-dock {
	// Sticky rather than fixed, so the dock scrolls with the page until the
	// list reaches it and then holds. mw-sticky-header-element is where Vector
	// and Citizen put the offset for their own sticky headers; without it the
	// dock hides underneath one.
	position: sticky;
	top: 0;
	z-index: 1;
	background-color: @background-color-base;
	border-bottom: @border-width-base @border-style-base @border-color-subtle;
}

.ext-sbu-dock__band,
.ext-sbu-dock__status {
	display: flex;
	align-items: stretch;
	min-height: calc( @min-size-interactive-pointer + 2 * @spacing-25 );
	padding-left: @spacing-75;
}

// The row stretches its items so the button at the end takes its full height;
// the words stay centred.
.ext-sbu-dock__band-icon,
.ext-sbu-dock__band-text,
.ext-sbu-dock__summary {
	align-self: center;
}

.ext-sbu-dock__band-text,
.ext-sbu-dock__summary {
	padding: @spacing-25 @spacing-75 @spacing-25 0;
}

// The button is the end of the row rather than something set into it: the
// row's full height and square to its edges, so it is as easy to hit as it
// is to see. One class deeper than .cdx-button, which sets all of this and
// may arrive in a stylesheet after this one.
.ext-sbu-dock .ext-sbu-dock__action,
.ext-sbu-dock .ext-sbu-dock__filter {
	min-height: 0;
	border-radius: 0;
	padding-right: @spacing-125;
	padding-left: @spacing-125;
}

.ext-sbu-dock__band {
	background-color: @background-color-warning-subtle;
}

// One class deeper than .cdx-icon, which sets its own colour and would
// otherwise win or lose on which stylesheet the page loaded last.
.ext-sbu-dock__band .ext-sbu-dock__band-icon {
	margin-right: @spacing-50;
	color: @color-warning;
}

.ext-sbu-dock__band-part:first-of-type {
	font-weight: bold;
}

.ext-sbu-dock__band-part + .ext-sbu-dock__band-part::before {
	content: '·';
	margin: 0 @spacing-25;
	font-weight: normal;
}

// The text takes the line and the button is pushed to the end of it. Done by
// growing the text rather than by an auto margin on the button, because the
// button carries .cdx-button and `.cdx-button { margin: 0 }` cannot be beaten
// on source order: another module on the page may ship Codex's stylesheet and
// be inserted after this one.
.ext-sbu-dock__band-text,
.ext-sbu-dock__summary {
	flex-grow: 1;
}

.ext-sbu-dock__summary-part {
	color: @color-subtle;
}

.ext-sbu-dock__summary-part:first-of-type {
	color: @color-base;
	font-weight: bold;
}

.ext-sbu-dock__summary-part + .ext-sbu-dock__summary-part::before {
	content: '·';
	margin: 0 @spacing-25;
	color: @color-subtle;
	font-weight: normal;
}

// The batch's figure, drawn as the rule under the dock: the rows below carry
// their own, and one number is worth this much room.
.ext-sbu-dock__bar {
	position: absolute;
	bottom: -@border-width-base;
	left: 0;
	width: 100%;
	height: @border-width-thick;
	-webkit-appearance: none;
	appearance: none;
	background-color: transparent;
	border: 0;
}

.ext-sbu-dock__bar::-webkit-progress-bar {
	background-color: transparent;
}

.ext-sbu-dock__bar::-webkit-progress-value {
	background-color: @color-progressive;
}

.ext-sbu-dock__bar::-moz-progress-bar {
	background-color: @color-progressive;
}

.ext-sbu-dock__status {
	position: relative;
}

.ext-sbu-dock__stopped {
	margin: 0;
	padding: @spacing-25 @spacing-75;
	color: @color-subtle;
	font-size: @font-size-small;
}
</style>
