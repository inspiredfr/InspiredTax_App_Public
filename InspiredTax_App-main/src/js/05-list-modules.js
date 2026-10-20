import { CAPTURE_KINDS, USUAL_COSTS, OTHER_RECEIPT_COST_KINDS, WT_SMALL_ITEM_LIMIT, wtLife, writeOffMonthsInTaxYear, RENTAL_LEASE_TYPES, interestExemptionNote, FOREIGN_DIVIDEND_TAXABLE_RATIO, getFact, IRP5_DEDUCTIONS, IRP5_INCOME, IT3B_CODES, S10C_ANNUITY_CODES, S12T_EXCESS_CHARGE_RATE, TFI_INVESTMENT_TYPES, FOREIGN_SERVICE_CODES, deductionCodeRoute } from './01-data.js';
import { revealField, hideField, wizReset, wizGoto, syncCodePicker } from './00-forms.js';
import { checkScope, flagField, clearFieldProblems, noteHtml, noteBody, setNote, noteStepCompleted, calcRemunerationBase, plausibilityHtml, plausibilityNotes, fxRefreshWidgets, refreshOptionNotes, formHoldsInput, $, APP, calcAgeAtYearEnd, calcFullTax, calcLumpsumTax, calcTaxableInvestment, closeModal, collectForeignIncome, commitPending, debounceSave, esc, flashSaved, fmt, foreignEmpExemptAmount, getActiveTaxYear, gs, gv, heroBreakdownLink, maskAll, openModal, parseFmt, renderBucketNav, segShow, showConfirm, showForeignRow, showFxWidgetFor, showToast, sv, syncYn, taxableIt3bItems, walkLumpsums, iconClassFor, calcTfiCharge, tfiChargeForActiveYear, scenarioAllows, _modalFocusables } from './02-core.js';
import { calcInterest, renderDeductionCodeList, toolsCostEcho } from './04-deductions.js';
import { onIncomeCodeChange, renderEmployerPaye, renderIncomeGlance, renderIncomeList, renderIncomeStats } from './03-income.js';
import { renderCgtResult } from './06b-cgt.js';
import { onReceiptTypeChange, otherReceiptUpdateCategory, renderOtherReceiptsList, otherReceiptSeedCosts, otherReceiptLoadCosts } from './06c-other-receipts.js';
import { refreshDerived } from './07-render-summary.js';
import { entUnlocked, entOnLockedTap } from './14-entitlement.js';
import { celebrateStep } from './08-dashboard-theme.js';

/* ═══════════════════════════════════════════════════════════
   GENERIC LIST-CRUD MODULE FACTORY
   One lifecycle for every modal-backed list editor (B2 IT3(b),
   B4 Business, B7 Pension / Lump-sum / Two-pot, B9 Other
   Receipts, B5 CGT, B3 Rental). Replaces eight hand-copied
   add/edit/clear/load/save/remove sets. Config:
     array      APP key holding the records
     modalId    modal-overlay element id
     titleId    modal title element id; titles: {add, edit}
     fields     [{el, key, kind:'str'|'raw'|'num', def}] —
                declarative clear/load/collect map. 'str' trims;
                'num' coerces via gv()||0; 'raw' = select/string
                with default. Falsy stored values load as def/''.
     onClear()/onLoad(item)  non-declarative form prep
     onForm()   toggles + live-calc, runs after clear AND load
     keepExtra  true: an edit keeps keys the form does not carry (e.g. a
                migrated record's origin) — saved = {...current, ...form}
     validate() cross-field rule after checkScope(): return {el, msg} to
                block save and show msg under field el (flagField),
                null to pass; a bare string still toasts (legacy)
     collect(cur) override record building (id preservation,
                conditional shapes); cur = record being edited
     refresh()  list re-render + module recalcs
     afterSave(item) optional post-commit hook
     confirm    {title, msg} for remove
     removeBy   'index' (default) | 'idOrIndex' (CGT compat)
   The factory owns edit-index state, modal open/close, commit,
   debounceSave + refreshDerived. List renderers stay bespoke.
   NOTE: form writes use direct assignment, not sv() — sv()
   ignores ''/null, which made the old clear functions silent
   no-ops (stale values leaked into Add forms; the old rental
   "defensive full reset" was a workaround for that bug). */
/* QR0.1: every makeCrudModule() config, in call order, for the smoke
   harness's CRUD field-existence check (tests/smoke.js) — it opens each
   module's modal and asserts every cfg.fields[].el resolves to a real
   element, catching a field wired into a CRUD config but never added to
   the form (RET-02). Read via the window bridge's existing full-surface
   republish (99-window-bridge.js).

   Registry lives as a property of makeCrudModule itself, lazily created on
   first call, rather than a sibling `const` — 05-list-modules.js and
   06b-cgt.js import from each other (renderCgtResult / makeCrudModule), so
   06b-cgt.js's own module-eval-time `makeCrudModule(...)` call can run
   before this file's own top-level statements do; a plain `const [] `
   initializer at that point would still be unassigned when the circular
   call reaches it (hard rule 10: never touch a foreign const at
   module-eval time — this is that hazard one module over). A property on
   the function object is available to every caller regardless of which
   module's top level runs first. */
export function makeCrudModule(cfg) {
  makeCrudModule.registry = makeCrudModule.registry || [];
  makeCrudModule.registry.push(cfg);
  let editIdx = -1;
  const arr = () => APP[cfg.array] || (APP[cfg.array] = []);
  const put = (id, v) => { const e = $(id); if (e) { e.value = (v == null ? '' : v); syncCodePicker(e); } };
  const setTitle = (t) => { const e = $(cfg.titleId); if (e) e.textContent = t; };
  /* UI-CAP-1 (owner 2026-10-05, capture option B): a sheet with a kind
     chooser (kindSwitchHtml, 00-forms.js; CAPTURE_KINDS, 01-data.js) opens
     on it while adding — data-kind-stage="pick" shows the chooser alone —
     and the pick moves into the form, titled for the kind ("Add Airbnb
     rental"). Editing opens on the form, titled "Edit …" for the record's
     kind; the header's Change button brings the chooser back (a cross-sheet
     kind — pension, two-pot, crypto — is fixed once saved, QR9b.3, so it
     has no Change while editing). */
  const kindBox = () => { const m = $(cfg.modalId); return m && m.querySelector('.kind-switch'); };
  const kindGroup = () => { const ks = kindBox(); return ks ? CAPTURE_KINDS[ks.getAttribute('data-kind-group')] : null; };
  const kindOpt = (v) => { const g = kindGroup(); return g ? g.options.find(o => o.value === v) : null; };
  /* The kind the sheet holds: its own (cross-sheet) or its select's value. */
  const currentKind = () => {
    const ks = kindBox(); if (!ks) return null;
    return ks.getAttribute('data-kind-own') || gs(kindGroup().field);
  };
  const titleFor = (adding, v) => {
    const o = kindOpt(v);
    return o && o.noun ? (adding ? 'Add ' : 'Edit ') + o.noun : (adding ? cfg.titles.add : cfg.titles.edit);
  };
  /* A tile is live while the kind select still offers its value — the
     profile gates (applyScenarioGates, run by openModal) and retired types
     hide the option, so they hide the tile. */
  const syncKindTiles = (pressed) => {
    const ks = kindBox(), g = kindGroup(); if (!ks) return;
    const sel = g.field ? $(g.field) : null;
    ks.querySelectorAll('.kind-tile').forEach(t => {
      const v = t.getAttribute('data-kind');
      const o = sel ? Array.from(sel.options).find(x => x.value === v) : null;
      t.classList.toggle('u-hidden', !!sel && (!o || o.hidden || o.disabled));
      const on = v === pressed;
      t.classList.toggle('sel', on); t.setAttribute('aria-pressed', String(on));
    });
  };
  const setStage = (stage, adding) => {
    const m = $(cfg.modalId); if (!m) return;
    m.setAttribute('data-kind-stage', stage);
    const ch = $(cfg.modalId + '-kind-change');
    if (ch) ch.hidden = stage !== 'form' || (!adding && !!kindBox().getAttribute('data-kind-own'));
  };
  const kindForm = (v, adding) => {
    syncKindTiles(v);
    setStage('form', adding);
    setTitle(titleFor(adding, v));
    const m = $(cfg.modalId);
    if (m && m.querySelector('.wiz-step')) { wizGoto(cfg.modalId, 0); return; }   // re-counts the live steps, focuses the first field
    const f = m && _modalFocusables(m).find(e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName));
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
  };
  const kindEnter = (adding, opts) => {
    const ks = kindBox(); if (!ks) return;
    if (!adding) { kindForm(currentKind(), false); return; }
    const own = ks.getAttribute('data-kind-own');
    /* Arrived from another kind's tile in the same group: already chosen. */
    if (own && opts && opts.kindGroup === ks.getAttribute('data-kind-group')) { kindForm(own, true); return; }
    syncKindTiles(null);
    const live = ks.querySelectorAll('.kind-tile:not(.u-hidden)');
    if (live.length === 1) { api.pickKind(live[0].getAttribute('data-kind')); return; }   // one kind left: nothing to ask
    setStage('pick', true);
    setTitle(kindGroup().addTitle || cfg.titles.add);
  };
  const fieldVal = (f, v) => {
    // Mirror legacy `item.x || ''` semantics: falsy (incl. 0) → default/blank
    return (v == null || v === '' || (f.kind === 'num' && !v)) ? (f.def != null ? f.def : '') : v;
  };
  const clearForm = () => {
    (cfg.fields || []).forEach(f => put(f.el, f.def != null ? f.def : ''));
    if (cfg.onClear) cfg.onClear();
    setTitle(cfg.titles.add);
    syncYn();
    if (cfg.onForm) cfg.onForm();
    fxRefreshWidgets($(cfg.modalId));
    refreshOptionNotes($(cfg.modalId));
  };
  const loadForm = (item) => {
    (cfg.fields || []).forEach(f => put(f.el, fieldVal(f, item[f.key])));
    if (cfg.onLoad) cfg.onLoad(item);
    setTitle(cfg.titles.edit);
    syncYn();   // repaints 'choice' tiles from the selects put() has just written
    if (cfg.onForm) cfg.onForm();
    fxRefreshWidgets($(cfg.modalId));
    refreshOptionNotes($(cfg.modalId));
  };
  const collect = (cur) => {
    if (cfg.collect) return cfg.collect(cur);
    const item = cfg.keepExtra && cur ? Object.assign({}, cur) : {};
    (cfg.fields || []).forEach(f => {
      if (f.kind === 'num') item[f.key] = gv(f.el) || 0;
      else if (f.kind === 'str') item[f.key] = (gs(f.el) || '').trim();
      else item[f.key] = gs(f.el) || (f.def != null ? f.def : '');
    });
    return item;
  };
  /* Monetization M2 (00-DESIGN §4.2): belt-and-braces entitlement gate on
     entry-point AND save (deep links / back-stack can reach a modal without
     passing the navigation gate). cfg.entKey names the feature; modules
     without one (free features) are untouched. Existing records keep
     rendering and computing — only add/edit/save are blocked. */
  const entGate = () => {
    if (cfg.entKey && !entUnlocked(cfg.entKey)) { entOnLockedTap(cfg.entKey); return true; }
    return false;
  };
  const api = {
    /* -1 while adding; the record's index while editing (for live notes
       that total the list without counting the edited record twice). */
    editingIndex() { return editIdx; },
    /* opts.kindGroup: opened from another sheet's tile in that chooser group
       (switchCaptureKind) — the kind is already chosen. */
    add(opts) { if (entGate()) return; editIdx = -1; clearForm(); clearFieldProblems($(cfg.modalId)); openModal(cfg.modalId); wizReset(cfg.modalId); kindEnter(true, opts); },
    edit(i) { if (entGate()) return; const item = arr()[i]; if (!item) return; editIdx = i; loadForm(item); clearFieldProblems($(cfg.modalId)); openModal(cfg.modalId); wizReset(cfg.modalId); kindEnter(false); },
    /* UI-CAP-1: a tile on this sheet's chooser was picked. A cross-sheet
       kind that is not this sheet swaps sheets; otherwise the kind is set —
       an in-sheet kind writes its select and fires its own change handler,
       so the form reshapes exactly as a change of that select always did —
       and the form shows. */
    pickKind(v) {
      const g = kindGroup(), o = kindOpt(v); if (!g || !o) return;
      if (o.modal && o.modal !== cfg.modalId) { switchCaptureKind(kindBox().getAttribute('data-kind-group'), v); return; }
      const adding = editIdx < 0;
      if (g.field) {
        const sel = $(g.field);
        if (sel && sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      if (cfg.onKind) cfg.onKind(v, adding);
      kindForm(v, adding);
    },
    /* The header's Change: back to the chooser, the current kind pressed. */
    changeKind() {
      if (!kindBox()) return;
      syncKindTiles(currentKind());
      setStage('pick', editIdx < 0);
      const t = kindBox().querySelector('.kind-tile.sel:not(.u-hidden)') || kindBox().querySelector('.kind-tile:not(.u-hidden)');
      if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
    },
    save() {
      if (cfg.entKey && !entUnlocked(cfg.entKey)) { closeModal(cfg.modalId); entOnLockedTap(cfg.entKey); return; }
      /* On-blur validation (BACKLOG 36): every live field on every step is
         checked; the first error is shown inline and focused (its step
         opened). Then the module's own cross-field rule: {el, msg} shows at
         that field; a bare string (none left in this file) would toast. */
      const m = $(cfg.modalId);
      if (m && checkScope(m, { includeEmpty: true })) return;
      const err = cfg.validate ? cfg.validate() : null;
      if (err) { if (typeof err === 'object' && err.el) flagField(err.el, err.msg); else showToast(err, 'warning'); return; }
      const item = collect(editIdx >= 0 ? arr()[editIdx] : null);
      const isNew = editIdx < 0;
      if (editIdx >= 0) arr()[editIdx] = item; else arr().push(item);
      closeModal(cfg.modalId);
      cfg.refresh();
      if (cfg.afterSave) cfg.afterSave(item);
      /* Batch A (UX #7): list-driven calculators save-as-you-go — refresh() has
         recomputed pendingValues, so commit straight to appliedValues. */
      if (cfg.applyType) commitPending(cfg.applyType);
      debounceSave();
      refreshDerived();
      noteStepCompleted(cfg.array);   // QR10a.3: one signal for "a step was completed"
      if (cfg.applyType) flashSaved();
      /* E5: adding a NEW income source is a small win and gets the short
         burst, on the page where it happened. Edits do not — re-opening a
         record to correct a figure is maintenance, not an achievement, and
         celebrating it would make the gesture meaningless. celebrateStep()
         rate-limits itself, so adding several records in a row does not
         stack bursts. */
      if (isNew && cfg.celebrateOnAdd) {
        setTimeout(function(){ celebrateStep(); }, 80);
      }
    },
    remove(iOrId) {
      showConfirm(cfg.confirm.title, cfg.confirm.msg, () => {
        if (cfg.removeBy === 'idOrIndex' && !(typeof iOrId === 'number' && iOrId < arr().length && arr()[iOrId])) {
          APP[cfg.array] = arr().filter(a => a.id !== iOrId);
        } else {
          arr().splice(iOrId, 1);
        }
        cfg.refresh();
        if (cfg.applyType) commitPending(cfg.applyType);
        debounceSave();
        refreshDerived();
        if (cfg.applyType) flashSaved();
      }, { tier: cfg.confirm.tier || 'del' });
    }
  };
  /* QR9b.3: modal id → module, so switchCaptureKind() can open another kind's
     sheet through its own add() (entitlement gate included). A property of
     the function, like `registry` above and for the same reason. */
  (makeCrudModule.byModal = makeCrudModule.byModal || {})[cfg.modalId] = api;
  return api;
}

/* QR9b.3 / QR9b.4 (QD-27): the kind chooser's handler. The user is on one
   kind's sheet and picks another: close it and open the other kind's sheet
   through its module's add(). Nothing typed is carried across — the sheets
   do not share fields — so if this sheet holds anything the user typed, ask
   first (the same question openProfileScenarios() asks before it leaves a
   sheet). Nothing is saved either way. */
export function switchCaptureKind(group, value) {
  const kinds = (CAPTURE_KINDS[group] || {}).options || [];
  const to = kinds.find(k => k.value === value);
  const open = document.querySelector('.modal-overlay.open');
  const from = open && kinds.find(k => k.modal === open.id);
  const mod = to && (makeCrudModule.byModal || {})[to.modal];
  if (!from || !mod || to === from) return;
  const go = () => { closeModal(open.id); mod.add({ kindGroup: group }); };
  if (formHoldsInput(open)) {
    showConfirm('Leave this form?',
      'What you have entered here is not saved. It does not carry over to “' + to.title + '”.', go,
      { tier: 'del', okLabel: 'Switch' });
    return;
  }
  go();
}

/* UI-CAP-1: a chooser tile's handler (kindSwitchHtml, 00-forms.js) — the
   sheet it sits on decides what the pick does (makeCrudModule pickKind). */
export function pickCaptureKind(group, value) {
  const box = document.querySelector('.modal-overlay.open .kind-switch[data-kind-group="' + group + '"]');
  const m = box && box.closest('.modal-overlay');
  const mod = m && (makeCrudModule.byModal || {})[m.id];
  if (mod) mod.pickKind(value);
}
/* The header's Change button (renderModal, 00-forms.js). */
export function changeCaptureKind(modalId) {
  const mod = (makeCrudModule.byModal || {})[modalId];
  if (mod) mod.changeKind();
}

/* QR0.1 registry accessor — see the comment on makeCrudModule above for why
   this isn't a plain top-level const. */
export function crudModuleConfigs() { return makeCrudModule.registry || []; }

/* ═══════════════════════════════════════════════════════════
   B2 INVESTMENT INCOME — BATCH 3 SECTION 2
   IT3(b) certificate capture with interest exemption auto-apply
   ═══════════════════════════════════════════════════════════ */

export const M_it3b = makeCrudModule({
  array: 'it3bItems', celebrateOnAdd: true, entKey: 'income.investment', applyType: 'interest', modalId: 'modal-it3b', titleId: 'it3b-modal-title',
  titles: { add: 'Add investment income', edit: 'Edit investment income' },
  fields: [
    { el:'it3b-institution',       key:'institution',          kind:'str' },
    { el:'it3b-account',           key:'accountRef',           kind:'str' },
    { el:'it3b-minor-attribution', key:'minorAttribution',     kind:'raw', def:'no' },
    { el:'it3b-ownership-share',   key:'ownershipShare',       kind:'num', def:100 },
    { el:'it3b-local-interest',    key:'localInterest',        kind:'num' },
    { el:'it3b-sars-interest',     key:'sarsInterest',         kind:'num' },
    { el:'it3b-foreign-interest',  key:'foreignInterest',      kind:'num' },
    { el:'it3b-foreign-dividends', key:'foreignDividends',     kind:'num' },
    { el:'it3b-reit',              key:'reitDistributions',    kind:'num' },
    { el:'it3b-reit-dividends',    key:'reitTaxableDividends', kind:'num' },
    { el:'it3b-other-loss',        key:'otherReceiptsLoss',    kind:'num' },
    { el:'it3b-local-div-taxable',  key:'taxableLocalDividends',  kind:'num' },
    { el:'it3b-local-div-exempt',   key:'exemptLocalDividends',   kind:'num' },
    { el:'it3b-foreign-cgt',       key:'foreignCapitalGains',  kind:'num' },
    { el:'it3b-foreign-tax-div',   key:'foreignTaxDividends',  kind:'num' },
    { el:'it3b-foreign-tax-int',   key:'foreignTaxInterest',   kind:'num' }
  ],
  /* UI-CAP-1: the certificate's kind is not saved — a new one starts South
     African only, a saved one is read from the halves that hold amounts. */
  onClear: () => { const k = $('it3b-kind'); if (k) k.value = 'local'; },
  onLoad: () => {
    const held = foreign => IT3B_CODES.some(c => c.foreign === foreign && (gv(_it3bFieldOf(c.row)) || 0) > 0);
    const k = $('it3b-kind'); if (k) k.value = held(true) ? (held(false) ? 'both' : 'foreign') : 'local';
  },
  onForm: () => { it3bUpdateLiveCalc(); it3bSyncOptionalFields(); it3bApplyKind(false); },
  validate: () => (gs('it3b-institution')||'').trim() ? null : { el:'it3b-institution', msg:'This is required.' },
  /* engine-remediation W4: it3bItems.foreignCapitalGains now feeds the CGT
     aggregate (renderCgtResult), not calcTaxableInvestment — refresh both so
     an IT3(b) save updates the CGT result immediately, same as interest. */
  refresh: () => { renderIt3bList(); calcInterest(); renderCgtResult(); },
  confirm: { title: 'Remove Certificate', msg: 'Delete this IT3(b) certificate?' }
});

/* QR9a (Q-INV-1): each IT3(b) amount line is born hidden and added by its
   code in the step's "Add an amount" picker. Runs on every add() and edit():
   shows exactly the lines that hold a value (none on Add, so a prior edit's
   lines never leak into the next Add) — IT3B_CODES (01-data.js) is the one
   list of lines, so a line added there is shown on edit without a second
   list here. A line's `pair` (its foreign tax withheld) travels with it. */
const _it3bFieldOf = rowId => rowId.replace(/-row$/, '');
function it3bSyncOptionalFields() {
  IT3B_CODES.forEach(c => {
    const held = (gv(_it3bFieldOf(c.row)) || 0) > 0 || (c.pair && (gv(_it3bFieldOf(c.pair)) || 0) > 0);
    [c.row, c.pair].forEach(id => { const r = id && $(id); if (r) r.style.display = held ? '' : 'none'; });
  });
  it3bSyncLines();
}
/* Offer in each step's picker only the lines not yet on the form; hide the
   picker once every line of its step is shown. */
function it3bSyncLines() {
  ['it3b-add-local', 'it3b-add-foreign'].forEach(id => {
    const store = $(id); if (!store) return;
    let left = 0;
    Array.from(store.options).forEach(o => {
      const c = IT3B_CODES.find(x => x.code === o.value), r = c && $(c.row);
      o.hidden = !!(r && r.style.display !== 'none');
      if (!o.hidden) left++;
    });
    store.value = '';
    const row = $(id + '-row'); if (row) row.style.display = left ? '' : 'none';
    syncCodePicker(store);
  });
}
/* The picker's onchange: show the chosen line (and its pair), take it out
   of the picker, and put the cursor in its amount. */
export function it3bAddLine(store) {
  const c = IT3B_CODES.find(x => x.code === (store && store.value));
  if (!c) return;
  [c.row, c.pair].forEach(id => { const r = id && $(id); if (r) r.style.display = ''; });
  it3bSyncLines();
  const inp = $(_it3bFieldOf(c.row)); if (inp) inp.focus();
}
/* UI-CAP-1: lay the certificate out for its kind (CAPTURE_KINDS.it3b) —
   South African only: the local half on step 1, no step 2; foreign only:
   the foreign half moved up into step 1 in its place; both: the foreign
   half is step 2. When the USER changes the kind, the half it leaves out
   is emptied, so an amount can never be saved from a half that is not on
   screen. */
export function it3bApplyKind(userChange) {
  const m = $('modal-it3b'); if (!m) return;
  const kind = gs('it3b-kind') || 'local';
  const steps = m.querySelectorAll('.wiz-step');
  const local = $('it3b-local-block'), foreign = $('it3b-foreign-block');
  if (userChange) {
    IT3B_CODES.filter(c => kind === 'both' ? false : (kind === 'local') === c.foreign).forEach(c =>
      [c.row, c.pair].forEach(id => { const inp = id && $(_it3bFieldOf(id)); if (inp) inp.value = ''; }));
    it3bSyncOptionalFields();
    it3bUpdateLiveCalc();
  }
  if (local) local.hidden = kind === 'foreign';
  if (foreign) {
    foreign.hidden = kind === 'local';
    const host = steps[kind === 'foreign' ? 0 : 1];
    if (host && foreign.parentElement !== host) host.insertBefore(foreign, host.querySelector('[data-wiz-live-final]'));
  }
  if (steps[1]) { if (kind === 'both') steps[1].removeAttribute('data-kind-off'); else steps[1].setAttribute('data-kind-off', '1'); }
}
export function addIt3bItem()     { M_it3b.add(); }
export function editIt3bItem(i)   { M_it3b.edit(i); }
export function saveIt3bItem()    { M_it3b.save(); }
export function removeIt3bItem(i) { M_it3b.remove(i); }

/* ═══════════════════════════════════════════════════════════
   TAX-FREE INVESTMENTS (QR9a, QD-12; s12T)
   Own list, per the ITR12's Tax Free Investments section — not an
   account type on an IT3(b) any more. The tax figure (the s12T(7) excess
   charge) is the engine's: calcTfiCharge / tfiChargeForActiveYear
   (02-core.js), which calcFullTax adds to the year's balance. Nothing here
   re-derives it.
   ═══════════════════════════════════════════════════════════ */
const TFI_FIELDS = [
  { el:'tfi-institution',   key:'institution',   kind:'str' },
  { el:'tfi-type',          key:'investmentType', kind:'raw', def:'deposit' },
  { el:'tfi-reference',     key:'reference',     kind:'str' },
  { el:'tfi-contributions', key:'contributions', kind:'num' },
  { el:'tfi-transfer-in',   key:'transferIn',    kind:'num' },
  { el:'tfi-transfer-out',  key:'transferOut',   kind:'num' },
  { el:'tfi-withdrawals',   key:'withdrawals',   kind:'num' },
  { el:'tfi-interest',      key:'interest',      kind:'num' },
  { el:'tfi-dividends',     key:'dividends',     kind:'num' },
  { el:'tfi-capital-gain',  key:'capitalGain',   kind:'num' },
  { el:'tfi-capital-loss',  key:'capitalLoss',   kind:'num' },
  { el:'tfi-net-profit',    key:'netReturnProfit', kind:'num' },
  { el:'tfi-net-loss',      key:'netReturnLoss', kind:'num' },
  { el:'tfi-other',         key:'otherReturn',   kind:'num' }
];
export const M_tfi = makeCrudModule({
  array: 'tfiItems', celebrateOnAdd: true, entKey: 'income.investment', modalId: 'modal-tfi', titleId: 'tfi-modal-title',
  titles: { add: 'Add a tax-free investment', edit: 'Edit tax-free investment' },
  fields: TFI_FIELDS,
  keepExtra: true,   // a migrated record keeps migratedFrom (QR9a.3) across an edit
  onForm: () => tfiUpdateLimitNote(),
  validate: () => (gs('tfi-institution') || '').trim() ? null : { el:'tfi-institution', msg:'This is required.' },
  refresh: () => renderTfiList(),
  confirm: { title: 'Remove tax-free investment', msg: 'Delete this tax-free investment?' }
});
export function addTfiItem()     { M_tfi.add(); }
export function editTfiItem(i)   { M_tfi.edit(i); }
export function saveTfiItem()    { M_tfi.save(); }
export function removeTfiItem(i) { M_tfi.remove(i); }

/* The yearly-limit line under the contributions field, counting the other
   investments already on the list plus what is typed here (the edited
   record replaced, not double-counted). Same primitive as the engine. */
export function tfiUpdateLimitNote() {
  const el = $('tfi-limit-note'); if (!el) return;
  const editing = M_tfi.editingIndex();
  const others = (APP.tfiItems || []).filter((it, i) => i !== editing && !it.forMinorChild);
  const t = calcTfiCharge(others.concat([{ contributions: gv('tfi-contributions') || 0 }]), APP.tfiPriorContributions, getActiveTaxYear());
  if (t.annualLimit == null) { el.textContent = ''; el.classList.add('u-hidden'); return; }
  el.classList.remove('u-hidden');
  el.innerHTML = 'Contributions this year across all your tax-free investments: <strong>' + fmt(t.contributions) + '</strong> of the ' + fmt(t.annualLimit) + ' yearly limit.'
    + (t.charge > 0 ? ' <strong>Over the limit</strong> — SARS adds ' + fmt(t.charge) + ' to your tax (s12T(7)).' : '');
}

/* Shown when the profile has not ruled TFSAs out (QR7 gate `tfsa`, QD-24:
   unanswered shows), or whenever something is already captured — captured
   data is never hidden (QD-10). */
export function renderTfiList() {
  const card = $('tfi-card'); if (!card) return;
  const items = APP.tfiItems || [];
  const prior = APP.tfiPriorContributions || 0;
  const show = scenarioAllows('tfsa') || items.length > 0 || prior > 0;
  card.classList.toggle('u-hidden', !show);
  if (!show) return;
  const typeLabel = v => (TFI_INVESTMENT_TYPES.find(t => t.value === v) || {}).label || '';
  const listEl = $('tfi-list');
  if (listEl) listEl.innerHTML = items.map((it, i) => `<div class="card" style="margin-bottom:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.9375rem;margin-bottom:2px">${esc(it.institution)}</div>
          <div style="font-size:0.6875rem;color:var(--tx3);margin-bottom:4px">${esc(typeLabel(it.investmentType))}${it.reference ? ' · ' + esc(it.reference) : ''}</div>
          ${it.forMinorChild ? '<span class="pill" style="font-size:0.625rem;background:rgba(212,163,45,0.15);color:var(--wa)">Child\'s TFSA \u2014 counts toward the child\'s limits, not yours</span>' : ''}
          <div style="font-size:0.75rem;color:var(--tx2)">Contributed this year: <strong class="mono">${fmt(it.contributions || 0)}</strong>${(it.transferIn || 0) > 0 ? ' · transferred in ' + fmt(it.transferIn) + ' (not counted)' : ''}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-ghost btn-xs" onclick="editTfiItem(${i})" aria-label="Edit tax-free investment"><i class="material-symbols-outlined msi-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="removeTfiItem(${i})" aria-label="Remove tax-free investment"><i class="material-symbols-outlined msi-delete"></i></button>
        </div>
      </div>
    </div>`).join('');
  const priorEl = $('tfi-prior');
  /* the raw number, as sv() writes masked fields — a locale-formatted string
     ("218,000") would be re-read by the mask as R218 */
  if (priorEl && document.activeElement !== priorEl) priorEl.value = prior > 0 ? String(Math.round(prior)) : '';
  const sumEl = $('tfi-summary');
  if (!sumEl) return;
  const t = tfiChargeForActiveYear();
  if (t.annualLimit == null) { sumEl.innerHTML = ''; return; }
  const pctY = Math.min(100, t.annualLimit ? (t.contributions / t.annualLimit) * 100 : 0);
  sumEl.innerHTML = (items.length ? '<div class="sum-line divider total"><span class="lbl">Contributed this year</span><span class="val">' + fmt(t.contributions) + '</span></div>'
      + '<div class="tfi-meter" role="img" aria-label="' + Math.round(pctY) + '% of the yearly limit used"><i style="width:' + pctY.toFixed(1) + '%"></i></div>' : '')
    + '<p class="u-note-xs note-line">' + noteBody(fmt(t.contributions) + ' of ' + fmt(t.annualLimit) + ' this year · ' + fmt(t.prior + t.contributions) + ' of ' + fmt(t.lifetimeLimit) + ' lifetime.', 'Transfers between your own tax-free investments, and the returns inside them, do not count towards either limit.', 'Tax-free limits') + '</p>'
    + (t.charge > 0
      ? noteHtml('warning', 'Over your tax-free limit: ' + fmt(t.charge) + ' is added to your tax.',
          'You are over the '
        + (t.chargeAnnual > 0 && t.chargeLifetime > 0 ? 'yearly and lifetime limits' : t.chargeAnnual > 0 ? 'yearly limit by ' + fmt(t.annualExcess) : 'lifetime limit by ' + fmt(t.lifetimeExcess))
        + '. SARS adds ' + Math.round(S12T_EXCESS_CHARGE_RATE * 100) + '% of the excess to your tax (s12T(7)): <strong>' + fmt(t.charge) + '</strong>, included in your tax balance.', { style: 'margin-top:8px', title: 'Over the tax-free limit' })
      : '');
}
/* Earlier-years total for the lifetime test — one figure for all the
   user's tax-free investments, kept on APP (not a list record). */
export function setTfiPriorContributions() {
  APP.tfiPriorContributions = Math.max(0, gv('tfi-prior') || 0);
  renderTfiList();
  refreshDerived();
  debounceSave();
}

/* QR3.2: fill the two s10(1)(i) notes (local half, foreign half) — text
   from interestExemptionNote(), applied amount from calcFullTax().intExempt. */
function it3bRenderInterestNotes() {
  const ty = getActiveTaxYear();
  const is65 = calcAgeAtYearEnd() >= 65;
  const applied = calcFullTax().intExempt || 0;
  const loc = $('it3b-interest-note-local'), fgn = $('it3b-interest-note-foreign');
  /* UI-NOTE-1: one line each; the full s10(1)(i) explanation behind More. */
  const limit = is65 ? ty.interest.age65 : ty.interest.under65;
  setNote(loc, 'info', 'Up to ' + fmt(limit) + ' of SA interest a year is tax-free.', esc(interestExemptionNote(ty, is65, 'local', applied, fmt)), { title: 'Interest exemption' });
  setNote(fgn, 'info', 'Foreign interest is fully taxable.', esc(interestExemptionNote(ty, is65, 'foreign', applied, fmt)), { title: 'Foreign interest' });
}

export function it3bUpdateLiveCalc() {
  it3bRenderInterestNotes();
  const localInt = gv('it3b-local-interest') || 0;
  const sarsInt  = gv('it3b-sars-interest') || 0;
  const localDivExempt = gv('it3b-local-div-exempt') || 0;
  const totalLocal = localInt + sarsInt;
  const liveEl = $('it3b-live-calc'); if(!liveEl) return;
  if(totalLocal === 0 && localDivExempt === 0) { liveEl.innerHTML = ''; return; }

  /* UI-NOTE-1: one line — what is exempt on the return so far — with the
     per-certificate detail and the sections behind More (was three boxes). */
  const parts = [];
  if(totalLocal > 0) {
    const age = calcAgeAtYearEnd();
    const ty = getActiveTaxYear();
    const exemption = age >= 65 ? ty.interest.age65 : ty.interest.under65;
    parts.push(`Local interest on this certificate: <strong>${fmt(totalLocal)}</strong>. The s10(1)(i) exemption (${fmt(exemption)}) is applied across all your certificates when you apply.`);
  }
  if(localDivExempt > 0) {
    parts.push(`Exempt local dividends on this certificate: <strong>${fmt(localDivExempt)}</strong> — fully exempt under s10(1)(k).`);
  }
  /* Engine output only (hard rule 2): r.tei is calcFullTax()'s canonical
     tax-exempt total over the SAVED certificates and the rest of the return. */
  const tei = calcFullTax().tei;
  liveEl.innerHTML = noteHtml('lime', `Tax-exempt on your return so far: ${fmt(tei)}.`, parts.join('<br><br>') + '<br><br>The total counts saved certificates only.', { icon: 'check', title: 'Tax-exempt income' });
}

export function renderIt3bList() {
  const listEl = $('it3b-list'); if(!listEl) return;
  if(!APP.it3bItems.length) {
    /* QA 2026-09: the persistent "+ Add investment income" button at the top
       of the page (body.html) is the only add-CTA now — this was a second
       one, below an explanatory line that duplicated the hero's empty copy. */
    listEl.innerHTML = '';
    const glEl = $('glance-b2investment'); if(glEl) glEl.innerHTML = '';
    const heroEl0 = $('hero-b2investment'); if(heroEl0) heroEl0.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')"><div class="dhero-top"><div class="dhero-lbl">Total investment income</div></div><div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b2investment">' + fmt(0) + '</div><div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No IT3(b) certificates yet — add your first below to see your interest, dividends and exemptions.</div></div>';
    const sumEl = $('it3b-totals'); if(sumEl) sumEl.innerHTML = '';
    if(typeof renderBucketNav === 'function') renderBucketNav();
    return;
  }
  let totalLocal = 0, totalForeignInt = 0, totalForeignDiv = 0, totalReit = 0, totalFTC = 0, totalOtherLoss = 0, totalForeignCgt = 0, totalLocalDivTaxable = 0, totalReitDiv = 0;
  listEl.innerHTML = APP.it3bItems.map((item, i) => {
    /* QR9a: TFSAs live under Tax-free investments. A certificate that still
       reaches it3bItems flagged as one is exempt — kept out of these totals,
       as taxableIt3bItems() keeps it out of the engine, and labelled so it is
       not mistaken for taxable. */
    if (item.isTfsa === 'yes') return `<div class="card" style="margin-bottom:10px;padding:14px 16px"><div style="font-weight:700;font-size:0.9375rem">${esc(item.institution)}</div><span class="pill" style="font-size:0.625rem;background:rgba(46,184,138,0.15);color:var(--ok)">TFSA \u2014 exempt (s12T)</span></div>`;
    const local = (item.localInterest||0) + (item.sarsInterest||0);
    const ftc   = (item.foreignTaxDividends||0) + (item.foreignTaxInterest||0);
    totalLocal += local;
    totalForeignInt += (item.foreignInterest||0);
    totalForeignDiv += (item.foreignDividends||0);
    totalReit += (item.reitDistributions||0);
    totalReitDiv += (item.reitTaxableDividends||0);
    totalFTC  += ftc;
    totalOtherLoss  += (item.otherReceiptsLoss||0);
    totalForeignCgt += (item.foreignCapitalGains||0);
    totalLocalDivTaxable += (item.taxableLocalDividends||0);
    const total = local + (item.foreignInterest||0) + (item.foreignDividends||0) + (item.reitDistributions||0) + (item.reitTaxableDividends||0) + (item.foreignCapitalGains||0) - (item.otherReceiptsLoss||0) + (item.taxableLocalDividends||0);
    const parts = [];
    if(local > 0)                  parts.push(`<span>Local interest: <strong>${fmt(local)}</strong></span>`);
    if(item.foreignInterest > 0)   parts.push(`<span>Foreign int: <strong>${fmt(item.foreignInterest)}</strong></span>`);
    if(item.foreignDividends > 0)  parts.push(`<span>Foreign div: <strong>${fmt(item.foreignDividends)}</strong></span>`);
    if(item.reitDistributions > 0) parts.push(`<span>Other receipts: <strong>${fmt(item.reitDistributions)}</strong></span>`);
    if(item.reitTaxableDividends > 0) parts.push(`<span>REIT / taxable dividends: <strong>${fmt(item.reitTaxableDividends)}</strong></span>`);
    if(item.otherReceiptsLoss > 0) parts.push(`<span style="color:var(--er)">Other receipts loss: <strong>${fmt(item.otherReceiptsLoss)}</strong></span>`);
    if(item.foreignCapitalGains > 0) parts.push(`<span>Foreign CGT: <strong>${fmt(item.foreignCapitalGains)}</strong></span>`);
    if(item.taxableLocalDividends > 0) parts.push(`<span>Dividends s8E/8EA: <strong>${fmt(item.taxableLocalDividends)}</strong></span>`);
    if(ftc > 0)                    parts.push(`<span style="color:var(--ok)">FTC: <strong>${fmt(ftc)}</strong></span>`);
    return `<div class="card" style="margin-bottom:10px;padding:14px 16px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div class="card-ico-head-icon ico-bg-green ico-sz-40"><i class="material-symbols-outlined msi-description"></i></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.9375rem;margin-bottom:2px">${esc(item.institution)}</div>
              ${item.accountRef ? `<div style="font-size:0.6875rem;color:var(--tx3);margin-bottom:4px">${esc(item.accountRef)}</div>` : ''}
              <span class="pill" style="font-size:0.625rem;background:color-mix(in srgb, var(--blue) 15%, transparent);color:var(--blue)">IT3(b)</span>
              ${item.minorAttribution === 'yes' ? ' <span class="pill" style="font-size:0.625rem;background:rgba(212,163,45,0.15);color:var(--wa)">Child\'s a/c — s7(3)</span>' : ''}
              ${(item.ownershipShare != null && item.ownershipShare < 100) ? ` <span class="pill" style="font-size:0.625rem">${item.ownershipShare}% share</span>` : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-xs" onclick="editIt3bItem(${i})" aria-label="Edit certificate"><i class="material-symbols-outlined msi-edit"></i></button>
              <button class="btn btn-danger btn-xs" onclick="removeIt3bItem(${i})" aria-label="Remove certificate"><i class="material-symbols-outlined msi-delete"></i></button>
            </div>
          </div>
          ${parts.length ? `<div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;font-size:0.75rem;color:var(--tx2)">${parts.join('')}</div>` : ''}
          <div style="margin-top:6px;font-size:0.8125rem;font-family:var(--mono);font-weight:600;color:var(--tx)">${fmt(total)}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const sumEl = $('it3b-totals');
  if(sumEl) {
    sumEl.innerHTML = `
      <div class="sum-line"><span class="lbl">Total local interest (codes 4201 + 4237)</span><span class="val">${fmt(totalLocal)}</span></div>
      ${totalForeignInt > 0 ? `<div class="sum-line"><span class="lbl">Total foreign interest (code 4218)</span><span class="val">${fmt(totalForeignInt)}</span></div>` : ''}
      ${totalForeignDiv > 0 ? `<div class="sum-line"><span class="lbl">Total foreign dividends (code 4216)</span><span class="val">${fmt(totalForeignDiv)}</span></div>` : ''}
      ${totalReit > 0 ? `<div class="sum-line"><span class="lbl">Total other receipts and accruals — profit (code 4214)</span><span class="val">${fmt(totalReit)}</span></div>` : ''}
      ${totalOtherLoss > 0 ? `<div class="sum-line"><span class="lbl">Total other receipts and accruals — loss (code 4215)</span><span class="val">−${fmt(totalOtherLoss)}</span></div>` : ''}
      ${totalForeignCgt > 0 ? `<div class="sum-line"><span class="lbl">Total foreign capital gains (code 4114)</span><span class="val">${fmt(totalForeignCgt)}</span></div>` : ''}
      ${totalReitDiv > 0 ? `<div class="sum-line"><span class="lbl">Distributions from a REIT / taxable local dividends (code 4238)</span><span class="val">${fmt(totalReitDiv)}</span></div>` : ''}
      ${totalLocalDivTaxable > 0 ? `<div class="sum-line"><span class="lbl">Dividends deemed to be income — s8E/8EA (code 4292)</span><span class="val">${fmt(totalLocalDivTaxable)}</span></div>` : ''}
      ${totalFTC > 0 ? `<div class="sum-line"><span class="lbl">Foreign tax credits (codes 4112 + 4113)</span><span class="val">${fmt(totalFTC)}</span></div>` : ''}`;
  }

  // v8.27 Focus: surface the total as a hero at the top of the sub-tab
  const totalIncome = totalLocal + totalForeignInt + totalForeignDiv + totalReit + totalReitDiv + totalForeignCgt - totalOtherLoss + totalLocalDivTaxable;
  const heroEl = $('hero-b2investment');
  if(heroEl) {
    heroEl.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
      + '<div class="dhero-top"><div class="dhero-lbl">Total investment income</div>'
      + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + APP.it3bItems.length + ' certificate' + (APP.it3bItems.length!==1?'s':'') + '</span></div>'
      + '<div class="dhero-num" data-count="' + (totalIncome) + '" data-count-key="income-b2investment">' + fmt(totalIncome) + '</div>'
      + '<div class="dhero-break">' + (totalLocal > 0 ? '<span class="mono">' + fmt(totalLocal) + '</span> local interest \u00b7 <span style="color:var(--au)">interest exemption applies</span>' : '') + heroBreakdownLink('investment') + '</div>'
      + '</div>';
  }
  /* Batch M: 4 expandable calc-breakdown cards replace the old single
     "Foreign Income s6quat..." teaser card. Taxable investment income reuses
     calcTaxableInvestment() directly -- never re-derive tax math inline. */
  const glEl = $('glance-b2investment');
  if(glEl) {
    const ty = getActiveTaxYear();
    const age = calcAgeAtYearEnd();
    const exemption = age >= 65 ? ty.interest.age65 : ty.interest.under65;
    const localIncome = totalLocal + totalReit + totalReitDiv - totalOtherLoss + totalLocalDivTaxable;
    const foreignDivTaxable = totalForeignDiv * FOREIGN_DIVIDEND_TAXABLE_RATIO;
    const foreignDivExcluded = totalForeignDiv - foreignDivTaxable;
    const foreignIncome = totalForeignInt + foreignDivTaxable + totalForeignCgt;
    /* s10(1)(i): local interest only — foreign interest is fully taxable, never pooled
       (Q-INV-5; mirrors calcTaxableInvestment()). */
    const taxableInterest = Math.max(0, totalLocal - exemption) + totalForeignInt;
    const taxableInvestment = calcTaxableInvestment(ty, age);
    const otherLocalInvestment = totalReit + totalReitDiv - totalOtherLoss + totalLocalDivTaxable;

    function card(id, lbl, val, rows) {
      return `<details class="calc-card" id="${id}">
        <summary><div><div class="calc-card-lbl">${lbl}</div><div class="calc-card-val">${fmt(val)}</div></div><i class="material-symbols-outlined msi-expand-more chev"></i></summary>
        <div class="calc-card-body">${rows}</div>
      </details>`;
    }
    function row(lbl, amt, isTotal) {
      return `<div class="calc-row${isTotal?' total':''}"><span>${lbl}</span><span class="amt">${fmt(amt)}</span></div>`;
    }

    let html = '';
    html += card('calc-local-income', 'Local income', localIncome,
      row('Local interest (4201 + 4237)', totalLocal) +
      row('Other receipts and accruals — profit (4214)', totalReit) +
      (totalOtherLoss > 0 ? row('Other receipts and accruals — loss (4215)', -totalOtherLoss) : '') +
      (totalReitDiv > 0 ? row('Distributions from a REIT / taxable local dividends (4238)', totalReitDiv) : '') +
      (totalLocalDivTaxable > 0 ? row('Dividends deemed to be income — s8E/8EA (4292)', totalLocalDivTaxable) : '') +
      row('Local income (before exemption)', localIncome, true));
    if (totalForeignInt > 0 || totalForeignDiv > 0 || totalForeignCgt > 0) {
      html += card('calc-foreign-income', 'Foreign income', foreignIncome,
        row('Foreign interest (4218)', totalForeignInt) +
        (totalForeignDiv > 0 ? row('Foreign dividends (4216)', totalForeignDiv) : '') +
        (totalForeignDiv > 0 ? row('&nbsp;&nbsp;less 25/45 exempt (s10B)', -foreignDivExcluded) : '') +
        (totalForeignDiv > 0 ? row('&nbsp;&nbsp;20/45 included in taxable income', foreignDivTaxable) : '') +
        (totalForeignCgt > 0 ? row('Foreign capital gains (4114)', totalForeignCgt) : '') +
        row('Foreign income (taxable)', foreignIncome, true));
    }
    /* QR3.2 (Q-INV-5): the s10(1)(i) exemption applies to LOCAL interest only;
       foreign interest is fully taxable and never absorbs unused local
       allowance. (The earlier "T-2" card pooled the two — wrong in law and
       inconsistent with calcTaxableInvestment().) */
    const _exemptOnLocal = Math.min(exemption, totalLocal);
    html += card('calc-taxable-interest', 'Taxable interest', taxableInterest,
      row('Local interest', totalLocal) +
      row('&nbsp;&nbsp;less s10(1)(i) exemption', -_exemptOnLocal) +
      row('Local interest (after exemption)', totalLocal - _exemptOnLocal) +
      row('Foreign interest (no exemption)', totalForeignInt) +
      row('Taxable interest', taxableInterest, true));
    html += card('calc-taxable-investment', 'Taxable investment income', taxableInvestment,
      row('Local interest after exemption', Math.max(0, totalLocal - exemption)) +
      row('Foreign interest', totalForeignInt) +
      row('Foreign dividend after exclusion', foreignDivTaxable) +
      row('Other local investment income', otherLocalInvestment) +
      (totalForeignCgt > 0 ? row('Foreign capital gains', totalForeignCgt) : '') +
      row('Taxable investment income', taxableInvestment, true));
    glEl.innerHTML = html;
  }

  if(typeof renderBucketNav === 'function') renderBucketNav();
}

/* Crypto parent checkbox — shows/hides sub-checkboxes */
/* V8.9 cleanup: legacy crypto parent/sub toggles removed (crypto is now a single source → B10) */

/* Onboarding income sub-tiles are now flat, directly-selectable checkboxes
   (no parent → sub-row cascade), so the former obSync*Subs helpers were
   removed along with the redundant primary sub-tiles they toggled. */

/* V8.6 C4 — medical scheme membership follow-up */
export function obToggleMedicalSchemeQ() {
  const yes = document.querySelector('input[name="ob-medical"]:checked')?.value === 'yes';
  const block = $('ob-medical-scheme-block');
  if (block) block.style.display = yes ? 'block' : 'none';
  /* Owner brief 2026-09-14 (PLAN.md §8 step 3): the tax-reduces-your-return
     note only makes sense once the answer is yes — it stays hidden
     otherwise, same contract as the step-4 activation notes. */
  const taxNote = $('ob-medical-tax-note');
  if (taxNote) taxNote.style.display = yes ? '' : 'none';
  if (!yes) {
    /* clear sub-Qs when parent reverts to No — the disability question is
       QA 2026-09 round 2's sibling of the member block, gated on THIS
       answer (not membership), so it clears here too. */
    document.querySelectorAll('input[name="ob-medical-member"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="ob-medical-disabled"]').forEach(r => r.checked = false);
    obToggleMedicalSchemeName();
  }
}
/* "Yes — I am a member" reveals the member-detail block: scheme name (with
   autocomplete) and the dependants-count follow-up. The disability question
   below it is independent of membership (QA 2026-09 round 2) — an
   out-of-pocket-only respondent can still claim the disability medical
   credit — so it is no longer cleared or hidden here. */
export function obToggleMedicalSchemeName() {
  const isMember = document.querySelector('input[name="ob-medical-member"]:checked')?.value === 'yes';
  const block = $('ob-medical-member-details');
  if (block) block.style.display = isMember ? 'block' : 'none';
  /* Owner brief 2026-09-14 (PLAN.md §8 step 3): Q2 ("member of a scheme?")
     becomes required once Q1 is yes (obValidateCurrentStep case 3). Any
     answer here — including reverting Q1 to No, which clears the radios —
     resolves that inline error. */
  const err = $('ob-medical-member-error'); if (err) err.style.display = 'none';
  if (!isMember) {
    const nameInput = $('ob-medical-scheme-name');
    if (nameInput) nameInput.value = '';
    const cnt = $('ob-medical-members'); if (cnt) cnt.value = '';
    obOnMedicalMembersChange();
  }
}
/* QA 2026-08: onboarding asks the medical member count the same way the
   Medical deductions page does — "including you" — so the two screens cannot
   disagree by one. This echoes the derived split back in words, exactly like
   renderMedMembersEcho() does there. The engine input (med_deps, dependants
   EXCLUDING the main member) is derived on apply, not here. */
export function obOnMedicalMembersChange() {
  const el = $('ob-medical-members');
  const echo = $('ob-medical-members-echo');
  if (!echo) return;
  const members = Math.max(0, Math.floor(parseInt((el && el.value || '').replace(/\D/g, ''), 10) || 0));
  if (!members) { echo.innerHTML = ''; return; }
  const deps = Math.max(0, members - 1);
  echo.innerHTML = '<div class="note good" style="margin-top:6px">'
    + "That's you" + (deps > 0 ? ' plus ' + deps + ' dependant' + (deps === 1 ? '' : 's') : ' only')
    + '.</div>';
}

/* V8.9 cleanup: restoreCryptoParentState removed (legacy crypto sub-checkboxes no longer exist) */

/* ═══════════════════════════════════════════════════════════
   B4 BUSINESS INCOME — BATCH 4 SECTION 1
   Multi-business list, gross + categorised expenses, foreign flag
   a loss note saying when SARS may ring-fence it (s20A — notice only)
   Option A double-count warnings vs standalone deductions
   ═══════════════════════════════════════════════════════════ */

export const B4_EXPENSE_CATEGORIES = [
  {id:'cost_sales',     label:'Cost of sales / Purchases',           overlap:null},
  {id:'salaries',       label:'Salaries & wages',                    overlap:null},
  {id:'rent',           label:'Rent paid',                           overlap:'homeoffice'},
  {id:'lease',          label:'Lease payments (equipment / vehicle)',overlap:'travel'},
  {id:'repairs',        label:'Repairs & maintenance',               overlap:null},
  {id:'telephone',      label:'Telephone / internet',                overlap:'homeoffice'},
  {id:'bank',           label:'Bank charges',                        overlap:null},
  {id:'professional',   label:'Professional fees (accountants, lawyers)', overlap:'subscrip'},
  {id:'travel',         label:'Travel & vehicle (business)',         overlap:'travel'},
  {id:'depreciation',   label:'Wear & tear',                        overlap:'tools'},
  {id:'insurance',      label:'Insurance',                           overlap:null},
  {id:'marketing',      label:'Marketing & advertising',             overlap:null},
  {id:'office',         label:'Office supplies / Stationery',        overlap:null},
  {id:'subscriptions',  label:'Subscriptions & memberships',         overlap:'subscrip'},
  {id:'bad_debts',      label:'Bad debts written off',               overlap:null},
  {id:'utilities',      label:'Utilities (electricity, water)',      overlap:'homeoffice'},
  {id:'training',       label:'Training & development',              overlap:null},
  {id:'interest_biz',   label:'Interest paid (business)',            overlap:null},
  {id:'other',          label:'Other (see note)',                    overlap:null}
];

/* The loss note on a business or rental card. One function for both, because
   the two said the same thing in two places and drifted apart once already.

   BACKLOG 16/57 (DECISIONS OI-D1b): a notice, not a determination. It says
   what the app did with the loss (s20(1)(b): set off against other income
   this year) and when SARS may instead ring-fence it — s20A(1) only reaches a
   person whose income before the set-off is at the top marginal rate, and
   then only a trade with a loss in 3 of the last 5 years (s20A(2)(a)) or a
   listed suspect trade such as letting residential accommodation less than
   80 % to non-relatives (s20A(2)(b)(iii)), subject to the
   reasonable-prospect-of-profit escape (s20A(3)). No figure is typed: the
   top bracket is named, not quoted (hard rule 5). */
export function tradeLossNote(kind, net) {
  if (net >= 0) return '';
  const amt = fmt(Math.abs(net));
  return '<div class="note warning" style="margin:6px 0 0;font-size:0.6875rem;padding:6px 10px">'
    + '<i class="material-symbols-outlined msi-warning u-mr-5"></i>'
    + '<strong>' + kind + ' loss of ' + amt + '</strong> \u2014 the app sets it against your other income this year. '
    + 'If your income before this loss reaches the top tax bracket, SARS can instead <strong>ring-fence</strong> it '
    + '(s20A) when this trade has made a loss in 3 of the last 5 years, or lets a home mostly to relatives. '
    + 'InspiredTax does not apply that \u2014 if it may apply to you, check with a tax practitioner.</div>';
}

export const M_business = makeCrudModule({
  array: 'businessItems', celebrateOnAdd: true, entKey: 'income.business', applyType: 'business', modalId: 'modal-business', titleId: 'biz-modal-title',
  titles: { add: 'Add business or trade', edit: 'Edit business or trade' },
  fields: [
    { el:'biz-type',   key:'bizType', kind:'raw', def:'freelancer' },
    { el:'biz-foreign-tax', key:'foreignTax', kind:'num' },
    { el:'biz-name',   key:'name',    kind:'str' },
    { el:'biz-income', key:'income',  kind:'num' },
    { el:'biz-psp-majorclient', key:'pspMajorClient', kind:'raw', def:'no' },
    { el:'biz-psp-control',     key:'pspControl',     kind:'raw', def:'no' },
    { el:'biz-psp-employees',   key:'pspEmployees',   kind:'raw', def:'no' },
  ],
  onClear: () => {
    const tbody = $('biz-expense-rows'); if(tbody) tbody.innerHTML = '';
    bizSeedCosts();
    const tc = $('biz-trade-confirm'); if(tc) tc.checked = false;
    const tcBlock = $('biz-trade-confirm-block'); if(tcBlock) tcBlock.classList.add('u-hidden');
  },
  onLoad: (b) => {
    const tbody = $('biz-expense-rows'); if(tbody) tbody.innerHTML = '';
    (b.expenses || []).forEach(exp => bizAddExpenseRow(exp));
    if(!b.expenses || !b.expenses.length) bizSeedCosts();
    const tc = $('biz-trade-confirm'); if(tc) tc.checked = !!b.tradeConfirmed;
  },
  onForm: () => { bizToggleForeign(); bizTogglePsp(); bizUpdateLiveCalc(); bizUpdateOverlapWarning(); },
  onKind: () => { bizSeedCosts(); bizUpdateLiveCalc(); },   // UI-CAP-1 (rule 6): the usual cost lines for the kind
  validate: () => {
    if (!(gs('biz-name')||'').trim()) return { el:'biz-name', msg:'This is required.' };
    const income = gv('biz-income') || 0;
    const totalExp = bizCollectExpenses().reduce((s,e)=>s+e.amount, 0);
    /* REVIEW AMENDMENT (b): a record with no income, only expenses, needs an
       explicit confirmation before its loss can flow — s11(a) and s23(g)
       both require a trade "carried on in the production of income".
       BACKLOG 57: the checkbox is shown exactly in this case
       (bizUpdateLiveCalc); it was hidden behind the retired ring-fencing
       flag, so the save refused with no visible field. */
    if (income === 0 && totalExp > 0 && !($('biz-trade-confirm') && $('biz-trade-confirm').checked)) {
      return { el:'biz-trade-confirm', msg:'Confirm this is a trade carried on in the production of income before saving a loss with no income.' };
    }
    return null;
  },
  collect: () => {
    const bizType = gs('biz-type') || 'freelancer';
    const name = (gs('biz-name')||'').trim();
    const income = gv('biz-income') || 0;
    const expenses = bizCollectExpenses();
    const tradeConfirmed = !!($('biz-trade-confirm') && $('biz-trade-confirm').checked);
    /* C-10: same zero-on-type-switch convention as foreignTax above — these
       are disclosure-only flags, never consumed by the engine, but stale
       'yes' answers surviving a switch away from Freelancer would still be
       misleading on the record's own card. */
    const _pspApplies = bizType === 'freelancer';
    return {
      bizType,
      foreign:  bizType === 'foreign' ? 'yes' : 'no',
      /* Batch I (#70): zeroed on a non-foreign type so switching away from
         "Foreign business" can't leave a stale credit feeding s6quat. */
      foreignTax: bizType === 'foreign' ? (gv('biz-foreign-tax') || 0) : 0,
      name,
      income,
      expenses,
      tradeConfirmed,
      pspMajorClient: _pspApplies ? (gs('biz-psp-majorclient') || 'no') : 'no',
      pspControl:     _pspApplies ? (gs('biz-psp-control') || 'no') : 'no',
      pspEmployees:   _pspApplies ? (gs('biz-psp-employees') || 'no') : 'no'
    };
  },
  refresh: () => renderBusinessList(),
  confirm: { title: 'Remove Business', msg: 'Delete this business entry and all its data?' }
});
export function addBusinessItem()     { M_business.add(); }
export function editBusinessItem(i)   { M_business.edit(i); }
export function saveBusinessItem()    { M_business.save(); }
export function removeBusinessItem(i) { M_business.remove(i); }

export function bizAddExpenseRow(exp) {
  const tbody = $('biz-expense-rows'); if(!tbody) return;
  const rowId = 'biz-exp-' + Date.now() + '-' + Math.floor(Math.random()*9999);
  const opts = B4_EXPENSE_CATEGORIES.map(c =>
    `<option value="${c.id}"${exp && exp.category === c.id ? ' selected' : ''}>${esc(c.label)}</option>`
  ).join('');
  const row = document.createElement('div');
  row.id = rowId;
  /* Batch I (#62): stacked card per row — see .exp-row-stacked in main.css. */
  row.className = 'exp-row-stacked';
  row.innerHTML = `
    <div class="form-group"><label class="form-label" for="${rowId}-cat">Category</label>
      <select id="${rowId}-cat" class="form-select u-fs-12 biz-exp-cat" onchange="bizUpdateLiveCalc(); bizUpdateOverlapWarning()">${opts}</select></div>
    <div class="form-group"><label class="form-label" for="${rowId}-amt">Amount (R)</label>
      <input id="${rowId}-amt" type="text" inputmode="numeric" class="form-input mono biz-exp-amt mask-rand" placeholder="0" value="${exp && exp.amount ? exp.amount : ''}" oninput="bizUpdateLiveCalc()"></div>
    <div class="form-group"><label class="form-label" for="${rowId}-note">Note (optional)</label>
      <input id="${rowId}-note" type="text" class="form-input biz-exp-note" placeholder="e.g. Laptop" value="${exp && exp.note ? esc(exp.note) : ''}"></div>
    <div class="exp-row-del"><button class="btn btn-danger btn-xs" onclick="bizRemoveExpenseRow('${rowId}')">Remove row</button></div>`;
  tbody.appendChild(row);
  if (typeof maskAll === 'function') maskAll(row);
}

/* Batch I (#70): show the foreign-tax field only on a foreign business, the
   same way rentalToggleType() gates rental-foreign-tax-row. */
export function bizToggleForeign() {
  const foreign = gs('biz-type') === 'foreign';
  /* B7.7 (IEM-1): hide-and-clear together — see showForeignRow(), 02-core.js.
     biz-income keeps its own value regardless of source; only its
     fx-conversion widget is foreign-only (showFxWidgetFor). */
  showForeignRow('biz-foreign-tax-row', foreign);
  showFxWidgetFor('biz-income', foreign);
}

/* C-10 (coverage-gap-analysis, detect-and-disclose only): the personal
   service provider / independent-contractor questions only apply to the
   Freelancer/Contractor/Consultant subtype — a sole proprietor, trader or
   foreign business isn't the "provides services through their own effort"
   scenario the Fourth Schedule para 1 remuneration exclusion tests are
   about. */
/* QR9b.5 (QD-27, pattern P2 — a question whose answer decides what is asked
   next). The three deemed-employee questions used to show together; they are
   a chain, because the test itself is one (Fourth Schedule para 1
   "remuneration" exclusion (ii): more than 80 % from one client AND that
   client's control or supervision; para 2(5): three or more unconnected
   full-time employees is the way out, and only matters once both are yes):
     1. more than 80 % from one client?          — always asked (freelancer)
     2. does that client control the work?       — asked when 1 is Yes
     3. three or more unconnected employees?     — asked when 1 and 2 are Yes
   An answer already saved is never hidden (a record captured before QR9b can
   hold a later Yes under an earlier No). Disclosure only — nothing here
   reaches calcFullTax(). */
export function bizTogglePsp() {
  const applies = gs('biz-type') === 'freelancer';
  const major = gs('biz-psp-majorclient') === 'yes';
  const control = gs('biz-psp-control') === 'yes';
  const employees = gs('biz-psp-employees') === 'yes';
  const show = {
    'biz-psp-majorclient-row': applies,
    'biz-psp-control-row':     applies && (major || control),
    'biz-psp-employees-row':   applies && ((major && control) || employees)
  };
  Object.keys(show).forEach(id => { const row = $(id); if (row) row.style.display = show[id] ? '' : 'none'; });
  bizUpdatePspNote();
}
/* The user changed an answer in the chain: a No makes the later questions
   moot, so they go back to No before the rows are re-evaluated. Only a
   user's own change does this — loading a record goes through bizTogglePsp()
   (onForm) and leaves what was saved alone. */
export function bizPspChain(changed) {
  const setNo = (id) => { const e = $(id); if (e) e.value = 'no'; };
  if (changed === 'majorclient' && gs('biz-psp-majorclient') !== 'yes') { setNo('biz-psp-control'); setNo('biz-psp-employees'); }
  if (changed === 'control' && gs('biz-psp-control') !== 'yes') setNo('biz-psp-employees');
  bizTogglePsp();
}

/* Fourth Schedule para 1 "remuneration" exclusion tests: >80% of income
   from one client AND that client controls/supervises how and when the
   work is done. Para 2(5) escape: 3+ full-time employees not connected to
   the taxpayer takes the trade out of deemed-employee status regardless of
   the other two answers. Disclosure only — no deduction is restricted here
   and nothing feeds the s11F cap base; the owner's scoping decision for
   this item was explicitly "elicit facts and route to advice", not compute. */
export function bizUpdatePspNote() {
  const note = $('biz-psp-note');
  if (!note) return;
  if (gs('biz-type') !== 'freelancer') { note.classList.add('u-hidden'); note.innerHTML = ''; return; }
  const majorClient = gs('biz-psp-majorclient') === 'yes';
  const control = gs('biz-psp-control') === 'yes';
  const employees = gs('biz-psp-employees') === 'yes';
  if (majorClient && control && !employees) {
    note.classList.remove('u-hidden');
    note.innerHTML = noteHtml('warning', 'SARS may treat this income as a salary, not a business.', 'Your answers suggest SARS may treat you as receiving "remuneration" rather than independent trading income (Fourth Schedule, para 1). If so: your client should have been withholding PAYE, and your allowable deductions would be restricted to retirement, medical, donations, travel and wear-and-tear on income-producing assets (s23(m)) — not the fuller expense set on the next step. This is a disclosure only; nothing on this record has been changed or restricted. Confirm your status with a tax practitioner if you\'re not sure.', { style: 'margin-top:8px', title: 'Deemed employee' });
  } else if (majorClient || control) {
    note.classList.remove('u-hidden');
    note.innerHTML = noteHtml('info', 'One answer points towards being a deemed employee.', 'One of your answers is a warning sign for deemed-employee status under the Fourth Schedule, but both the 80%-one-client and control/supervision tests need to be "yes" together for it to apply. Worth keeping an eye on if your situation changes.', { style: 'margin-top:8px', title: 'Deemed employee' });
  } else {
    note.classList.add('u-hidden');
    note.innerHTML = '';
  }
}

export function bizRemoveExpenseRow(rowId) {
  const row = document.getElementById(rowId);
  if(row) row.remove();
  bizUpdateLiveCalc();   // re-renders the cost chips
  bizUpdateOverlapWarning();
}

export function bizCollectExpenses() {
  const rows = document.querySelectorAll('#biz-expense-rows > div');
  const expenses = [];
  rows.forEach(r => {
    const cat = r.querySelector('.biz-exp-cat')?.value;
    const amt = parseFmt(r.querySelector('.biz-exp-amt')?.value);
    const note = r.querySelector('.biz-exp-note')?.value || '';
    if(cat && (amt > 0 || note)) expenses.push({category: cat, amount: amt, note});
  });
  return expenses;
}

/* ── Rental expense rows ─────────────────────────────────────────────── */

/* Returns the expense category list for the given rental type + ownership.
   - Property / Foreign: full set; bond OR rent_paid based on ownership.
   - Airbnb: area-apportioned fixed costs + direct (100%) costs; repairs split.
   - Equipment: equipment-specific set only (finance, insurance, repairs, W&T, other). */
export function rentalCategoriesForType(type, ownership) {
  const isOwned = (ownership || 'owned') === 'owned';
  const finRow = isOwned
    ? {id:'bond',     label:'Bond interest / Finance charges', direct:false}
    : {id:'rent_paid',label:'Rent paid (if subletting)',       direct:false};

  if(RENTAL_LEASE_TYPES.includes(type)) {
    return [
      finRow,
      {id:'insurance', label:'Insurance',                       direct:false},
      {id:'repairs',   label:'Repairs & maintenance',           direct:false},
      {id:'wear_tear', label:'Wear & tear (s11(e))',            direct:false},
      {id:'improvements', label:'Improvements — NOT deductible here (adds to cost for CGT)', direct:false},
      {id:'other',     label:'Other deductible expenses',       direct:false},
    ];
  }
  if(type === 'airbnb') {
    return [
      finRow,
      {id:'rates',          label:'Rates & taxes',                                        direct:false},
      {id:'insurance',      label:'Insurance',                                            direct:false},
      {id:'repairs',        label:'Repairs & maintenance (general)',                      direct:false},
      {id:'repairs_direct', label:'Repairs & maintenance (Airbnb specific)',              direct:true},
      {id:'agent',          label:'Managing agent fees',                                  direct:true},
      {id:'levies',         label:'Body corporate levies',                                direct:false},
      {id:'advertising',    label:'Advertising / letting fees',                           direct:true},
      {id:'wear_tear',      label:'Wear & tear — exclusively Airbnb equipment (s11(e))', direct:true},
      {id:'improvements',   label:'Improvements — NOT deductible here (adds to cost for CGT)', direct:false},
      {id:'other',          label:'Other deductible expenses',                            direct:false},
    ];
  }
  /* property / foreign */
  return [
    finRow,
    {id:'rates',       label:'Rates & taxes',                   direct:false},
    {id:'insurance',   label:'Insurance',                       direct:false},
    {id:'repairs',     label:'Repairs & maintenance',           direct:false},
    {id:'agent',       label:'Managing agent fees',             direct:false},
    {id:'levies',      label:'Body corporate levies',           direct:false},
    {id:'advertising', label:'Advertising / letting fees',      direct:false},
    {id:'wear_tear',   label:'Wear & tear (s11(e))',            direct:false},
    {id:'improvements',label:'Improvements — NOT deductible here (adds to cost for CGT)', direct:false},
    {id:'other',       label:'Other deductible expenses',       direct:false},
  ];
}

export function rentalAddExpenseRow(exp) {
  const tbody = $('rental-expense-rows'); if(!tbody) return;
  /* read current type/ownership from form (called both programmatically and via onclick) */
  const type = (typeof gs === 'function' ? gs('rental-type') : null) || 'property';
  const ownership = (typeof gs === 'function' ? gs('rental-ownership') : null) || 'owned';
  const cats = rentalCategoriesForType(type, ownership);
  const rowId = 'rental-exp-' + Date.now() + '-' + Math.floor(Math.random()*9999);
  const opts = cats.map(c =>
    `<option value="${c.id}"${exp && exp.category === c.id ? ' selected' : ''}>${esc(c.label)}</option>`
  ).join('');
  const row = document.createElement('div');
  row.id = rowId;
  /* Batch I (#73): stacked card per row — see .exp-row-stacked in main.css. */
  row.className = 'exp-row-stacked';
  row.innerHTML = `
    <div class="form-group"><label class="form-label" for="${rowId}-cat">Category</label>
      <select id="${rowId}-cat" class="form-select u-fs-12 rental-exp-cat" onchange="rentalUpdateLiveCalc()">${opts}</select></div>
    <div class="form-group"><label class="form-label" for="${rowId}-amt">Amount (R)</label>
      <input id="${rowId}-amt" type="text" inputmode="numeric" class="form-input mono rental-exp-amt mask-rand" placeholder="0" value="${exp && exp.amount ? exp.amount : ''}" oninput="rentalUpdateLiveCalc()"></div>
    <!-- RENT-13/RENT-14 (§L.8): contextual info for the row's own category —
         replaces the ⓘ Bond interest / ⓘ Repairs vs improvements accordion
         notes that used to sit at the bottom of the whole modal, disconnected
         from the row they explain. Filled/shown by rentalUpdateExpenseRowInfo()
         (06a-rental.js), which rentalUpdateLiveCalc() already calls on every
         category change. -->
    <div class="rental-exp-info note info u-hidden" id="${rowId}-info" style="font-size:0.6875rem;padding:6px 8px"></div>
    <div class="exp-row-del"><button class="btn btn-danger btn-xs" onclick="rentalRemoveExpenseRow('${rowId}')">Remove row</button></div>`;
  tbody.appendChild(row);
  if (typeof maskAll === 'function') maskAll(row);
}

/* Rebuild the options in all existing expense row selects when type/ownership changes.
   Preserves the current amount; resets category to first option if old value no longer exists. */
export function rentalUpdateExpenseRowOptions(type, ownership) {
  const cats = rentalCategoriesForType(type, ownership);
  const opts = cats.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
  document.querySelectorAll('#rental-expense-rows > div .rental-exp-cat').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = opts;
    if(cats.find(c => c.id === prev)) sel.value = prev;
  });
}

export function rentalRemoveExpenseRow(rowId) {
  const row = document.getElementById(rowId);
  if(row) row.remove();
  /* late-bound: rentalUpdateLiveCalc lives in 06a-rental (avoids circular import) */
  if(typeof window !== 'undefined' && typeof window.rentalUpdateLiveCalc === 'function') window.rentalUpdateLiveCalc();
}

export function rentalCollectExpenses() {
  const rows = document.querySelectorAll('#rental-expense-rows > div');
  const expenses = [];
  rows.forEach(r => {
    const cat = r.querySelector('.rental-exp-cat')?.value;
    const amt = parseFmt(r.querySelector('.rental-exp-amt')?.value);
    const note = r.querySelector('.rental-exp-note')?.value || '';
    if(cat && (amt > 0 || note)) expenses.push({category: cat, amount: amt, note});
  });
  return expenses;
}

/* UI-CAP-1 (shared rule 6 — amounts as lines, QD-27 P4): a new rental,
   business or crypto record (BACKLOG 44, 06-crypto.js) starts with the usual cost lines for its kind, and the next few
   are one-tap chips under them; "Another cost" adds a line with the full
   category list. Data: USUAL_COSTS (01-data.js). A line left at 0 is not
   saved (the collectors keep a line only with an amount or a note), so the
   seeded lines change nothing until the user fills one in.
   costRowsUntouched: no line holds anything the user typed — only then is
   re-seeding for another kind safe. */
export function costRowsUntouched(rowsSel) {
  return Array.from(document.querySelectorAll(rowsSel + ' > div')).every(r =>
    !(parseFmt((r.querySelector('input.mask-rand') || {}).value) > 0)
    && !String((r.querySelector('input[class$="-note"]') || {}).value || '').trim());
}
/* Each list's chip, its onclick written out as an attribute so the window
   bridge generator (tools/gen-bridge.js) sees every handler. */
const COST_CHIP = {
  biz:        (id, label) => `<button type="button" class="cost-chip" onclick="bizAddCost('${id}')"><i class="material-symbols-outlined msi-add"></i>${esc(label)}</button>`,
  rental:     (id, label) => `<button type="button" class="cost-chip" onclick="rentalAddCost('${id}')"><i class="material-symbols-outlined msi-add"></i>${esc(label)}</button>`,
  cryptoDisp: (id, label) => `<button type="button" class="cost-chip" onclick="cryptoDispAddCost('${id}')"><i class="material-symbols-outlined msi-add"></i>${esc(label)}</button>`,
  cryptoRev:  (id, label) => `<button type="button" class="cost-chip" onclick="cryptoRevAddCost('${id}')"><i class="material-symbols-outlined msi-add"></i>${esc(label)}</button>`,
  otherReceipt: (id, label) => `<button type="button" class="cost-chip" onclick="otherReceiptAddCost('${id}')"><i class="material-symbols-outlined msi-add"></i>${esc(label)}</button>`
};
export function costChipsHtml(more, have, labelOf, list) {
  const chip = COST_CHIP[list];
  const chips = more.filter(id => have.indexOf(id) < 0 && labelOf(id)).map(id => chip(id, labelOf(id)));
  chips.push(chip('', 'Another cost'));
  return '<span class="cost-chips-lbl">Add a cost</span>' + chips.join('');
}
export function renderCostChips(boxId, html) {
  const box = $(boxId); if (!box || box.innerHTML === html) return;   // re-render only when the set changes
  box.innerHTML = html;
}

/* One cost row — category select, amount, note, remove — for the crypto
   lists and the other-receipt costs (moved from 06-crypto.js, BACKLOG 63).
   A row with neither an amount nor a note is not collected. */
export function addCostRow(containerId, catCls, amtCls, noteCls, optionsMap, onChangeFn, exp) {
  const tbody = $(containerId); if (!tbody) return;
  const rowId = containerId + '-' + Date.now() + '-' + Math.floor(Math.random()*9999);
  const opts = Object.keys(optionsMap).map(v =>
    `<option value="${v}"${exp && exp.type === v ? ' selected' : ''}>${esc(optionsMap[v])}</option>`
  ).join('');
  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'biz-exp-grid';
  row.style.marginBottom = '6px';
  /* The expense-row note input binds to exp.desc — an optional per-expense NOTE,
     NOT the record descriptor; same key name, deliberately different meaning. */
  row.innerHTML = `
    <select class="form-select u-fs-12 ${catCls}" onchange="${onChangeFn}">${opts}</select>
    <input type="text" inputmode="numeric" class="form-input mono ${amtCls} mask-rand" placeholder="0" value="${exp && exp.amount ? exp.amount : ''}" oninput="${onChangeFn}">
    <input type="text" class="form-input ${noteCls}" placeholder="Note (optional)" value="${exp && exp.desc ? esc(exp.desc) : ''}">
    <button class="btn btn-danger btn-xs" onclick="this.closest('.biz-exp-grid').remove(); ${onChangeFn}" aria-label="Remove expense"><i class="material-symbols-outlined msi-delete"></i></button>`;
  tbody.appendChild(row);
  if (typeof maskAll === 'function') maskAll(row);
}
export function collectCostRows(containerId, catCls, amtCls, noteCls) {
  const out = [];
  document.querySelectorAll('#' + containerId + ' > div').forEach(r => {
    const type = r.querySelector('.' + catCls)?.value;
    const amtEl = r.querySelector('.' + amtCls);
    const amount = amtEl ? parseFmt(amtEl.value) : 0;
    const desc = (r.querySelector('.' + noteCls)?.value || '').trim();
    if (type && (amount > 0 || desc)) out.push({ id: 'ex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, desc, amount });
  });
  return out;
}

/* Business (B4_EXPENSE_CATEGORIES). */
export function bizSeedCosts() {
  if (!costRowsUntouched('#biz-expense-rows')) return;
  const tbody = $('biz-expense-rows'); if (!tbody) return;
  tbody.innerHTML = '';
  const set = USUAL_COSTS.business[gs('biz-type') || 'freelancer'] || { usual: [] };
  set.usual.forEach(id => bizAddExpenseRow({ category: id }));
  if (!set.usual.length) bizAddExpenseRow();
  bizRenderCostChips();
}
export function bizRenderCostChips() {
  const set = USUAL_COSTS.business[gs('biz-type') || 'freelancer'] || { more: [] };
  const have = Array.from(document.querySelectorAll('#biz-expense-rows .biz-exp-cat')).map(x => x.value);
  const labelOf = id => (B4_EXPENSE_CATEGORIES.find(c => c.id === id) || {}).label;
  renderCostChips('biz-cost-chips', costChipsHtml(set.more, have, labelOf, 'biz'));
}
export function bizAddCost(cat) {
  bizAddExpenseRow(cat ? { category: cat } : null);
  bizRenderCostChips();
  const rows = document.querySelectorAll('#biz-expense-rows > div');
  const amt = rows.length && rows[rows.length - 1].querySelector('.biz-exp-amt'); if (amt) amt.focus();
}

/* Rental (rentalCategoriesForType — the list depends on kind and ownership). */
export function rentalSeedCosts() {
  if (!costRowsUntouched('#rental-expense-rows')) return;
  const tbody = $('rental-expense-rows'); if (!tbody) return;
  tbody.innerHTML = '';
  const type = gs('rental-type') || 'property';
  const cats = rentalCategoriesForType(type, gs('rental-ownership') || 'owned').map(c => c.id);
  const set = USUAL_COSTS.rental[type] || { usual: [] };
  const usual = set.usual.filter(id => cats.indexOf(id) >= 0);
  usual.forEach(id => rentalAddExpenseRow({ category: id }));
  if (!usual.length) rentalAddExpenseRow();
  rentalRenderCostChips();
}
export function rentalRenderCostChips() {
  const type = gs('rental-type') || 'property';
  const cats = rentalCategoriesForType(type, gs('rental-ownership') || 'owned');
  const set = USUAL_COSTS.rental[type] || { more: [] };
  const have = Array.from(document.querySelectorAll('#rental-expense-rows .rental-exp-cat')).map(x => x.value);
  const labelOf = id => (cats.find(c => c.id === id) || {}).label;
  renderCostChips('rental-cost-chips', costChipsHtml(set.more, have, labelOf, 'rental'));
}
export function rentalAddCost(cat) {
  rentalAddExpenseRow(cat ? { category: cat } : null);
  rentalRenderCostChips();
  if (typeof window !== 'undefined' && typeof window.rentalUpdateLiveCalc === 'function') window.rentalUpdateLiveCalc();
  const rows = document.querySelectorAll('#rental-expense-rows > div');
  const amt = rows.length && rows[rows.length - 1].querySelector('.rental-exp-amt'); if (amt) amt.focus();
}

export function bizUpdateLiveCalc() {
  bizRenderCostChips();
  const income = gv('biz-income') || 0;
  const expenses = bizCollectExpenses();
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - totalExp;
  const isLoss = net < 0;
  /* BACKLOG 57: the trade confirmation is asked exactly when validate()
     requires it — no income and some costs (s11(a)/s23(g)). */
  const tcBlock = $('biz-trade-confirm-block');
  if (tcBlock) tcBlock.classList.toggle('u-hidden', !(income === 0 && totalExp > 0));
  const liveEl = $('biz-live-calc'); if(!liveEl) return;
  if(income === 0 && totalExp === 0) { liveEl.innerHTML = ''; return; }
  liveEl.innerHTML = `<div style="background:var(--sf3);border-radius:6px;padding:10px 12px;margin-top:10px;font-size:0.75rem">
    <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Gross income</span><span>${fmt(income)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Total expenses</span><span>\u2212 ${fmt(totalExp)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;margin-top:4px;border-top:1px solid var(--bd);font-weight:700;color:${isLoss?'var(--er)':'var(--ok)'}">
      <span>Net ${isLoss?'Loss':'Profit'}</span><span>${fmt(Math.abs(net))}</span>
    </div>
    ${isLoss ? '<div class="note warning" style="margin-top:8px;font-size:0.71875rem;padding:6px 10px"><i class="material-symbols-outlined msi-warning u-mr-5"></i>' + '<strong>Loss noted.</strong> It is included in your total and set against your other income.' + '</div>' : ''}
  </div>`;
}

/* Batch I (#63): the warning used to list EVERY deduction with a non-zero
   applied value, regardless of what this business's own expense rows
   actually claimed — so a user with a travel deduction saw "do not
   double-count travel" even on a business whose only expense was bank
   charges. It is now driven by the `overlap` field that has sat unused on
   B4_EXPENSE_CATEGORIES since that table was written: a deduction is named
   only when a row in THIS record selects a category that maps to it.
   Display-only — no amount here enters any calculation. */
const _OVERLAP_LABELS = {
  travel:      'Travel Deduction',
  homeoffice:  'Home Office Deduction',
  tools:       'Tools & Equipment (W&T)',
  subscrip:    'Professional memberships',
  subsistence: 'Subsistence Allowance'
};

export function bizUpdateOverlapWarning() {
  const warnEl = $('biz-overlap-notice'); if(!warnEl) return;
  /* Which overlap keys do this record's own selected categories map to? */
  const selected = {};
  document.querySelectorAll('#biz-expense-rows .biz-exp-cat').forEach(sel => {
    const cat = B4_EXPENSE_CATEGORIES.find(c => c.id === sel.value);
    if (cat && cat.overlap) selected[cat.overlap] = true;
  });
  const av = APP.appliedValues || {};
  /* ...and of those, which are actually also being claimed as a deduction? */
  const overlaps = Object.keys(selected)
    .filter(key => (av[key] || 0) > 0)
    .map(key => ({ label: _OVERLAP_LABELS[key] || key, amount: av[key] }));
  if(!overlaps.length) { warnEl.innerHTML = ''; return; }
  const rows = overlaps.map(o => `<li><strong>${esc(o.label)}:</strong> ${fmt(o.amount)} claimed</li>`).join('');
  warnEl.innerHTML = `<details class="info-acc" style="margin-top:10px" open>
    <summary style="font-size:0.71875rem">⚠ Avoid double-counting <span class="chev">▾</span></summary>
    <div class="body" style="font-size:0.71875rem">
      You have picked an expense category here that is also claimed as a separate deduction. Do not include the same amount twice:
      <ul style="margin:6px 0 0 18px;line-height:1.6">${rows}</ul>
    </div>
  </details>`;
}

export function calcBusinessNet(b) {
  const totalExp = (b.expenses || []).reduce((s, e) => s + (e.amount||0), 0);
  /* Batch I (#67): surface the wear-and-tear portion the same way
     calcRentalNet() already returns wearTearAmt, so Business can show the
     stat tile Rental has had all along. Additive only — `net` and `totalExp`
     are unchanged, W&T is already inside totalExp and is NOT re-subtracted. */
  const wearTearAmt = (b.expenses || [])
    .filter(e => e.category === 'depreciation')
    .reduce((s, e) => s + (e.amount||0), 0);
  return { net: (b.income||0) - totalExp, totalExp, income: b.income||0, wearTearAmt };
}

export function renderBusinessList() {
  const listEl = $('business-list');
  const aggEl  = $('business-aggregate');
  const glanceEl = $('glance-b4business');

  const BIZ_TYPE_LABELS = {
    freelancer: 'Freelancer / Contractor', commission: 'Commission / Fees',
    sole_prop: 'Sole Proprietor', trader: 'Trader / Vendor', foreign: 'Foreign Business'
  };

  if(!APP.businessItems.length) {
    /* QA 2026-09: persistent "+ Add business or trade" button at the top of
       the page is the only add-CTA now — this duplicated it. */
    if(listEl) listEl.innerHTML = '';
    if(aggEl) aggEl.innerHTML = '';
    if(glanceEl) glanceEl.innerHTML = '';
    { const heroElB = $('hero-b4business'); if(heroElB) heroElB.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')"><div class="dhero-top"><div class="dhero-lbl">Gross business income</div></div><div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b4business">' + fmt(0) + '</div><div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No business or trade income yet — add your first below.</div></div>'; }
    APP.pendingValues.business = 0;
    if(typeof renderBucketNav === 'function') renderBucketNav();
    return;
  }

  if(listEl) {
    listEl.innerHTML = APP.businessItems.map((b, i) => {
      const { net, totalExp, income } = calcBusinessNet(b);
      const isLoss = net < 0;
      const typeLabel = BIZ_TYPE_LABELS[b.bizType] || 'Business';
      const lossNote = tradeLossNote('Business', net);
      /* C-10: same disclosure test as bizUpdatePspNote() (05-list-modules.js) —
         a persistent flag on the card so it stays visible without reopening
         the record. Disclosure only, no computed treatment. */
      const pspFlag = (b.pspMajorClient === 'yes' && b.pspControl === 'yes' && b.pspEmployees !== 'yes')
        ? '<span class="pill" style="font-size:0.625rem;background:rgba(239,68,68,0.15);color:var(--er)"><i class="material-symbols-outlined msi-warning"></i> Possible deemed employee</span>' : '';
      return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <i class="material-symbols-outlined msi-storefront" style="color:var(--ico-orange);font-size:0.75rem"></i>
              <strong style="font-size:0.875rem">${esc(b.name)}</strong>
              <span class="pill" style="font-size:0.625rem;background:rgba(217,119,6,0.15);color:var(--ico-orange)">${esc(typeLabel)}</span>
              ${pspFlag}
            </div>
            <div style="display:flex;gap:14px;margin-top:7px;font-size:0.75rem;color:var(--tx2);flex-wrap:wrap">
              <span><i class="material-symbols-outlined msi-arrow-upward" style="color:var(--ok);font-size:0.625rem"></i> ${fmt(income)}</span>
              <span><i class="material-symbols-outlined msi-arrow-downward" style="color:var(--er);font-size:0.625rem"></i> ${fmt(totalExp)}</span>
              <span style="font-weight:700;color:${isLoss?'var(--er)':'var(--ok)'}">Net: ${isLoss?'('+fmt(Math.abs(net))+') Loss':fmt(net)}</span>
            </div>
            ${lossNote}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-ghost btn-xs" onclick="editBusinessItem(${i})" aria-label="Edit business"><i class="material-symbols-outlined msi-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="removeBusinessItem(${i})" aria-label="Remove business"><i class="material-symbols-outlined msi-delete"></i></button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  let totalIncome = 0, totalExpenses = 0, totalWearTear = 0;
  const byType = {};
  APP.businessItems.forEach(b => {
    const r = calcBusinessNet(b);
    totalIncome += r.income;
    totalExpenses += r.totalExp;
    totalWearTear += r.wearTearAmt || 0;   /* Batch I (#67) */
    const t = b.bizType || 'freelancer';
    if(!byType[t]) byType[t] = { income: 0, net: 0 };
    byType[t].income += r.income;
    byType[t].net += r.net;
  });
  /* s20(1)(b): a business loss flows into the tax base and may be negative
     (calcFullTax's adjGross composition sums it with other income). The app
     does not ring-fence (OI-D1b, BACKLOG 57); a `ringfenced` key on a record
     saved before QA 2026-08 is ignored. */
  const netBusiness = APP.businessItems.reduce((s, b) => s + calcBusinessNet(b).net, 0);
  const isLoss = netBusiness < 0;

  APP.pendingValues.business = netBusiness;

  if(aggEl) {
    /* Batch I (#66): no aggregate s20A banner here — each business's own
       card carries the loss notice (tradeLossNote), so a total-level one only
       repeated it. */
    aggEl.innerHTML = `
      <div class="sum-line"><span class="lbl">Total gross business income</span><span class="val">${fmt(totalIncome)}</span></div>
      <div class="sum-line"><span class="lbl">Total business expenses</span><span class="val">&minus; ${fmt(totalExpenses)}</span></div>`;
  }

  if(glanceEl) {
    const BIZ_TYPE_SHORT = {
      freelancer:'Freelancer', commission:'Commission', sole_prop:'Sole Proprietor',
      trader:'Trader', foreign:'Foreign'
    };
    const breakdownRows = Object.entries(byType)
      .filter(([, v]) => v.income > 0)
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.6875rem">
        <span style="color:var(--tx2)">${BIZ_TYPE_SHORT[k] || k}</span>
        <span style="font-family:var(--mono);color:${v.net<0?'var(--er)':'var(--ok)'}">${v.net<0?'('+fmt(Math.abs(v.net))+')':fmt(v.net)}</span>
      </div>`)
      .join('');
    const heroElB = $('hero-b4business');
    if(heroElB) {
      heroElB.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
        + '<div class="dhero-top"><div class="dhero-lbl">Gross business income</div>'
        + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + APP.businessItems.length + (APP.businessItems.length===1?' business':' businesses') + '</span></div>'
        + '<div class="dhero-num" data-count="' + (totalIncome) + '" data-count-key="income-b4business">' + fmt(totalIncome) + '</div>'
        + '<div class="dhero-break">Net ' + (isLoss?'loss':'income') + ' <span class="mono" style="color:' + (isLoss?'var(--er)':'var(--au)') + '">' + (isLoss?'('+fmt(Math.abs(netBusiness))+')':fmt(netBusiness)) + '</span>' + heroBreakdownLink('business') + '</div>'
        + '</div>';
    }
    const cards = [
      `<div class="card" style="padding:0;margin-bottom:8px;overflow:hidden">
        <details>
          <summary style="padding:12px 14px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Net Business ${isLoss?'Loss':'Income'} <i class="material-symbols-outlined msi-expand-more" style="font-size:0.5625rem;opacity:.5;margin-left:4px"></i></div>
              <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:${isLoss?'var(--er)':'var(--ok)'}">${isLoss?'('+fmt(Math.abs(netBusiness))+')':fmt(netBusiness)}</div>
            </div>
          </summary>
          <div style="padding:0 14px 12px;border-top:1px solid var(--bd)">
            <div style="font-size:0.6875rem;color:var(--tx3);margin:8px 0 4px">By type</div>
            ${breakdownRows}
          </div>
        </details>
      </div>`,
    ];
    /* Batch I (#67): the wear-and-tear tile Rental has had all along
       (renderRentalList's "Equipment W&T" card) — Business claims W&T through
       its own `depreciation` expense category but never surfaced the total. */
    if(totalWearTear > 0) {
      cards.push(`<div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Wear &amp; tear claimed (s11(e))</div>
        <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--tx2)">${fmt(totalWearTear)}</div>
      </div>`);
    }
    glanceEl.innerHTML = cards.join('');
  }

  if(typeof renderBucketNav === 'function') renderBucketNav();
}

/* ═══════════════════════════════════════════════════════════
   B6 FOREIGN INCOME — BATCH 4 SECTION 2
   Calculator-only subpage. Income captured in primary buckets.
   Summary table + s6quat foreign tax credit calculator + catch-all.
   ═══════════════════════════════════════════════════════════ */

/* engine-remediation W9: collectForeignIncome now lives in 02-core.js (the
   engine owns the single overall s6quat(1B) limitation and needs to be the
   one place that assembles every foreign source) — re-exported here for the
   B6 UI below, which is the only remaining consumer in this file. */
export { collectForeignIncome };

export function calcS6QuatCredit() {
  /* engine-remediation W9: calcFullTax computes the ENTIRE s6quat(1B) single
     overall limitation now (foreignTI, ftcLimit, ftcQualifying, ftc,
     ftcCarryOut) — this function is display-only: it reads those outputs
     back rather than re-deriving any min()/limitation math, so the B6 page,
     the projection/planner and the tests all show the identical figure the
     engine actually charged. */
  const fi = collectForeignIncome();
  const totalForeignIncome = fi.foreignInterest + fi.foreignDividends + fi.foreignRental
                           + fi.foreignBusiness + fi.foreignService + fi.foreignCgt + fi.catchAll + fi.foreignPension;
  const foreignTaxPaid = fi.foreignTaxDividends + fi.foreignTaxInterest + fi.otherTax;

  let ftc = 0, ftcLimit = 0, ftcQualifying = 0, ftcCarryOut = 0, rate = 0;
  try {
    const r = (typeof calcFullTax === 'function') ? calcFullTax() : null;
    if(r) {
      rate = r.taxableIncome > 0 ? r.taxOnIncome / r.taxableIncome : 0;
      ftc = r.ftc || 0;
      ftcLimit = r.ftcLimit || 0;
      ftcQualifying = r.ftcQualifying || 0;
      ftcCarryOut = r.ftcCarryOut || 0;
    }
  } catch(e) { /* ignore */ }

  return {
    foreignIncome: totalForeignIncome, foreignTaxPaid,
    rate, credit: ftc, ftcLimit, ftcQualifying, ftcCarryOut,
    saTaxOnForeign: ftcLimit, // the single overall limitation IS the "SA tax on foreign income" figure now
    breakdown: fi
  };
}

/* Batch J (#77): the Foreign Employment Exemption tab only applies to
   foreign-service remuneration (FOREIGN_SERVICE_CODES — IRP5 codes
   3651/3655/3656, the set the tab's own "Applies only to..." note cites). Disables
   + locks the tab until one of those codes is captured, instead of
   always defaulting the user into a question that doesn't apply to
   them yet. */
export function hasForeignEmploymentIncome() {
  return (APP.incomeItems || []).some(function(i) { return FOREIGN_SERVICE_CODES.has(i.code); });
}
export function updateForeignEmpTabState() {
  const tab = $('foreign-emp-tab'); if(!tab) return;
  const applicable = hasForeignEmploymentIncome();
  tab.classList.toggle('disabled', !applicable);
  tab.setAttribute('aria-disabled', applicable ? 'false' : 'true');
  /* if the tab was active and just became inapplicable (e.g. the
     qualifying IRP5 entry was removed), fall back to Summary rather
     than leaving a disabled tab showing as selected */
  if(!applicable && tab.classList.contains('active')) {
    const summaryBtn = tab.closest('.seg-ctl')?.querySelector('[data-seg="foreign-seg-summary"]');
    if(summaryBtn) segShow('foreign-seg', summaryBtn);
  }
}

/* coverage-gap B-10: live feedback on the day-count apportionment as the
   user types — the actual exempt figure is recomputed by
   foreignEmpExemptAmount() inside calcFullTax() (refreshDerived(), fired by
   the same oninput), this is purely the explanatory echo. */
export function fsUpdateLiveCalc() {
  const el = $('fs-live-calc'); if(!el) return;
  const fe = foreignEmpExemptAmount();
  if(!fe.qualifying) { el.innerHTML = ''; return; }
  if(fe.daysTotal > 0) {
    const pct = (fe.apportionRatio * 100).toFixed(1);
    el.innerHTML = `<div style="background:var(--tebg);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:0.75rem;color:var(--tx2)">
      <i class="material-symbols-outlined msi-info" style="color:var(--tel)"></i>
      ${fe.daysOutside} of ${fe.daysTotal} workdays outside SA (${pct}%) — the exemption applies to that portion of the qualifying remuneration before the ${fmt(fe.cap)} cap.
    </div>`;
  } else {
    el.innerHTML = `<div style="background:var(--tebg);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:0.75rem;color:var(--tx2)">
      <i class="material-symbols-outlined msi-info" style="color:var(--tel)"></i>
      No workdays entered — the full qualifying remuneration is treated as earned outside SA (up to the ${fmt(fe.cap)} cap). Enter workdays above if you worked part of the period in SA.
    </div>`;
  }
}

export function renderForeignSummary() {
  fxRefreshWidgets($('foreign-seg-catchall')); // QR3.3: hand-written Foreign-page widgets
  const listEl = $('b6-foreign-summary'); if(!listEl) return;
  updateForeignEmpTabState();
  const fi = collectForeignIncome();
  // v8.27 Focus: foreign income hero (always visible, empty state at R0)
  const heroElF = $('hero-b6foreign');
  if(heroElF) {
    const _ftotal = (fi.foreignInterest||0) + (fi.foreignDividends||0) + (fi.foreignRental||0)
      + (fi.foreignBusiness||0) + (fi.foreignCgt||0) + (fi.foreignService||0) + (fi.catchAll||0) + (fi.foreignPension||0);
    const _fcred = calcS6QuatCredit();
    if(_ftotal > 0) {
      heroElF.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
        + '<div class="dhero-top"><div class="dhero-lbl">Total taxable foreign income</div></div>'
        + '<div class="dhero-num" data-count="' + (_ftotal) + '" data-count-key="income-b6foreign">' + fmt(_ftotal) + '</div>'
        + (_fcred && _fcred.credit > 0
            ? '<div class="dhero-break"><i class="material-symbols-outlined msi-trending-down" style="color:var(--au)"></i> <span class="mono" style="color:var(--au)">' + fmt(_fcred.credit) + '</span> foreign tax credit applied' + heroBreakdownLink('foreign') + '</div>'
            : '<div class="dhero-break">Included in your taxable income \u00b7 foreign tax credit may apply' + heroBreakdownLink('foreign') + '</div>')
        + '</div>';
    } else {
      heroElF.innerHTML = '<div class="dhero bl u-empty">'
        + '<div class="dhero-top"><div class="dhero-lbl">Total taxable foreign income</div></div>'
        + '<div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b6foreign">' + fmt(0) + '</div>'
        + '<div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No foreign income detected \u2014 it flows in from your IT3(b), rental, business and CGT entries.</div>'
        + '</div>';
    }
  }

  /* QR2.1: each source row routes to the page that owns its figure through
     CAPTURE_ROUTES. This used to be a local navTargets map invoked from an
     inline onclick (navTargets['…']()) — navTargets is not on window, so every
     click threw, and Rental/CGT pointed at deductions/selections. */
  const sources = [
    {label:'Foreign Interest (from IT3(b))',     amount: fi.foreignInterest,  source:'Investment', route:'investment_income'},
    {label:'Foreign Dividends (from IT3(b), taxable after s10B exemption)',    amount: fi.foreignDividends, source:'Investment', route:'investment_income', note:'20/45 taxable portion per s10B(3) (25/45 exempt)'},
    {label:'Foreign Rental Income (net)',        amount: fi.foreignRental,    source:'Rental', route:'rental_income'},
    {label:'Foreign Business Income (net)',      amount: fi.foreignBusiness,  source:'Business', route:'business_income'},
    {label:'Foreign Capital Gains (taxable)',    amount: fi.foreignCgt,       source:'Capital Gains', route:'cgt'},
    {label:'Foreign Service Remuneration',       amount: fi.foreignService,   source:'IRP5 employment (3651/3655/3656)', route:'employment_income', note:'Subject to s10(1)(o)(ii) exemption (R1.25m if 183 days + 60 continuous days met)'},
    {label:'Foreign Pension / Annuity',          amount: fi.foreignPension,   source:'Retirement income', route:'retirement_income'},
    {label:'Other foreign income (catch-all)',   amount: fi.catchAll,         source:'Foreign (manual)', route:'foreign_income'}
  ];

  const totalForeign = sources.reduce((s, r) => s + r.amount, 0);

  const rows = sources.filter(r => r.amount > 0).map(r =>
    `<tr style="border-bottom:1px solid var(--bd)">
      <td style="padding:8px 6px;font-size:0.8125rem">
        <span style="cursor:pointer;text-decoration:underline;color:var(--lnk)" onclick="navigateToCapture('${r.route}')">${esc(r.label)}${r.note ? ' <span style="font-size:0.65rem;color:var(--tx3)">ⓘ</span>' : ''}</span>
      </td>
      <td style="padding:8px 6px;font-size:0.6875rem;color:var(--tx3)">${esc(r.source)}</td>
      <td class="mono" style="padding:8px 6px;font-size:0.8125rem;text-align:right;cursor:pointer;color:var(--lnk)" onclick="navigateToCapture('${r.route}')">${fmt(r.amount)}</td>
    </tr>`
  ).join('');

  listEl.innerHTML = `
    <div style="margin-bottom:12px">
      <table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
        <thead><tr style="border-bottom:2px solid var(--bd);color:var(--tx2);font-size:0.6875rem;text-transform:uppercase;letter-spacing:.4px">
          <th scope="col" style="text-align:left;padding:8px 6px">Source</th>
          <th scope="col" style="text-align:left;padding:8px 6px">From</th>
          <th scope="col" style="text-align:right;padding:8px 6px">Amount (R)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid var(--bd);font-weight:700">
          <td colspan="2" style="padding:8px 6px">Total Taxable Foreign Income</td>
          <td class="mono" style="padding:8px 6px;text-align:right">${fmt(totalForeign)}</td>
        </tr></tfoot>
      </table>
    </div>
    ${noteHtml('info', 'Tap an amount to open where it comes from.', 'Foreign dividends include the s10B(3) exemption (20/45 taxable portion for natural persons).', { title: 'Foreign income' })}`;

  // Render s6quat credit calc
  const credEl = $('b6-credit-calc'); if(!credEl) return;
  const c = calcS6QuatCredit();
  /* engine-remediation W9: the s6quat credit is now a SINGLE overall
     limitation, computed entirely by calcFullTax (ftc/ftcLimit/ftcQualifying/
     ftcCarryOut) — this page is purely a read-back of those outputs, nothing
     is written to appliedValues.foreign any more (that field is retired). */
  const carryYears = getFact('foreignTaxCredit.carryForwardYears');

  credEl.innerHTML = `
    <div class="sum-line"><span class="lbl">Total foreign taxable income (single overall basket)</span><span class="val mono">${fmt(c.foreignIncome)}</span></div>
    <div class="sum-line"><span class="lbl">s6quat(1B) limitation (SA tax on foreign income)</span><span class="val mono">${fmt(c.ftcLimit)}</span></div>
    <div class="sum-line"><span class="lbl">Qualifying foreign tax (paid + brought forward)</span><span class="val mono">${fmt(c.ftcQualifying)}</span></div>
    <div class="sum-line divider total refund"><span class="lbl"><strong>s6quat Credit Allowed</strong></span><span class="val"><strong>${fmt(c.credit)}</strong></span></div>
    ${c.ftcCarryOut > 0 ? `<div class="sum-line"><span class="lbl">Carried forward (${carryYears} years) — excess over the limitation</span><span class="val mono">${fmt(c.ftcCarryOut)}</span></div>` : ''}

    <details class="calc-card" style="margin-top:12px">
      <summary><div><div class="calc-card-lbl">Foreign tax credit to apply against SA tax</div><div class="calc-card-val">${fmt(c.credit)}</div></div><i class="material-symbols-outlined msi-expand-more chev"></i></summary>
      <div class="calc-card-body">
        ${noteHtml('info', 'All foreign income shares one credit limit.', 'All foreign-sourced income (IT3(b) dividends/interest, rental, business, capital gains, foreign-service salary, catch-all) is pooled into ONE limitation — s6quat(1B) tests total foreign tax paid against SA tax on your total foreign taxable income, not a per-source basket.', { style: 'margin:8px 0', title: 'One limit for all foreign income' })}
        <div class="sum-line"><span class="lbl">Foreign taxable income</span><span class="val mono">${fmt(c.foreignIncome)}</span></div>
        <div class="sum-line"><span class="lbl">s6quat(1B) limitation</span><span class="val mono">${fmt(c.ftcLimit)}</span></div>
        <div class="sum-line"><span class="lbl">Qualifying foreign tax</span><span class="val mono">${fmt(c.ftcQualifying)}</span></div>
        <div class="sum-line" style="border-top:1px solid var(--bd);margin-top:4px;padding-top:4px"><span class="lbl"><strong>Credit = min(qualifying tax, limitation, remaining SA tax)</strong></span><span class="val mono"><strong>${fmt(c.credit)}</strong></span></div>
        <details style="margin-top:12px">
          <summary style="cursor:pointer;font-size:0.75rem;color:var(--lnk);text-decoration:underline;user-select:none">About the s6quat credit</summary>
          <div class="note info" style="margin-top:8px;font-size:0.75rem">
            <p><strong>What is s6quat?</strong> Section 6quat of the Income Tax Act allows you to credit foreign tax paid against your SA tax liability.</p>
            <p style="margin-top:6px"><strong>Limitation (s6quat(1B)):</strong> ONE overall limitation across all foreign-sourced income — the credit cannot exceed SA tax attributable to your total foreign taxable income (to prevent a refund).</p>
            <p style="margin-top:6px"><strong>Carry-forward:</strong> foreign tax blocked by the s6quat(1B) limitation itself carries forward ${carryYears} years (para (iii) of the proviso to s6quat(1B)(a)) — enter it as "Foreign tax credit b/f" in a future year. Tax blocked only by the no-refund guard (remaining SA tax after rebates/medical credits) is forfeited, not carried.</p>
            <p style="margin-top:6px"><strong>Dividend exemption:</strong> Foreign dividends are taxed on 20/45 of the gross amount under s10B(3) — the remaining 25/45 is exempt from SA tax.</p>
            <p style="margin-top:6px"><strong>Interest:</strong> Foreign interest is fully taxable (no exemption), unlike local interest which has an age-based exemption (s10(1)(i)).</p>
          </div>
        </details>
      </div>
    </details>
    ${noteHtml('info', `Credit: the lowest of ${fmt(c.ftcQualifying)} and ${fmt(c.ftcLimit)} = ${fmt(c.credit)}.`, 'Your FTC = minimum of (qualifying foreign tax) or (the s6quat(1B) limitation) or (remaining SA tax after rebates/medical) — one blended test over ALL foreign income, not a basket per source.', { style: 'margin-top:8px', icon: 'balance', title: 'How the credit is worked out' })}`;
}

/* ───── TOOLS & EQUIPMENT W&T ───── s11(e) wear-and-tear on tools/equipment.
   Migrated from 04-deductions.js (task #39) to makeCrudModule so this list
   gets edit + delete like every other list in the app, instead of a
   hand-rolled add/remove pair with no edit path (Hard rule 6). */

/* T-5 (IN47 s4.1.6/s4.3.8): the allowance must be apportioned for the part
   of the year of assessment the asset was actually owned — an asset
   acquired mid-year gets only the whole months from acquisition to
   year-end, not the full annual amount. An asset acquired before this tax
   year (or with no recorded acquisition date — treated as already owned,
   never excluded outright) gets the full year. Single source of truth for
   calcToolsWtTotal() (the total) and renderToolsWtList() (the per-item
   display) so they can never disagree, the way cryptoTotals() and its list
   renderers used to (T-1). Returns 0 once the write-off period is
   exhausted. */
function calcToolItemWt(item, key) {
  const life = wtLife(item.type);
  const annualWt = life === 1 ? item.cost : item.cost / life;
  /* F6 (Phase 7) and BACKLOG 91: the months come from the one write-off
     window rule, writeOffMonthsInTaxYear (01-data) — a period that starts
     OR ends partway through this tax year is apportioned (bought Sept 2023
     on a 3-year life, the 1 Mar 2026 - 28 Feb 2027 year gets March-Sept),
     one exhausted before the year gives 0. Equivalent, date for date, to the
     Date-object version it replaces (checked 2026-10-17 over 2017-2028,
     lives 1-6, in SAST and UTC). */
  return annualWt * (writeOffMonthsInTaxYear(item.dateAcq, life, key) / 12);
}
export function calcToolsWtTotal() {
  const key = gs('taxYear') || '2027';
  let total = 0;
  (APP.toolsWtItems||[]).forEach(item => { total += calcToolItemWt(item, key); });
  return total;
}

export const M_toolsWt = makeCrudModule({
  array: 'toolsWtItems', modalId: 'modal-tools-wt', titleId: 'tools-modal-title',
  titles: { add: 'Add asset', edit: 'Edit asset' },
  fields: [
    { el:'tools-wt-desc', key:'desc', kind:'str' },
    { el:'tools-wt-type', key:'type', kind:'raw', def:'computer' },
    { el:'tools-wt-cost', key:'cost', kind:'num' },
    { el:'tools-wt-date', key:'dateAcq', kind:'raw' }
  ],
  /* F5 (Phase 7): the type field's "computer" default on a fresh Add is not
     a deliberate choice — it is just where the select starts — so it is
     eligible for toolsCostEcho()'s cost-driven auto-switch to small_tool.
     An EDIT's loaded type IS a deliberate, previously-saved choice and must
     never be silently changed, so the flag stays off there regardless of
     cost. Kept here rather than in toolsCostEcho() itself because add vs
     edit is exactly what onClear/onLoad already distinguish. */
  onClear: () => { APP._toolsTypeAuto = 'computer'; APP._toolsTypePicked = null; },
  onLoad:  (it) => { APP._toolsTypeAuto = null; APP._toolsTypePicked = it.type === 'small_tool' ? null : it.type; },
  /* UI-CAP-1: the chooser says what the asset IS; whether it is written off
     at once is still the cost rule (F5, toolsCostEcho) — so a pick while
     adding stays eligible for the automatic full write-off, and the picked
     kind is what "Spread it out" and a cost over the limit return to. */
  onKind: (v, adding) => { APP._toolsTypePicked = v; if (adding) APP._toolsTypeAuto = v; toolsCostEcho(); },
  validate: () => {
    if(!(gs('tools-wt-desc')||'').trim()) return { el:'tools-wt-desc', msg:'This is required.' };
    if((gv('tools-wt-cost')||0) <= 0) return { el:'tools-wt-cost', msg:'Enter an amount.' };
    /* task #41: the s11(e) small-item write-off concession only applies
       at/under WT_SMALL_ITEM_LIMIT ("does not exceed", ITR12 guide §9.8.3(c)
       — QD-29) — block the save rather than silently write off an
       over-threshold item at 100% in year one. */
    /* The small-item limit itself is FIELD_CHECKS 'tools-wt-cost' (01-data.js):
       shown on blur and enforced by checkScope before this runs. */
    return null;
  },
  refresh: () => renderToolsWtList(),
  applyType: 'tools',
  confirm: { title: 'Remove Asset', msg: 'Delete this asset?' }
});
export function addToolsWtItem()    { M_toolsWt.add(); }
export function editToolsWtItem(i)  { M_toolsWt.edit(i); }
export function saveToolsWtItem()   { M_toolsWt.save(); }
export function removeToolsWtItem(i){ M_toolsWt.remove(i); }

export function renderToolsWtList() {
  const el = $('tools-wt-list'); if(!el) return;
  /* QA 2026-09: persistent "+ Add asset" button at the top of this page is
     the only add-CTA now — this duplicated it. */
  if(!(APP.toolsWtItems||[]).length) { el.innerHTML = ''; return; }
  const key = gs('taxYear') || '2027';
  el.innerHTML = APP.toolsWtItems.map((item,i) => {
    const life = wtLife(item.type);
    const annual = life === 1 ? item.cost : item.cost / life;
    const status = life === 1 ? 'Write-off' : 'Depreciate';
    /* task #43: the pro-rated "this year" figure is now the primary
       displayed amount (previously a small sub-text line) — it's the
       actual deductible amount, the straight-line annual rate is context. */
    const thisYear = calcToolItemWt(item, key);
    const annualLine = Math.abs(thisYear - annual) > 0.5
      ? `<div style="font-size:0.625rem;color:var(--tx3);width:100%">Annual rate: <span class="mono">${fmt(annual)}</span>/yr (${life}yr)</div>` : '';
    return `<div class="wt-item">
      <span class="wt-desc">${esc(item.desc)}</span>
      <span class="wt-val">${fmt(item.cost)}</span>
      <span style="font-size:0.625rem;color:var(--tx3)">${life}yr</span>
      <span class="wt-val">${fmt(thisYear)}</span>
      <span class="wt-status active">${status}</span>
      <div style="display:flex;gap:2px">
        <button class="btn btn-ghost btn-xs" onclick="editToolsWtItem(${i})" aria-label="Edit tool item"><i class="material-symbols-outlined msi-edit"></i></button>
        <button class="item-remove del" onclick="removeToolsWtItem(${i})" aria-label="Remove tool item"><i class="material-symbols-outlined msi-delete"></i></button>
      </div>
      ${annualLine}
    </div>`;
  }).join('');
  const total = calcToolsWtTotal();
  APP.pendingValues.tools = total;
  const totalEl = $('tools-wt-total');
  if(totalEl) totalEl.innerHTML = `<div class="calc-result-box"><div class="calc-result-big">${fmt(total)}</div><div class="calc-result-sub">Wear & tear deduction this year — s11(e)</div></div>`;
}

/* ═══════════════════════════════════════════════════════════
   B7 RETIREMENT INCOME — BATCH 5 SESSION 2
   Three sub-sections:
     1. Pension / Annuity (simple multi-entry capture)
     2. Retirement Lump Sum Tax Calculator (Second Schedule para 5/6 cumulative table)
     3. Two-Pot Savings Withdrawal (marginal-rate calc)
   ═══════════════════════════════════════════════════════════ */

/* ───── PENSION / ANNUITY ───── */
export const M_pension = makeCrudModule({
  array: 'pensionAnnuityItems', celebrateOnAdd: true, modalId: 'modal-pension-annuity', titleId: 'pen-modal-title',
  titles: { add: 'Add pension / annuity', edit: 'Edit pension / annuity' },
  fields: [
    { el:'pen-source',         key:'source',        kind:'str' },
    { el:'pen-amount',         key:'amount',        kind:'num' },
    { el:'pen-code',           key:'code',          kind:'raw' },
    { el:'pen-foreign',        key:'foreign',       kind:'raw', def:'no' },
    { el:'pen-source-country', key:'sourceCountry', kind:'str' },
    { el:'pen-foreign-tax',    key:'foreignTax',    kind:'num' }
  ],
  onForm: () => { penToggleForeign(); penToggleCodeNote(); },
  validate: () => {
    if(!(gs('pen-source')||'').trim()) return { el:'pen-source', msg:'This is required.' };
    if((gv('pen-amount')||0) <= 0) return { el:'pen-amount', msg:'Enter an amount.' };
    return null;
  },
  refresh: () => renderPensionAnnuityList(),
  confirm: { title: 'Remove Entry', msg: 'Delete this pension/annuity entry?' }
});
export function addPensionAnnuity()     { M_pension.add(); }
export function editPensionAnnuity(i)   { M_pension.edit(i); }
export function savePensionAnnuity()    { M_pension.save(); }
export function removePensionAnnuity(i) { M_pension.remove(i); }

export function penToggleForeign() {
  const foreign = gs('pen-foreign') === 'yes';
  /* B7.7 (IEM-1): hide-and-clear together — see showForeignRow(), 02-core.js.
     pen-amount keeps its own value regardless of source; only its
     fx-conversion widget is foreign-only (showFxWidgetFor). */
  showForeignRow('pen-country-row', foreign);
  showForeignRow('pen-foreigntax-row', foreign);
  showFxWidgetFor('pen-amount', foreign);
}

export function penToggleCodeNote() {
  const note = $('pen-code-3611-note');
  if(note) note.style.display = gs('pen-code') === '3611' ? '' : 'none';
}

export function renderPensionAnnuityList() {
  const el = $('pension-annuity-list'); if(!el) return;
  if(!(APP.pensionAnnuityItems||[]).length) {
    /* QA 2026-09: the persistent add button at the top of the page ("Add
       retirement income" since QR9b.3) is the only add-CTA — this duplicated it. */
    el.innerHTML = '';
    const sumEl = $('pension-annuity-total'); if(sumEl) sumEl.innerHTML = '';
    renderRetirementGlance();
    return;
  }
  /* W6 (PAYE-AE-06-G06 p.9, 3613/3663 "Restraint of trade" and p.9-10, 3618/3668
     "Annuity from Provident / Provident Preservation Fund"): 3613 is not a pension code at
     all (par (cB) gross income, restraint of trade — a labour/employment code, removed from
     this pension picker) and 3618 was mislabeled "Pension — disability". */
  const codeLabels = {
    '3603': 'Pension (PAYE)',
    '3610': 'Annuity from RAF',
    '3611': 'Purchased Annuity (taxable portion)',
    '3618': 'Annuity from Provident / Provident Preservation Fund'
  };
  let total = 0;
  el.innerHTML = APP.pensionAnnuityItems.map((p, i) => {
    total += p.amount || 0;
    return `<div class="card" style="margin-bottom:10px;padding:14px 16px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div class="card-ico-head-icon ico-bg-green ico-sz-40"><i class="material-symbols-outlined msi-beach-access"></i></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.9375rem;margin-bottom:4px">${esc(p.source)}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <span class="pill teal" style="font-size:0.625rem">${esc(p.code)} — ${esc(codeLabels[p.code]||p.code)}</span>
                ${p.foreign === 'yes' ? '<span class="pill" style="font-size:0.625rem;background:rgba(31,95,175,0.18);color:var(--tel)">Foreign' + (p.sourceCountry?' · '+esc(p.sourceCountry):'') + '</span>' : ''}
              </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-xs" onclick="editPensionAnnuity(${i})" aria-label="Edit pension"><i class="material-symbols-outlined msi-edit"></i></button>
              <button class="btn btn-danger btn-xs" onclick="removePensionAnnuity(${i})" aria-label="Remove pension"><i class="material-symbols-outlined msi-delete"></i></button>
            </div>
          </div>
          <div style="margin-top:8px;font-size:0.8125rem;color:var(--tx2)"><span style="font-family:var(--mono);font-weight:700;font-size:0.9375rem;color:var(--tx)">${fmt(p.amount)}</span> annual${S10C_ANNUITY_CODES[p.code] ? ' — may qualify for the s10C exemption' : ' — fully taxable'}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const r = calcFullTax();
  const sumEl = $('pension-annuity-total');
  if(sumEl) {
    sumEl.innerHTML = `<div class="sum-line divider total refund">
      <span class="lbl">Total Pension / Annuity (gross)</span>
      <span class="val">${fmt(total)}</span>
    </div>`
    + (r.s10cAnnuityExempt > 0 ? `<div class="sum-line"><span class="lbl">Less: s10C exemption (non-deducted contributions)</span><span class="val" style="color:var(--ok)">−${fmt(r.s10cAnnuityExempt)}</span></div>
    <div class="sum-line total"><span class="lbl">Taxable pension / annuity</span><span class="val">${fmt(r.pensionAnnuity)}</span></div>` : '');
  }
  renderRetirementGlance();
}

/* ───── RETIREMENT LUMP SUM (Second Schedule para 5/6) ───── */
export const M_lumpsum = makeCrudModule({
  array: 'retirementLumpsums', celebrateOnAdd: true, modalId: 'modal-retirement-lumpsum', titleId: 'ls-modal-title',
  titles: { add: 'Add retirement lump sum', edit: 'Edit retirement lump sum' },
  fields: [
    { el:'ls-fund',       key:'fund',      kind:'str' },
    { el:'ls-amount',     key:'amount',    kind:'num' },
    { el:'ls-event-type', key:'eventType', kind:'raw', def:'retirement' },
    { el:'ls-date',       key:'date',      kind:'raw' },
    { el:'ls-tax-withheld', key:'taxWithheld', kind:'num' }
  ],
  validate: () => {
    if(!(gs('ls-fund')||'').trim()) return { el:'ls-fund', msg:'This is required.' };
    if((gv('ls-amount')||0) <= 0) return { el:'ls-amount', msg:'Enter an amount.' };
    return null;
  },
  refresh: () => renderRetirementLumpsumList(),
  confirm: { title: 'Remove Entry', msg: 'Delete this retirement lump sum?' }
});
export function addRetirementLumpsum()     { M_lumpsum.add(); }
export function editRetirementLumpsum(i)   { M_lumpsum.edit(i); }
export function saveRetirementLumpsum()    { M_lumpsum.save(); }
export function removeRetirementLumpsum(i) { M_lumpsum.remove(i); }

export function renderRetirementLumpsumList() {
  const el = $('retirement-lumpsum-list'); if(!el) return;
  if(!(APP.retirementLumpsums||[]).length) {
    /* QA 2026-09, re-checked 2026-10-09 (OI-C1a): the empty list renders no
       add-CTA of its own. Since UI-CAP-1 the retirement panel has ONE Add
       (addPensionAnnuity, body.html), which opens the "What did you
       receive?" chooser — a lump-sum-only Add here would skip that question.
       assertCaptureKinds pins the count at one. */
    el.innerHTML = '';
    const sumEl = $('retirement-lumpsum-summary'); if(sumEl) sumEl.innerHTML = '';
    renderRetirementGlance();
    return;
  }

  const labels = {retirement:'Retirement', severance:'Severance', withdrawal:'Withdrawal', death:'Death Benefit', transfer:'Transfer (not taxed)', divorce_nonmember:'Divorce order'};
  /* T-C2: s10cOpening is this year's post-s11F retExcess (calcFullTax's own
     already-settled figure — the single unified py_ret_excess balance),
     not an independently-read field, so this list can never disagree with
     the engine about how much relief pool is available this year. */
  const s10cOpening = calcFullTax().s10cOpening;
  /* engine-remediation W10: one shared walk (date-ordered, para 6(1)(b)(i)
     relief scope) drives both this list and calcFullTax — see walkLumpsums
     in 02-core.js. Cards stay in the record's own array order (so edit/
     remove indices stay stable); the per-event figures come from the
     date-ordered walk via an identity lookup. */
  const walk = walkLumpsums(APP.retirementLumpsums, s10cOpening, APP.priorLumpsumTaxable || 0);
  const rowByEvent = new Map(walk.rows.map(r => [r.event, r]));
  let totalGross = 0, totalTax = 0, totalRelief = 0;

  el.innerHTML = APP.retirementLumpsums.map((l, i) => {
    const row = rowByEvent.get(l);
    const g = row.gross, relief = row.relief, calc = { taxOnThis: row.taxOnThis };
    totalGross += g;
    totalRelief += relief;
    totalTax += calc.taxOnThis;
    return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <i class="material-symbols-outlined msi-savings" style="color:var(--tx3);font-size:0.75rem"></i>
            <strong style="font-size:0.875rem">${esc(l.fund)}</strong>
            <span class="pill teal" style="font-size:0.625rem">${esc(labels[l.eventType]||l.eventType)}</span>
            ${l.date ? '<span style="font-size:0.6875rem;color:var(--tx3)">'+esc(l.date)+'</span>' : ''}
          </div>
          <div style="display:flex;gap:14px;margin-top:7px;font-size:0.75rem;color:var(--tx2);flex-wrap:wrap">
            <span><strong>Gross:</strong> ${fmt(g)}</span>
            ${relief > 0 ? `<span style="color:var(--ok)"><strong>Non-deducted contributions relief:</strong> &minus;${fmt(relief)}</span>` : ''}
            <span style="color:var(--er)"><strong>Tax:</strong> ${fmt(calc.taxOnThis)}</span>
            <span style="color:var(--ok)"><strong>Net:</strong> ${fmt(g - calc.taxOnThis)}</span>
          </div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-xs" onclick="editRetirementLumpsum(${i})" aria-label="Edit"><i class="material-symbols-outlined msi-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="removeRetirementLumpsum(${i})" aria-label="Remove"><i class="material-symbols-outlined msi-delete"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');

  const sumEl = $('retirement-lumpsum-summary'); if(!sumEl) return;
  const taxFreeBand = getFact('retirementLumpSum.0.max');
  const runningCum = walk.cumPoolClosing;
  const taxableTotalThisYear = totalGross - totalRelief;
  // Tax-free portion consumed this year = growth in cumulative pool through the 0% bracket
  const taxFreeUsedThisYear = Math.max(0, Math.min(taxFreeBand, runningCum) - Math.max(0, APP.priorLumpsumTaxable || 0));
  const taxablePortion = taxableTotalThisYear - taxFreeUsedThisYear;
  sumEl.innerHTML = `
    <div class="sum-line"><span class="lbl">Prior cumulative pool (SARS records)</span><span class="val">${fmt(APP.priorLumpsumTaxable||0)}</span></div>
    <div class="sum-line"><span class="lbl">Gross lump sums (this year)</span><span class="val">${fmt(totalGross)}</span></div>
    ${totalRelief > 0 ? `<div class="sum-line"><span class="lbl">Less: non-deducted contributions relief (Second Schedule para 5/6)</span><span class="val" style="color:var(--ok)">&minus; ${fmt(totalRelief)}</span></div>` : ''}
    ${totalRelief > 0 ? `<div class="sum-line"><span class="lbl">Taxable lump sums (after relief)</span><span class="val">${fmt(taxableTotalThisYear)}</span></div>` : ''}
    ${taxFreeUsedThisYear > 0 ? `<div class="sum-line"><span class="lbl">Of which: tax-free (0% bracket — first ${fmt(taxFreeBand)} lifetime)</span><span class="val" style="color:var(--ok)">${fmt(taxFreeUsedThisYear)}</span></div>` : ''}
    ${taxablePortion > 0 ? `<div class="sum-line"><span class="lbl">Of which: above tax-free band (18%–36%)</span><span class="val">${fmt(taxablePortion)}</span></div>` : ''}
    <div class="sum-line"><span class="lbl">Updated lifetime cumulative pool</span><span class="val">${fmt(runningCum)}</span></div>
    <div class="sum-line divider total owing"><span class="lbl">Total tax on lump sums</span><span class="val">${fmt(totalTax)}</span></div>
    <div class="sum-line total refund"><span class="lbl">Net after lump sum tax</span><span class="val">${fmt(totalGross - totalTax)}</span></div>
    <details class="info-acc" style="margin-top:8px">
      <summary>ⓘ Lifetime cumulative table <span class="chev">▾</span></summary>
      <div class="body" style="font-size:0.75rem">First ${fmt(taxFreeBand)} is tax-free across your lifetime. Tax brackets at 18%, 27%, 36%. The cumulative pool tracks ALL taxable retirement lump sums received (including from prior years) and determines which bracket applies to each new receipt, in date order. The non-deducted contributions relief (Second Schedule para 5/6) reduces the taxable portion of retirement, death and withdrawal benefits by the balance of prior non-deductible retirement fund contributions — severance benefits do not qualify for this relief.</div>
    </details>`;
  renderRetirementGlance();
}

/* ───── TWO-POT SAVINGS WITHDRAWAL ───── */
export const M_twopot = makeCrudModule({
  array: 'twopotWithdrawals', celebrateOnAdd: true, modalId: 'modal-twopot', titleId: 'tp-modal-title',
  titles: { add: 'Add two-pot withdrawal', edit: 'Edit two-pot withdrawal' },
  fields: [
    { el:'tp-fund',   key:'fund',   kind:'str' },
    { el:'tp-amount', key:'amount', kind:'num' },
    { el:'tp-date',   key:'date',   kind:'raw' },
    { el:'tp-tax-withheld', key:'taxWithheld', kind:'num' }
  ],
  onForm: () => twopotUpdateLiveCalc(),
  validate: () => {
    if(!(gs('tp-fund')||'').trim()) return { el:'tp-fund', msg:'This is required.' };
    if((gv('tp-amount')||0) <= 0) return { el:'tp-amount', msg:'Enter an amount.' };
    return null;
  },
  refresh: () => renderTwopotWithdrawalList(),
  confirm: { title: 'Remove Entry', msg: 'Delete this two-pot withdrawal?' }
});
export function addTwopotWithdrawal()     { M_twopot.add(); }
export function editTwopotWithdrawal(i)   { M_twopot.edit(i); }
export function saveTwopotWithdrawal()    { M_twopot.save(); }
export function removeTwopotWithdrawal(i) { M_twopot.remove(i); }

/* §H (07-surfaces-and-motion.md, entry-sheets): the R2,000 statutory
   minimum is stated as a live position — how far above/below it this
   amount sits — rather than only surfacing once the amount is already
   invalid. */
export function twopotUpdateLiveCalc() {
  const amount = gv('tp-amount') || 0;
  const minWithdrawal = getFact('twoPot.savingsPotMin');
  const liveEl = $('tp-live-calc'); if(!liveEl) return;
  if(amount === 0) { liveEl.innerHTML = ''; return; }
  const isBelow = amount < minWithdrawal;
  const limitLine = isBelow
    ? `<div style="font-size:0.6875rem;color:var(--er);margin-top:4px"><i class="material-symbols-outlined msi-warning"></i> Below the ${fmt(minWithdrawal)} minimum withdrawal — need ${fmt(minWithdrawal - amount)} more.</div>`
    : `<div style="font-size:0.6875rem;color:var(--mint);margin-top:4px"><i class="material-symbols-outlined msi-check"></i> ${fmt(amount - minWithdrawal)} above the ${fmt(minWithdrawal)} minimum withdrawal.</div>`;
  liveEl.innerHTML = `<div style="background:var(--tebg);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:0.75rem;color:var(--tx2)">
    <i class="material-symbols-outlined msi-info" style="color:var(--tel)"></i>
    Two-pot withdrawals are added to your taxable income for the year and taxed at your marginal rate (not the lump sum table).
    ${limitLine}
  </div>`;
}

export function renderTwopotWithdrawalList() {
  const el = $('twopot-list'); if(!el) return;
  if(!(APP.twopotWithdrawals||[]).length) {
    /* QA 2026-09: the persistent add button at the top of the page ("Add
       retirement income" since QR9b.3) is the only add-CTA — this duplicated it. */
    el.innerHTML = '';
    const sumEl = $('twopot-summary'); if(sumEl) sumEl.innerHTML = '';
    renderRetirementGlance();
    return;
  }

  let total = 0;
  el.innerHTML = APP.twopotWithdrawals.map((t, i) => {
    total += t.amount;
    return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <i class="material-symbols-outlined msi-paid" style="color:var(--tx3);font-size:0.75rem"></i>
            <strong style="font-size:0.875rem">${esc(t.fund)}</strong>
            ${t.date ? '<span style="font-size:0.6875rem;color:var(--tx3)">'+esc(t.date)+'</span>' : ''}
          </div>
          <div style="margin-top:5px;font-size:0.8125rem;color:var(--tx2)"><strong style="color:var(--tx)">${fmt(t.amount)}</strong> — taxed at marginal rate</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-xs" onclick="editTwopotWithdrawal(${i})" aria-label="Edit"><i class="material-symbols-outlined msi-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="removeTwopotWithdrawal(${i})" aria-label="Remove"><i class="material-symbols-outlined msi-delete"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Marginal rate estimate
  let marginalRate = 0;
  try {
    const r = (typeof calcFullTax === 'function') ? calcFullTax() : null;
    if(r && r.taxableIncome > 0) {
      const ty = getActiveTaxYear();
      const newTaxable = r.taxableIncome + total;
      const br = ty.brackets.find(b => newTaxable >= b.min && newTaxable <= b.max);
      if(br) marginalRate = br.rate;
    }
  } catch(e) { /* ignore */ }
  const estTax = total * marginalRate;

  const sumEl = $('twopot-summary'); if(!sumEl) return;
  sumEl.innerHTML = `
    <div class="sum-line"><span class="lbl">Total two-pot withdrawals (this year)</span><span class="val">${fmt(total)}</span></div>
    <div class="sum-line"><span class="lbl">Estimated marginal rate</span><span class="val">${(marginalRate*100).toFixed(0)}%</span></div>
    <div class="sum-line divider total owing"><span class="lbl">Estimated tax (added to income tax)</span><span class="val">${fmt(estTax)}</span></div>
    <details class="info-acc" style="margin-top:8px">
      <summary>ⓘ Two-pot tax note <span class="chev">▾</span></summary>
      <div class="body" style="font-size:0.75rem">Two-pot withdrawals are added to your <strong>taxable income</strong> for the year. The estimate uses your marginal tax bracket — actual rate may differ if the withdrawal pushes you into a higher bracket.</div>
    </details>`;
  renderRetirementGlance();
}

export function renderRetirementGlance() {
  const glEl = $('glance-b7retirement'); if(!glEl) return;
  /* T-C2: keep this page's non-deducted-contributions mirror (py_ret_excess_ret)
     in sync with the canonical py_ret_excess field on the Retirement
     Deductions page — same pattern as renderCarriedBalances()'s mirrorIn()
     on the SARS Account page. Never overwrite while the user is typing in it. */
  (function(){
    const m = $('py_ret_excess_ret'), c = $('py_ret_excess');
    if (m && c && document.activeElement !== m) m.value = c.value;
  })();
  const pensionTotal = (APP.pensionAnnuityItems||[]).reduce((s, p) => s + (p.amount||0), 0);
  const lumpsums = APP.retirementLumpsums||[];
  /* engine-remediation W10: shared walk (date order + para 6 relief scope) —
     no more locally re-derived gross/tax/cum. T-C2: s10cOpeningGl is
     calcFullTax's own already-settled retExcess, not an independently-read
     field — see the identical note in renderRetirementLumpsumList above. */
  const s10cOpeningGl = calcFullTax().s10cOpening;
  const lsWalk = walkLumpsums(lumpsums, s10cOpeningGl, APP.priorLumpsumTaxable || 0);
  const lsGross = lsWalk.lumpSumGross, lsTax = lsWalk.lumpSumTax;
  const twopotTotal = (APP.twopotWithdrawals||[]).reduce((s, t) => s + (t.amount||0), 0);

  if(!pensionTotal && !lsGross && !twopotTotal) { glEl.innerHTML = ''; var _hp0=$('hero-b7retirement'); if(_hp0) _hp0.innerHTML='<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')"><div class="dhero-top"><div class="dhero-lbl">Total retirement income</div></div><div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b7retirement">' + fmt(0) + '</div><div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No pension, annuity, lump sum or two-pot income yet — add your first below.</div></div>'; return; }

  const heroElP = $('hero-b7retirement');
  if(heroElP) {
    var _rTotal = pensionTotal + lsGross + twopotTotal;
    var _rCount = (APP.pensionAnnuityItems||[]).length + lumpsums.length + (APP.twopotWithdrawals||[]).length;
    var _rParts = [];
    if(pensionTotal>0) _rParts.push('<span class="mono" style="color:var(--tx)">'+fmt(pensionTotal)+'</span> pension');
    if(lsGross>0) _rParts.push('<span class="mono" style="color:var(--tx)">'+fmt(lsGross)+'</span> lump sum');
    if(twopotTotal>0) _rParts.push('<span class="mono" style="color:var(--tx)">'+fmt(twopotTotal)+'</span> two-pot');
    heroElP.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
      + '<div class="dhero-top"><div class="dhero-lbl">Total retirement income</div>'
      + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + _rCount + (_rCount===1?' source':' sources') + '</span></div>'
      + '<div class="dhero-num" data-count="' + (_rTotal) + '" data-count-key="income-b7retirement">' + fmt(_rTotal) + '</div>'
      + (_rParts.length ? '<div class="dhero-break">' + _rParts.join(' \u00b7 ') + heroBreakdownLink('retirement') + '</div>' : '')
      + '</div>';
  }

  const cards = [];
  if(pensionTotal > 0) {
    const _rGl = calcFullTax();
    cards.push(`<div class="card" style="padding:12px 14px;margin-bottom:8px">
      <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Pension / Annuity Income</div>
      <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--tx)">${fmt(pensionTotal)}</div>
      <div style="font-size:0.6875rem;color:var(--tx3);margin-top:4px">${_rGl.s10cAnnuityExempt > 0 ? 'Taxable at marginal rate after ' + fmt(_rGl.s10cAnnuityExempt) + ' s10C exemption' : 'Annual — fully taxable at marginal rate'}</div>
    </div>`);
  }
  if(lsGross > 0) {
    cards.push(`<div class="card" style="padding:0;margin-bottom:8px;overflow:hidden">
      <details>
        <summary style="padding:12px 14px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Lump Sum Tax <i class="material-symbols-outlined msi-expand-more" style="font-size:0.5625rem;opacity:.5;margin-left:4px"></i></div>
            <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--er)">${fmt(lsTax)}</div>
          </div>
        </summary>
        <div style="padding:0 14px 12px;border-top:1px solid var(--bd);font-size:0.75rem;color:var(--tx2);line-height:1.8">
          <div style="display:flex;justify-content:space-between"><span>Gross lump sums</span><span style="font-family:var(--mono)">${fmt(lsGross)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Tax payable (lump-sum table)</span><span style="font-family:var(--mono);color:var(--er)">${fmt(lsTax)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--bd);margin-top:4px;padding-top:4px"><span>Net after tax</span><span style="font-family:var(--mono);color:var(--ok)">${fmt(lsGross - lsTax)}</span></div>
        </div>
      </details>
    </div>`);
  }
  if(twopotTotal > 0) {
    cards.push(`<div class="card" style="padding:12px 14px;margin-bottom:8px">
      <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Two-Pot Withdrawals</div>
      <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--tx)">${fmt(twopotTotal)}</div>
      <div style="font-size:0.6875rem;color:var(--tx3);margin-top:4px">Added to taxable income — taxed at marginal rate</div>
    </div>`);
  }
  glEl.innerHTML = cards.join('');
}

/* ═══════════════════════════════════════════════════════════
   B9 OTHER RECEIPTS — BATCH 5 SESSION 3
   Multi-item capture for miscellaneous taxable receipts.
   Categories: Royalties, Alimony, Settlements, Recoveries, Other.
   Taxable at the marginal rate; royalties and Other take cost lines
   (OTHER_RECEIPT_COST_KINDS, BACKLOG 63).
   ═══════════════════════════════════════════════════════════ */

/* NB: here `desc` is a fixed CATALOG help-string (static UI copy), NOT the
   free-text record descriptor that live records carry on their own `desc`
   field — same key name, deliberately different meaning. */
export const B9_CATEGORIES = [
  {id:'royalties',       label:'Royalties / IP Income',       icon:'music_note',        desc:'Author royalties, patent royalties, IP licensing'},
  {id:'alimony',         label:'Alimony / Maintenance',       icon:'handshake',    desc:'Maintenance received from former spouse'},
  {id:'settlement',      label:'Settlement / Award',          icon:'gavel',        desc:'Court settlements, awards (revenue nature)'},
  {id:'recovery',        label:'Recoveries / Refunds',        icon:'undo',  desc:'Insurance recoveries, expense refunds previously claimed'},
  {id:'other',           label:'Other Taxable Receipt',       icon:'receipt_long',      desc:'Any other taxable income not covered above'}
];

export const M_otherReceipt = makeCrudModule({
  array: 'otherReceipts', celebrateOnAdd: true, entKey: 'income.other', modalId: 'modal-other-receipt', titleId: 'or-modal-title',
  titles: { add: 'Add other taxable receipt', edit: 'Edit other taxable receipt' },
  fields: [
    { el:'or-category',     key:'category',    kind:'raw', def:'royalties' },
    { el:'or-description',  key:'description', kind:'str' },
    { el:'or-amount',       key:'amount',      kind:'num' },
    { el:'or-note',         key:'note',        kind:'str' },
    { el:'or-date',         key:'date',        kind:'raw' },
    { el:'or-receipt-type', key:'receiptType', kind:'raw', def:'income' },
    { el:'or-proceeds',     key:'proceeds',    kind:'num' },
    { el:'or-basecost',     key:'baseCost',    kind:'num' }
  ],
  onForm: () => { onReceiptTypeChange(); otherReceiptUpdateCategory(); },
  onClear: () => { const rows = $('or-expense-rows'); if (rows) rows.innerHTML = ''; },
  /* UI-CAP-1: what was received decides income or capital
     (CAPTURE_KINDS.otherReceipt receiptType). A saved record keeps its own
     until a kind is picked again. */
  onKind: (v) => {
    const o = CAPTURE_KINDS.otherReceipt.options.find(x => x.value === v);
    const t = $('or-receipt-type'); if (t && o) t.value = o.receiptType;
    onReceiptTypeChange(); otherReceiptUpdateCategory(); otherReceiptSeedCosts();
  },
  onLoad: (item) => {
    otherReceiptLoadCosts(item);
    const isAlimony = item && item.category === 'alimony';
    const sel = $('or-alimony-order');
    if(sel) sel.value = (isAlimony && item.receiptType === 'exempt') ? 'yes' : 'no';
  },
  validate: () => {
    if(!(gs('or-description')||'').trim()) return { el:'or-description', msg:'This is required.' };
    const isAlimony = gs('or-category') === 'alimony';
    if(!isAlimony && (gs('or-receipt-type')||'income') === 'capital') {
      if((gv('or-proceeds')||0) <= 0 && (gv('or-basecost')||0) <= 0) return { el:'or-proceeds', msg:'Enter the proceeds, the base cost, or both.' };
    } else if((gv('or-amount')||0) <= 0) return { el:'or-amount', msg:'Enter an amount.' };
    return null;
  },
  collect: (cur) => {
    const description = (gs('or-description')||'').trim();
    const base = {
      id:   cur ? cur.id : Date.now() + Math.random(),
      description,
      note: (gs('or-note')||'').trim(),
      date: gs('or-date') || ''
    };
    const isAlimony = gs('or-category') === 'alimony';
    if(isAlimony) {
      /* s10(1)(u): exempt only when under a court order, divorce order or
         written agreement — see otherReceiptAlimonyOrderChange (06c). */
      const ordered = gs('or-alimony-order') === 'yes';
      return Object.assign(base, {
        receiptType: ordered ? 'exempt' : 'income', category: 'alimony',
        amount: gv('or-amount') || 0
      });
    }
    if((gs('or-receipt-type')||'income') === 'capital') {
      return Object.assign(base, {
        receiptType: 'capital', category: gs('or-category') || 'capital_receipt',
        proceeds: gv('or-proceeds') || 0, baseCost: gv('or-basecost') || 0, amount: 0
      });
    }
    const category = gs('or-category') || 'other';
    return Object.assign(base, {
      receiptType: 'income', category,
      amount: gv('or-amount') || 0
    }, OTHER_RECEIPT_COST_KINDS.indexOf(category) >= 0
      ? { expenses: collectCostRows('or-expense-rows', 'or-exp-cat', 'or-exp-amt', 'or-exp-note') } : {});
  },
  refresh: () => renderOtherReceiptsList(),
  afterSave: (item) => {
    /* capital items go via CGT — refresh CGT result so pendingValues.cgt updates */
    if(item.receiptType === 'capital' && typeof renderCgtResult === 'function') renderCgtResult();
  },
  confirm: { title: 'Remove Entry', msg: 'Delete this entry?' }
});
export function addOtherReceipt()     { M_otherReceipt.add(); }
export function editOtherReceipt(i)   { M_otherReceipt.edit(i); }
export function saveOtherReceipt()    { M_otherReceipt.save(); }
export function removeOtherReceipt(i) { M_otherReceipt.remove(i); }

/* ═══════════════════════════════════════════════════════════
   EMPLOYMENT INCOME · EMPLOYER PAYE · DEDUCTION CODES
   Folded onto the shared factory so every record type uses one
   lifecycle (add/edit/save/remove + auto-save). Defined here (not
   in 03/04) because makeCrudModule lives in this module, which
   evaluates after 00–04 — defining them upstream would call the
   factory before it exists (ESM eval-order boot hazard).
   Record shapes are unchanged: the engine reads APP.incomeItems /
   APP.deductionItems / APP.employerPaye directly. No applyType —
   these are live reads, not appliedValues commits.
   ═══════════════════════════════════════════════════════════ */

/* B1 — IRP5 / IT3(a) employment income. name/cat/doc derived from the
   selected SARS code via IRP5_INCOME (single source of truth).
   Field convention: on a LIVE record, `desc` is the user's free-text descriptor
   (the canonical record-descriptor meaning, shared by incomeItems /
   deductionItems / cgtAssets / cryptoDisposals / cryptoRevenue / toolsWtItems).
   Kept as `desc` by design — distinct from the catalog `desc`, the planner
   `_auto_bonus` sentinel, and the cgtAssets `note` sub-field. */
export const M_income = makeCrudModule({
  array: 'incomeItems', celebrateOnAdd: true, modalId: 'modal-irp5', titleId: 'irp5-modal-title',
  titles: { add: 'IRP5 / IT3(a) Income', edit: 'Edit Income' },
  fields: [
    { el:'add-income-code',   key:'code',   kind:'raw' },
    { el:'add-income-desc',   key:'desc',   kind:'str' },
    { el:'add-income-amount', key:'amount', kind:'num' },
  ],
  /* S3 Batch 6 (C8): onForm re-runs the code-dependent FX-widget gate, since
     an edited item's code (and so its foreign/domestic status) is already
     set by the time onForm fires — without this, editing a foreign-service
     entry would open with the currency widget hidden until the user
     re-touched the Source Code field. */
  onForm: () => onIncomeCodeChange(),
  /* S3 Batch 6 (C8): clears the FX widget's own state on a fresh add — its
     fields aren't in `fields` above (they're conversion-helper state, not
     part of the item), so makeCrudModule's declarative clear never touches
     them; left alone, a previous entry's rate/source/date would leak into
     the next add. */
  onClear: () => { ['emp-fx-cur','emp-fx-amt','emp-fx-rate','emp-fx-source','emp-fx-date'].forEach(id => { const e = $(id); if (e) e.value = ''; }); const r = $('emp-fx-result'); if (r) r.style.display = 'none'; },
  /* S3 Batch 6 (C8): repopulate the stored rate/source/date so re-saving an
     edited entry without touching the currency widget doesn't wipe them. */
  onLoad: (item) => {
    const rateEl = $('emp-fx-rate'), sourceEl = $('emp-fx-source'), dateEl = $('emp-fx-date');
    if (rateEl) rateEl.value = item.fxRate || '';
    if (sourceEl) sourceEl.value = item.fxRateSource || '';
    if (dateEl) dateEl.value = item.fxRateDate || '';
  },
  validate: () => !gs('add-income-code') ? { el:'add-income-code', msg:'Choose an option.' } : !(gv('add-income-amount') > 0) ? { el:'add-income-amount', msg:'Enter an amount.' } : null,
  collect: (cur) => {
    const code = gs('add-income-code');
    const def = IRP5_INCOME.find(x => x.code === code);
    const item = {
      id: cur && cur.id ? cur.id : Date.now(),
      code,
      name: def ? def.name : 'Other',
      cat:  def ? def.cat  : 'other',
      doc:  def ? def.doc  : 'IRP5',
      desc: (gs('add-income-desc') || '').trim(),
      amount: gv('add-income-amount') || 0
    };
    /* S3 Batch 6 (C8): persists only when the FX widget was actually used
       for THIS entry (emp-fx-rate is blank otherwise, whether the code is
       domestic or the user typed the Rand amount directly) — a bare amount
       alone can't tell those two apart from a foreign one entered via
       conversion. */
    const fxRate = gv('emp-fx-rate');
    if (fxRate > 0) {
      item.fxRate = fxRate;
      item.fxRateSource = gs('emp-fx-source');
      item.fxRateDate = gs('emp-fx-date');
    }
    return item;
  },
  refresh: () => { renderIncomeList(); renderIncomeStats(); },
  confirm: { title: 'Remove Income Item', msg: 'Delete this income entry?' }
});
export function addIncomeItem()     { M_income.add(); }
export function editIncomeItem(i)   { M_income.edit(i); }
export function saveIncomeItem()    { M_income.save(); }
export function removeIncomeItem(i) { M_income.remove(i); }

/* B1 — per-employer PAYE / UIF withheld. */
/* QR4.6 (Q-CPY-7, QD-19): a non-blocking note under PAYE Withheld when the entry is
   larger than all the remuneration captured, or above the top marginal rate of it.
   Remuneration is the engine's own remunerationBase sum (calcRemunerationBase) —
   not a second definition. Never blocks saving. */
export function payePlausibilityCheck() {
  const box = $('paye-plausibility'); if (!box) return;
  box.innerHTML = plausibilityHtml(plausibilityNotes(['payeOverRemuneration', 'payeOverTopRate'],
    { paye: gv('add-emp-paye') || 0, remuneration: calcRemunerationBase(APP.incomeItems) }));
}
export const M_employerPaye = makeCrudModule({
  array: 'employerPaye', modalId: 'modal-paye', titleId: 'paye-modal-title',
  titles: { add: 'PAYE & UIF Withheld', edit: 'Edit PAYE / UIF' },
  fields: [
    { el:'add-emp-name', key:'name', kind:'str' },
    { el:'add-emp-paye', key:'paye', kind:'num' },
    { el:'add-emp-uif',  key:'uif',  kind:'num' },
  ],
  onForm: () => payePlausibilityCheck(),
  validate: () => ((gs('add-emp-name') || '').trim() || gv('add-emp-paye') > 0) ? null : { el:'add-emp-name', msg:'Enter the employer name or the PAYE amount.' },
  collect: (cur) => ({
    id: cur && cur.id ? cur.id : Date.now(),
    name: (gs('add-emp-name') || '').trim() || 'Employer',
    paye: gv('add-emp-paye') || 0,
    uif:  gv('add-emp-uif')  || 0
  }),
  refresh: () => { renderEmployerPaye(); renderIncomeGlance(); },
  confirm: { title: 'Remove Employer', msg: 'Delete this employer entry?' }
});
export function addEmployerPaye()     { M_employerPaye.add(); }
export function editEmployerPaye(i)   { M_employerPaye.edit(i); }
export function saveEmployerPaye()    { M_employerPaye.save(); }
export function removeEmployerPaye(i) { M_employerPaye.remove(i); }

/* Additional IRP5 deduction codes not covered by the dedicated calculators.
   name/type derived from the selected code via IRP5_DEDUCTIONS. */
export const M_deductionCode = makeCrudModule({
  array: 'deductionItems', modalId: 'modal-deduction-code', titleId: 'ded-code-modal-title',
  /* S3 Batch 13 (D8): "IRP5 deduction" heading corrected — see 00-forms.js's
     CFG_DEDUCTION_CODE comment for why. */
  titles: { add: 'Add other deductions', edit: 'Edit other deduction' },
  fields: [
    { el:'add-ded-code',   key:'code',   kind:'raw' },
    { el:'add-ded-desc',   key:'desc',   kind:'str' },
    { el:'add-ded-amount', key:'amount', kind:'num' },
  ],
  /* B3 (§6.3, item 30): the code is no longer the way in — a claim needs an
     amount and SOMETHING to identify it, either the user's own description
     or a SARS code. Requiring the description outright would have broken the
     still-valid code-first path (and did: the CRUD smoke drives exactly
     that), so the rule is amount + at least one identifier. */
  validate: () => !((gs('add-ded-desc') || '').trim() || gs('add-ded-code')) ? { el:'add-ded-desc', msg:'Say what it is, or choose its code.' }
    /* BACKLOG 24: a code with its own page is refused here, never deducted
       in full (deductionCodeRoute, 01-data). */
    : deductionCodeRoute(gs('add-ded-code')) ? { el:'add-ded-code', msg: deductionCodeRoute(gs('add-ded-code')) }
    : !(gv('add-ded-amount') > 0) ? { el:'add-ded-amount', msg:'Enter an amount.' } : null,
  /* Reveal the code row when editing an entry that has one, so a saved code
     is never invisible in the form that owns it. */
  onLoad: (item) => {
    if (item && item.code) revealField('ded-code-row', 'ded-code-chip');
    else hideField('ded-code-row', 'ded-code-chip');
  },
  onClear: () => hideField('ded-code-row', 'ded-code-chip'),
  collect: (cur) => {
    const code = gs('add-ded-code');
    const desc = (gs('add-ded-desc') || '').trim();
    const def = IRP5_DEDUCTIONS.find(x => x.code === code);
    /* Item shape is UNCHANGED — the engine reads `code` (only to exclude
       4116) and `amount`, and both still arrive exactly as before. `name`
       falls back to the user's own description so a code-less entry still
       reads as something in the list and on the return. */
    return {
      id: cur && cur.id ? cur.id : Date.now(),
      code,
      name: def ? def.name : (desc || 'Other'),
      type: def ? def.type : 'other',
      desc,
      amount: gv('add-ded-amount') || 0
    };
  },
  refresh: () => { renderDeductionCodeList(); },
  confirm: { title: 'Remove Deduction', msg: 'Delete this entry?' }
});
export function addDeductionItem()     { M_deductionCode.add(); }
export function editDeductionItem(i)   { M_deductionCode.edit(i); }
export function saveDeductionItem()    { M_deductionCode.save(); }
export function removeDeductionItem(i) { M_deductionCode.remove(i); }

/* V8.9 B4.2 (D2-v9): standalone crypto capture. Each entry is classified and routed to
   the correct tax line (cgt -> capital gains; trading/mining/staking/other -> revenue).
   String concatenation only in dynamic HTML (Android WebView). */
