<template>
	<div class="ext-sbu-shell">
		<!-- Each section starts open when it has something in it, and says
		nothing about itself when closed: one with content is only ever
		closed because the user closed it. The toggle is written back, so
		Upload can open a section the user closed to show what stops it. -->
		<cdx-accordion
			class="ext-sbu-section ext-sbu-text"
			:open="textOpen || null"
			@toggle="textOpen = $event.target.open"
		>
			<template #title>
				{{ textTitle }}
			</template>

			<cdx-field :disabled="locked" :hide-label="true">
				<cdx-text-area
					v-model="description"
					:rows="4"
				></cdx-text-area>
				<template #label>
					{{ textTitle }}
				</template>
			</cdx-field>
			<!-- Always mounted, because a region added at the moment it fills
			is not announced. -->
			<div role="status">
				<cdx-message
					v-if="batch.textLooksLikeDirective"
					class="ext-sbu-text__warning"
					type="warning"
					:inline="true"
				>
					{{ $i18n( 'simplebatchupload-text-directive-not-read' ).text() }}
				</cdx-message>
			</div>
		</cdx-accordion>

		<cdx-accordion
			class="ext-sbu-section ext-sbu-rename"
			:open="renameOpen || null"
			@toggle="renameOpen = $event.target.open"
		>
			<template #title>
				{{ $i18n( 'simplebatchupload-rename-title' ).text() }}
			</template>

			<div class="ext-sbu-rename__fields">
				<cdx-field
					:status="findError ? 'error' : 'default'"
					:messages="findError ? { error: findErrorLabel } : {}"
					:disabled="locked"
				>
					<cdx-text-input
						ref="findInput"
						v-model="find"
						:placeholder="$i18n( 'simplebatchupload-rename-find-placeholder' ).text()"
						@input="typingFind"
						@blur="settleFind"
						@compositionstart="composing = true"
						@compositionend="composingEnded"
					></cdx-text-input>
					<template #label>
						{{ $i18n( 'simplebatchupload-rename-find' ).text() }}
					</template>
				</cdx-field>

				<cdx-field :disabled="locked">
					<cdx-text-input v-model="replace"></cdx-text-input>
					<template #label>
						{{ $i18n( 'simplebatchupload-rename-replace' ).text() }}
					</template>
				</cdx-field>

				<cdx-checkbox v-model="regex" :disabled="locked">
					{{ $i18n( 'simplebatchupload-rename-regex' ).text() }}
				</cdx-checkbox>

				<div
					class="ext-sbu-rename__count"
					:class="{ 'ext-sbu-rename__count--empty': !countLabel && !offersRenamedFilter }"
				>
					<!-- Always mounted, and holding the one sentence: a region is
					read whole on every change. The button is outside it, so
					it is not read along with the count. -->
					<span
						class="ext-sbu-rename__count-text"
						:class="{ 'ext-sbu-rename__count-text--none': matchesNothing }"
						role="status"
					>{{ countLabel }}</span>
					<cdx-button
						v-if="offersRenamedFilter"
						class="ext-sbu-rename__filter"
						weight="quiet"
						action="progressive"
						@click="toggleFilter( 'renamed' )"
					>
						{{ renamedFilterLabel }}
					</cdx-button>
				</div>
			</div>
		</cdx-accordion>

		<div
			class="ext-sbu-panel"
			:class="{
				'ext-sbu-panel--empty': empty,
				'ext-sbu-panel--dragging': dragging,
				'ext-sbu-panel--running': locked
			}"
			@dragenter.prevent="onDragIn"
			@dragover.prevent
			@dragleave="onDragOut"
			@drop.prevent="onDrop"
		>
			<list-item
				v-if="!empty"
				tag="div"
				class="ext-sbu-add"
				lead="outlined">
				<template #lead>
					<cdx-icon :icon="icons.cdxIconUpload"></cdx-icon>
				</template>
				<template #text>
					<span class="ext-sbu-item__title">{{ addTitle }}</span>
					<span class="ext-sbu-add__hint">{{ addHint }}</span>
				</template>
				<template #end>
					<cdx-button
						class="ext-sbu-add__select"
						action="progressive"
						@click="openPicker">
						{{ selectLabel }}
					</cdx-button>
				</template>
			</list-item>

			<div v-else class="ext-sbu-add ext-sbu-add--empty">
				<!-- Empty, the whole thing is the way to open the file
				picker, so it is one button rather than a panel with a
				button in it. Filled, that room belongs to the files. -->
				<cdx-button
					class="ext-sbu-add__all"
					weight="quiet"
					@click="openPicker">
					<cdx-icon :icon="icons.cdxIconUpload"></cdx-icon>
					<span class="ext-sbu-add__words">
						<span class="ext-sbu-item__title">{{ addTitle }}</span>
						<span class="ext-sbu-add__hint">{{ addHint }}</span>
						<span v-if="capacityLabel" class="ext-sbu-add__hint">{{ capacityLabel }}</span>
					</span>
					<!-- Not a button: the container around it already is
					one, and a button inside a button is neither valid nor
					reachable. Codex has a modifier for exactly this, and it
					keeps the word that says the container can be clicked. -->
					<span
						class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-primary cdx-button--action-progressive ext-sbu-add__select"
					>{{ selectLabel }}</span>
				</cdx-button>
			</div>

			<status-dock
				v-if="!empty"
				:counts="batch.counts"
				:phase="batch.state.phase"
				:stopped-by-limit="batch.state.stoppedByLimit"
				:filtered="filter === 'on-hold'"
				:remaining="batch.remaining"
				@start="upload"
				@pause="batch.pause"
				@toggle-filter="toggleFilter( 'on-hold' )"
			></status-dock>

			<p v-if="turnedAwayLabel" class="ext-sbu-panel__turned-away">
				{{ turnedAwayLabel }}
			</p>

			<!-- Always mounted, because a region added at the moment it fills is
			not announced. It says how many files are ready when they arrive,
			since nothing happens until Upload is found and pressed, and what came
			of the batch once it has run.

			A div rather than a p: a skin may style prose, and Citizen pulls a
			list up under a paragraph that precedes it, which would slide the
			first row under the sticky dock. -->
			<div class="ext-sbu-visually-hidden" role="status">
				{{ announcement }}
			</div>

			<ul v-if="!empty" class="ext-sbu-list">
				<template v-for="section in sections" :key="section.name">
					<li
						v-if="section.heading"
						class="ext-sbu-group"
						:class="'ext-sbu-group--' + section.name">
						<span class="ext-sbu-group__text">{{ section.heading }}</span>
						<cdx-button
							class="ext-sbu-group__action"
							weight="quiet"
							action="progressive"
							@click="section.act"
						>
							{{ section.action }}
						</cdx-button>
					</li>

					<file-row
						v-for="row in section.rows"
						:key="row.id"
						:row="row"
						@retry="batch.retryFile( row.id )"
						@replace="batch.replaceFile( row.id )"
						@skip="batch.skipFile( row.id )"
						@keep="batch.keepFile( row.id )"
						@add-back="batch.addFileBack( row.id )"
					></file-row>
				</template>
			</ul>

			<!-- Outside the list, because both kinds of add line reach for it
			and only one of them is rendered at a time. -->
			<!-- Clicked by the buttons that stand for it rather than reached on
			its own, so it is kept out of the tab order and out of the
			accessibility tree; those buttons carry the name. -->
			<input
				ref="picker"
				class="ext-sbu-visually-hidden"
				type="file"
				multiple
				tabindex="-1"
				aria-hidden="true"
				@change="onPicked"
			>
		</div>
	</div>
</template>

<script>
const { defineComponent, computed, nextTick, ref } = require( 'vue' );
const {
	CdxAccordion, CdxButton, CdxCheckbox, CdxField, CdxIcon, CdxMessage, CdxTextArea, CdxTextInput
} = require( './codex.js' );
const icons = require( './icons.json' );
const FileRow = require( './FileRow.vue' );
const ListItem = require( './ListItem.vue' );
const StatusDock = require( './StatusDock.vue' );
const { groupNameClashes } = require( './nameClash.js' );
const { collectDroppedEntries, readEntryTree } = require( './folderDrop.js' );

/**
 * @param {?FileList} list
 * @return {{file: File, path: string}[]}
 */
function fromFileList( list ) {
	return Array.prototype.map.call( list || [], ( file ) => ( { file: file, path: '' } ) );
}

module.exports = exports = defineComponent( {
	name: 'UploadPanel',

	components: {
		CdxAccordion,
		CdxButton,
		CdxCheckbox,
		CdxField,
		CdxIcon,
		CdxMessage,
		CdxTextArea,
		CdxTextInput,
		FileRow,
		ListItem,
		StatusDock
	},

	props: {
		batch: { type: Object, required: true }
	},

	setup( props ) {
		const picker = ref( null );
		// Read from and written straight through to the batch, which owns it.
		const description = computed( {
			get: () => props.batch.description,
			set: ( written ) => props.batch.setDescription( written )
		} );

		// Likewise the rule, one field at a time: changing it renames the files
		// not yet sent, which can make or settle a clash between them.
		function ruleField( name ) {
			return computed( {
				get: () => props.batch.rule[ name ],
				set: ( value ) => {
					const given = {
						find: props.batch.rule.find,
						replace: props.batch.rule.replace,
						regex: props.batch.rule.regex
					};

					given[ name ] = value;
					props.batch.setRule( given );
				}
			} );
		}

		const find = ruleField( 'find' );
		const replace = ruleField( 'replace' );
		const regex = ruleField( 'regex' );
		const hasRule = computed( () => !!( props.batch.rule.find || props.batch.rule.replace ) );

		const textOpen = ref( !!props.batch.description );
		const renameOpen = ref( hasRule.value );
		const locked = computed( () => props.batch.state.phase !== 'idle' );

		// An invalid pattern is said once typing pauses, or the field is left,
		// rather than on every key: Codex announces it as an alert, and would
		// interrupt each character of an IME composition as well.
		const findSettled = ref( true );
		const composing = ref( false );
		let settleTimer = null;

		function settleFind() {
			clearTimeout( settleTimer );
			findSettled.value = true;
		}

		function typingFind() {
			clearTimeout( settleTimer );
			findSettled.value = false;
			settleTimer = setTimeout( settleFind, 500 );
		}

		function composingEnded() {
			composing.value = false;
			typingFind();
		}

		const findError = computed( () => props.batch.state.renamePatternInvalid &&
			findSettled.value && !composing.value );

		// Upload under a rule that is not a pattern would send every file
		// under its own name. The batch refuses, and the press takes the user
		// to the field that says why instead.
		const findInput = ref( null );

		function upload() {
			props.batch.start();

			if ( !props.batch.state.renamePatternInvalid ) {
				return;
			}

			renameOpen.value = true;
			settleFind();
			nextTick( () => findInput.value.focus() );
		}

		// One list filter, so two can never hide each other's rows: what is on
		// hold, narrowed from the dock, or what the rule renames.
		const filter = ref( '' );

		function toggleFilter( name ) {
			filter.value = filter.value === name ? '' : name;
		}

		const matchesNothing = computed( () => hasRule.value &&
			!props.batch.state.renamePatternInvalid &&
			props.batch.renameCount.of > 0 && props.batch.renameCount.changed === 0 );
		// Counted rather than a flag: dragging over a child fires dragleave on
		// the parent, so a flag would flicker off every time the pointer
		// crossed a row.
		const dragDepth = ref( 0 );
		// A dropped tree is walked only as far as the batch has room for, so
		// what was left out cannot be counted -- only reported.
		const droppedTooMany = ref( false );
		const dragging = computed( () => dragDepth.value > 0 );
		const empty = computed( () => !props.batch.rows.length );

		/**
		 * What is waiting on an answer first, and files sharing a name next to
		 * each other, so the choice between them can be made by looking.
		 */
		const sections = computed( () => {
			// Like the on-hold filter below, this narrows only while there is
			// something to narrow to, so working through it never strands an
			// empty list with no way back.
			if ( filter.value === 'renamed' && props.batch.renamedRows.length ) {
				return [ { name: 'rest', rows: props.batch.renamedRows } ];
			}

			const clashes = groupNameClashes(
				props.batch.rows.filter( ( row ) => row.status === 'clash' )
			);
			const clashRows = [].concat( ...clashes );
			const held = props.batch.rows.filter( ( row ) => row.status === 'held' );
			const listed = [];

			if ( clashRows.length ) {
				listed.push( {
					name: 'clash',
					rows: clashRows,
					heading: mw.msg( 'simplebatchupload-group-clash', clashes.length ),
					action: mw.msg( 'simplebatchupload-group-skip-all' ),
					act: () => props.batch.skipFiles( clashRows.map( ( row ) => row.id ) )
				} );
			}

			if ( held.length ) {
				listed.push( {
					name: 'held',
					rows: held,
					heading: mw.msg( 'simplebatchupload-group-held', held.length ),
					action: mw.msg( 'simplebatchupload-group-replace-all', held.length ),
					act: () => props.batch.replaceFiles( held.map( ( row ) => row.id ) )
				} );
			}

			// Only a list that still has something on hold can be narrowed: the
			// button that widens it again lives on the band, and the band goes
			// when the last hold is answered.
			if ( filter.value !== 'on-hold' || !( clashRows.length || held.length ) ) {
				listed.push( {
					name: 'rest',
					rows: props.batch.rows.filter(
						( row ) => row.status !== 'clash' && row.status !== 'held'
					)
				} );
			}

			return listed;
		} );

		function openPicker() {
			picker.value.click();
		}

		function onPicked( event ) {
			droppedTooMany.value = false;
			props.batch.addFiles( fromFileList( event.target.files ) );
			// So selecting the same file again after removing it still fires a
			// change event.
			event.target.value = '';
		}

		function onDragIn() {
			dragDepth.value += 1;
		}

		function onDragOut() {
			dragDepth.value = Math.max( 0, dragDepth.value - 1 );
		}

		/**
		 * @param {DragEvent} event
		 * @return {Promise}
		 */
		async function onDrop( event ) {
			dragDepth.value = 0;

			// Read before anything is awaited: the entries are only reachable
			// while the drop event is being handled, and a folder among them is
			// the whole reason for taking this path.
			const entries = collectDroppedEntries( event.dataTransfer );

			if ( !entries.length ) {
				droppedTooMany.value = false;
				props.batch.addFiles( fromFileList( event.dataTransfer.files ) );
				return;
			}

			// Walked one file past what there is room for: enough to know the
			// drop overran, without walking a forty thousand file tree that is
			// mostly going to be thrown away.
			const room = props.batch.room;
			const found = await readEntryTree( entries, { limit: room + 1 } );

			droppedTooMany.value = found.length > room;
			props.batch.addFiles( found );
		}

		return {
			icons,
			picker,
			description,
			find,
			replace,
			regex,
			textOpen,
			renameOpen,
			locked,
			composing,
			typingFind,
			settleFind,
			composingEnded,
			findError,
			findInput,
			upload,
			matchesNothing,
			filter,
			toggleFilter,
			dragging,
			empty,
			sections,
			openPicker,
			onPicked,
			onDragIn,
			onDragOut,
			onDrop,

			addTitle: computed( () => mw.msg( empty.value ?
				'simplebatchupload-add-first' :
				'simplebatchupload-add-more'
			) ),

			addHint: computed( () => mw.msg( empty.value ?
				'simplebatchupload-add-hint' :
				'simplebatchupload-add-hint-more'
			) ),

			// Only said before anything is selected, and only where the wiki
			// sets a limit at all.
			capacityLabel: computed( () => (
				empty.value && props.batch.room < Infinity ?
					mw.msg( 'simplebatchupload-add-capacity', props.batch.room ) :
					''
			) ),

			textTitle: mw.msg( 'simplebatchupload-text-title' ),

			findErrorLabel: mw.msg( 'simplebatchupload-error-rename-pattern' ),

			// Nothing while there is no rule or no file to apply it to, and
			// nothing while the pattern is not one: the field says so.
			countLabel: computed( () => {
				const count = props.batch.renameCount;

				if ( !hasRule.value || props.batch.state.renamePatternInvalid || !count.of ) {
					return '';
				}

				return matchesNothing.value ?
					mw.msg( 'simplebatchupload-rename-matches-nothing' ) :
					mw.msg( 'simplebatchupload-rename-count', count.changed, count.of );
			} ),

			// Narrowing a list to all of it would change nothing; the way back
			// stays while the narrowing is on.
			offersRenamedFilter: computed( () => filter.value === 'renamed' || (
				props.batch.renameCount.changed > 0 &&
				props.batch.renameCount.changed < props.batch.renameCount.of
			) ),

			renamedFilterLabel: computed( () => ( filter.value === 'renamed' ?
				mw.msg( 'simplebatchupload-dock-show-all', props.batch.rows.length ) :
				mw.msg( 'simplebatchupload-rename-show-only', props.batch.renameCount.changed )
			) ),

			// Said while the batch is not running -- as files arrive, and once it
			// has run out of things to do -- rather than on every file: those are
			// the moments there is something worth hearing, and a two hundred
			// file batch would otherwise talk two hundred times.
			announcement: computed( () => {
				if ( props.batch.state.phase !== 'idle' ) {
					return '';
				}

				const counts = props.batch.counts;
				const onHold = counts.held + counts.clash;
				const said = [];

				function say( message, count ) {
					if ( count ) {
						said.push( mw.msg( message, count ) );
					}
				}

				// Messages that reach this:
				// * simplebatchupload-dock-ready
				// * simplebatchupload-dock-uploaded
				// * simplebatchupload-dock-failed
				// * simplebatchupload-dock-skipped
				// * simplebatchupload-dock-on-hold
				say( 'simplebatchupload-dock-ready', counts.queued );
				say( 'simplebatchupload-dock-uploaded', counts.done );
				say( 'simplebatchupload-dock-failed', counts.failed );
				say( 'simplebatchupload-dock-skipped', counts.skipped );
				say( 'simplebatchupload-dock-on-hold', onHold );

				return said.join( mw.msg( 'comma-separator' ) );
			} ),

			selectLabel: mw.msg( 'simplebatchupload-buttonlabel' ),

			// A selection can be counted, so it says how much of it got in. A
			// dropped tree cannot, so it says what the batch holds instead.
			turnedAwayLabel: computed( () => {
				if ( droppedTooMany.value ) {
					return mw.msg( 'simplebatchupload-drop-truncated', props.batch.maxFiles );
				}

				if ( props.batch.state.turnedAway ) {
					return mw.msg(
						'simplebatchupload-max-files-reached',
						props.batch.state.admitted,
						props.batch.state.admitted + props.batch.state.turnedAway
					);
				}

				return '';
			} )
		};
	}
} );
</script>

<style lang="less">
@import 'mediawiki.skin.variables.less';

// The panel below draws its own top border, and two hairlines of the same
// colour with nothing between them read as one rule twice as thick. One class
// deeper than .cdx-accordion, which sets the border itself.
.ext-sbu-shell .ext-sbu-rename {
	border-bottom: 0;
}

.ext-sbu-text__warning {
	margin-top: @spacing-50;
}

// A reading width for the fields; Codex spaces them itself.
.ext-sbu-rename__fields {
	max-width: @size-3200;
}

.ext-sbu-rename__fields .cdx-checkbox {
	margin-top: @spacing-100;
}

.ext-sbu-rename__count {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	margin-top: @spacing-75;
	padding-top: @spacing-50;
	border-top: @border-width-base @border-style-base @border-color-muted;
}

// Nothing to count is no line at all, rather than a rule over nothing.
.ext-sbu-rename__count--empty {
	margin-top: 0;
	padding-top: 0;
	border-top: 0;
}

.ext-sbu-rename__count-text {
	margin-right: @spacing-50;
	font-weight: @font-weight-bold;
}

.ext-sbu-rename__count-text--none {
	font-weight: @font-weight-normal;
}

.ext-sbu-panel {
	position: relative;
	border: @border-width-base @border-style-base @border-color-subtle;
	border-radius: @border-radius-base;
}

// Empty, the container is the drop zone, and a dashed edge is what says so.
// Filled, it is a list of files and a dashed edge around it would be noise.
.ext-sbu-panel--empty {
	border-style: dashed;
}

// One target, whatever is in it, said with the border alone: anything that
// adds a line to the panel moves every row under it at the moment the pointer
// arrives, which is worse than a cue that scrolls out of view.
.ext-sbu-panel--dragging {
	border-color: @color-progressive;
	border-style: dashed;
}

.ext-sbu-panel__turned-away {
	margin: 0;
	padding: @spacing-25 @spacing-75;
	background-color: @background-color-warning-subtle;
}

// Scoped past the skin: a skin's rules for prose are written for wikitext and
// reach anything shaped like it, and they are specific enough to win against a
// single class. Citizen pulls a list up under the paragraph before it, which
// here would slide the first row beneath the sticky dock.
.ext-sbu-panel .ext-sbu-list {
	margin: 0;
	padding: 0;
	list-style: none;
}

// Above the dock rather than at the top of the list: adding files belongs with
// the description, and what is worth pinning as the list scrolls is the state
// of the batch. It draws the line between itself and the dock, which draws only
// its own bottom edge.
.ext-sbu-add {
	background-color: @background-color-interactive-subtle;
	border-bottom: @border-width-base @border-style-base @border-color-subtle;
}

// Stacked title over hint, modelled on the Accordion header directly above it
// on the page -- with the hint a step smaller, which the Accordion itself does
// not do: it carries one line, and this carries two.
.ext-sbu-add__words {
	display: flex;
	flex-direction: column;
	min-width: 0;
	overflow-wrap: break-word;
}

.ext-sbu-add__hint {
	color: @color-subtle;
	font-size: @font-size-small;
	font-weight: normal;
	line-height: @line-height-xx-small;
}

// Empty, the row is the whole container, so it can be as generous as a drop
// target should be without costing that room once there are files to show. The
// height is the row's rather than the panel's so that every pixel of it belongs
// to the button, with nowhere to click that does nothing.
.ext-sbu-add--empty {
	display: flex;
	min-height: @size-1600;
	padding: 0;
	background-color: transparent;
	border-bottom: 0;
}

// A Codex button is built to sit in a line of controls: one line, capped
// width, bold throughout. Here it is the container, so those are undone.
.ext-sbu-add--empty .ext-sbu-add__all {
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	justify-content: center;
	max-width: none;
	height: auto;
	padding: @spacing-200 @spacing-75;
	overflow: visible;
	border-radius: @border-radius-base;
	text-align: center;
	white-space: normal;
}

// Stacked inside a button rather than sitting in a row, so it has no row's size
// to take.
.ext-sbu-add--empty .ext-sbu-item__title {
	font-size: @font-size-medium;
}

// One class deeper than Codex's .cdx-button .cdx-icon, which sets the colour too.
.ext-sbu-add--empty .ext-sbu-add__all .cdx-icon {
	min-width: @size-250;
	min-height: @size-250;
	width: @size-250;
	height: @size-250;
	margin-bottom: @spacing-50;
	color: @color-subtle;
}

.ext-sbu-add--empty .ext-sbu-add__select {
	margin-top: @spacing-75;
}

.ext-sbu-group {
	display: flex;
	align-items: center;
	padding: @spacing-25 @spacing-75;
	background-color: @background-color-interactive-subtle;
	border-top: @border-width-base @border-style-base @border-color-subtle;
	border-bottom: @border-width-base @border-style-base @border-color-subtle;
	font-size: @font-size-small;
}

.ext-sbu-group__text {
	flex-grow: 1;
}
</style>
