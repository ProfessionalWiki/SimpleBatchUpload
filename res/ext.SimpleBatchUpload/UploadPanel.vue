<template>
	<div class="ext-sbu-shell">
		<div
			v-if="!compact"
			class="ext-sbu-details"
			role="group"
			:aria-label="detailsTitle"
		>
			<div class="ext-sbu-details__bar">
				<dl v-show="!editing" class="ext-sbu-details__values">
					<dt>{{ textTitle }}</dt>
					<dd>
						<template v-if="textPreview">
							<span class="ext-sbu-details__text">{{ textPreview }}</span>
							<span v-if="textLinesLabel" class="ext-sbu-details__lines">{{ textLinesLabel }}</span>
						</template>
						<span v-else class="ext-sbu-details__none">{{ noTextLabel }}</span>
					</dd>
					<dt>{{ commentTitle }}</dt>
					<dd>
						<span v-if="comment.trim()" class="ext-sbu-details__text">{{ comment }}</span>
						<span v-else class="ext-sbu-details__none">{{ noCommentLabel }}</span>
					</dd>
					<dt>{{ renameTitle }}</dt>
					<dd>
						<template v-if="hasRule">
							<span class="ext-sbu-details__text">{{ ruleLabel }}</span>
							<span
								v-if="batch.state.renamePatternInvalid"
								class="ext-sbu-details__error"
							>{{ findErrorLabel }}</span>
							<span
								v-else-if="countLabel"
								class="ext-sbu-details__count"
							>{{ countLabel }}</span>
						</template>
						<span v-else class="ext-sbu-details__none">{{ noRuleLabel }}</span>
					</dd>
				</dl>
				<span v-show="editing" class="ext-sbu-details__title">{{ detailsTitle }}</span>
				<cdx-button
					class="ext-sbu-details__toggle"
					:aria-expanded="editing"
					@click="toggleEditing"
				>
					{{ editing ? doneLabel : editLabel }}
				</cdx-button>
			</div>

			<!-- Always mounted, because a region added at the moment it fills is
			not announced. Above the form rather than in it, so the warning shows
			either way, next to the text it is about. -->
			<div class="ext-sbu-details__status" role="status">
				<cdx-message
					v-if="batch.textLooksLikeDirective"
					class="ext-sbu-details__warning"
					type="warning"
					:inline="true"
				>
					{{ $i18n( 'simplebatchupload-text-directive-not-read' ).text() }}
				</cdx-message>
				<cdx-message
					v-if="batch.state.renameRuleUnreadable"
					class="ext-sbu-details__warning"
					type="warning"
					:inline="true"
				>
					{{ $i18n( 'simplebatchupload-rename-rule-unreadable' ).text() }}
				</cdx-message>
			</div>

			<!-- Hidden rather than removed: Upload and the edit-details event
			need its textarea while it is put away, and WikiEditor's toolbar
			survives it. -->
			<div v-show="editing" class="ext-sbu-details__form">
				<cdx-field class="ext-sbu-text" :disabled="locked">
					<!-- Read-only as well as disabled, because WikiEditor's buttons
					and insert dialogs check for readonly and would otherwise still
					write to the field on screen, though not to the batch. -->
					<cdx-text-area
						ref="textField"
						v-model="description"
						:rows="4"
						:readonly="locked"
					></cdx-text-area>
					<template #label>
						{{ textTitle }}
					</template>
				</cdx-field>

				<!-- MediaWiki keeps 500 characters of a summary and drops the rest
				without saying so. -->
				<cdx-field class="ext-sbu-comment" :disabled="locked">
					<cdx-text-input v-model="comment" maxlength="500"></cdx-text-input>
					<template #label>
						{{ commentTitle }}
					</template>
				</cdx-field>

				<cdx-field class="ext-sbu-rename" :is-fieldset="true">
					<template #label>
						{{ renameTitle }}
					</template>

					<div class="ext-sbu-rename__pair">
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
					</div>

					<cdx-checkbox v-model="regex" :disabled="locked">
						{{ $i18n( 'simplebatchupload-rename-regex' ).text() }}
					</cdx-checkbox>

					<div
						class="ext-sbu-rename__count"
						:class="{ 'ext-sbu-rename__count--empty': !countLabel && !offersRenamedFilter }"
					>
						<span
							class="ext-sbu-rename__count-text"
							:class="{ 'ext-sbu-rename__count-text--none': matchesNothing }"
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
				</cdx-field>
			</div>
		</div>

		<!-- The count where a screen reader hears it, whether the form is open
		or not: a live region in the put-away form would be silent. Outside the
		details, which a compact panel leaves out until the first files arrive,
		and those are what it counts. Always mounted, and holding the one
		sentence, since a region is read whole on every change. -->
		<div class="ext-sbu-visually-hidden ext-sbu-rename-status" role="status">
			{{ countLabel }}
		</div>

		<div
			class="ext-sbu-panel"
			:class="{
				'ext-sbu-panel--compact': compact,
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
						ref="addSelect"
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
					ref="addAll"
					class="ext-sbu-add__all"
					weight="quiet"
					@click="openPicker">
					<cdx-icon v-if="!compact" :icon="icons.cdxIconUpload"></cdx-icon>
					<span class="ext-sbu-add__words">
						<span class="ext-sbu-item__title">{{ addTitle }}</span>
						<span v-if="!compact" class="ext-sbu-add__hint">{{ addHint }}</span>
						<span v-if="capacityLabel" class="ext-sbu-add__hint">{{ capacityLabel }}</span>
					</span>
					<!-- Not a button: the container around it already is
					one, and a button inside a button is neither valid nor
					reachable. Codex has a modifier for exactly this, and it
					keeps the word that says the container can be clicked.

					Compact, it is the icon alone, and not primary: a page may
					hold dozens. The word stays in the container's name. -->
					<span
						class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--action-progressive ext-sbu-add__select"
						:class="compact ?
							'cdx-button--icon-only cdx-button--weight-normal' :
							'cdx-button--weight-primary'"
					>
						<cdx-icon v-if="compact" :icon="icons.cdxIconUpload"></cdx-icon>
						<span :class="{ 'ext-sbu-visually-hidden': compact }">{{ selectLabel }}</span>
					</span>
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
const { defineComponent, computed, nextTick, ref, watch } = require( 'vue' );
const {
	CdxButton, CdxCheckbox, CdxField, CdxIcon, CdxMessage, CdxTextArea, CdxTextInput
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
		batch: { type: Object, required: true },
		startsCompact: { type: Boolean }
	},

	// Each time the form opens, with its textarea, so the page can add
	// WikiEditor to it.
	emits: [ 'edit-details' ],

	setup( props, { emit } ) {
		const picker = ref( null );
		// Read from and written straight through to the batch, which owns it.
		const description = computed( {
			get: () => props.batch.description,
			set: ( written ) => props.batch.setDescription( written )
		} );
		const comment = computed( {
			get: () => props.batch.comment,
			set: ( written ) => props.batch.setComment( written )
		} );
		// Kept to one line by the stylesheet, line breaks and all; the count
		// says how much more there is.
		const textPreview = computed( () => description.value.trim() );

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

		const editing = ref( false );
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
			takeFieldText();
			props.batch.start();

			if ( !props.batch.state.renamePatternInvalid ) {
				return;
			}

			editDetails();
			settleFind();
			nextTick( () => findInput.value.focus() );
		}

		// Upload sends what the field shows, and putting the form away shows
		// it. Not every writer says so with an input event: WikiEditor's inserts
		// set the value directly for 100 lines or more in Chrome and Safari, or
		// when the field cannot take focus, and the next redraw from the batch
		// would undo them.
		const textField = ref( null );

		function textArea() {
			return textField.value.$el.querySelector( 'textarea' );
		}

		function takeFieldText() {
			const shown = textArea().value;

			if ( shown !== description.value ) {
				description.value = shown;
			}
		}

		// One list filter, so two can never hide each other's rows: what is on
		// hold, narrowed from the dock, or what the rule renames.
		const filter = ref( '' );

		function toggleFilter( name ) {
			filter.value = filter.value === name ? '' : name;
		}

		function editDetails() {
			editing.value = true;
			emit( 'edit-details', textArea() );
		}

		// The way back from the renamed files is in the form, so putting the
		// form away puts the whole list back.
		function toggleEditing() {
			if ( !editing.value ) {
				editDetails();
				return;
			}

			takeFieldText();
			editing.value = false;

			if ( filter.value === 'renamed' ) {
				filter.value = '';
			}
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
		// Not at all when the details start with something to warn of, so
		// whoever wrote the page sees it without adding a file. Decided once:
		// putting the warning right in the open form must not close it. And for
		// good once files have arrived, since rows are never taken out.
		const startsCompact = props.startsCompact && !props.batch.textLooksLikeDirective &&
			!props.batch.state.renamePatternInvalid && !props.batch.state.renameRuleUnreadable;
		const compact = computed( () => startsCompact && empty.value );

		// The first files replace the button that opened the picker with the
		// add line's, and a focused element that goes leaves focus on the page
		// itself. Run before that happens, while the old button still holds it.
		const addAll = ref( null );
		const addSelect = ref( null );

		watch( empty, ( isEmpty ) => {
			if ( isEmpty || addAll.value.$el !== document.activeElement ) {
				return;
			}

			nextTick( () => addSelect.value.$el.focus() );
		} );

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
			comment,
			find,
			replace,
			regex,
			hasRule,
			editing,
			toggleEditing,
			locked,
			composing,
			typingFind,
			settleFind,
			composingEnded,
			findError,
			findInput,
			upload,
			textField,
			matchesNothing,
			filter,
			toggleFilter,
			dragging,
			empty,
			compact,
			addAll,
			addSelect,
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
			commentTitle: mw.msg( 'simplebatchupload-comment-title' ),
			renameTitle: mw.msg( 'simplebatchupload-rename-title' ),
			detailsTitle: mw.msg( 'simplebatchupload-details-title' ),
			editLabel: mw.msg( 'simplebatchupload-details-edit' ),
			doneLabel: mw.msg( 'simplebatchupload-details-done' ),
			noTextLabel: mw.msg( 'simplebatchupload-details-no-text' ),
			noCommentLabel: mw.msg( 'simplebatchupload-details-no-comment' ),
			noRuleLabel: mw.msg( 'simplebatchupload-details-no-rule' ),

			textPreview,

			textLinesLabel: computed( () => {
				const lines = textPreview.value.split( '\n' ).length;

				return lines > 1 ? mw.msg( 'simplebatchupload-details-lines', lines ) : '';
			} ),

			// An empty Find adds Replace with to the start of every name.
			ruleLabel: computed( () => ( props.batch.rule.find ?
				mw.msg( 'simplebatchupload-details-rule', props.batch.rule.find, props.batch.rule.replace ) :
				mw.msg( 'simplebatchupload-details-rule-start', props.batch.rule.replace )
			) ),

			findErrorLabel: mw.msg( 'simplebatchupload-error-rename-pattern' ),

			// Nothing while there is no rule or no file to apply it to, and
			// nothing while the pattern is not one: the field says so. Nothing
			// while uploading either: only files still waiting are counted, so a
			// rule that renamed every file sent would seem to match nothing.
			countLabel: computed( () => {
				const count = props.batch.renameCount;

				if ( !hasRule.value || props.batch.state.renamePatternInvalid || !count.of || locked.value ) {
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

.ext-sbu-details {
	margin-bottom: @spacing-100;
	padding: @spacing-50 @spacing-75;
	background-color: @background-color-interactive-subtle;
	border: @border-width-base @border-style-base @border-color-subtle;
	border-radius: @border-radius-base;
}

// A grid rather than a flex row: gap on a flex container is above the browsers
// ResourceLoader still serves.
.ext-sbu-details__bar {
	display: grid;
	grid-template-columns: minmax( 0, 1fr ) auto;
	gap: @spacing-50 @spacing-100;
	align-items: start;
}

.ext-sbu-details .ext-sbu-details__values {
	display: grid;
	grid-template-columns: max-content minmax( 0, 1fr );
	gap: @spacing-25 @spacing-100;
	margin: 0;
}

.ext-sbu-details .ext-sbu-details__values dt {
	margin: 0;
	font-family: inherit;
	font-weight: @font-weight-bold;
	line-height: inherit;
}

.ext-sbu-details .ext-sbu-details__values dd {
	display: flex;
	align-items: baseline;
	min-width: 0;
	margin: 0;
}

// One line, however long: the field holds the rest.
.ext-sbu-details__text {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ext-sbu-details__lines,
.ext-sbu-details__count,
.ext-sbu-details__error {
	flex-shrink: 0;
	margin-left: @spacing-50;
	color: @color-subtle;
	white-space: nowrap;
}

.ext-sbu-details__error {
	color: @color-error;
}

.ext-sbu-details__none {
	color: @color-subtle;
}

.ext-sbu-details__title {
	align-self: center;
	font-weight: @font-weight-bold;
}

.ext-sbu-details__form {
	margin-top: @spacing-75;
}

// One class deeper than .cdx-field, which spaces fields too.
.ext-sbu-details__form .ext-sbu-comment,
.ext-sbu-details__form .ext-sbu-rename {
	margin-top: @spacing-150;
}

.ext-sbu-details .ext-sbu-details__warning {
	margin-top: @spacing-50;
}

@media ( max-width: @max-width-breakpoint-mobile ) {
	.ext-sbu-details .ext-sbu-details__values {
		grid-template-columns: minmax( 0, 1fr );
		row-gap: 0;
	}

	.ext-sbu-details .ext-sbu-details__values dd {
		margin-bottom: @spacing-50;
	}

	// The button ends the box, under the values or the form alike, and spans
	// it. Moved there by order rather than in the markup, so it still comes
	// before what it opens when read or tabbed through. One class deeper than
	// Codex's .cdx-button, which caps its width.
	.ext-sbu-details {
		display: flex;
		flex-direction: column;
	}

	.ext-sbu-details__bar {
		display: contents;
	}

	.ext-sbu-details__title {
		align-self: flex-start;
	}

	.ext-sbu-details .ext-sbu-details__toggle {
		order: 1;
		width: 100%;
		max-width: none;
	}

	.ext-sbu-details__form {
		margin-bottom: @spacing-100;
	}

	.ext-sbu-details .ext-sbu-details__warning {
		margin-bottom: @spacing-50;
	}
}

// One frame on every skin, Codex's. WikiEditor takes the border off a textarea
// it wraps for a frame of its own to stand in, which Citizen does not draw: the
// field would show as blank space there, and as a frame within a frame
// elsewhere. The colours stay Codex's, hover and focus included.
.ext-sbu-text .cdx-text-area__textarea {
	border-width: @border-width-base;
	border-style: @border-style-base;
}

/* stylelint-disable selector-class-pattern -- WikiEditor's elements, not ours */
.ext-sbu-text .wikiEditor-ui .wikiEditor-ui-view {
	border: 0;
}

// With its frame gone, the toolbar is boxed in the field's own resting colour
// on three sides, and the field's top edge is the one line between them. No
// overflow: hidden for the corners, which would clip WikiEditor's menus.
.ext-sbu-text .wikiEditor-ui .wikiEditor-ui-top {
	border: @border-width-base @border-style-base @border-color-base;
	border-bottom: 0;
	border-radius: @border-radius-base @border-radius-base 0 0;
}

.ext-sbu-text .wikiEditor-ui .cdx-text-area__textarea {
	border-top-left-radius: 0;
	border-top-right-radius: 0;
}

// A group kept for tools a gadget may add, drawn as a second line against the
// box's right edge while it has none.
.ext-sbu-text .wikiEditor-ui-toolbar .group.empty {
	display: none;
}
/* stylelint-enable selector-class-pattern */

// Find and Replace with side by side where both fit at Codex's narrowest text
// input, one above the other where they do not: wrapping by the room the form
// has rather than by the viewport, which says nothing about the skin around it.
.ext-sbu-rename__pair {
	display: grid;
	grid-template-columns: repeat( auto-fit, minmax( @min-width-medium, 1fr ) );
	gap: @spacing-100;
}

// The grid spaces them instead of Codex's margin between fields, which would
// set the second one lower. One class deeper than .cdx-field:first-child.
.ext-sbu-rename .ext-sbu-rename__pair .cdx-field {
	margin-top: 0;
}

.ext-sbu-rename .cdx-checkbox {
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
// The lead icon only, not one in the button inside.
.ext-sbu-add--empty .ext-sbu-add__all > .cdx-icon {
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

// Compact, the same button is a slim line: the words, and at their end the icon
// that stands for Select files. Spaced alike on either side, since the panel
// takes the direction of the page's content and CSSJanus flips by the
// interface's.
.ext-sbu-panel--compact .ext-sbu-add--empty {
	min-height: 0;
}

.ext-sbu-panel--compact .ext-sbu-add--empty .ext-sbu-add__all {
	flex-direction: row;
	align-items: center;
	padding: @spacing-50;
	text-align: start;
}

.ext-sbu-panel--compact .ext-sbu-add--empty .ext-sbu-add__words {
	flex-grow: 1;
	margin: 0 @spacing-50;
}

// A line among the page's text, so at its size.
.ext-sbu-panel--compact .ext-sbu-add--empty .ext-sbu-item__title {
	font-size: inherit;
}

.ext-sbu-panel--compact .ext-sbu-add--empty .ext-sbu-add__select {
	flex-shrink: 0;
	margin-top: 0;
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
