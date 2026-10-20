import { $, esc, iconClassFor, MODE_PREFIX_MAP, wizLiveSteps, stepTransition, checkScope } from './02-core.js';
import { CAPTURE_KINDS, INCOME_TYPE_DEFS, IT3B_CODES, OPTION_NOTES, TFI_INVESTMENT_TYPES, PAGE_HEADS, PAGE_HELP, PARA45_PROCEEDS_LIMIT, SARS_WT_RATES, TOPIC_HELP, WT_SMALL_ITEM_LIMIT, randText, wtLife } from './01-data.js';

/* Returns option array [{value, label}] from a Level-1 entry's subtypes field. */
function subtypesOf(typeValue) {
  return (INCOME_TYPE_DEFS.find(d => d.value === typeValue)?.subtypes || [])
    .map(s => ({ value: s.value, label: s.label, showWhen: s.showWhen }));   // QR7.3: a foreign subtype carries its gate
}

/* ============================================================
   CONFIG-DRIVEN MODAL RENDERER
   All 10 bottom-sheet income modals are declared here as config
   objects and stamped into #modals-dynamic at DOMContentLoaded.
   This removes ~650 lines of static HTML from body.html and
   gives a single source of truth for field IDs, labels,
   placeholders, tips, and save handlers.

   Structure:
     renderField(f)    → one <div class="form-group"> string
     renderSection(s)  → optional section-label + g2 grid or rawHtml
     renderModal(cfg)  → complete .modal-overlay.modal-bottom string
     MODAL_CONFIGS     → array of 10 config objects
     mountModals()     → injects HTML into #modals-dynamic
   ============================================================ */

/* Minimal attribute escaper — only used for dynamic values;
   all config strings in this file are trusted literals. */
function _ea(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* C-3 (coverage-gap-analysis): optional currency-conversion widget, dropped
   in after a foreign-amount field via that field's postFieldHtml. Collapsed
   by default and purely a convenience input method — fxApply() (02-core.js)
   writes the converted Rand straight into targetFieldId and dispatches a
   real input event, so the field behaves exactly as if the user had typed
   the Rand amount themselves; nothing downstream of it changes.

   NOT built on .info-acc/<details> — that class was repurposed (H7,
   simplification programme) to open the shared static help sheet instead of
   expanding inline (details.info-acc > .body { display:none } in main.css,
   unconditionally), which would have swallowed these real inputs into a
   read-only popup. Uses the same plain toggle-a-u-hidden-class pattern as
   the Company Car module's cost rows (ccToggleCosts(), 05-list-modules.js)
   instead. _fxSeq gives every instance a unique id since MODAL_CONFIGS is
   built once at module load (deterministic, not per-render). */
/* B7.7 (IEM-1): this widget appears on every foreign-amount field regardless
   of whether the user ever said they have foreign income (pension, IT3(b),
   rental, business all carry one unconditionally) — a control most users
   never need, sitting in their way on every income form. `fx-widget-gated`
   marks the CFG-generated instances; each is gated by ITS OWN record's
   source field (rentalToggleType()/penToggleForeign()/bizToggleForeign(),
   via showFxWidgetFor(), 02-core.js) or, for IT3(b), simply by living inside
   a row that only reveals once its own chip is picked — never by the
   app-wide foreign-income profile flag, which used to gate every widget in
   a modal together regardless of what that specific record said. The two
   hand-written widgets on the Foreign Income page itself (body.html,
   b6-catchall) are NOT marked — that whole page is already
   foreign-income-scoped. */
let _fxSeq = 0;
/* S3 Batch 6 (C8): explicitId lets a caller reference this instance's
   hidden fields by a stable name (e.g. 'emp-fx-rate') instead of the
   auto-incremented counter, which shifts if MODAL_CONFIGS gains or loses
   an earlier fxWidgetHtml() call. Only the employment modal uses this so
   far; every other caller keeps the auto id, unaffected. */
function fxWidgetHtml(targetFieldId, explicitId) {
  const id = explicitId || ('fx' + (_fxSeq++));
  return `<div class="fx-widget fx-widget-gated" style="margin:4px 0 0">
    <button type="button" class="btn btn-ghost btn-xs" style="width:auto" onclick="document.getElementById('${id}-body').classList.toggle('u-hidden')">
      <i class="material-symbols-outlined msi-currency-exchange"></i> Enter in foreign currency instead?
    </button>
    <div id="${id}-body" class="u-hidden" style="margin-top:6px">
      <div class="note info fx-notice u-hidden" aria-live="polite"></div>
      <div class="g2">
        <div class="form-group"><label class="sfl">Currency</label>
          <select class="form-select" id="${id}-cur" onchange="fxApply('${targetFieldId}','${id}')">
            <option value="">— select —</option>
          </select>
        </div>
        <div class="form-group"><label class="sfl">Amount in that currency</label>
          <input type="text" inputmode="decimal" class="form-input mono" id="${id}-amt" placeholder="0" oninput="fxApply('${targetFieldId}','${id}')">
        </div>
      </div>
      <div id="${id}-result" class="note" style="margin-top:6px;display:none"></div>
      <input type="hidden" id="${id}-rate">
      <input type="hidden" id="${id}-source">
      <input type="hidden" id="${id}-date">
    </div>
  </div>`;
}

/* QR7.4 (Q-INV-2): the container for a profile-scenario note. Empty and
   hidden until applyScenarioGates() (02-core.js) fills it for a closed gate. */
function scnNoteHtml(gate) {
  return `<div class="note info scn-note u-hidden" data-scn-gate="${_ea(gate)}" aria-live="polite"></div>`;
}

/* UI-CAP-1 (owner 2026-10-05, capture option B; extends QR9b.3 / QR9b.4,
   QD-27 P3/P1) — the kind chooser: the FIRST SCREEN of a sheet that captures
   more than one kind of record ("What kind of rental is it?"). Picking a
   tile calls pickCaptureKind() (05-list-modules.js), which moves into the
   form — or, for a cross-sheet group, opens that kind's own sheet — and
   titles the sheet for the kind. renderModal() puts it first in the body;
   while the overlay carries data-kind-stage="pick" it is all the body shows,
   otherwise it is hidden (main.css). Data: CAPTURE_KINDS (01-data.js).

   BUTTONS, not radios, on purpose: picking a kind changes the screen, and a
   radio group fires `change` as the arrow keys move through it — a keyboard
   or screen-reader user would be thrown into a form on every keypress (WCAG
   3.2.2 On Input). A button acts only on Enter / Space / tap, and
   aria-pressed says which kind the record is. They wear the app's radio
   tile look (.yn-tile). The two-way 'choice' FIELD below stays a radio
   group: it changes a value, not the screen.

   For an in-sheet group the select's own options say which tiles are live
   (syncKindTiles, 05): a gated or retired value hides its tile. */
function kindSwitchHtml(group, own, scnGate) {
  const k = CAPTURE_KINDS[group];
  const lblId = 'ks-' + group + '-' + (own || 'in') + '-lbl';
  const tiles = k.options.filter(o => o.tile !== false).map(o =>
    `<button type="button" class="yn-tile kind-tile" data-kind="${o.value}" aria-pressed="false" onclick="pickCaptureKind('${group}','${o.value}')"><span class="yn-lbl">${o.title}${o.desc ? `<span class="kind-desc">${o.desc}</span>` : ''}</span><span class="yn-chk"><i class="material-symbols-outlined msi-check"></i></span></button>`
  ).join('');
  return `<div class="kind-switch" data-kind-group="${group}"${own ? ` data-kind-own="${own}"` : ''}>
    <h3 class="kind-q" id="${lblId}">${k.label}</h3>
    <div class="yn-group${k.layout === 'cards' ? ' col1' : ''}" role="group" aria-labelledby="${lblId}">${tiles}</div>${scnGate ? scnNoteHtml(scnGate) : ''}
  </div>`;
}
/* The select an in-sheet group writes, built from the group's own list
   (other receipts, IT3(b)); a value's profile gate rides on its option. */
function kindSelectOptions(group) {
  return CAPTURE_KINDS[group].options.map(o => ({ value: o.value, label: o.title, showWhen: o.showWhen }));
}

/* ── FIELD RENDERER ─────────────────────────────────────────── */
function renderField(f, hideLabelText) {
  /* rawHtml fields bypass the wrapper entirely (e.g. result divs,
     cross-span elements like or-capital-fields). */
  if (f.rawHtml) return f.rawHtml;

  const rowId   = f.rowId   ? ` id="${f.rowId}"`    : '';
  const display = f.hidden  ? ' style="display:none"' : '';
  /* QR7.3: a profile-scenario gate (applyScenarioGates, 02-core.js) and the
     value the field submits while its gate keeps it hidden. */
  const gate    = f.showWhen ? ` data-show-when="${_ea(f.showWhen)}"` : '';
  const hidVal  = f.hiddenValue != null ? ` data-hidden-value="${_ea(f.hiddenValue)}"` : '';
  const fullCls = f.full    ? ' full'                 : '';

  /* Label — text node first so JS like
     bondLabel.childNodes[0].textContent = '...' works correctly.
     QR2.4 exception: `hideLabelText` (renderStep, when a step's title
     duplicates this field's label) wraps the base text in `.sr-only`
     instead — still readable to a screen reader, but no longer
     childNodes[0]'s own text node. Nothing in this file relies on that for
     a field renderStep would ever mark this way (checked before adding). */
  let lbl = hideLabelText ? `<span class="sr-only">${f.label || ''}</span>` : (f.label || '');
  /* QA 2026-08 (B1-20): mark what is OPTIONAL, not what is required.
     A bare "*" needs a legend to decode, and these forms never carried one —
     so the marker told the user a field was special without saying how. Most
     fields on most of these modals are required anyway, which made the
     asterisk the visual default and left the genuinely skippable fields
     indistinguishable from the rest. Naming the short list instead is both
     shorter on screen and directly actionable.

     `f.optional: false` opts a field out of the marker — for one that is
     neither required nor meaningfully skippable (a field revealed only when
     it applies, where "(optional)" would be misleading). */
  /* QR9b.2 (QR5.5 R-1): a select whose options include no empty choice always
     holds a value — there is nothing to skip, so "(optional)" on it is noise
     (it was on nine: Type, Ownership, Asset type, Domestic/Foreign, Event
     Type, Business type, How did you hold it?, Donation type …). A select
     the caller fills at runtime (no options in the config) keeps the marker
     — the renderer cannot know what it will hold. */
  const alwaysHolds = (f.type === 'select' || f.type === 'choice') && (f.options || []).length > 0 && !f.options.some(o => o.value === '');
  /* UI-FS-1: the markers after the label text travel as one unbreakable
     unit (.lbl-tail), so in .sfl's inline flow the ⓘ wraps WITH
     "(optional)" rather than onto a line of its own (QR0.3 geometry
     check). The label text itself stays childNodes[0] (see above). */
  let tail = '';
  if (!f.required && f.label && f.optional !== false && !alwaysHolds) {
    tail += ' <span class="u-c-tx3" style="font-weight:normal;font-size:0.6875rem">(optional)</span>';
  }
  if (f.codeChip)  tail += ` <span class="code-chip">${f.codeChip}</span>`;
  if (f.labelNote) tail += ` <span class="u-c-tx3" style="font-weight:normal;font-size:0.6875rem">${f.labelNote}</span>`;
  if (f.tip)       tail += ` <span class="info-btn" data-tip="${_ea(f.tip)}"><i class="material-symbols-outlined msi-info"></i></span>`;
  if (tail) lbl += ' <span class="lbl-tail">' + tail.trim() + '</span>';

  const lblCls = f.full ? 'form-label' : 'sfl';
  const lblId  = f.labelId ? ` id="${f.labelId}"` : '';
  const forAttr = f.type === 'codepicker' ? ` for="${f.el}-q"` : '';
  /* A 'choice' is a radio group: it is named by aria-labelledby, not by a
     <label for> (which can name one control only). */
  const labelHtml = f.type === 'choice'
    ? `<div class="${lblCls}" id="${f.el}-lbl">${lbl}</div>`
    : `<label class="${lblCls}"${lblId}${forAttr}>${lbl}</label>`;

  const oninput  = f.oninput  ? ` oninput="${f.oninput}"`   : '';
  /* QR4.2 (QX-CPY-1): a select with `optionNotes` refreshes its note from its
     OWN change handler — the note update is prepended to whatever the field
     already runs, so there is still exactly one listener per select. */
  const noteSel = (f.type === 'select' || f.type === 'choice') && f.optionNotes;
  const onchange = (f.onchange || noteSel)
    ? ` onchange="${noteSel ? `optNoteUpdate('${f.el}')${f.onchange ? ';' : ''}` : ''}${f.onchange || ''}"`
    : '';
  const ph = _ea(f.placeholder || '');
  /* data-req marks a required field for the generic wizard per-step validator
     (wizNext). Harmless on non-wizard modals — only wizNext reads it. */
  /* required:'zero-ok' (BACKLOG 57): a number that must be entered but for
     which R 0 is a real answer — a business with no income yet. */
  const req = f.required ? (f.required === 'zero-ok' ? ' data-req="zero-ok"' : ' data-req="1"') : '';

  let inputHtml;
  switch (f.type) {
    case 'select': {
      const opts = (f.options || []).map(o =>
        `<option value="${_ea(o.value)}"${o.showWhen ? ` data-show-when="${_ea(o.showWhen)}"` : ''}>${o.label}</option>`
      ).join('');
      inputHtml = `<select class="form-select${f.cls ? ' '+f.cls : ''}" id="${f.el}"${onchange}${req}>${opts}</select>`;
      break;
    }
    case 'choice': {
      /* QR9b.4 (QD-27, pattern P1): a short either/or shown as radio tiles on
         the same screen as the fields it shapes, instead of a dropdown on a
         step of its own. A VIEW over a hidden native <select> that keeps the
         field's id, value and inline onchange — the yes/no tiles' own
         mechanism (ynPick / syncYn, 02-core.js) — so everything that reads
         or writes the field (gs, makeCrudModule's put, optionNotes) is
         unchanged. */
      const opts = (f.options || []).map(o => `<option value="${_ea(o.value)}">${o.label}</option>`).join('');
      const tiles = (f.options || []).map(o =>
        `<label class="yn-tile"><input type="radio" name="${f.el}-yn" value="${_ea(o.value)}" onchange="ynPick(this.parentNode,'${f.el}')"><span class="yn-lbl">${o.label}</span><span class="yn-chk"><i class="material-symbols-outlined msi-check"></i></span></label>`
      ).join('');
      inputHtml = `<div class="yn-group" role="radiogroup" aria-labelledby="${f.el}-lbl" data-yn-select="${f.el}">${tiles}</div>`
        + `<select id="${f.el}"${onchange}${req} hidden tabindex="-1" aria-hidden="true">${opts}</select>`;
      break;
    }
    case 'codepicker': {
      /* QR8 — see CODE PICKER above. The visible control is the combobox; the
         hidden <select> carries the field's id, options and value. Its inline
         onchange (f.onchange) fires when the picker chooses. */
      /* Options given in config with a `group` are rendered inside optgroups
         (the picker's category headers); otherwise the caller populates the
         store at runtime (populateSourceCodeSelects). */
      const opt = o => `<option value="${_ea(o.value)}"${o.name ? ` data-name="${_ea(o.name)}"` : ''}${o.title ? ` title="${_ea(o.title)}"` : ''}>${o.label}</option>`;
      const grouped = [];
      (f.options || []).forEach(o => {
        const g = grouped.find(x => x.g === (o.group || ''));
        if (g) g.items.push(o); else grouped.push({ g: o.group || '', items: [o] });
      });
      const opts = grouped.map(x => x.g
        ? `<optgroup label="${_ea(x.g)}">${x.items.map(opt).join('')}</optgroup>`
        : x.items.map(opt).join('')).join('');
      const openG = f.openGroups === 'all' ? 'all' : JSON.stringify(f.openGroups || []);
      inputHtml = `<div class="cp" data-open-groups="${_ea(openG)}" data-empty-note="${_ea(f.emptyNote || '')}" data-picked-note="${_ea(f.pickedNote || '')}">`
        + `<input type="text" class="form-input cp-q" id="${f.el}-q" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${f.el}-lb"`
        + ` placeholder="${ph}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">`
        + `<div class="cp-lb" id="${f.el}-lb" role="listbox" aria-label="${_ea(f.listLabel || f.label || 'Codes')}" hidden></div>`
        + `<p class="cp-live" aria-live="polite"></p><div class="cp-val" hidden></div>`
        + `<select class="cp-store" id="${f.el}"${onchange}${req} hidden tabindex="-1" aria-hidden="true">${opts}</select></div>`;
      break;
    }
    case 'date':
      inputHtml = `<input type="date" class="form-input${f.cls ? ' '+f.cls : ''}" id="${f.el}"${req}>`;
      break;
    case 'num': {
      const im    = f.inputmode || 'numeric';
      const msk   = f.pct ? 'mask-pct' : 'mask-rand';
      const minA  = f.min  != null ? ` min="${f.min}"`   : '';
      const maxA  = f.max  != null ? ` max="${f.max}"`   : '';
      const stepA = f.step != null ? ` step="${f.step}"` : '';
      const valA  = f.value != null ? ` value="${_ea(String(f.value))}"` : '';
      inputHtml = `<input type="text" inputmode="${im}" class="form-input mono ${msk}${f.cls ? ' '+f.cls : ''}" id="${f.el}" placeholder="${ph || '0'}"${minA}${maxA}${stepA}${valA}${oninput}${onchange}${req}>`;
      break;
    }
    default: /* text */
      inputHtml = `<input type="text" class="form-input${f.cls ? ' '+f.cls : ''}" id="${f.el}" placeholder="${ph}"${oninput}${onchange}${req}>`;
  }

  /* postFieldHtml: HTML injected after the input but inside the form-group
     (used for hint spans, nested info accordions, etc.). */
  const post = f.postFieldHtml || '';

  /* The note container carries its own option map (JSON in a data attribute)
     so optNoteUpdate()/refreshOptionNotes() (02-core.js) need no registry. */
  const optNote = noteSel
    ? `<div class="note info opt-note u-hidden" id="${f.el}-optnote" data-optnotes="${_ea(JSON.stringify(f.optionNotes))}" aria-live="polite"></div>`
    : '';

  /* QR7.4: the "You told us…" / mismatch note for the gate on one of this
     select's options (f.scnNote names the gate). Filled by applyScenarioGates. */
  const scn = f.scnNote ? scnNoteHtml(f.scnNote) : '';

  /* UI-CAP-0 (owner 2026-10-05, shared rule 3): a field whose answer
     belongs to the person, not the record — the ownership share, whose
     account it is — is not asked as a form question. The row shows the
     answer as one line with a one-tap switch (syncProfileChips, 02-core.js);
     the real input stays in the row, collapsed, so every reader (gs/gv,
     makeCrudModule's put, applyScenarioGates) is unchanged. */
  /* UI-CAP-1: the select a sheet's kind chooser writes (CAPTURE_KINDS
     `field`). The kind is picked on the chooser screen, so the select is
     not asked again — it stays here, hidden, for every reader — while its
     option note, scenario note and anything after it still follow the kind
     (shared rule 4: "fields and notes follow the type"). */
  if (f.kindField) {
    return `<div class="form-group${fullCls} kind-field"${rowId}${display}${gate}${hidVal}>`
      + `<div class="kind-field-input" hidden>${labelHtml}${inputHtml}</div>${optNote}${scn}${post}</div>`;
  }
  if (f.profileChip) {
    return `<div class="form-group${fullCls} pchip-row"${rowId}${display}${gate}${hidVal}>`
      + `<div class="pchip" data-pchip="${f.profileChip}" data-for="${f.el}"><span class="pchip-t" aria-live="polite"></span><span class="pchip-acts"></span></div>`
      + `<div class="pchip-edit" hidden>${labelHtml}${inputHtml}${optNote}${scn}${post}</div></div>`;
  }
  return `<div class="form-group${fullCls}"${rowId}${display}${gate}${hidVal}>${labelHtml}${inputHtml}${optNote}${scn}${post}</div>`;
}

/* ── SECTION RENDERER ───────────────────────────────────────── */
/* QR2.4 (Q-UIC-1): `hideLabelFor`, when given, names one field object (by
   reference) in this section whose visible label text renderStep wants
   suppressed — see renderStep below. Every other caller (every non-wizard
   `cfg.sections.map(renderSection)`, and every OTHER field in a wizard
   section) passes/receives nothing and renders exactly as before. */
function renderSection(s, hideLabelFor) {
  /* rawHtml section: inject as-is — complete control over markup */
  if (s.rawHtml) return s.rawHtml;
  /* UI-CAP-1: `wrapId` gives a section one box a kind can show, hide or
     move as a unit (the IT3(b) local and foreign halves, it3bApplyKind). */
  if (s.wrapId) return `<div id="${s.wrapId}">` + renderSection(Object.assign({}, s, { wrapId: null }), hideLabelFor) + '</div>';

  let html = s.preHtml || '';

  if (s.label) {
    const sid = s.labelId    ? ` id="${s.labelId}"`       : '';
    const sst = s.labelStyle ? ` style="${s.labelStyle}"` : '';
    html += `<div class="section-label"${sid}${sst}>${s.label}</div>`;
  }

  if (s.fields && s.fields.length) {
    html += `<div class="g2">${s.fields.map(f => renderField(f, f === hideLabelFor)).join('')}</div>`;
  }

  html += s.postHtml || '';
  return html;
}

/* ── STEP RENDERER (wizard mode) ────────────────────────────────
   A step groups one or more sections behind a stepper page. Only
   the active step is visible; hidden steps keep their inputs in the
   DOM (settable/collectable) so the save handler stays step-agnostic. */
function renderStep(step, i, total, cfg) {
  /* QR2.4 (Q-UIC-1, QR0.6(b)): a step whose title just repeats its first
     field's label would show that text twice — once in the wiz-steplabel
     bar above (kept; it's the step indicator, not a duplicate), once as
     the field's own visible label right below it. "First field" is the
     first field of the first section that HAS a `fields` array — same
     definition tools/check-static-form.js's own STATIC FORM (b) check
     uses, so the two can't disagree about what counts. Only that one
     field's visible label TEXT is suppressed (wrapped .sr-only, still
     readable to a screen reader) — its <label>, `for`, tip, codeChip and
     any labelNote are unchanged, so nothing about its accessible name or
     behaviour moves. */
  const firstFieldSection = (step.sections || []).find(s => s.fields && s.fields.length);
  const firstField = firstFieldSection && firstFieldSection.fields[0];
  const dupTitle = !!firstField
    && (step.title || '').trim().toLowerCase() === (firstField.label || '').trim().toLowerCase();
  let inner = (step.sections || [])
    .map(s => renderSection(s, dupTitle && s === firstFieldSection ? firstField : null))
    .join('');
  /* §H (07-surfaces-and-motion.md, entry-sheets): cfg.pinLiveCalc hoists the
     running outcome out of the steps entirely (rendered once, above them,
     by renderModal below) so it stays visible on every step instead of
     only appearing as a review on the last one. Everything else keeps the
     original "live-calc lives on the final step" behaviour. */
  /* QR7.3: data-wiz-live-final lets wizGoto() carry this box to the last
     LIVE step when a profile-scenario gate skips the step it was born in
     (IT3(b)'s Foreign step). Ungated, it never moves. */
  if (!cfg.pinLiveCalc && i === total - 1 && cfg.liveCalcId) inner += `<div id="${cfg.liveCalcId}" data-wiz-live-final></div>`;
  const gate = step.showWhen ? ` data-show-when="${_ea(step.showWhen)}"` : '';
  return `<div class="wiz-step${i === 0 ? ' active' : ''}" data-wiz-step="${i}" data-wiz-title="${_ea(step.title || '')}"${gate}>${inner}</div>`;
}

/* ── CODE PICKER (QR8: Q-COD-1/2, QX-COD-1) ─────────────────────
   One control for every SARS-code choice (`type:'codepicker'` in a form
   config): the WAI-ARIA combobox-with-listbox pattern, approved in the QR6a
   prototype. Typing filters across every category by code prefix or name
   words; categories collapse; `openGroups` names the ones open before the
   user types (income: the "Main Income Codes" group, QD-15).

   The picker is a VIEW over a hidden native <select> (`.cp-store`, the field's
   own id). That select stays the field's value and its option list — the
   caller still populates it, gates it (`data-show-when`, QR7 — a gated-off
   option is simply not listed here), reads it with gs() and writes it with
   put(), and its inline onchange fires when the picker chooses. Nothing that
   collects or saves the field changes; the DoB selector took the same
   approach with its hidden input. Whoever sets the select's value from code
   calls syncCodePicker() so the box shows it (makeCrudModule's put() does).

   Options carry `data-name` (the label without its code) and `title`; the
   optgroup label is the category. State is per-picker and transient: it is
   not persisted and not on APP. */
const _cpState = new WeakMap();   // .cp root -> { q, open, exp, act, flat }
function _cpSt(root) {
  let st = _cpState.get(root);
  if (!st) { st = { q: '', open: false, exp: {}, act: -1, flat: [] }; _cpState.set(root, st); }
  return st;
}
const _cpStore = root => root.querySelector('select.cp-store');
function _cpGroups(store) {
  const out = [];
  Array.from(store.children).forEach(g => {
    if (g.tagName !== 'OPTGROUP' || g.hidden) return;
    const items = Array.from(g.children).filter(o => !o.hidden).map(o => ({
      code: o.value, name: o.getAttribute('data-name') || o.textContent, title: o.getAttribute('title') || ''
    }));
    if (items.length) out.push({ label: g.label, items });
  });
  return out;
}
function _cpTokens(q) { return q.toLowerCase().split(/\s+/).filter(Boolean); }
function _cpMatch(it, tokens) {
  const nm = it.name.toLowerCase();
  return tokens.every(t => it.code.indexOf(t) === 0 || nm.indexOf(t) >= 0);
}
function _cpMark(text, tokens, prefixOnly) {
  for (const t of tokens) {
    const i = text.toLowerCase().indexOf(t);
    if (i >= 0 && (!prefixOnly || i === 0)) {
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + t.length)) + '</mark>' + esc(text.slice(i + t.length));
    }
  }
  return esc(text);
}
function _cpOpenGroups(root) {
  const raw = root.getAttribute('data-open-groups') || '[]';
  if (raw === 'all') return 'all';
  try { return JSON.parse(raw); } catch (e) { return []; }
}
function _cpRender(root) {
  const st = _cpSt(root), store = _cpStore(root);
  if (!store) return;
  const inp = root.querySelector('.cp-q'), lb = root.querySelector('.cp-lb');
  const live = root.querySelector('.cp-live'), val = root.querySelector('.cp-val');
  const tokens = _cpTokens(st.q), openCfg = _cpOpenGroups(root);
  const flat = [];
  let html = '', total = 0;
  _cpGroups(store).forEach((g, gi) => {
    const items = tokens.length ? g.items.filter(it => _cpMatch(it, tokens)) : g.items;
    if (!items.length) return;
    total += items.length;
    const open = tokens.length ? true
      : Object.prototype.hasOwnProperty.call(st.exp, g.label) ? st.exp[g.label]
      : (openCfg === 'all' || openCfg.indexOf(g.label) >= 0);
    const gid = store.id + '-g' + gi;
    /* While filtering every matching group is open, so arrow keys go straight
       to the options; headers are only keyboard stops when browsing. */
    if (!tokens.length) flat.push({ kind: 'g', id: gid, label: g.label, open });
    html += '<div role="group" aria-labelledby="' + gid + '">'
      + '<button type="button" class="cp-gh" id="' + gid + '" tabindex="-1" aria-expanded="' + open + '" data-g="' + _ea(g.label) + '">'
      + '<span class="cp-cv" aria-hidden="true">' + (open ? '▾' : '▸') + '</span>'
      + '<span class="cp-gn">' + esc(g.label) + '</span>'
      + '<span class="cp-n">' + (tokens.length ? items.length + ' found' : g.items.length + ' codes') + '</span></button>';
    if (open) items.forEach(it => {
      const oid = store.id + '-o' + it.code;
      flat.push({ kind: 'o', id: oid, code: it.code });
      html += '<div class="cp-opt" role="option" id="' + oid + '" data-c="' + _ea(it.code) + '"'
        + ' aria-selected="' + (store.value === it.code) + '"' + (it.title ? ' title="' + _ea(it.title) + '"' : '') + '>'
        + '<span class="cp-c">' + _cpMark(it.code, tokens, true) + '</span>'
        + '<span class="cp-t">' + _cpMark(it.name, tokens, false) + '</span></div>';
    });
    html += '</div>';
  });
  if (!total) {
    html = '<div class="cp-empty" role="note"><strong>No codes found for “' + esc(st.q) + '”.</strong> '
      + esc(root.getAttribute('data-empty-note') || '') + '</div>';
  }
  st.flat = flat;
  if (st.act >= flat.length) st.act = flat.length - 1;
  lb.innerHTML = html;
  lb.hidden = !st.open;
  inp.setAttribute('aria-expanded', String(st.open));
  const act = st.open && st.act >= 0 ? flat[st.act] : null;
  if (act) {
    inp.setAttribute('aria-activedescendant', act.id);
    const el = document.getElementById(act.id);
    if (el) {
      el.classList.add('act');
      if (el.offsetTop < lb.scrollTop) lb.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > lb.scrollTop + lb.clientHeight) lb.scrollTop = el.offsetTop + el.offsetHeight - lb.clientHeight;
    }
  } else inp.removeAttribute('aria-activedescendant');
  live.textContent = st.open && tokens.length
    ? (total ? total + ' code' + (total === 1 ? '' : 's') + ' found' : 'No codes found') : '';
  const chosen = store.value ? Array.from(store.options).find(o => o.value === store.value) : null;
  if (chosen) {
    val.textContent = '✓ ' + chosen.value + ' — ' + (chosen.getAttribute('data-name') || chosen.textContent)
      + (root.getAttribute('data-picked-note') ? ' · ' + root.getAttribute('data-picked-note') : '');
    val.hidden = false;
  } else val.hidden = true;
}
/* Show whatever the store <select> now holds. Safe to call on any element —
   a no-op unless it is a picker's store. */
export function syncCodePicker(store) {
  const root = store && store.closest && store.closest('.cp');
  if (!root || store !== _cpStore(root)) return;
  const st = _cpSt(root);
  st.q = ''; st.open = false; st.act = -1;
  root.querySelector('.cp-q').value = store.value || '';
  _cpRender(root);
}
function _cpChoose(root, code) {
  const store = _cpStore(root);
  const changed = store.value !== code;
  store.value = code;
  syncCodePicker(store);
  if (changed) store.dispatchEvent(new Event('change', { bubbles: true }));   // runs the field's own onchange
}
/* Leaving the box: a typed code that exists is taken (Q-COD-1), an emptied
   box clears the choice, anything else is put back to what is chosen. */
function _cpCommit(root) {
  const store = _cpStore(root), inp = root.querySelector('.cp-q');
  const typed = inp.value.trim();
  if (typed === '') { if (store.value) { _cpChoose(root, ''); return; } }
  else if (typed !== store.value) {
    const hit = [].concat(..._cpGroups(store).map(g => g.items)).find(it => it.code === typed);
    if (hit) { _cpChoose(root, hit.code); return; }
  }
  syncCodePicker(store);
}
function _cpToggle(root, label, force) {
  const st = _cpSt(root), g = st.flat.find(x => x.kind === 'g' && x.label === label);
  if (!g) return;
  st.exp[label] = force == null ? !g.open : force;
  _cpRender(root);
}
function _cpKeydown(root, e) {
  const st = _cpSt(root), f = st.flat, cur = st.act >= 0 ? f[st.act] : null;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  switch (e.key) {
    case 'ArrowDown': stop(); st.open = true; st.act = Math.min(f.length - 1, st.act + 1); _cpRender(root); break;
    case 'ArrowUp':   stop(); st.open = true; st.act = Math.max(0, st.act - 1); _cpRender(root); break;
    case 'Home': if (st.open && cur) { stop(); st.act = 0; _cpRender(root); } break;
    case 'End':  if (st.open && cur) { stop(); st.act = f.length - 1; _cpRender(root); } break;
    case 'ArrowRight': if (st.open && cur && cur.kind === 'g' && !cur.open) { stop(); _cpToggle(root, cur.label, true); } break;
    case 'ArrowLeft':  if (st.open && cur && cur.kind === 'g' && cur.open)  { stop(); _cpToggle(root, cur.label, false); } break;
    case 'Enter': {
      /* Consumed only while it means something to the picker; otherwise the
         modal's own Enter-to-save (_modalTrapKeydown) still sees it. */
      if (st.open && cur) {
        stop();
        if (cur.kind === 'g') _cpToggle(root, cur.label); else _cpChoose(root, cur.code);
      } else if (st.open || root.querySelector('.cp-q').value.trim() !== _cpStore(root).value) {
        stop(); _cpCommit(root);
      }
      break;
    }
    case 'Escape':
      if (st.open) { stop(); st.open = false; st.act = -1; _cpRender(root); }   // closes the list, not the modal
      break;
  }
}
let _cpMounted = false;
/* One delegated listener set for every picker, wherever its modal is built.
   Keydown is captured so Enter/Escape that the picker consumes never reach
   the modal's own handlers (Enter-to-save, Escape-to-close). */
export function mountCodePickers() {
  if (_cpMounted) return;
  _cpMounted = true;
  const rootOf = t => (t && t.closest) ? t.closest('.cp') : null;
  document.addEventListener('keydown', e => {
    if (!e.target.classList || !e.target.classList.contains('cp-q')) return;
    _cpKeydown(rootOf(e.target), e);
  }, true);
  document.addEventListener('input', e => {
    if (!e.target.classList || !e.target.classList.contains('cp-q')) return;
    const root = rootOf(e.target), st = _cpSt(root);
    st.q = e.target.value.trim(); st.open = true; st.act = -1;
    _cpRender(root);
  });
  /* Opening is by tap, typing or ↓ — not on focus: openModal() focuses the
     first field, and a list springing open (and a keyboard with it) on every
     modal open would push the amount out of sight. */
  document.addEventListener('click', e => {
    const root = rootOf(e.target); if (!root) return;
    const st = _cpSt(root);
    if (e.target.classList.contains('cp-q')) {
      if (!st.open) { st.open = true; st.q = ''; _cpRender(root); }
      return;
    }
    const gh = e.target.closest('.cp-gh');
    if (gh) { _cpToggle(root, gh.getAttribute('data-g')); return; }
    const opt = e.target.closest('.cp-opt');
    if (opt) { _cpChoose(root, opt.getAttribute('data-c')); root.querySelector('.cp-q').blur(); }
  });
  document.addEventListener('focusin', e => {
    if (e.target.classList && e.target.classList.contains('cp-q')) e.target.select();
  });
  /* Keep focus in the box while the list is touched, so picking a row is not
     preceded by a blur that would close and re-render the list under the tap. */
  document.addEventListener('mousedown', e => {
    if (e.target.closest && e.target.closest('.cp-lb')) e.preventDefault();
  });
  document.addEventListener('focusout', e => {
    if (e.target.classList && e.target.classList.contains('cp-q')) _cpCommit(rootOf(e.target));
  });
}

/* ── PROGRESSIVE-DISCLOSURE CHIPS ───────────────────────────────
   A field can be born hidden (f.hidden + f.rowId) with a matching
   "+ Label" chip (the deduction modal's "I know the code from my IRP5").
   Tapping the chip reveals the row, hides the chip, and focuses the input —
   keeps the common-case form short while rare fields stay one tap away. */
export function revealField(rowId, chipId) {
  const row = document.getElementById(rowId);
  if (row) row.style.display = '';
  const chip = document.getElementById(chipId);
  if (chip) chip.style.display = 'none';
  const input = row ? row.querySelector('input, select') : null;
  if (input) input.focus();
}
/* Hides a revealed row and re-shows its chip — used to reset progressive-
   disclosure forms (e.g. IT3(b)) back to all-collapsed after Add/Save. */
export function hideField(rowId, chipId) {
  const row = document.getElementById(rowId);
  if (row) row.style.display = 'none';
  const chip = document.getElementById(chipId);
  if (chip) chip.style.display = '';
}
/* QR9a (Q-INV-1, QX-COD-1): an IT3(b) step's "Add an amount" picker — the
   code picker over that step's IT3B_CODES lines (01-data.js). Choosing a
   line reveals its amount row (it3bAddLine, 05-list-modules.js); lines
   already on the form are not offered again (it3bSyncLines). Replaces the
   chip row that used to sit here — the app's only chip-disclosure pattern. */
function it3bLinePicker(el, foreign) {
  return { el, type:'codepicker', label:'Add an amount', full:true, optional:false, rowId: el + '-row',
    placeholder:'Code or word, e.g. 4201 or interest', openGroups:'all',
    listLabel: foreign ? 'Foreign amount lines on an IT3(b)' : 'Local amount lines on an IT3(b)',
    emptyNote:'Use the code printed next to the amount on your certificate.',
    onchange:'it3bAddLine(this)',
    options: IT3B_CODES.filter(c => c.foreign === foreign).map(c =>
      ({ value: c.code, label: c.code + ' \u2014 ' + c.name, name: c.name, group: c.group })) };
}

/* ── MODAL RENDERER ─────────────────────────────────────────── */
function renderModal(cfg) {
  const id    = cfg.id;
  /* No inline colour: the header glyph takes the CATEGORY colour of the area
     the modal was opened from, via --area-accent (openModal stamps data-area
     on the overlay). The configs used to hardcode a per-modal --ico-* here,
     which is why an income modal opened from Deductions still showed green. */
  const sv    = cfg.footer.save;
  const ico   = sv.icon ? `<i class="${iconClassFor(sv.icon)}"></i> ` : '<i class="material-symbols-outlined msi-check"></i> ';

  const wiz = Array.isArray(cfg.steps) && cfg.steps.length > 1;
  let body, footer;
  /* UI-CAP-1: a sheet with a kind chooser opens on it (cfg.kinds = { group,
     own } — `own` for a cross-sheet group only). */
  /* The kind select's scenario note (QR7.4, "You told us you have no
     foreign rental income…") is shown under the tiles, where the missing
     tile is noticed; on the form it shows only as the mismatch note on a
     saved foreign record (main.css, .scn-kept). */
  const kindField = cfg.kinds && [].concat(...(cfg.steps || [cfg]).map(st => (st.sections || [])))
    .reduce((a, sec) => a.concat(sec.fields || []), []).find(f => f.kindField);
  const kindHtml = cfg.kinds ? kindSwitchHtml(cfg.kinds.group, cfg.kinds.own, kindField && kindField.scnNote) : '';
  const kindChange = cfg.kinds
    ? `<button type="button" class="kind-change" id="${id}-kind-change" onclick="changeCaptureKind('${id}')" aria-describedby="${cfg.titleId}" hidden>Change</button>`
    : '';

  if (wiz) {
    const total = cfg.steps.length;
    /* UI-CAP-1 (shared rule 5 — one step header): "Step n of N" and the
       step's name on ONE line, above a bar with one segment per step. The
       counter never wraps; wizGoto() rebuilds the segments for the live
       step count and hides the header when one step is left. */
    const segs = cfg.steps.map((s, i) => `<i class="wiz-seg${i === 0 ? ' on' : ''}"></i>`).join('');
    const head = `<div class="wiz-head" id="${id}-wiz-head">
        <div class="wiz-steplabel" aria-live="polite"><span class="wiz-text" id="${id}-wiz-text">Step 1 of ${total}</span><span class="wiz-title" id="${id}-wiz-title">${_ea(cfg.steps[0].title || '')}</span></div>
        <div class="wiz-progress" id="${id}-wiz-bar" role="progressbar" aria-label="Progress" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="1">${segs}</div>
      </div>`;
    body =
      kindHtml +
      (cfg.preBodyHtml || '') +
      head +
      (cfg.pinLiveCalc && cfg.liveCalcId ? `<div class="wiz-live-pin" id="${cfg.liveCalcId}"></div>` : '') +
      cfg.steps.map((s, i) => renderStep(s, i, total, cfg)).join('');
    /* §A (07-surfaces-and-motion.md, screen-standards — sheet): "two 44px
       pills" — .btn is already a 44px pill (var(--r-pill), min-height:
       44px); dropping btn-sm (36px) here is the whole change. Every
       renderModal()-generated modal is a .modal-sheet (the CFG_* CRUD
       forms) — .modal-box dialogs (confirm, plaintext-export) are a
       different, untouched pattern. */
    footer = `<div class="modal-footer wiz-nav">
        <button class="btn btn-ghost" id="${id}-wiz-back" onclick="wizBack('${id}')" style="display:none">Back</button>
        <div class="modal-footer-right">
          <button class="btn btn-primary" id="${id}-wiz-next" onclick="wizNext('${id}')">Next <i class="material-symbols-outlined msi-arrow-forward"></i></button>
          <button class="btn btn-primary" id="${id}-wiz-save" onclick="${sv.onclick}" style="display:none">${ico}${sv.label}</button>
        </div>
      </div>`;
  } else {
    body =
      kindHtml +
      (cfg.preBodyHtml || '') +
      (cfg.sections || []).map(renderSection).join('') +
      (cfg.liveCalcId ? `<div id="${cfg.liveCalcId}"></div>` : '');
    footer = sv.fab
      ? `<div class="modal-footer" style="padding:12px 0 0;display:block">
          <button class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem;border-radius:12px" onclick="${sv.onclick}">${ico}${sv.label}</button>
        </div>`
      : `<div class="modal-footer">
          <div></div>
          <div class="modal-footer-right">
            <button class="btn btn-ghost" onclick="closeModal('${id}')">Cancel</button>
            <button class="btn btn-primary" onclick="${sv.onclick}">${ico}${sv.label}</button>
          </div>
        </div>`;
  }

  /* QR9b.2 (QR5.7 R-12): in a wizard the explainer accordions sit under step 1
     only — wizGoto() hides this wrapper on every later step. They used to
     repeat under every step of IT3(b), rental, business, CGT and the rest. */
  const noteList = (cfg.notes || []).map(n =>
    `<details class="info-acc" style="margin-top:12px">
      <summary>${n.summary} <span class="chev">▾</span></summary>
      <div class="body">${n.body}</div>
    </details>`
  ).join('');
  const notes = wiz && noteList ? `<div class="wiz-notes" id="${id}-wiz-notes">${noteList}</div>` : noteList;

  return `
<div class="modal-overlay modal-bottom" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${cfg.titleId}">
  <div class="modal-sheet">
    <div class="modal-grab"></div>
    <div class="modal-hdr">
      <i class="${iconClassFor(cfg.icon)}"></i>
      <span class="modal-title" id="${cfg.titleId}">${cfg.title}</span>${kindChange}
      <button class="modal-close" onclick="closeModal('${id}')">✕</button>
    </div>
    <div class="modal-body">
${body}
${footer}
${notes}
    </div>
  </div>
</div>`;
}

/* ══════════════════════════════════════════════════════════════
   WIZARD NAVIGATION — generic, DOM-driven stepper for modals that
   declare cfg.steps. No per-record JS: state lives on the modal
   element (data-wiz-cur); buttons call these by modal id. The save
   handler stays step-agnostic, so list-CRUD + tests are unaffected.
   ══════════════════════════════════════════════════════════════ */
export function wizGoto(modalId, n) {
  const m = $(modalId); if (!m) return;
  /* QR7.3: only the live steps — a step closed by a profile-scenario gate
     (data-gated-off) is skipped and not counted. With no gate closed this
     is every .wiz-step, exactly as before. */
  const steps = wizLiveSteps(m);
  const total = steps.length; if (!total) return;
  n = Math.max(0, Math.min(total - 1, n));
  /* QR11: the step being left and where it sits, read before the switch. */
  const _from = m.querySelector('.wiz-step.active');
  const _fromBox = (_from && _from !== steps[n] && m.classList.contains('open')) ? { top: _from.offsetTop, left: _from.offsetLeft, width: _from.offsetWidth } : null;
  m.querySelectorAll('.wiz-step').forEach(s => s.classList.toggle('active', s === steps[n]));
  if (_fromBox) stepTransition(m, _from, _fromBox, steps[n]);
  const lc = m.querySelector('[data-wiz-live-final]');
  if (lc && lc.parentElement !== steps[total - 1]) steps[total - 1].appendChild(lc);
  const txt  = $(modalId + '-wiz-text');  if (txt)  txt.textContent = `Step ${n + 1} of ${total}`;
  const ttl  = $(modalId + '-wiz-title'); if (ttl)  ttl.textContent = steps[n].dataset.wizTitle || '';
  const bar  = $(modalId + '-wiz-bar');
  if (bar) {
    bar.setAttribute('aria-valuenow', String(n + 1)); bar.setAttribute('aria-valuemax', String(total));
    bar.innerHTML = steps.map((s, i) => '<i class="wiz-seg' + (i <= n ? ' on' : '') + '"></i>').join('');
  }
  /* UI-CAP-1: a kind can leave one live step (an IT3(b) with no foreign
     half) — then there is no "Step 1 of 1" to show. */
  const head = $(modalId + '-wiz-head'); if (head) head.hidden = total < 2;
  const back = $(modalId + '-wiz-back'); if (back) back.style.display = n === 0 ? 'none' : '';
  const next = $(modalId + '-wiz-next'); if (next) next.style.display = n === total - 1 ? 'none' : '';
  const save = $(modalId + '-wiz-save'); if (save) save.style.display = n === total - 1 ? '' : 'none';
  const nts  = $(modalId + '-wiz-notes'); if (nts) nts.classList.toggle('u-hidden', n !== 0);   // QR9b.2 (R-12)
  m.setAttribute('data-wiz-cur', String(n));
  const mb = m.querySelector('.modal-body'); if (mb) mb.scrollTop = 0;
  let ff = steps[n].querySelector('input,select,textarea');
  /* A radio group is entered at its ticked option (QR9b.4: a 'choice' field). */
  if (ff && ff.type === 'radio') ff = steps[n].querySelector('input[type="radio"][name="' + ff.name + '"]:checked') || ff;
  if (ff) { try { ff.focus({ preventScroll: true }); } catch (e) {} }
}
/* Advance one step, blocking while the current step has a field error
   (on-blur validation, BACKLOG 36: required, impossible values, blocking
   plausibility rules — shown inline under each field, focus on the first). */
export function wizNext(modalId) {
  const m = $(modalId); if (!m) return;
  const cur = parseInt(m.getAttribute('data-wiz-cur') || '0', 10);
  const active = wizLiveSteps(m)[cur];   // QR7.3: data-wiz-cur indexes the live steps
  if (active && checkScope(active, { includeEmpty: true })) return;
  wizGoto(modalId, cur + 1);
}
export function wizBack(modalId) {
  const m = $(modalId); if (!m) return;
  wizGoto(modalId, parseInt(m.getAttribute('data-wiz-cur') || '0', 10) - 1);
}
/* Reset to step 1 — called by the CRUD factory on every add()/edit() open.
   No-op for non-wizard modals (no .wiz-step elements). */
export function wizReset(modalId) { wizGoto(modalId, 0); }

/* ══════════════════════════════════════════════════════════════
   MODAL CONFIGS — one per bottom-sheet modal (10 total)
   ══════════════════════════════════════════════════════════════ */

/* ─── IRP5 / IT3(a) ─────────────────────────────────────────── */
const CFG_IRP5 = {
  id: 'modal-irp5', titleId: 'irp5-modal-title', title: 'IRP5 / IT3(a) Income',
  /* QA 2026-09: income modals get the Income category's colour (emerald),
     matching the ICON-22 status/identity split on the Income selector rows
     (03-income.js) — PAYE is the one deliberate exception there, kept blue
     as "its own category", and kept here for the same reason. */
  icon: 'description',
  sections: [{
    fields: [
      /* S3 Batch 13 (D5): Source Code and Amount are both required by
         validate() below but neither carried `required:true`, so
         renderField()'s automatic "(optional)" marker (00-forms.js) — which
         fires for any field that ISN'T marked required — wrongly appended
         "(optional)" to both. Marking them required fixes that and matches
         what save already enforces. */
      /* QR8: the code picker (Q-COD-1/2). Type a code or a word; the "Main
         Income Codes" group (QD-15) is open first, the rest collapsed. */
      { el:'add-income-code', type:'codepicker', label:'Source Code', full:true, required:true,
        tip:'Type the IRP5/IT3(a) SARS source code, or a word such as salary or travel. The income category is set automatically.',
        placeholder:'e.g. 3601 or salary', openGroups:['Main Income Codes'],
        pickedNote:'sets the category and document automatically',
        emptyNote:'Try the code from the Income Sources block of your IRP5, or a word such as salary or travel.',
        onchange:'onIncomeCodeChange()', options:[] /* populated at runtime by populateSourceCodeSelects() */,
        /* QR7.4: says why the Foreign Service codes are missing when the
           profile rules out working abroad (populateIncomeCodes gates them). */
        scnNote:'foreign:employment' },
      /* S3 Batch 13 (D5): labelNote removed — Note has no `required:true`,
         so the automatic marker already appends "(optional)" once; the
         explicit labelNote duplicated it, rendering "Note (optional)
         (optional)". */
      { el:'add-income-desc', type:'text', label:'Note', placeholder:'e.g. Main employer' },
      { el:'add-income-amount', type:'num', label:'Amount (annual, R)', required:true,
        tip:'Annual total as shown on your IRP5 or IT3(a) certificate.',
        /* S3 Batch 6 (C8): foreign-employment codes (3651/3655/3656) can be
           paid in a foreign currency — gated to those codes only by
           onIncomeCodeChange() (03-income.js), the existing exchange-rate
           widget (fxWidgetHtml/fxApply, same one pension/rental/business/
           IT3(b) already use) rather than a new one. */
        postFieldHtml: fxWidgetHtml('add-income-amount', 'emp-fx') },
      { rawHtml: '<div class="form-group full"><div id="income-code-tip"></div></div>' }
    ]
  }],
  footer: { save: { label: 'Save Income', icon: 'add', onclick: 'saveIncomeItem()', fab: true } },
  /* STD-IA-3: shared with the page-level "About IRP5 & IT3(a)" accordion —
     see TOPIC_HELP.irp5 (01-data.js) for the merge history (incl. the
     OD-24/6.7 IT3(a) correction this text used to carry inline). */
  notes: [TOPIC_HELP.irp5]
};

/* ─── PAYE & UIF ────────────────────────────────────────────── */
const CFG_PAYE = {
  id: 'modal-paye', titleId: 'paye-modal-title', title: 'PAYE &amp; UIF Withheld',
  icon: 'account_balance',
  sections: [{
    fields: [
      /* QR9b.2 (QR5.7 R-16): no automatic "(optional)" — the save needs a name
         OR a PAYE amount (M_paye.validate), so calling the name optional
         while PAYE is blank was untrue. Left blank with an amount, the row
         is listed as "Employer". */
      { el:'add-emp-name', type:'text', label:'Employer Name', full:true, optional:false, placeholder:'e.g. Acme (Pty) Ltd' },
      /* S3 Batch 13 (D5): neither field carried `required:true`, so
         renderField()'s automatic "(optional)" marker fired for both —
         wrong for PAYE Withheld (the modal's whole point; opted out via
         `optional:false`, the escape hatch renderField's own comment
         documents for a field that is neither required nor meaningfully
         skippable) and duplicated on UIF Withheld, which already had its
         own explicit "(Annual, optional)" labelNote saying the same word
         twice ("UIF Withheld (optional) (Annual, optional)"). */
      { el:'add-emp-paye', type:'num', label:'PAYE Withheld (Annual)', optional:false,
        oninput:'payePlausibilityCheck()',
        postFieldHtml:'<div id="paye-plausibility" aria-live="polite"></div>',
        tip:'The total employees’ tax this employer deducted from your pay over the year — shown on your IRP5, code 4102. This reduces the balance you still owe SARS; it is not extra income.' },
      { el:'add-emp-uif',  type:'num', label:'UIF Withheld', labelNote:'(Annual)',
        tip:'Unemployment Insurance Fund contributions withheld by this employer. For your records only — UIF does not affect your income tax calculation.' }
    ]
  }],
  footer: { save: { label: '+ Add PAYE / UIF', onclick: 'saveEmployerPaye()', fab: true } },
  /* STD-IA-3: shared with the page-level "About PAYE & UIF" accordion. */
  notes: [TOPIC_HELP.paye]
};

/* ─── PENSION / ANNUITY — one screen (UI-CAP-1, shared rule 2: its five
   inputs no longer justify two steps). Opens on the retirement chooser. ── */
const CFG_PENSION = {
  id: 'modal-pension-annuity', titleId: 'pen-modal-title', title: 'Pension / Annuity',
  icon: 'savings',
  kinds: { group: 'retirement', own: 'pension' },
  sections: [{
      fields: [
        { el:'pen-source', type:'text', label:'Fund / Source Name', full:true, required:true,
          placeholder:'e.g. Old Mutual RAF, GEPF, Liberty' },
        { el:'pen-code', type:'select', label:'Type of pension / annuity', required:true, onchange:'penToggleCodeNote()',
          tip:'The SARS source code for how you receive this income — sets which figure to use from your IT3(a) and how it is reported.',
          options:[
          { value:'', label:'Select the type…' },
          { value:'3610', label:'Living annuity from a retirement annuity fund (code 3610)' },
          { value:'3603', label:'Pension from a pension fund (code 3603)' },
          { value:'3618', label:'Annuity from a provident / provident preservation fund (code 3618)' },
          { value:'3611', label:'An annuity you bought yourself, not from a retirement fund (purchased annuity, code 3611)' }
        ]},
        { el:'pen-code-note', type:'text', rawHtml:'<div class="form-group full" id="pen-code-3611-note" style="display:none"><div class="note info note-line"><i class="material-symbols-outlined msi-info" aria-hidden="true"></i><span class="note-t">Enter only the taxable portion from your IT3(a).</span><button type="button" class="note-more" data-tip-long data-tip="&lt;strong&gt;Purchased annuity&lt;/strong&gt;Only enter the &lt;strong&gt;taxable portion&lt;/strong&gt; shown on your IT3(a) — a purchased annuity’s capital element (the return of your own money) is excluded before that certificate is issued. If you are not sure which figure is the taxable portion, use the amount from the IT3(a), not your own estimate." onclick="showInfoTip(this)">More</button></div></div>' },
        /* QR9b (WR-1 sweep of RENT-11 / R-16): optional:false on the sheet's own
           amount — M_pension.validate refuses a save without it, so "(optional)"
           was untrue. Same on the lump-sum and two-pot sheets below. */
        { el:'pen-amount',  type:'num', label:'Annual Amount (R)', required:true,
          tip:'Total pension/annuity income for the year, as shown on your IT3(a). Fully taxable as ordinary income at your marginal rate.',
          postFieldHtml: fxWidgetHtml('pen-amount') },
        /* UI-CAP-1: the whole question is asked only when the profile allows
           a foreign pension (QR7.3); hidden, it submits Domestic. A saved
           foreign pension keeps it, with the mismatch note. */
        { el:'pen-foreign', type:'select', label:'Domestic / Foreign', onchange:'penToggleForeign()',
          tip:'A foreign pension is still taxed here if you live in South Africa. Any tax already deducted abroad can reduce what you owe here — enter it on the next field.',
          options:[{ value:'no', label:'Domestic (SA)' },{ value:'yes', label:'Foreign', showWhen:'foreign:pension' }], scnNote:'foreign:pension',
          showWhen:'foreign:pension', hiddenValue:'no' },
        { el:'pen-source-country', type:'text', label:'Source Country',
          rowId:'pen-country-row', hidden:true, placeholder:'e.g. United Kingdom' },
        { el:'pen-foreign-tax', type:'num', label:'Foreign tax withheld (annual, R)',
          tip:'Tax already deducted abroad on this pension or annuity. We use it to reduce what you owe here on the same income.',
          rowId:'pen-foreigntax-row', hidden:true,
          postFieldHtml: fxWidgetHtml('pen-foreign-tax') }
      ]
  }],
  footer: { save: { label: 'Save Pension / Annuity', onclick: 'savePensionAnnuity()' } },
  notes: [{
    summary: 'ⓘ About pension &amp; annuity income',
    body: 'Pension and annuity income is fully taxable as ordinary income — added to your total taxable income for the year.'
  }]
};

/* ─── RETIREMENT LUMP SUM — one screen (UI-CAP-1): the event type is the
   sheet's chooser ("Why was it paid?"), leaving fund, amount, date and tax
   withheld. Reached from the retirement chooser's "A lump sum". ─────── */
const CFG_LUMPSUM = {
  id: 'modal-retirement-lumpsum', titleId: 'ls-modal-title', title: 'Retirement Lump Sum',
  icon: 'paid',
  kinds: { group: 'lumpsum' },
  sections: [{
      fields: [
        { el:'ls-fund', type:'text', label:'Fund Name', full:true, required:true,
          placeholder:'e.g. Old Mutual Pension Fund' },
        /* The kind select (CAPTURE_KINDS.lumpsum). coverage-gap C-13 added
           Transfer and Divorce order — a transfer looked exactly like a
           taxable lump sum on the IT3(a) with nothing to say otherwise, and
           a divorce-order amount received by the non-member spouse had no
           home at all. */
        { el:'ls-event-type', type:'select', label:'Event Type', kindField:true,
          options: kindSelectOptions('lumpsum') },
        { el:'ls-amount', type:'num', label:'Gross Lump Sum (R)', required:true,
          tip:'Gross lump sum before any relief. Taxed on a separate cumulative table, not your marginal rate — the first slice of your lifetime total across all lump sums is tax-free — the amount for your tax year is applied in the calculation.' },
        { el:'ls-date',   type:'date', label:'Date Received',
          tip:'If you leave this blank, lump sums are taxed in the order you added them. The date matters if you received more than one lump sum this period — set it so they’re taxed in the order SARS actually received them.' },
        { el:'ls-tax-withheld', type:'num', label:'Tax Withheld by Fund (R)',
          tip:'Tax already withheld by the fund under its SARS directive — IRP5/IT3(a) code 4115. Reduces the balance you still owe/are refunded, alongside your lump-sum tax.' }
      ]
  }],
  footer: { save: { label: 'Save Lump Sum', onclick: 'saveRetirementLumpsum()' } },
  notes: [{
    summary: 'ⓘ Cumulative lump sum table (Second Schedule para 5/6)',
    body: 'Retirement and severance lump sums are aggregated across your lifetime. Withdrawals (pre-retirement) use a separate table. The first slice of the lifetime total is tax-free; the remainder is taxed at the lump-sum table rates for your tax year.'
  }, {
    summary: 'ⓘ Lump sum from a foreign fund?',
    body: 'This table only applies to SA-regulated pension/provident/RA funds. A lump sum from a foreign retirement fund isn’t taxed via the SARS lump-sum tables at all — capture it under Foreign Income → Other foreign income instead, where it correctly enters your tax base and gets credit for any foreign tax withheld.'
  }]
};

/* ─── TWO-POT WITHDRAWAL ────────────────────────────────────── */
const CFG_TWOPOT = {
  id: 'modal-twopot', titleId: 'tp-modal-title', title: 'Two-Pot Withdrawal',
  icon: 'paid',
  kinds: { group: 'retirement', own: 'twopot' },
  sections: [{
    fields: [
      { el:'tp-fund',   type:'text', label:'Fund Name', full:true, required:true,
        placeholder:'e.g. Allan Gray RAF — Savings Pot' },
      { el:'tp-amount', type:'num', label:'Amount Withdrawn (R)', required:true, oninput:'twopotUpdateLiveCalc()',
        tip:'Amount withdrawn from your savings pot. Taxed at your marginal rate, not the lump-sum table (two-pot rules, effective 1 Sept 2024).' },
      { el:'tp-date',   type:'date', label:'Date',
        tip:'For your own records — the date does not change how this withdrawal is taxed.' },
      { el:'tp-tax-withheld', type:'num', label:'Tax Withheld by Fund (R)',
        tip:'Tax already withheld by the fund under its SARS directive — IRP5/IT3(a) code 4115. Reduces the balance you still owe/are refunded, alongside your normal tax.' }
    ],
    postHtml: '<div id="tp-live-calc"></div>'
  }],
  footer: { save: { label: 'Save Withdrawal', onclick: 'saveTwopotWithdrawal()', fab: true } },
  notes: [{
    summary: 'ⓘ Two-Pot retirement system',
    body: 'From 1 Sept 2024, NEW retirement contributions split 1/3 to savings pot (withdrawable) and 2/3 to retirement pot (preserved). Savings pot withdrawals are <strong>taxed at marginal rate</strong>, not the lump sum table. A minimum withdrawal applies — it is shown under the amount as you type.'
  }, {
    summary: 'ⓘ Withdrawal from a foreign fund?',
    body: 'Two-pot is a South African retirement-fund mechanism — a withdrawal from a foreign fund isn’t a two-pot savings withdrawal. Capture it under Foreign Income → Other foreign income instead, where it correctly enters your tax base and gets credit for any foreign tax withheld.'
  }]
};

/* ─── IT3(b) TAX CERTIFICATE — two steps at most (UI-CAP-1, shared rule 2).
   Opens on "What is on the certificate?" (CAPTURE_KINDS.it3b): South
   African only → one step (the certificate and its local lines); foreign
   only → one step (the certificate and its foreign lines); both → the
   foreign lines are step 2. it3bApplyKind (05-list-modules.js) shows the
   halves and moves the foreign one; each amount line is still added by its
   SARS code (QR9a). ── */
const CFG_IT3B = {
  id: 'modal-it3b', titleId: 'it3b-modal-title', title: 'IT3(b) Tax Certificate',
  icon: 'finance_mode',
  kinds: { group: 'it3b' },
  steps: [
    { title: 'Certificate', sections: [
      {
        fields: [
          { el:'it3b-institution', type:'text', label:'Institution', full:true, required:true,
            tip:'Name of the institution that issued the IT3(b) (e.g. FNB, Investec).',
            placeholder:'e.g. FNB, Investec, Absa, Standard Bank', oninput:'it3bUpdateLiveCalc()' },
          { el:'it3b-account', type:'text', label:'Account Reference', full:true,
            placeholder:'e.g. ****1234' },
          /* Not saved: which halves the certificate carries. */
          { el:'it3b-kind', type:'select', label:'What is on the certificate?', full:true, kindField:true,
            onchange:'it3bApplyKind(true)', options: kindSelectOptions('it3b') },
          { el:'it3b-minor-attribution', profileChip:'holder', type:'select', label:'Whose account is this?',
            tip:'If this account is in your minor child\'s name but you (or your spouse) funded it, the interest is taxed in YOUR hands under s7(3) of the Income Tax Act — not the child\'s. Select this so the certificate is clearly marked as attributed income on your return.',
            options:[{ value:'no', label:'My own account' }, { value:'yes', label:'My minor child\'s account, funded by me (s7(3))' }],
            showWhen:'minorChildAccount', hiddenValue:'no' },   // QR7.3
          { el:'it3b-ownership-share', profileChip:'share', type:'num', label:'Your ownership share (%)', full:true,
            tip:'If this is a joint account you hold with someone else (not your minor child, above), each holder is taxed only on their own share of the interest, dividends and gains. Enter 100% if the account is held by you alone. Enter the FULL certificate amounts below — your share is applied automatically.',
            inputmode:'decimal', pct:true, min:1, max:100, step:1, value:'100',
            showWhen:'jointOwnership', hiddenValue:'100' }   // QR7.3: hidden = sole holder = 100 %
        ]
      },
      /* The certificate's South African half (it3b-local-block). QR7.4
         (Q-INV-2): "You told us you have no foreign investment income" sits
         at its top — with the gate closed it is the whole certificate. */
      /* QR2.3 (Q-UIC-2): every amount field below is `optional:false`. Each
         only appears once the user has already told us, by choosing its code
         in the "Add an amount" picker, that this certificate carries that line item — renderField()'s
         automatic "(optional)" marker would then read as "you can skip
         reporting income you just said you have," which is wrong, not just
         redundant. Same for the Foreign section below. */
      { wrapId: 'it3b-local-block', preHtml: scnNoteHtml('foreign:investments'),
        fields: [
          { el:'it3b-local-interest', type:'num', label:'Local interest (annual)', full:true, codeChip:'4201', optional:false,
            tip:'Total local interest for the year. Some of it is tax-free automatically — you don\'t need to work out how much.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-local-interest-row' },
          { el:'it3b-sars-interest', type:'num', label:'SARS refund interest (annual)', full:true, codeChip:'4237', optional:false,
            tip:'Interest SARS paid you on a refund. It\'s taxable, and counts toward the same tax-free interest allowance as your other interest.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-sars-interest-row' },
          { el:'it3b-reit', type:'num', label:'Other Receipts and Accruals – Profit (annual)', full:true, codeChip:'4214', optional:false,
            tip:'Taxed as income — no dividend exemption applies.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-reit-row' },
          { el:'it3b-other-loss', type:'num', label:'Other Receipts and Accruals – Loss (annual)', full:true, codeChip:'4215', optional:false,
            tip:'Reduces taxable income.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-other-loss-row' },
          /* Code 4306 per SARS IT-AE-36-G05 rev 39 (19 Aug 2025) §5 'Exempt Local Dividends'
             (source code shown from 2025 YOA; revision history p.39). NOT 4292 — that is
             'Dividends deemed to be income s8E/8EA' (§6.1.7). WR-10, QR3.1. */
          { el:'it3b-local-div-exempt', type:'num', label:'Exempt local dividends (s10(1)(k)) (annual)', full:true, codeChip:'4306', optional:false,
            tip:'Ordinary local dividends are part of your tax-exempt income and do not form part of your taxable income.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-local-div-exempt-row' },
          /* 4238 per SARS IT-AE-36-G05 rev 39 §6.1.6 'Distribution from a REIT /
             Taxable Local Dividends'. A REIT distribution is income in a
             resident's hands (s25BB(6)); proviso (aa) to s10(1)(k)(i) keeps it
             out of the dividend exemption, and §6.1.1(c) of the guide keeps it
             out of the interest exemption. TC-020. WR-10. */
          { el:'it3b-reit-dividends', type:'num', label:'Distribution from a REIT / taxable local dividends (annual)', full:true, codeChip:'4238', optional:false,
            tip:'Distributions from a listed property company or fund (a REIT) — code 4238 on your certificate. Fully taxable: neither the dividend exemption nor the tax-free interest allowance applies.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-reit-dividends-row' },
          /* 4292 per the same guide, §6.1.7 'Dividends deemed to be income in
             terms of s8E and s8EA'. This line printed 4238 until 2026-10-02. */
          { el:'it3b-local-div-taxable', type:'num', label:'Dividends deemed to be income (s8E/8EA) (annual)', full:true, codeChip:'4292', optional:false,
            tip:'Dividends taxed as ordinary income rather than as dividends — code 4292 on your certificate. Fully taxable; the usual dividend exemption doesn\'t apply.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-local-div-taxable-row' },
          it3bLinePicker('it3b-add-local', false)
        ],
        postHtml: `<div id="it3b-interest-note-local" class="note info" style="margin-top:8px" aria-live="polite"></div>
        <details class="info-acc" style="margin-top:8px">
          <summary>ⓘ Local dividends <span class="chev">▾</span></summary>
          <div class="body">Ordinary local dividends (code 4306 from 2025) are exempt under s10(1)(k) — dividend withholding tax is deducted at source. They appear in your tax-exempt income total but do not increase your taxable income. Dividends re-characterised as income under s8E/8EA (code 4238) are taxable — enter those above.</div>
        </details>`
      }
    ] },
    /* The foreign half (it3b-foreign-block): its own step only for a
       certificate with both halves; it3bApplyKind moves it into step 1 for
       a foreign-only certificate and switches this step off otherwise.
       The foreign-investments gate (QR7.3) now sits on the kinds that
       carry it, so with the gate closed this half is never offered. */
    { title: 'Foreign amounts', sections: [
      { wrapId: 'it3b-foreign-block',
        preHtml: '<div id="it3b-interest-note-foreign" class="note info" aria-live="polite"></div>',
        fields: [
          { el:'it3b-foreign-interest', type:'num', label:'Foreign interest (annual)', full:true, codeChip:'4218', optional:false,
            tip:'Interest earned outside South Africa. Unlike local interest, none of it is tax-free — it\'s all taxable here.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-foreign-interest-row',
            postFieldHtml: fxWidgetHtml('it3b-foreign-interest') },
          { el:'it3b-foreign-tax-int', type:'num', label:'Foreign tax on interest (annual)', full:true, codeChip:'4113', optional:false,
            tip:'Tax already deducted abroad on that foreign interest. We use it to reduce what you owe here on the same income.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-foreign-tax-int-row',
            postFieldHtml: fxWidgetHtml('it3b-foreign-tax-int') },
          { el:'it3b-foreign-dividends', type:'num', label:'Foreign dividends (annual)', full:true, codeChip:'4216', optional:false,
            tip:'Foreign dividends received. Only part of this is taxed — we work out the taxable portion for you.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-foreign-dividends-row',
            postFieldHtml: fxWidgetHtml('it3b-foreign-dividends') },
          { el:'it3b-foreign-tax-div', type:'num', label:'Foreign tax on dividends (annual)', full:true, codeChip:'4112', optional:false,
            tip:'Tax already deducted abroad on that foreign dividend. We use it to reduce what you owe here on the same income.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-foreign-tax-div-row',
            postFieldHtml: fxWidgetHtml('it3b-foreign-tax-div') },
          { el:'it3b-foreign-cgt', type:'num', label:'Foreign capital gains (annual)', full:true, codeChip:'4114', optional:false,
            tip:'Increases taxable income.',
            oninput:'it3bUpdateLiveCalc()', hidden:true, rowId:'it3b-foreign-cgt-row' },
          it3bLinePicker('it3b-add-foreign', true)
        ]
      }
    ] }
  ],
  liveCalcId: 'it3b-live-calc',
  footer: { save: { label: 'Save Certificate', onclick: 'saveIt3bItem()' } }
};

/* ─── TAX-FREE INVESTMENT (QR9a, QD-12; s12T) ─────────────────
   Its own list, not an account type on an IT3(b): the ITR12 asks for each
   tax-free investment separately (IT-AE-36-G05 rev 39 §6.11(g)), with the
   source codes on the labels. Nothing here enters taxable income — the
   only tax role is the s12T(7) excess charge on contributions
   (02-core.js calcTfiCharge). Step 2 carries the return lines for
   completeness of the return; they are exempt and never feed the engine. */
const tfiNum = (el, label, code, tip) => ({ el, type:'num', label, full:true, codeChip:code, tip });
const CFG_TFI = {
  id: 'modal-tfi', titleId: 'tfi-modal-title', title: 'Tax-free investment',
  icon: 'savings',
  steps: [
    { title: 'Investment', sections: [ {
      fields: [
        { el:'tfi-institution', type:'text', label:'Institution', full:true, required:true,
          placeholder:'e.g. Capitec, Satrix, Discovery' },
        { el:'tfi-type', type:'select', label:'Investment type', full:true,
          options: TFI_INVESTMENT_TYPES },
        { el:'tfi-reference', type:'text', label:'Policy or client number', full:true, placeholder:'e.g. ****4471' },
        Object.assign(tfiNum('tfi-contributions', 'Contributions this year', '4219',
          'New money you paid in during this tax year. Only contributions count toward the yearly and lifetime limits.'),
          { oninput:'tfiUpdateLimitNote()' }),
        tfiNum('tfi-transfer-in', 'Transfers in from another tax-free investment', '4246',
          'Money moved here from another of your own tax-free investments. Transfers do not count toward the limits (s12T(6)).'),
        tfiNum('tfi-transfer-out', 'Transfers out to another tax-free investment', '4247',
          'Money moved from here to another of your own tax-free investments. Not a withdrawal, and not counted toward the limits.'),
        tfiNum('tfi-withdrawals', 'Withdrawals', '4248',
          'Money you took out. A withdrawal does not give back any of your limit.')
      ],
      postHtml: '<div id="tfi-limit-note" class="note info" style="margin-top:8px" aria-live="polite"></div>'
    } ] },
    { title: 'Returns on your certificate', sections: [ {
      rawHtml: '<p class="u-note-xs">The interest, dividends and gains inside a tax-free investment are tax-free. Fill these in only if your provider\u2019s certificate shows them — they do not change your tax.</p>'
    }, {
      fields: [
        tfiNum('tfi-interest', 'Interest', '4241'),
        tfiNum('tfi-dividends', 'Dividends', '4242'),
        tfiNum('tfi-capital-gain', 'Capital gain', '4243'),
        tfiNum('tfi-capital-loss', 'Capital loss', '4244'),
        tfiNum('tfi-net-profit', 'Net return \u2013 profit', '4239'),
        tfiNum('tfi-net-loss', 'Net return \u2013 loss', '4240'),
        tfiNum('tfi-other', 'Other (e.g. manufactured dividends)', '4257')
      ]
    } ] }
  ],
  footer: { save: { label: 'Save investment', onclick: 'saveTfiItem()' } }
};

/* ─── OTHER TAXABLE RECEIPT — one screen (UI-CAP-1). What was received
   is the sheet's chooser (CAPTURE_KINDS.otherReceipt): it sets the category
   and whether the receipt is income or capital (pickCaptureKind →
   otherReceiptKindPicked, 05-list-modules.js), so description, amount and
   date share one screen. The income / capital rows keep their grid-column
   markup as rawHtml, as before. ─────────────────────────────────────── */
const CFG_OTHER_RECEIPT = {
  id: 'modal-other-receipt', titleId: 'or-modal-title', title: 'Other Taxable Receipt',
  icon: 'inbox',
  kinds: { group: 'otherReceipt' },
  sections: [{
      fields: [
        { el:'or-category', type:'select', label:'Category', full:true, kindField:true, onchange:'otherReceiptUpdateCategory()',
          options: kindSelectOptions('otherReceipt') },
        /* Set by the kind; never asked. A capital receipt's proceeds and base
           cost join the CGT aggregate. */
        { el:'or-receipt-type', type:'select', label:'Income or capital', full:true, kindField:true, onchange:'onReceiptTypeChange()',
          options:[{ value:'income', label:'Income — taxable at marginal rate' }, { value:'capital', label:'Capital — goes to capital gains' }] }
      ]
    }, {
      rawHtml: `<div class="g2">
        <div class="form-group full" id="or-alimony-block" style="display:none">
          <label class="form-label" for="or-alimony-order">Is this maintenance paid under a court order, a divorce order, or a written separation/maintenance agreement?</label>
          <select class="form-select" id="or-alimony-order" onchange="otherReceiptAlimonyOrderChange()">
            <option value="yes">Yes — under an order or written agreement</option>
            <option value="no">No — informal / voluntary support</option>
          </select>
          <div id="or-alimony-note" class="u-c-tx3" style="font-size:0.6875rem;margin-top:4px"></div>
        </div>
        <div class="form-group full">
          <label class="form-label" for="or-description">Description</label>
          <input type="text" class="form-input" id="or-description" data-req="1" placeholder="e.g. Book royalty from Penguin Random House">
        </div>
        <div class="form-group full" id="or-income-fields">
          <label class="form-label" for="or-amount">Amount (R)</label>
          <input type="text" inputmode="numeric" class="form-input mono mask-rand" id="or-amount" placeholder="0" min="0" oninput="otherReceiptCostCheck()">
        </div>
        <!-- BACKLOG 63 (OI-C1d): costs on a royalty or "something else"
             receipt only (OTHER_RECEIPT_COST_KINDS, otherReceiptUpdateCategory). -->
        <div class="form-group full" id="or-costs-block" style="display:none">
          <div class="section-label">Costs</div>
          <div id="or-costs-note"></div>
          <div class="biz-exp-grid" style="font-size:0.625rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;padding:0 2px"><div>Type</div><div style="padding-left:6px">Amount (R)</div><div style="padding-left:6px">Note</div><div></div></div>
          <div id="or-expense-rows"></div>
          <div id="or-cost-chips" class="cost-chips"></div>
          <div id="or-costs-over" aria-live="polite"></div>
        </div>
        <div id="or-capital-fields" style="display:none;grid-column:1/-1">
          <div class="g2">
            <div class="form-group"><label class="form-label" for="or-proceeds">Proceeds (R)</label><input type="text" inputmode="numeric" class="form-input mono mask-rand" id="or-proceeds" placeholder="0" min="0" step="1"></div>
            <div class="form-group"><label class="form-label" for="or-basecost">Base Cost (R)</label><input type="text" inputmode="numeric" class="form-input mono mask-rand" id="or-basecost" placeholder="0" min="0" step="1"></div>
          </div>
          <details class="info-acc" style="margin-top:4px">
            <summary>ⓘ CGT calculation <span class="chev">▾</span></summary>
            <div class="body">Gain = Proceeds &minus; Base Cost &rarr; added to CGT aggregate &rarr; inclusion rate &rarr; annual exclusion, shared with other capital gains. Open the Capital Gains page to see the combined result.</div>
          </details>
        </div>
        <div class="form-group">
          <label class="form-label" for="or-date">Date <span class="u-c-tx3" style="font-weight:normal;font-size:0.6875rem">(optional)</span></label>
          <input type="date" class="form-input" id="or-date">
        </div>
        <div class="form-group">
          <label class="form-label" for="or-note">Note <span class="u-c-tx3" style="font-weight:normal;font-size:0.6875rem">(optional)</span></label>
          <input type="text" class="form-input" id="or-note" placeholder="Additional context">
        </div>
      </div>`
  }],
  footer: { save: { label: 'Save Receipt', onclick: 'saveOtherReceipt()' } }
};

/* ─── CGT DISPOSAL ──────────────────────────────────────────── */
const CFG_CGT = {
  id: 'modal-cgt-asset', titleId: 'cgt-modal-title', title: 'Add CGT disposal',
  icon: 'arrow_split',
  /* UI-CAP-1: opens on "What did you sell?" — the asset type (its select
     stays below, hidden). Two steps stay: the proceeds and three cost
     fields are a step of their own. */
  kinds: { group: 'cgt' },
  steps: [
    { title: 'Asset', sections: [
    {
      fields: [
        { el:'cgt-desc', type:'text', label:'Description', full:true, required:true,
          placeholder:'e.g. 12 Acacia Ave Sandton — 50 Sanlam shares — 0.5 BTC' },
        { el:'cgt-type', type:'select', label:'Asset type', kindField:true, onchange:'cgtToggleType()',
          optionNotes: OPTION_NOTES['cgt-type'],
          tip:'What kind of asset this was. Property unlocks the primary-residence exclusion questions below; Foreign routes the gain into your foreign-income totals for the tax credit.',
          /* QR4.4 (QX-CPY-3): the taxonomy's own cgt subtypes, like rental-type — a
             subtype edit can no longer drift between onboarding and this modal. */
          options: subtypesOf('cgt'), scnNote:'foreign:capital' },
        { el:'cgt-primary-res', type:'select', label:'Primary residence?',
          tip:'The first part of the gain on your primary residence is tax-free — the exclusion for your tax year is applied in the calculation below. This also shows a warning if you claimed home-office expenses on it.',
          rowId:'cgt-primary-res-row', onchange:'cgtTogglePara45b();cgtUpdateLiveCalc()', options:[
          { value:'no',  label:'No' },
          { value:'yes', label:'Yes (primary-residence exclusion applies)' }
        ]},
        /* Eighth Schedule para 45(1)(b): sole residential use for the whole period + proceeds
           at most PARA45_PROCEEDS_LIMIT disregards the whole gain, not only the usual exclusion. */
        { el:'cgt-para45b', type:'select', label:'Sole domestic use for the entire ownership period, proceeds ' + randText(PARA45_PROCEEDS_LIMIT) + ' or less?',
          tip:'If you (or your spouse) lived here the whole time you owned it, used it only as a home with no business use, and the proceeds were ' + randText(PARA45_PROCEEDS_LIMIT) + ' or less, the whole gain is tax-free — not only the usual primary-residence exclusion. Does not apply if proceeds were more than ' + randText(PARA45_PROCEEDS_LIMIT) + '.',
          rowId:'cgt-para45b-row', hidden:true, onchange:'cgtUpdateLiveCalc()', options:[
          { value:'no',  label:'No' },
          { value:'yes', label:'Yes' }
        ]},
        { el:'cgt-source-country', type:'text', label:'Source Country',
          rowId:'cgt-country-row', hidden:true, placeholder:'e.g. United Kingdom' },
        { el:'cgt-ownership-share', profileChip:'share', type:'num', label:'Your ownership share (%)',
          tip:'If you co-owned this asset with someone else (e.g. a spouse not married in community of property, or another co-owner), the gain or loss accrues only to the extent of your own beneficial ownership. Enter 100% if you owned it alone. Enter proceeds and costs for the FULL asset below — your share is applied automatically.',
          inputmode:'decimal', pct:true, min:1, max:100, step:1, value:'100', oninput:'cgtUpdateLiveCalc()',
          /* QR7.3 (Q-ONB-2): asked only if the user co-owns what they sold.
             Hidden, it submits 100 % — the whole gain is theirs. */
          showWhen:'cgtJointOwnership', hiddenValue:'100' }
      ]
    }
    ] },
    { title: 'Proceeds & Costs', sections: [
    {
      label: 'Proceeds &amp; Costs (R)',
      fields: [
        { el:'cgt-proceeds',      type:'num', label:'Proceeds', required:true, oninput:'cgtUpdateLiveCalc()',
          tip:'Total amount received or accrued on disposal. For a deemed disposal (e.g. emigration, donation), use market value at date of disposal.' },
        /* QR9b.2 (QR5.7 R-14): the three labelNotes here ("(agent, transfer,
           advertising)" …) repeated the start of each tip; the tip is kept. */
        { el:'cgt-selling-costs', type:'num', label:'Selling Costs',
          tip:'Costs incurred to dispose of the asset: estate agent commission, transfer costs on sale, advertising, auctioneer fees, conveyancing on disposal. Securities: include brokerage on the sale leg.',
          oninput:'cgtUpdateLiveCalc()' },
        { el:'cgt-basecost',      type:'num', label:'Base Cost',
          tip:'All costs to acquire the asset: purchase price + transfer duty (property), bond registration costs, conveyancing on purchase, brokerage and securities transfer tax (shares), import duties (assets). Do NOT include capital improvements — add those separately in the Improvements field.',
          oninput:'cgtUpdateLiveCalc()' },
        { el:'cgt-improvements',  type:'num', label:'Improvements',
          tip:'Capital expenditure incurred to improve the asset during the period of ownership (e.g. extensions, additions, structural renovations for property). Routine repairs and maintenance are NOT improvements and must be deducted as expenses in the year incurred — they do not add to base cost.',
          oninput:'cgtUpdateLiveCalc()' },
        { el:'cgt-note', type:'text', label:'Note', full:true,
          labelNote:'— supporting context',
          placeholder:'e.g. Improvements were a kitchen extension in 2023' }
      ]
    }
    ] }
  ],
  liveCalcId: 'cgt-live-calc',
  pinLiveCalc: true,
  footer: { save: { label: 'Save Disposal', onclick: 'saveCgtAsset()' } },
  /* STD-IA-3: shared with the page-level "About Capital Gains Tax"
     accordion. */
  notes: [TOPIC_HELP.cgt]
};

/* ─── RENTAL PROPERTY — two steps (UI-CAP-1, shared rule 2). Opens on "What
   kind of rental is it?" (CAPTURE_KINDS.rental); then Details, then the rent
   and its costs (the Income step held one field, so it joined the costs). ── */
const CFG_RENTAL = {
  id: 'modal-rental-property', titleId: 'rental-modal-title', title: 'Add rental',
  icon: 'home',
  kinds: { group: 'rental' },
  steps: [
    { title: 'Details', sections: [{
      fields: [
        { el:'rental-name', type:'text', label:'Rental', full:true, required:true,
          placeholder:'e.g. 12 Oak Lane, Rosebank', oninput:'rentalUpdateLiveCalc()' },
        { el:'rental-type', type:'select', label:'Type', kindField:true, full:true, onchange:'rentalToggleType()',
          optionNotes: OPTION_NOTES['rental-type'],
          options: subtypesOf('rental_income'), scnNote:'foreign:rental' },
        { el:'rental-source-country', type:'text', label:'Source country',
          rowId:'rental-country-row', hidden:true, placeholder:'e.g. United Kingdom' },
        /* Batch I (#76): s6quat(1A) — foreign tax proved payable on foreign
           income already included in taxable income qualifies for a rebate.
           Foreign rental income has entered the s6quat limitation numerator
           since S0-1, but the tax actually paid on it had no capture path,
           so the credit was always nil. Same gap and same one-line fix as
           T-7 made for a foreign pension. */
        { el:'rental-foreign-tax', type:'num', label:'Foreign tax paid on this rental income (annual, R)',
          rowId:'rental-foreign-tax-row', hidden:true,
          tip:'Tax paid to the foreign country on this property’s rental income. Feeds the s6quat foreign tax credit on the Foreign Income page. Leave at 0 if none was withheld.',
          postFieldHtml: fxWidgetHtml('rental-foreign-tax') },
        { el:'rental-ownership', type:'select', label:'Ownership',
          tip:'Whether you own the property (bond / mortgage) or lease it from another party and sublet.',
          onchange:'rentalToggleOwnership()', options:[
          { value:'owned',  label:'Owned (bond / mortgage)' },
          { value:'leased', label:'Leased / Rented' }
        ]},
        /* Airbnb only (rentalToggleType). On Details since UI-CAP-1 — the
           share of the home let belongs with what is let, not with the rent. */
        { el:'rental-ratio', type:'num', label:'% of home area rented',
          rowId:'rental-ratio-row', hidden:true,
          inputmode:'decimal', pct:true,
          tip:'For Airbnb or a short-term let: how much of your home\'s floor area is used for it (e.g. 40% for 2 of 5 rooms).',
          min:1, max:100, step:1, value:'100', oninput:'rentalUpdateLiveCalc()',
          postFieldHtml:'<span style="font-size:0.6875rem;color:var(--tx3)">% of floor area. Fixed costs apportioned; direct costs (agent, advertising) 100% deductible.</span>' },
        { el:'rental-ownership-share', profileChip:'share', type:'num', label:'Your ownership share (%)',
          tip:'If you co-own this property (e.g. with a spouse or another person, not married in community of property), rental income and gains accrue only to the extent of your own beneficial ownership. Enter 100% if you are the sole owner. Enter income and expenses for the FULL property below — your share is applied automatically.',
          inputmode:'decimal', pct:true, min:1, max:100, step:1, value:'100', oninput:'rentalUpdateLiveCalc()',
          showWhen:'jointOwnership', hiddenValue:'100' }   // QR7.3: hidden = sole owner = 100 %
      ]
    }] },
    { title: 'Rent and costs', sections: [{
      fields: [
        /* QR9b.2 (RENT-11): optional:false — gross income is what this modal
           is for, exactly as PAYE Withheld on the PAYE modal. */
        { el:'rental-income', type:'num', label:'Gross rental income (annual)', optional:false, full:true,
          tip:'Total annual rental received before expenses.',
          oninput:'rentalUpdateLiveCalc()',
          postFieldHtml: fxWidgetHtml('rental-income') }
      ]
    }, {
      rawHtml: `<div class="section-label">Costs (annual)</div>
      <p id="rental-exp-intro" style="font-size:0.6875rem;color:var(--tx3);margin-bottom:8px">Add each expense by category.</p>
      <!-- Batch I (#73): column headers removed — each row is now a stacked
           card carrying its own labels, so a header strip would duplicate
           them and align with nothing. -->
      <div id="rental-expense-rows"></div>
      <!-- UI-CAP-1 (rule 6): "Add a cost" chips, rentalRenderCostChips() (05). -->
      <div id="rental-cost-chips" class="cost-chips"></div>
      <div id="rental-type-notice"></div>`
    }] }
  ],
  /* RENT-9 (§L.8): the gross/expenses/net calculation display used to be
     pinned above every step (pinLiveCalc), so it showed on Property Details
     and Income before any expense had been entered. Un-pinning it falls
     through to renderStep()'s existing default — liveCalcId lands on the
     LAST step only (Expenses) — with no other code change: renderRentalResult()
     already looks the element up by id ($('rental-live-calc')), not by
     position, so it renders correctly wherever the div ends up. */
  liveCalcId: 'rental-live-calc',
  footer: { save: { label: 'Save Rental', onclick: 'saveRentalProperty()' } },
  notes: [
    /* STD-IA-3: shared with the page-level "About rental income &
       deductions" accordion — see TOPIC_HELP.rental (01-data.js) for the
       merge history (incl. the RENT-3 (§L.8) trims this text used to carry
       inline: the first sentence, "/ short-term", the "— s23(b)" citation,
       "vehicle" from "Equipment leases", and "(s11(e))"; the "Foreign ...
       FCT" deletion did not literally match anything here and was not
       applied, per that same review). */
    TOPIC_HELP.rental,
    /* RENT-13/RENT-14 (§L.8): the "Repairs vs improvements" and "Bond
       interest vs bond instalment" notes that used to live here — as two
       more accordions at the bottom of the whole modal, disconnected from
       the expense row they explained — are now shown CONTEXTUALLY, inline
       on the row itself, the moment its category is set to Repairs,
       Improvements or Bond interest. See RENTAL_ROW_INFO and
       rentalUpdateExpenseRowInfo() (06a-rental.js). Moved, not duplicated —
       removed from here so the same guidance does not appear twice. */
    /* QR4.3 (Q-CPY-1): the PAYE-GEN-01-G03 §3.2 "vehicle let to the employer"
       accordion that sat here for every rental type is now the Vehicle lease
       note — OPTION_NOTES['rental-type'].vehicle (01-data.js), where the rule
       and its citation live. */
  ]
};

/* ─── BUSINESS & TRADE — two steps (UI-CAP-1, shared rule 2). Opens on
   "What kind of work is it?" (CAPTURE_KINDS.business); the Income step held
   two fields (gross income and, for a freelancer, the first deemed-employee
   question), so it joined Details; the costs are step 2. ─────────────── */
const CFG_BUSINESS = {
  id: 'modal-business', titleId: 'biz-modal-title', title: 'Add business or trade',
  icon: 'work',
  kinds: { group: 'business' },
  steps: [
    { title: 'Details', sections: [{
      fields: [
        { el:'biz-type', type:'select', label:'Business type', kindField:true, full:true, onchange:'bizToggleForeign(); bizTogglePsp(); bizUpdateLiveCalc()',
          /* QR9b.2 (QR5.5 R-7): the foreign sentence is the option's own
             note — shown for Foreign business only. */
          optionNotes: OPTION_NOTES['biz-type'],
          /* QR7.3: the taxonomy's own business subtypes, like rental-type and
             cgt-type — so the Foreign option's `foreign:business` gate has
             one home (INCOME_TYPE_DEFS). */
          options: subtypesOf('business_income'), scnNote:'foreign:business' },
        { el:'biz-name', type:'text', label:'Business / Trade', full:true, required:true,
          placeholder:'e.g. Freelance Design, Consulting Practice, ABC Traders' },
        { el:'biz-income', type:'num', label:'Gross income (annual, R)', full:true, required:'zero-ok',
          tip:'Total gross receipts for the year, before any expenses — enter your running costs on the next step.',
          oninput:'bizUpdateLiveCalc()',
          postFieldHtml: fxWidgetHtml('biz-income') },
        /* Batch I (#70): s6quat(1A), mirroring #76 on Rental. Foreign business
           profit already enters the s6quat limitation numerator; the foreign
           tax paid on it had no capture path, so the credit was always nil. */
        { el:'biz-foreign-tax', type:'num', label:'Foreign tax paid on this business income (annual, R)',
          rowId:'biz-foreign-tax-row', hidden:true, full:true,
          tip:'Tax paid to the foreign country on this business’s profit. Feeds the s6quat foreign tax credit on the Foreign Income page. Leave at 0 if none was paid.',
          postFieldHtml: fxWidgetHtml('biz-foreign-tax') },
        /* C-10 (coverage-gap-analysis): detect-and-disclose only — the Fourth
           Schedule para 1 "remuneration" exclusion tests (control/supervision,
           the 80%-one-client rule) and the para 2(5) 3-employee escape. Shown
           only for the Freelancer/Contractor/Consultant subtype; answers
           drive a disclosure note (bizUpdatePspNote(), 05-list-modules.js) —
           no deduction is restricted and nothing feeds the s11F cap base.
           Owner-scoped: compute nothing, elicit facts and route to advice. */
        { el:'biz-psp-majorclient', type:'select', label:'Did more than 80% of this income come from one client this year?',
          rowId:'biz-psp-majorclient-row', hidden:true, onchange:"bizPspChain('majorclient')",
          tip:'One of the Fourth Schedule tests for whether you’re really an independent contractor or should be treated as an employee for tax purposes.',
          options:[{ value:'no', label:'No' }, { value:'yes', label:'Yes' }] },
        { el:'biz-psp-control', type:'select', label:'Does that client control or supervise how and when you do the work, like an employee?',
          rowId:'biz-psp-control-row', hidden:true, onchange:"bizPspChain('control')",
          tip:'Direction over your hours or methods — rather than just the end result — is the other main test.',
          options:[{ value:'no', label:'No' }, { value:'yes', label:'Yes' }] },
        { el:'biz-psp-employees', type:'select', label:'Do you employ 3 or more full-time staff who are not connected to you?',
          rowId:'biz-psp-employees-row', hidden:true, onchange:'bizUpdatePspNote()',
          tip:'This takes you out of deemed-employee status even though both answers above are yes.',
          options:[{ value:'no', label:'No' }, { value:'yes', label:'Yes' }] },
        { rawHtml:'<div id="biz-psp-note" class="u-hidden"></div>' }
      ]
    }] },
    { title: 'Costs', sections: [{
      /* Cost lines rendered by bizAddExpenseRow() — seeded with the usual
         lines for the kind, more offered as chips (UI-CAP-1, rule 6). */
      rawHtml: `
      <div class="section-label">Costs (annual)</div>
      <!-- Batch I (#62): column headers removed — each row is now a stacked
           card carrying its own labels. -->
      <div id="biz-expense-rows"></div>
      <div id="biz-cost-chips" class="cost-chips"></div>
      <!-- BACKLOG 57 (copy C-86): costs with no income are deductible only for
           a trade carried on in the production of income (s11(a), s23(g)).
           Shown exactly when validate() requires it — no income, some
           costs (bizUpdateLiveCalc()). -->
      <div class="form-group full u-hidden" id="biz-trade-confirm-block">
        <label class="sfl" for="biz-trade-confirm">No income yet — is this a business you are actively running to earn income? <span class="info-btn" data-tip="Costs with no income count against your other income only if you are carrying on a trade to earn income — for example a business that has started but has not been paid yet (s11(a), s23(g))."><i class="material-symbols-outlined msi-info"></i></span></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--tx2)">
          <input type="checkbox" id="biz-trade-confirm"> Yes — I am running this business to earn income
        </label>
      </div>
      <div id="biz-overlap-notice"></div>
      <div id="biz-live-calc"></div>`
    }] }
  ],
  footer: { save: { label: 'Save Business', onclick: 'saveBusinessItem()' } },
  /* STD-IA-3: shared with the page-level "About business & trade income"
     accordion. */
  notes: [TOPIC_HELP.business]
};

/* ─── TOOLS & EQUIPMENT ─────────────────────────────────────── */
const CFG_TOOLS_WT = {
  id: 'modal-tools-wt', titleId: 'tools-modal-title', title: 'Add asset',
  icon: 'handyman',
  /* UI-CAP-1: opens on "What did you buy?" (CAPTURE_KINDS.tools). */
  kinds: { group: 'tools' },
  sections: [
    {
      fields: [
        { el:'tools-wt-desc', type:'text', label:'Description', full:true, required:true,
          placeholder:'e.g. MacBook Pro, Makita drill set, office desk' },
        { el:'tools-wt-type', type:'select', label:'Asset type', kindField:true, full:true, onchange:'toolsTypeUserChanged()',
          optionNotes: OPTION_NOTES['tools-wt-type'],
          /* QR9b (QD-30, WR-8): the options and the periods in this tip
             come from SARS_WT_RATES. */
          tip:'Sets the wear-and-tear write-off period — it varies by type ('
            + SARS_WT_RATES.filter(r => r.life > 1).map(r => r.label.toLowerCase() + ' over ' + r.life + ' years').join(', ')
            + '). Choose "Small tool" for a full write-off if the cost is ' + randText(WT_SMALL_ITEM_LIMIT) + ' or less, whatever the item.',
          options: SARS_WT_RATES.map(r => ({ value: r.type, label: r.option })) },
        { el:'tools-wt-cost', type:'num', label:'Cost (R)', required:true,
          oninput:'toolsCostEcho()',
          postFieldHtml:'<div id="tools-wt-cost-echo" class="field-echo"></div>',
          tip:'Total cost including VAT. Items at or under ' + randText(WT_SMALL_ITEM_LIMIT) + ' default to a full write-off in the year of purchase — tap “Spread it out” under the cost if you would rather depreciate it. Larger assets are deducted as wear and tear over their SARS useful life.' },
        { el:'tools-wt-date', type:'date', label:'Date brought into use', full:true,
          tip:'Leave blank to assume the asset was in use for the full tax year. Set this if it was bought partway through the year — the wear-and-tear deduction is then pro-rated from this date.' }
      ]
    }
  ],
  footer: { save: { label: 'Save Asset', onclick: 'saveToolsWtItem()', fab: true } },
  notes: [{
    summary: 'ⓘ About tools &amp; equipment (s11(e))',
    body: 'Assets used in your trade or employment: items costing ' + randText(WT_SMALL_ITEM_LIMIT) + ' or less are written off in full in the year of purchase. Larger items are deducted as wear and tear over their SARS useful life (e.g. ' + wtLife('computer') + ' years for computers). Only the business-use portion is deductible. A vehicle is not added here — claim it under Travel, or with your business expenses if you are self-employed. Keep all purchase receipts.'
  }]
};

/* ─── DONATIONS TO PBOs ─────────────────────────────────────── */
const CFG_DONATION = {
  id: 'modal-donation', titleId: 'don-modal-title', title: 'Add donation',
  icon: 'volunteer_activism',
  sections: [{
    fields: [
      { el:'don-name', type:'text', label:'PBO / Organisation', full:true, required:true,
        placeholder:'e.g. Red Cross SA, Cancer Association of SA' },
      { el:'don-has-s18a', type:'select', label:'Do you have a valid s18A certificate for this donation?', full:true, required:true, onchange:'donToggleS18a()',
        /* QR9b.2 (QR5.5 R-8): the "without one…" sentence is the No option's
           own note (don-no-s18a-note, donToggleS18a) — no longer repeated
           here for someone who answered Yes. s18A(1), (2). */
        tip:'Only a donation backed by a valid s18A certificate from the organisation is deductible.',
        options:[
          { value:'', label:'Select…' },
          { value:'yes', label:'Yes — I have (or will get) the s18A certificate' },
          { value:'no', label:'No — I don’t have one' }
        ] },
      { el:'don-ref', type:'text', label:'s18A receipt reference', rowId:'don-ref-row', hidden:true,
        tip:'Receipt number on the s18A certificate issued by the PBO.',
        placeholder:'Receipt number' },
      { el:'don-no-s18a-note', type:'text', rawHtml:'<div class="form-group full" id="don-no-s18a-note" style="display:none"><div class="note warning note-line"><i class="material-symbols-outlined msi-warning" aria-hidden="true"></i><span class="note-t">Not deductible without an s18A certificate.</span><button type="button" class="note-more" data-tip-long data-tip="&lt;strong&gt;No s18A certificate&lt;/strong&gt;Without a valid s18A certificate, this donation is &lt;strong&gt;not deductible&lt;/strong&gt;. It will be recorded here for your own records but will not reduce your tax." onclick="showInfoTip(this)">More</button></div></div>' },
      { el:'don-kind', type:'select', label:'Donation type', full:true,
        tip:'If you donated goods rather than money, use the value the organisation puts on the s18A certificate — not your own estimate of what they were worth.',
        options:[
          { value:'cash', label:'Cash / money' },
          { value:'kind', label:'Goods or property (in-kind donation)' }
        ], onchange:'donToggleKindNote()' },
      { el:'don-kind-note', type:'text', rawHtml:'<div class="form-group full" id="don-kind-note" style="display:none"><div class="note info note-line"><i class="material-symbols-outlined msi-info" aria-hidden="true"></i><span class="note-t">Use the value on the s18A certificate, not your own estimate.</span><button type="button" class="note-more" data-tip-long data-tip="&lt;strong&gt;In-kind donations&lt;/strong&gt;In-kind donations are valued under s18A(3), not at your own estimate of market value — use the value the PBO records on the s18A certificate, not what you think the goods are worth." onclick="showInfoTip(this)">More</button></div></div>' },
      { el:'don-amount', type:'num', label:'Amount donated (R)', required:true,
        tip:'There is a yearly limit on the donations you can claim, set as a share of your taxable income — the Donations page shows yours. Anything above it is not lost — it carries over to next year.',
        oninput:'donAmountEcho()',
        postFieldHtml:'<div id="don-amount-echo" class="field-echo"></div>' }
    ]
  }],
  footer: { save: { label: 'Add donation', onclick: 'addDonation()', fab: true } },
  /* STD-IA-3: shared with the page-level "About the donations deduction"
     accordion (retitled to match this text — the two were already nearly
     identical; this is the fuller of the two, naming PBOs explicitly). */
  notes: [TOPIC_HELP.donations]
};

/* ─── ADDITIONAL IRP5 DEDUCTION CODES ───────────────────────── */
const CFG_DEDUCTION_CODE = {
  /* S3 Batch 13 (D8): "Add IRP5 deduction" was a misnomer — this modal
     collects a manually-described claim (deductionItems/"Other claims"),
     not an IRP5-coded one; the SARS code field inside it is optional. */
  id: 'modal-deduction-code', titleId: 'ded-code-modal-title', title: 'Add other deductions',
  icon: 'format_list_numbered',
  /* B3 (01-SPEC.md §6.3, item 30): the SARS code is no longer the way in.
     A user with a claim and no idea of its code could not get past the first
     field. Now they describe it and give the amount; the code sits behind a
     reveal for the people who have it in front of them. The saved item keeps
     the same shape either way — see M_deductionCode.collect(). */
  sections: [{
    fields: [
      { el:'add-ded-desc', type:'text', label:'What is it?', full:true, optional:false,
        placeholder:'e.g. Salary you paid back to your employer' },
      { el:'add-ded-amount', type:'num', label:'Amount (annual, R)', required:true,
        tip:'Amount for this claim, as shown on your IRP5 or your own records.' },
      { rawHtml: '<div class="form-group full"><span class="chip" id="ded-code-chip" role="button" tabindex="0"'
          + ' onclick="revealField(\'ded-code-row\',\'ded-code-chip\')">'
          + '<i class="material-symbols-outlined msi-add"></i>I know the code from my IRP5</span></div>' },
      { el:'add-ded-code', type:'codepicker', label:'Code from your IRP5',
        full:true, hidden:true, rowId:'ded-code-row',
        placeholder:'e.g. 4001 or pension', openGroups:'all',
        emptyNote:'Try the code from the deductions block of your IRP5, or a word such as pension or medical.',
        tip:'Optional — the IRP5 4000-series code, if you have it in front of you. Leaving it blank does not change what you can claim.',
        postFieldHtml:'<div class="u-note-xs">Only if you have it. Leaving it blank does not change what you can claim.</div>',
        options:[] /* populated at runtime by populateDedCodeSelect() */ }
    ]
  }],
  footer: { save: { label: 'Add deduction', onclick: 'saveDeductionItem()', fab: true } },
  notes: [{
    summary: 'ⓘ About other claims',
    body: 'Anything you can claim that does not have its own page here. Describe it and enter the amount. If you have the code from your IRP5 you can add it, but it is not required.'
  }]
};

/* ══════════════════════════════════════════════════════════════
   MOUNT — inject all modal HTML into #modals-dynamic
   ══════════════════════════════════════════════════════════════ */

/* ─── CRYPTO DISPOSAL (wizard) ──────────────────────────────── */
const CFG_CRYPTO_DISPOSAL = {
  id: 'modal-crypto-disposal', titleId: 'crypto-disp-modal-title', title: 'Add crypto disposal',
  icon: 'logout',
  /* QR9b.4 (QD-27, pattern P1): one screen. The "Classify" step is gone — how
     the asset was held is a two-way choice above the amounts it shapes, with
     the consequence of each as its option note (it replaces the old tip,
     which described both at once). */
  kinds: { group: 'crypto', own: 'disposal' },
  sections: [
      { fields: [
        { el:'cd-class', type:'choice', label:'How did you hold it?', full:true, onchange:'cryptoDispOnClassChange()',
          optionNotes: OPTION_NOTES['cd-class'],
          options:[
            { value:'capital', label:'As an investment' },
            { value:'trading', label:'To trade' },
          ] },
        { el:'cd-desc', type:'text', label:'Description / asset', full:true, required:true,
          placeholder:'e.g. Bitcoin — disposal Mar 2026' },
        { el:'cd-proceeds', type:'num', label:'Proceeds (R)', required:true, oninput:'cryptoDispPreview()',
          tip:'Amount received on disposal (sale, conversion or market value if gifted/spent).' },
        { el:'cd-cost', type:'num', label:'Base cost (R)', oninput:'cryptoDispPreview()',
          tip:'Acquisition cost: what you paid to acquire the asset, plus acquisition fees.' },
      ] },
      /* BACKLOG 53 / OI-C1d: the list shows for BOTH holdings. It used to be
         hidden for an investment while the engine still subtracted every row
         from the gain, so a user who switched from trading kept costs they
         could not see. The label and the note follow the holding; which
         costs actually count is cryptoDisposalCosts() (06-crypto.js). */
      { rawHtml: `<div id="cd-expense-section">
        <div class="section-label" style="margin-top:4px"><span id="cd-expense-label">Costs of buying and selling</span></div>
        <div class="form-group full" id="cd-expense-note"></div>
        <div class="biz-exp-grid" style="font-size:0.625rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;padding:0 2px"><div>Type</div><div style="padding-left:6px">Amount (R)</div><div style="padding-left:6px">Note</div><div></div></div>
        <div id="cd-expense-rows"></div>
        <div id="cd-cost-chips" class="cost-chips"></div>
      </div>` }
  ],
  liveCalcId: 'crypto-disp-preview',
  footer: { save: { label: 'Save Disposal', onclick: 'saveCryptoDisposal()' } },
  notes: [{
    summary: 'ⓘ About crypto disposals',
    body: 'SARS taxes crypto under the Income Tax Act. The key question is whether the activity is capital (held as an investment → CGT) or revenue (a trade → ordinary income at your marginal rate). Trading losses may offset other income subject to assessed-loss rules.'
  }]
};

/* ─── CRYPTO REVENUE INCOME ─────────────────────────────────── */
const CFG_CRYPTO_REVENUE = {
  id: 'modal-crypto-revenue', titleId: 'crypto-rev-modal-title', title: 'Add crypto income',
  icon: 'paid',
  kinds: { group: 'crypto', own: 'revenue' },
  sections: [
    { fields: [
      { el:'cr-type', type:'select', label:'Income type', onchange:'cryptoRevSeedCosts()',
        tip:'Staking, mining, DeFi yield and airdrops are all ordinary income, taxed at your marginal rate on the market value when received — not a capital gain.',
        options:[
          { value:'staking',  label:'Staking / Proof-of-Stake rewards' },
          { value:'mining',   label:'Mining — Proof-of-Work' },
          { value:'defi',     label:'DeFi / Yield Farming' },
          { value:'airdrops', label:'Airdrops' },
          { value:'other',    label:'Other crypto income' },
        ] },
      { el:'cr-desc', type:'text', label:'Description / asset', full:true, placeholder:'e.g. ETH staking rewards' },
      { el:'cr-amount', type:'num', label:'Amount received (R)', required:true,
        tip:'Market value of the crypto at the date it was received.' },
    ] },
    { rawHtml: `<div>
      <div class="section-label" style="margin-top:4px">Expenses <span style="font-weight:400;color:var(--tx3)">(optional — deductible)</span></div>
      <div class="biz-exp-grid" style="font-size:0.625rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;padding:0 2px"><div>Type</div><div style="padding-left:6px">Amount (R)</div><div style="padding-left:6px">Note</div><div></div></div>
      <div id="cr-expense-rows"></div>
      <div id="cr-cost-chips" class="cost-chips"></div>
    </div>` }
  ],
  footer: { save: { label: 'Save Income', onclick: 'saveCryptoRevenue()' } },
  notes: [{
    summary: 'ⓘ About crypto revenue income',
    body: 'Mining, staking, DeFi yield and airdrops are ordinary income, taxed at your marginal rate on the market value at receipt. Mining hardware is claimed via wear-and-tear (not in full upfront) — enter only this year’s W&T amount as an expense.'
  }]
};

const MODAL_CONFIGS = [
  CFG_IRP5, CFG_PAYE, CFG_PENSION, CFG_LUMPSUM, CFG_TWOPOT,
  CFG_IT3B, CFG_TFI, CFG_OTHER_RECEIPT, CFG_CGT, CFG_RENTAL, CFG_BUSINESS,
  CFG_TOOLS_WT, CFG_DONATION, CFG_DEDUCTION_CODE,
  CFG_CRYPTO_DISPOSAL, CFG_CRYPTO_REVENUE
];

export function mountModals() {
  const el = $('modals-dynamic');
  if (!el) return;
  el.innerHTML = MODAL_CONFIGS.map(renderModal).join('');
}

/* STD-IA-3 (design-system-audit-2026-09 §L.9): one source per help topic,
   referenced by both the page's own "About X" accordion and its modal's
   notes entry. Static page markup carries a `data-topic-help` id and empty
   label/body slots; this runs once at boot and copies the same TOPIC_HELP
   entry the modal's `notes: [TOPIC_HELP.x]` config already references — the
   two can no longer drift, because there is only one string. innerHTML (not
   textContent) matches how renderModal() already writes these same values
   into modal markup, so entities like "&amp;" render the same way in both
   places; the values are developer-authored constants, never user input, so
   hard rule 7's esc() requirement does not apply here (same reasoning as
   renderModal()'s own notes.map()). */
export function renderTopicHelpAccordions() {
  document.querySelectorAll('[data-topic-help]').forEach(function(el) {
    var t = TOPIC_HELP[el.dataset.topicHelp];
    if (!t) return;
    var label = el.querySelector('.topic-help-label');
    var body = el.querySelector('.body');
    if (label) label.innerHTML = t.summary;
    if (body) body.innerHTML = t.body;
  });
}

/* B0 Simplification — back bar + title + page ⓘ component (01-SPEC.md §2, P4).
   cfg: { backMode, backTab, backLabel, title, tipKey, areaClass }
   Mounted onto every income/deduction page by mountPageHeads() (B1).
   tipKey looks up PAGE_HELP for a sheet tip on the heading ⓘ. */
export function pageHead(cfg) {
  var back = cfg.backMode
    ? '<button class="page-head-back" onclick="navigateTo(\'' + cfg.backMode + '\',\'' + (cfg.backTab || '') + '\')" aria-label="' + _ea(cfg.backLabel || 'Back') + '"><i class="material-symbols-outlined msi-arrow-back"></i> ' + _ea(cfg.backLabel || 'Back') + '</button>'
    : '';
  var pageTip = cfg.tipKey && PAGE_HELP[cfg.tipKey] ? PAGE_HELP[cfg.tipKey] : null;
  var tipBtn = pageTip
    ? ' <span class="info-btn" data-tip-long data-tip="' + _ea(pageTip) + '" aria-label="About this page"><i class="material-symbols-outlined msi-info"></i></span>'
    : '';
  return '<div class="page-head' + (cfg.areaClass ? ' ' + cfg.areaClass : '') + '">'
    + back
    + '<h2 class="page-head-title">' + esc(cfg.title || '') + '</h2>'
    + tipBtn
    + '</div>';
}

/* B1 Simplification — fill a mode's back-bar slot for the page now showing.

   The slot (`#page-head-<mode>`, in body.html) sits ABOVE the tab bar, so
   the page name and its way out read before the sibling-page rail — the
   order the approved B1 prototype establishes. One slot per mode, repainted
   on navigation, rather than one bar baked into each of the 24 pages: the
   bar has to out-rank the tab bar in the sticky stack, and only a sibling
   of the tab bar can do that.

   Called from switchTab() (02-core), the single funnel every tab change
   goes through. A page with no PAGE_HEADS entry empties the slot, which
   `.page-head-slot:empty` then collapses — so pages B1 does not cover are
   left exactly as they were.

   tipKey defaults to the page key, so PAGE_HELP and PAGE_HEADS stay keyed
   the same way and a page can never show a ⓘ pointing at another page's
   help. A page with no PAGE_HELP entry simply renders no ⓘ. */
export function updatePageHead(mode, tab) {
  var slot = $('page-head-' + mode);
  if (!slot) return;
  var key = (MODE_PREFIX_MAP[mode] || mode) + '-' + tab;
  var cfg = PAGE_HEADS[key];
  if (!cfg) { slot.innerHTML = ''; slot.classList.remove('has-head'); return; }
  slot.innerHTML = pageHead({
    backMode:  cfg.backMode,
    backTab:   cfg.backTab,
    backLabel: cfg.backLabel,
    title:     cfg.title,
    tipKey:    cfg.tipKey || key
  });
  slot.classList.add('has-head');
}
