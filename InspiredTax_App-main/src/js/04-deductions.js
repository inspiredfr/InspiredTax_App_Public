import { RETIREMENT_FUNDS, WT_SMALL_ITEM_LIMIT, itemCount, wtLife, getFact, SARS_REIMBURSIVE_RATE, randText, deductionEvidenceFromCodes, DEDUCTION_CHECKLIST, FOREIGN_EXCHANGE_RATES, FOREIGN_SUBSISTENCE_RATES, monthsInTaxYearFrom, writeOffMonthsInTaxYear, SARS_TRAVEL, SUBSISTENCE_RATES, TRAVEL_ACTUAL_COST_CAP, MEDICAL_S6B, katHtml, DED_ACTIVATION_NOTE} from './01-data.js';
import { flagField, noteHtml, setNote, plausibilityHtml, plausibilityNotes, refreshOptionNotes, captureNav, lblWithInfo, navigateToCapture, $, APP, confirmContradiction, BUCKET_DEFS, DED_GROUPS, applyDeduction, calcAgeAtYearEnd, calcFullTax, calcMedicalCredits, medicalCreditComposition, stackBarHtml, capMeterHtml, calcTaxOnIncome, closeModal, debounceSave, esc, fmt, getActiveTaxYear, getBucketStatus, getSelectedIncomeTypes, gs, gv, iconClassFor, isMedicalSchemeMemberDom, mainAccToggle, navigateTo, provBtn, provTip, showConfirm, showToast, sv, switchTab, taxableIt3bItems, updateCalc, updatePendingIndicators, hasEmploymentIncome, isMainlyCommission, isSelfEmployed } from './02-core.js';
import { renderAll, renderTaxReturn } from './07-render-summary.js';
import { getIncomeOutstanding } from './03-income.js';
import { onMedDepsAck, PROFILE_DED_Q} from './13-patches.js';
import { collectForeignIncome } from './05-list-modules.js';
import { entFeatureForScreen, entUnlocked } from './14-entitlement.js';

/* ============================================================
   InspiredTax v8.5 — DEDUCTIONS MODE
   Checklist + all calculator modules
   ============================================================ */
/* The two deductions whose prior-year balance is consumed by the current
   year's allowance (both already summed into the engine's own totals) —
   module scope so both the checklist's per-row active state and the
   aggregate dedActiveCount() below apply the identical rule. */
const DED_CARRY_FIELD = { retirement:'py_ret_excess', donations:'py_s18a_excess' };
/* ── DEDUCTIONS CHECKLIST ── */
/* Dynamic recommendation engine — drives the "Recommended" / "Consider" pill.
   Returns 'strong' (evidence in the return, or an answer the user actually
   gave), 'consider' (the income type makes it plausible but nothing confirms
   it), or null (no pill).

   2026-09 (Atlas F1/F2/F3): every `selected` branch here tested pre-taxonomy
   income values — self_employment, freelancer, sole_prop, commission_fee,
   salary_permanent, rental, interest, crypto and the rest — which the Batch G
   migration to the nine INCOME_TYPE_DEFS values retired. getSelectedIncomeTypes()
   returns the new values, so none of those branches could match: measured over
   all nine types × all nine deductions, every one of the 81 combinations
   returned null. Only the IRP5-code branches were live, which left home office,
   tools and subscriptions — the three a self-employed user is most likely to
   miss — unreachable by any signal.

   The values below come from INCOME_TYPE_DEFS.

   This also absorbs the income-type rules from evaluateDeductionRules(), which
   tested the current values correctly but was never called (F3). That function
   is gone: two functions answering one question is what let the stale one win.
   Its 'high'-confidence branches read APP.facts, a screening layer that was
   never built and is only ever persisted and restored, so they could not fire
   either — they are not carried over. Its universal "any income ⇒ retirement"
   rule is deliberately not carried over either: a pill everyone sees carries no
   information, which is the B2-DED-B2-4 lesson recorded on `donations` below. */
export function deductionRecommendationFor(id) {
  /* QR4.5 (Q-CPY-6, QD-18): returns { level, reason } — the pill AND the reason
     shown under it — or null. Evidence from IRP5 codes comes from ONE table
     (INCOME_DEDUCTION_LINKS, 01-data.js); what remains in the switch below is the
     income-type and setup-answer triggers, each with the plain-language reason
     the user sees (07-COPY-DECK C-20). */
  const rec = (level, reason) => ({ level, reason });
  const selected = (typeof getSelectedIncomeTypes === 'function') ? getSelectedIncomeTypes() : [];
  const items = APP.incomeItems || [];
  const codes = items.map(i => i.code);
  const has = (arr, ...vals) => vals.some(v => arr.includes(v));
  /* Trade-like income: your own business, plus the receipts that migrated into
     other_income and can still run a trade. */
  const TRADE = ['business_income', 'other_income'];
  /* Anyone earning from work, on their own account or an employer's. */
  const EARNED = ['employment_income', ...TRADE];

  const byProfile = () => { switch(id) {
    case 'retirement':
      /* Employer fringe-benefit contributions (3817/3825/3828) are proof a fund
         exists — INCOME_DEDUCTION_LINKS, not this switch. */
      if(has(selected, ...EARNED, 'rental_income')) return rec('consider', 'you have income that retirement savings can reduce');
      return null;
    case 'medical':
      /* V8.9 B3.3: 65+ get 33⅓% AMTC with no 7.5% floor — always worth claiming */
      if(gs('p_has_medical_aid') === 'yes') return rec('strong', 'you told us you have a medical aid');
      if(typeof calcAgeAtYearEnd === 'function' && calcAgeAtYearEnd() >= 65) return rec('strong', 'you are 65 or older, when medical costs are always worth claiming');
      return null;
    case 'travel':
      /* s8(1)(b) is a deduction against a TRAVEL allowance. 3701 is that
         allowance; 3704 is a subsistence allowance and was previously in this
         'strong' set, which recommended a claim the taxpayer may have no basis
         for. It moves to 'consider' here (an overnight work trip makes business
         travel plausible) and becomes a 'strong' trigger on `subsistence`,
         which is the deduction it actually evidences. */
      /* 3701 (strong), 3702/3722 (consider) and the 3802/3816 company-car note are
         INCOME_DEDUCTION_LINKS rows. 3704 is no longer a travel trigger at all (QR4.5;
         BACKLOG item 12) — it evidences subsistence, below. */
      if(has(selected, ...TRADE)) return rec('consider', 'you have business income, so business travel may be claimable');
      return null;
    case 'homeoffice':
      /* The setup question is an explicit confirmation, so it outranks the
         income type — same standing as an IRP5 code elsewhere in this switch. */
      if(APP.workFromHomeYN === 'yes') return rec('strong', 'you told us you work from home');
      if(has(selected, ...TRADE)) return rec('consider', 'you have business income, and a home office may be part of it');
      return null;
    case 'tools':
      if(has(selected, ...TRADE)) return rec('consider', 'you have business income, and tools and equipment may be part of it');
      return null;
    case 'subsistence':
      /* Atlas F2: this had no case at all and fell through to `default`, so the
         pill could never appear. 3704 (local) and 3715 (foreign) ARE the
         s8(1)(c) subsistence allowance. 3714 is the portion the employer already
         treated as non-taxable within the deemed daily rate — it evidences that
         an allowance was paid without establishing a further claim. */
      /* 3704/3715 (strong) and 3714 (consider) are INCOME_DEDUCTION_LINKS rows. */
      return null;
    case 'donations':
      /* QA 2026-08 (B2-DED-B2-4): this returned 'consider' for ANY user with any
         income at all, which is why the pill read as arbitrary — it carried no
         information. Real triggers only, in the same shape as every other case:
         evidence in the return, or an answer the user actually gave.
           strong  — an s18A deduction is already in play: donations captured
                     this year, or an unused s18A excess carried forward from
                     last year (s18A(1)(B) 10% cap rollover).
           consider— the user said in setup that they donate, but nothing is
                     captured yet.
         Otherwise no pill.
         2026-09: a `codes` test for 4011 used to lead this list. 4011 is the
         donations DEDUCTION code; `codes` comes from APP.incomeItems, which
         only ever carries income codes, so it could not match. Captured
         donations are what the app actually has, and they are tested below. */
      if((APP.donationItems || []).length > 0 || gv('py_s18a_excess') > 0) return rec('strong', 'you have donations captured, or an unused donation excess carried forward');
      if(APP.hasDonations === 'yes') return rec('consider', 'you told us you donate');
      return null;
    case 'subscrip':
      if(has(selected, ...EARNED)) return rec('consider', 'you earn income from work, and professional fees may be part of it');
      return null;
    case 'additional':
      /* "Other Deduction Codes" is the manual catch-all for claims with no page
         of their own. Nothing in the return can evidence it, so it has no
         trigger by design. Stated explicitly rather than left to fall through,
         so the absence reads as a decision and not as the missing case that
         `subsistence` turned out to be. */
      return null;
    default:
      /* Reached only if DEDUCTION_CHECKLIST gains an id with no rule here.
         The ids it carries today are all handled above; the arms that used to
         sit here for `interest`, `cgt` and `rental` were removed — those
         stopped being deductions in V8.5 Session 5 (interest → B2, rental →
         B3, CGT → B5) and no checklist row could ever request them. */
      return null;
  } };
  const typed = byProfile();
  const linked = deductionEvidenceFromCodes(id, codes);
  const rank = { strong: 2, consider: 1 };
  /* Evidence beats an assumption: a code on the return wins a tie, and outranks a
     weaker profile-based level. */
  if (linked && (!typed || rank[linked.level] >= rank[typed.level])) return { level: linked.level, reason: linked.reason, codes: linked.codes };
  return typed;
}

/* The pill level alone — 'strong' | 'consider' | null. Kept as the stable name every
   older caller (and tests/Atlas probes) uses. */
export function recommendDeductionFor(id) {
  const r = deductionRecommendationFor(id);
  return r ? r.level : null;
}

/* B0 Simplification — shared selector-list renderer (01-SPEC.md P9, §2).
   Renders toggle-row groups for both Income and Deductions selector pages.
   cfg.groups: [{ label, sublabel, items, renderRow }]
   renderRow(item) → HTML string for one row.
   Groups with no items are silently omitted. */
/* QA 2026-08 (B2-INC-B2-5, B2-INC-B2-9): a group can now be COLLAPSIBLE, with
   its heading persisting as a summary card while collapsed.

   The owner asked for three sections on Income — "Still to add" (never
   collapsible, no heading card), "Completed, well done!" and "Off" (both
   collapsible, both showing information while collapsed). That shape lives
   here rather than at either call site because Income and Deductions share
   this renderer, and a second hand-rolled copy is exactly the duplication
   this function exists to prevent.

   Collapsing is opt-in per group (`collapsible`), so a caller that has not
   asked for it renders byte-identically to before. Income and Deductions both
   opt in for Completed and Off (STD-BEHAV-4), each page with its own `name`
   so only one of its two sections is open at a time.

   Group contract, additions marked *:
     { label, sublabel, items, renderRow,
       collapsible*,  -- render as <details> with a summary card
       open*,         -- initial state; the caller owns where that is stored
       name*,         -- groups sharing a name are mutually exclusive (STD-BEHAV-4)
       stateKey*,     -- APP property the open/closed state writes back to
       metaHtml* }    -- summary content shown while collapsed (and expanded)

   `<details>` is deliberate over a class-toggle + handler: it is what every
   other disclosure in the app uses (.mini-card, .stmt-row, .info-acc), it is
   keyboard- and screen-reader-correct with no ARIA of our own, and it needs
   no entry in the window bridge. */
export function renderSelectorList(cfg) {
  var html = '';
  (cfg.groups || []).forEach(function(g, i) {
    if (!g.items || !g.items.length) return;
    /* B7.6 (INC-12/D-25): sublabel inline on one line with the heading,
       joined by the same middle-dot separator every other group/sublabel
       pairing in the app uses — was a comma. Shared here so Income,
       Deductions and Tax balances (once B9.5 migrates onto this renderer)
       all read the same. */
    var headText = g.label + (g.sublabel ? ' · <span>' + g.sublabel + '</span>' : '');
    /* B7.6 (DED-1): an optional mascot beside the heading. Deductions'
       "Still to add" passes it; Income's does not — D-24 already put Kat on
       the Income hero permanently, so a second one here would be a caller
       this flag has no business serving. Do not add a condition for it. */
    var mascotHtml = g.mascot ? katHtml('pointing', 44) : '';
    /* B7 (§9.2): stagger-in. The class self-limits to the first 8 rows in
       CSS, so a long list never cascades down the page. */
    var tiles = '<div class="ded-tiles stagger-in">' + g.items.map(g.renderRow).join('') + '</div>';

    if (!g.collapsible) {
      html += '<div class="ded-split-hd-row' + (i > 0 ? ' ded-split-hd-mt' : '') + '">'
        + '<div class="ded-split-hd' + (g.headClass ? ' ' + g.headClass : '') + '">' + headText + '</div>'
        + mascotHtml + '</div>' + tiles;
      return;
    }

    /* APP is on window (the income hero's own ontoggle already relies on it),
       so the state write-back needs no handler function and no bridge entry. */
    var onToggle = g.stateKey ? ' ontoggle="APP.' + g.stateKey + '=this.open"' : '';
    /* STD-BEHAV-4: same-named <details> behave as a radio group, so opening one
       closes the other - native HTML, no handler. The ontoggle above fires on the
       one that closed too, so the stored state stays true for both. */
    var nameAttr = g.name ? ' name="' + g.name + '"' : '';
    html += '<details class="sel-sec' + (i > 0 ? ' sel-sec-mt' : '') + '"'
      + (g.open ? ' open' : '') + nameAttr + onToggle + '>'
      + '<summary class="sel-sec-sum">'
      + '<div class="sel-sec-txt">'
      + '<div class="ded-split-hd sel-sec-hd">' + headText + '</div>'
      + (g.metaHtml || '')
      + '</div>'
      + '<i class="material-symbols-outlined msi-expand-more sel-sec-chev" aria-hidden="true"></i>'
      + '</summary>'
      + tiles
      + '</details>';
  });
  return html;
}

/* B0 (01-SPEC.md §1.2 P9): the selector ROW, shared by both selectors.
   renderSelectorList above owns the group headings; without this the two
   call sites still hand-rolled the same .ded-tile markup twice, which is
   the duplication P9 exists to remove — B2 and B3 would each have had to
   add the third group to their own copy, and the two would drift.

   The component owns STRUCTURE; callers own CONTENT:
     { icon, iconColour, labelHtml, amountHtml, notesHtml,
       active,     -- drives .ded-on and the trailing chevron
       click,      -- onclick body; omitted for an inert row
       tabindex,   -- deduction rows use -1 when off, income rows always 0
       toggle: { checked, onchange } -- onchange omitted => readonly status }
   Output is DOM-identical to what both call sites emitted before. */
export function selectorRow(r) {
  var t = r.toggle || {};
  /* STD-COL-4 (§L.6, OD-2): "Completed" (.ded-on) used to render every
     category in the shared --au green. r.iconColour (e.g. 'ico-bg-blue')
     can't go on the outer tile directly — that class also carries the full
     icon-chip visual system ([class*="ico-bg-"][class] in main.css), which
     would restyle the whole row as a 35x35 chip. row-accent-* (main.css)
     sets only --row-c, the variable .ded-on's CSS now reads. */
  var rowAccentCls = (r.iconColour || 'ico-bg-blue').replace('ico-bg-', 'row-accent-');
  /* QA 2026-09 round 2: owner reverted ICON-22's split again — every row's
     icon keeps its tile (background/border/lip, one colour per page) no
     matter its state; status ("Still to add") now lives ONLY on the row's
     own outline (amber lip via .ded-tile-outstanding below), never on the
     icon. The naked-glyph icon variant this replaced is kept as dead CSS
     (.ded-tile-ico-naked) in case a future row still wants it, but no
     caller opts into it any more. */
  /* E15 (calc-audit-2026-09 S4): the Income and Deductions selector rows used
     to prefer a purpose-drawn two-tone SVG (ICONS, via iconName) and fall back
     to the icon font. The brief asks these rows for MONOCHROME OUTLINE icons,
     so the two-tone layer is gone and the Material Symbols glyph — which E14
     set the names for — is now what renders. No caller passes iconName any
     more, so the preference branch and the INCOME_ICON_NAME / DED_ICON_NAME
     maps that fed it were removed rather than left dangling. */
  var iconInner = '<i class="' + iconClassFor(r.icon) + '"></i>';
  var iconHtmlOut = '<div class="ded-tile-ico ' + (r.iconColour || 'ico-bg-blue') + '">' + iconInner + '</div>';
  /* B7.5/INC-10 (D-24): the row's ⓘ moves out of the label text to the
     row's own bottom-right corner — shared here so Income and Deductions
     (and Tax balances, once B9.5 migrates it onto this same renderer) can
     never drift apart on where it sits. */
  var tipHtml = r.tip ? '<span class="info-btn ded-tile-tip" data-tip="' + esc(r.tip) + '"><i class="material-symbols-outlined msi-info"></i></span>' : '';
  return '<div class="ded-tile' + (r.active ? ' ded-on' : '') + (r.outstanding ? ' ded-tile-outstanding' : '') + ' ' + rowAccentCls + '"'
    + (r.click ? ' onclick="' + r.click + '"' : '')
    + ' role="button" tabindex="' + (r.tabindex == null ? 0 : r.tabindex) + '">'
    + iconHtmlOut
    + '<div class="ded-tile-body">'
    + '<div class="ded-tile-lbl">' + r.labelHtml + '</div>'
    + (r.amountHtml || '')
    + (r.notesHtml || '')
    + '</div>'
    + '<div class="ded-tile-right">'
    /* Phase 1 (G3): `t.locked` renders a switch that is on and cannot be
       turned off, for a row whose state is dictated by another answer. It
       still reads as a switch to a screen reader (aria-disabled + a label
       naming the reason) rather than silently ignoring the tap.

       A11Y-3 (design-system-audit-2026-09 §L.6, owner decision 6.6): the
       reason used to ride on `title=`, which NEVER renders on an Android
       WebView — the codebase already learned this once and migrated its tips
       to data-tip. A bare label[data-tip] is not in TIP_TRIGGER_SEL, so a
       straight swap would have shown nothing either. The reason is therefore
       carried two ways that actually work: visibly, in the caller's
       notesHtml, and to assistive tech via aria-label here. */
    /* QA 2026-09: a smaller toggle on outstanding rows — the row's job here
       is "tap to go add this", not "flip a setting", so the full-size switch
       overstated it. */
    + '<label class="toggle-switch' + (r.outstanding ? ' toggle-switch--sm' : '') + (t.locked ? ' toggle-locked' : '') + '" onclick="event.stopPropagation()">'
    + '<input type="checkbox"' + (t.checked ? ' checked' : '')
    + (t.ariaLabel ? ' aria-label="' + esc(t.ariaLabel) + '"' : '')
    + (t.locked ? ' disabled aria-disabled="true"' : (t.onchange ? ' onchange="' + t.onchange + '"' : ' readonly')) + '>'
    + '<span class="toggle-track"></span><span class="toggle-thumb"></span>'
    + '</label>'
    + (r.active ? '<i class="material-symbols-outlined msi-chevron-right ded-tile-chev"></i>' : '')
    + '</div>'
    + tipHtml
    + '</div>';
}

export function renderDeductionsChecklist() {
  var el = document.getElementById('deductions-checklist'); if(!el) return;
  var av = APP.appliedValues || {};
  var cr = calcFullTax();
  var calcAmts = {
    retirement: cr.retAllowed || 0,
    medical:    (cr.med && cr.med.total) || 0,
    travel:     cr.travelDed || 0,
    homeoffice: cr.homeOfficeDed || 0,
    tools:      cr.toolsDed || 0,
    donations:  cr.donAllowed || 0,
    subscrip:   cr.subscripDed || 0,
    subsistence: cr.subsistenceDed || 0,
    additional: cr.additionalDed || 0,
  };
  var tabMap ={retirement:'retirement',medical:'medical',travel:'travel',homeoffice:'homeoffice',tools:'tools',donations:'donations',subscrip:'subscrip',subsistence:'subsistence',additional:'additional'};
  var autoToggled = APP.onboardingAutoToggled || {};
  var obTravelYes = APP.travelAllowanceYN === 'yes';
  var isSelfEmp = isSelfEmployed();   // BACKLOG 93 R-6: one test (02-core); the old list held pre-taxonomy values only

  function buildDedTileNotes(d, checked) {
    var notes = '';
    var reasonText = ({medical:'qualifying medical expenses',retirement:'retirement fund contributions',donations:'qualifying donations',homeoffice:'that you work from home',travel:'a travel allowance'})[d.id] || 'your onboarding answers';
    /* F2 (Phase 6): the four things the feedback asked for on a prepopulated
       selection — what was assumed, why it is on, what it means, and how to
       change it. B6 had removed this note on the grounds that "the toggle
       state speaks for itself"; it says WHETHER, but not why, and the owner
       specifically asked for the why. Phrased as the user's own answer being
       played back ("you told us"), never as something the app decided. */
    /* QA 2026-08 (B2-DED-B2-3): the "On because you told us ..." activation note
       was removed at the owner's request. It had been added on an earlier owner
       ask for the why; this reverses that. DED_ACTIVATION_NOTE is retained in
       01-data because it is the copy source if the note is ever reinstated. */
    /* F3: the user turned this off against their own setup answer. Say so,
       confirm the setup answer moved with it, and offer the way back. */
    if(!checked && APP.dedUserOverride && APP.dedUserOverride[d.id] && actNote) {
      notes += '<div class="note warn" style="margin:4px 0 0;font-size:0.6875rem;padding:5px 9px">'
        + '<i class="material-symbols-outlined msi-warning u-mr-5"></i>'
        + 'You turned this off, and your setup answer was updated to match. '
        + '<button type="button" class="btn-link" onclick="event.stopPropagation();openProfileModal()">Open Profile</button>'
        + '</div>';
    }
    if(APP.autoReason&&APP.autoReason[d.id]&&checked&&!(autoToggled[d.id])) {
      /* B6: "Auto-enabled because…" said the app had done something to the
         user. "From your setup answers" says where it came from, which is
         what they need in order to change it. */
      notes += '<div class="note info" style="margin:4px 0 0;font-size:0.6875rem;padding:5px 9px"><i class="material-symbols-outlined msi-info u-mr-5"></i>From your setup answers: ' + APP.autoReason[d.id] + '.</div>';
    }
    if(d.id==='travel'&&obTravelYes&&!checked) {
      notes += '<div class="note info" style="margin:4px 0 0;font-size:0.6875rem;padding:5px 9px"><i class="material-symbols-outlined msi-lightbulb u-mr-5"></i>From your setup answers: you get a travel allowance. Worth turning on.</div>';
    }
    if(d.id==='medical'&&APP.hasMedical==='yes'&&!checked) {
      notes += '<div class="note info" style="margin:4px 0 0;font-size:0.6875rem;padding:5px 9px"><i class="material-symbols-outlined msi-lightbulb u-mr-5"></i>From your setup answers: you have a medical aid or medical costs. Worth turning on.</div>';
    }
    if(isSelfEmp&&!checked) {
      var selfNotes = {travel:'As a freelancer/contractor, if you receive a travel allowance or use your vehicle for business, enabling the travel deduction (s8(1)(b)) is worth considering.',homeoffice:'Self-employed taxpayers who work from a dedicated home office may claim a portion of occupancy costs (s23(b)/s23(m)).',tools:'Tools, equipment, and computers used in your trade are typically deductible over their wear-and-tear period (s11(e)) — consider enabling this.',subscrip:'Professional memberships and indemnity insurance related to your trade may be deductible.'};
      if(selfNotes[d.id]) notes += '<div class="note teal" style="margin:4px 0 0;font-size:0.6875rem;padding:5px 9px"><i class="material-symbols-outlined msi-lightbulb u-mr-5"></i>' + selfNotes[d.id] + '</div>';
    }
    return notes ? '<div class="ded-tile-notes">' + notes + '</div>' : '';
  }

  var DED_SHORT = {retirement:'Retirement', medical:'Medical', travel:'Travel', homeoffice:'Home Office', tools:'Tools & Equipment', donations:'Donations', subscrip:'Subscriptions', subsistence:'Subsistence'};

  var html = '';
  // v8.27 Focus: Active / Available split (replaces category-accordion groups).
  // Compact + progressive — active deductions surface their applied amount and a
  // tap-to-edit chevron; available ones are muted toggles. Matches the Focus mockup.
  function buildDedRow(d) {
    /* QA 2026-08 (B2-GEN-12): a deduction can be live this year purely from a
       carried opening balance — non-deducted retirement contributions
       (py_ret_excess) and donations above the 10% cap (py_s18a_excess) both
       flow into the current year's allowance. The engine already includes
       them, so the card's AMOUNT was right while its toggle read "off": the
       row said nothing was claimed while tax was being reduced. Derive the
       active state instead of writing to dedChecks — writing would recreate
       the one-way latch that broke Profile persistence (B2-BUG-1). */
    var carriedField = DED_CARRY_FIELD[d.id];
    var carriedApplies = !!carriedField && gv(carriedField) > 0 && (calcAmts[d.id] || 0) > 0;
    /* S2 Batch 13 (A2, verified — confirmed live, not just the audit's
       word): "Other claims" (id 'additional') is gated by
       dedChecks.additional, but that flag was only ever auto-set at
       HYDRATE time (02-core.js, loading persisted data) — adding the
       FIRST "Other" claim through the modal mid-session
       (M_deductionCode.save(), 05-list-modules.js) never sets it, so the
       row stayed in "Still to add"/"Off" even with a real captured amount
       until the next app reload. Derived live from the array instead,
       same reasoning as carriedApplies above: derive, don't write to
       dedChecks (writing recreates the one-way-latch bug, B2-BUG-1). */
    var otherClaimsApplies = d.id === 'additional' && (APP.deductionItems || []).some(function(i){ return (i.amount || 0) > 0; });
    var checked = !!APP.dedChecks[d.id] || carriedApplies || otherClaimsApplies;
    var val = calcAmts[d.id] || 0;
    var showAmt = checked && val > 0;
    var recFull = deductionRecommendationFor(d.id);
    var rec = recFull ? recFull.level : null;
    /* QR4.5 (Q-CPY-6, QD-18): the pill says WHAT; this says WHY, in the user's own
       terms, and — where the evidence is a captured IRP5 code — links to where that
       code lives (CAPTURE_ROUTES 'employment_income'). */
    var whyHtml = recFull && recFull.reason
      ? '<div class="ded-why">' + esc(recFull.reason.charAt(0).toUpperCase() + recFull.reason.slice(1)) + '.'
        + (recFull.codes ? ' <button type="button" class="btn-link" onclick="event.stopPropagation();navigateToCapture(\'employment_income\')">See income</button>' : '')
        + '</div>'
      : '';
    var recBadge = rec==='strong' ? '<span class="pill recommended" style="font-size:0.625rem">Recommended</span>'
                 : rec==='consider' ? '<span class="pill teal" style="font-size:0.625rem">Consider</span>' : '';
    /* B3 (§6.2): plain-language row label from `short`, with the row's own
       press-and-hold ⓘ (item 38). The code chip stays — decision-log B1
       keeps it because it is how the user finds the figure on the document. */
    var shortLbl = d.short || DED_SHORT[d.id] || d.label;
    var codeBadge = d.code!=='\u2014' ? '<span class="code-chip" style="margin-left:5px">' + d.code + '</span>' : '';
    return selectorRow({
      icon: d.icon,
      /* ICON-23 (§L.7 step 4a; OD-2) — same three-state scheme as the income
         selector. Seven of the nine deduction rows carried another area's
         colour: Retirement wore PAYE blue ON A DEDUCTIONS PAGE, Medical and
         Subsistence the Dashboard's cyan, Travel and Home office Income's
         green, Donations Tax Balances' amber. Only Tools and Professional
         memberships were already Deductions violet. */
      /* QA 2026-09 round 2 / D-19: the icon tile is Deductions' violet in
         every state — a single constant class, not a checked/unchecked
         conditional; "Still to add" status lives only on the row's amber
         outline (`outstanding` below), never the icon. The area-accent
         override (main.css) supplies the actual hue regardless of which
         ico-bg-* class is named here, so a conditional would have been
         dead code from the start. */
      iconColour: 'ico-bg-purple',
      outstanding: dedTodo[d.id],
      labelHtml: esc(shortLbl) + ' ' + recBadge + codeBadge,
      tip: d.tip,
      amountHtml: showAmt ? '<div class="ded-tile-amt">' + fmt(val) + ' applied</div>' : '',
      notesHtml: buildDedTileNotes(d, checked) + whyHtml,
      active: checked,
      tabindex: checked ? 0 : -1,
      /* Only an enabled deduction has a calculator to open. */
      click: checked ? 'if(event.target.closest(\'.toggle-switch\')||event.target.closest(\'.info-btn\'))return;navigateTo(\'deductions\',\'' + (tabMap[d.id]||d.id) + '\')' : null,
      toggle: { checked: checked, onchange: 'toggleDedCheck(\'' + d.id + '\')' }
    });
  }
  /* B3 (§6.2): the same three groups the Income selector uses. "Still to
     add" is getDeductionsOutstanding()'s own list — enabled but with nothing
     captured — so this page and the Dashboard can never disagree about what
     is outstanding. */
  var dedTodo = {};
  try { getDeductionsOutstanding().forEach(function(o){ dedTodo[o.nav[1]] = true; }); } catch(e) {}
  var todoItems  = DEDUCTION_CHECKLIST.filter(function(d){ return dedTodo[d.id]; });
  var activeItems = DEDUCTION_CHECKLIST.filter(function(d){ return !!APP.dedChecks[d.id] && !dedTodo[d.id]; });
  var availItems  = DEDUCTION_CHECKLIST.filter(function(d){ return !APP.dedChecks[d.id] && !dedTodo[d.id]; });
  /* STD-BEHAV-4: Completed and Off collapse, both closed on every first view, one open
     at a time. Open state is session-only (APP._dedSec*Open, never saved), as on Income:
     a return visit starts from the outstanding work. The Completed total is the same
     four engine fields the Dashboard's Deductions card adds, not a sum of row figures. */
  var dedCr = {}; try { dedCr = calcFullTax(); } catch(e) {}
  var dedTotal = (dedCr.retAllowed || 0) + (dedCr.otherDed || 0) + (dedCr.donAllowed || 0) + (dedCr.additionalDed || 0);
  var dedDoneMeta = '<div class="sel-sec-meta">'
    + '<span class="sel-sec-total" data-val="' + dedTotal + '">' + fmt(dedTotal) + '</span>'
    + '<span class="sel-sec-count">' + itemCount(activeItems.length) + '</span></div>';
  var dedOffMeta = '<div class="sel-sec-meta"><span class="sel-sec-count">' + itemCount(availItems.length) + '</span></div>';
  html += renderSelectorList({
    groups: [
      { label: 'Still to add', sublabel: 'you told us these apply to you', items: todoItems, renderRow: buildDedRow,
        headClass: 'ded-split-hd-amber', mascot: true },
      { label: 'Completed, well done!', sublabel: null, items: activeItems, renderRow: buildDedRow,
        collapsible: true, name: 'ded-sel-group', stateKey: '_dedSecDoneOpen', metaHtml: dedDoneMeta,
        open: APP._dedSecDoneOpen === true },
      { label: 'Off', sublabel: null, items: availItems, renderRow: buildDedRow,
        collapsible: true, name: 'ded-sel-group', stateKey: '_dedSecOffOpen', metaHtml: dedOffMeta,
        open: APP._dedSecOffOpen === true }
    ]
  });
  el.innerHTML = html;

  // Show/hide dynamic tabs
  updateDeductionTabs();
  // Update drawer to show only ticked deduction items
  updateDrawerDeductions();
  if(typeof updateDrawerIncomeCalcs === 'function') updateDrawerIncomeCalcs();
  // V8.4 B3: refresh pending indicators on Apply buttons (in case render was triggered by toggle/state change)
  if(typeof updatePendingIndicators === 'function') updatePendingIndicators();
}

/* Batch D (#12/#14/#15): shared row renderer for the drawer's Income-bucket
   and Deduction lists. Both used to be hide-until-active (display:none on
   anything without data yet) — a chicken-and-egg gap that made Foreign,
   and every other not-yet-started section, undiscoverable until the user
   had already found another way in. Now every row always renders, grouped
   by status instead of hidden. Locking uses entFeatureForScreen/entUnlocked
   directly (both already imported below) rather than calling
   15-entitlement-ui.js's _refreshDrawerLocks() — that module imports FROM
   this one, so the reverse import would cycle (Hard rule 10); duplicating
   this small a lock-glyph check inline is the documented way out. */
function _drawerBadgeHtml(status) {
  if (status === 'complete' || status === 'on') return '<span class="drawer-status-badge complete">Has data</span>';
  if (status === 'amber') return '<span class="drawer-status-badge amber">In progress</span>';
  return '';
}
/* QA 2026-09: noBadge suppresses the status badge entirely — income rows no
   longer show "In progress" (captured/not-captured is already the section
   the row sits in), while deductions keeps it. */
function _drawerRowHtml(mode, tab, screenKey, icon, label, status, noBadge) {
  var key = entFeatureForScreen(screenKey);
  var locked = !!key && !entUnlocked(key);
  return '<div class="drawer-subitem' + (locked ? ' ent-locked' : '') + '" data-screen="' + screenKey + '"'
    + (locked ? ' aria-disabled="true"' : '')
    + ' onclick="navigateTo(\'' + mode + '\',\'' + tab + '\')">'
    + (icon ? '<i class="' + iconClassFor(icon) + '" style="width:20px;font-size:1rem;color:var(--tx3);flex-shrink:0"></i>' : '')
    + '<span style="flex:1">' + esc(label) + '</span>'
    + (noBadge ? '' : _drawerBadgeHtml(status))
    + (locked ? '<i class="material-symbols-outlined msi-lock ent-lock-glyph" aria-hidden="true"></i>' : '')
    + '</div>';
}
/* QA 2026-09: replaces the old Started/Not-started plain-label groups with
   two collapsible <details> — "X captured" open by default, "Other X"
   closed. ontoggle="drawerSubAccToggle(this)" (02-core.js) keeps the two
   mutually exclusive within one drawer section, matching the Income/
   Deductions/Taxation exclusivity toggleDrawerGroup() enforces one level
   up. Inline handler rather than an addEventListener binding because this
   markup is fully replaced on every re-render (no stale-listener risk, and
   nothing to guard against double-binding). */
function _drawerCapturedOtherHtml(kind, capturedLabel, otherLabel, captured, other) {
  return '<details class="drawer-sub-acc" id="grp-' + kind + '-captured" open ontoggle="drawerSubAccToggle(this)">'
    + '<summary>' + esc(capturedLabel) + '<i class="material-symbols-outlined msi-expand-more chevron"></i></summary>'
    + '<div class="drawer-sub-acc-body">' + (captured.length ? captured.join('') : '<div class="drawer-subitem-empty">Nothing captured yet</div>') + '</div>'
    + '</details>'
    + '<details class="drawer-sub-acc" id="grp-' + kind + '-other" ontoggle="drawerSubAccToggle(this)">'
    + '<summary>' + esc(otherLabel) + '<i class="material-symbols-outlined msi-expand-more chevron"></i></summary>'
    + '<div class="drawer-sub-acc-body">' + (other.length ? other.join('') : '<div class="drawer-subitem-empty">None</div>') + '</div>'
    + '</details>';
}

export function updateDrawerDeductions() {
  var host = document.getElementById('grp-deductions-list');
  if(!host) return;
  /* S2 Batch 13 (B11, verified — not just the audit's stated gap): this
     list was missing Subsistence and Professional memberships entirely
     (not just their icons), and passed `icon: null` for every row, so
     NONE of these rows showed an icon. Fixed by reading straight from
     DEDUCTION_CHECKLIST (01-data.js) — the same canonical list and icon
     names the Deductions checklist itself uses — instead of a second,
     independently-maintained (and incomplete) list here. Excludes
     'additional' ("Other claims"), which A2 handles as its own row. */
  var DEDS = DEDUCTION_CHECKLIST.filter(function(d){ return d.id !== 'additional'; })
    .map(function(d){ return { id: d.id, label: d.short || d.label, icon: d.icon }; });
  /* C8 (2026-07-29 follow-up): "Has data" used to fire on APP.dedChecks[id]
     alone — the enabled toggle, not actual captured data — so every
     just-turned-on deduction with nothing entered yet still badged as
     "Has data". Now reuses getDeductionsOutstanding()'s own applied-amount
     check (the same one the deductions selector page's "Still to add"
     group already relies on), so this drawer can never disagree with that
     page about what's actually captured. */
  var dedTodo = {};
  try { getDeductionsOutstanding().forEach(function(o){ dedTodo[o.nav[1]] = true; }); } catch(e) {}
  var captured = [], other = [];
  DEDS.forEach(function(d) {
    var on = !!APP.dedChecks[d.id] && !dedTodo[d.id];
    var row = _drawerRowHtml('deductions', d.id, 'ded-' + d.id, d.icon, d.label, on ? 'on' : 'inactive');
    (on ? captured : other).push(row);
  });
  host.innerHTML = _drawerCapturedOtherHtml('deductions', 'Deductions captured', 'Other deductions', captured, other);
}

/* QA 2026-09: Employment and PAYE are no longer their own static drawer
   lines above this list — they are two more rows in the same
   captured/other grouping, with plain labels (was "Employment
   (IRP5/IT3(a))" / "Tax already paid (PAYE)"). No "In progress" badge for
   any income row (noBadge=true) — which side of the accordion a row sits
   in already says that. */
export function updateDrawerIncomeCalcs() {
  var host = document.getElementById('grp-income-list');
  if(!host) return;
  var screenByBucket = {2:'b2investment',3:'b3rental',4:'b4business',5:'b5cgt',6:'b6foreign',7:'b7retirement',9:'b9other',10:'b10crypto'};
  var outstandingKeys = {};
  try { getIncomeOutstanding().forEach(function(o){ outstandingKeys[o.key] = true; }); } catch(e) {}

  var captured = [], other = [];
  var empKey = entFeatureForScreen('income-b1employment');
  var empLocked = !!empKey && !entUnlocked(empKey);
  var empRow = _drawerRowHtml('income', 'b1employment', 'income-b1employment', 'work', 'Employment', null, true);
  (!empLocked && !outstandingKeys['missing_employment_income'] ? captured : other).push(empRow);
  var payeKey = entFeatureForScreen('income-paye');
  var payeLocked = !!payeKey && !entUnlocked(payeKey);
  var payeRow = _drawerRowHtml('income', 'paye', 'income-paye', 'credit_score', 'PAYE', null, true);
  (!payeLocked && (APP.employerPaye || []).length > 0 ? captured : other).push(payeRow);

  /* QA 2026-09 round 2: "Income captured" listed anything not flatly
     'inactive' — that included 'amber' (selected but nothing entered yet)
     and an entitlement-locked bucket with a status left over from before
     it locked, so a source with nothing captured (or one you can't
     currently open) sat in the "captured" group. Only a genuinely
     'complete', unlocked bucket belongs there now; everything else
     (amber, inactive, locked) is "Other income". */
  BUCKET_DEFS.filter(function(b){ return screenByBucket[b.id]; }).forEach(function(b) {
    var tab = screenByBucket[b.id];
    var status = (typeof getBucketStatus === 'function') ? getBucketStatus(b) : 'inactive';
    var screenKey = 'income-' + tab;
    var entKey = entFeatureForScreen(screenKey);
    var locked = !!entKey && !entUnlocked(entKey);
    var row = _drawerRowHtml('income', tab, screenKey, b.icon, b.label, null, true);
    (status === 'complete' && !locked ? captured : other).push(row);
  });
  host.innerHTML = _drawerCapturedOtherHtml('income', 'Income captured', 'Other income', captured, other);
}

export function toggleDedCheck(id) {
  const wasOff = !APP.dedChecks[id];
  /* FB9 #17: if toggling an auto-enabled deduction OFF, confirm before honouring */
  if(!wasOff) {
    var isAutoOn = (APP.onboardingAutoToggled && APP.onboardingAutoToggled[id])
                || (APP.autoReason && APP.autoReason[id]);
    /* B5 (§3.3, decision A4): the FB9 confirm becomes confirmContradiction —
       plain language, and the write-back that stops the two answers drifting.
       Clearing onboardingAutoToggled is what makes it stick: without it the
       row re-arms as "auto-enabled" and the user is asked again. */
    if(isAutoOn && typeof confirmContradiction === 'function') {
      renderDeductionsChecklist(); /* revert checkbox visual immediately */
      var _def = DEDUCTION_CHECKLIST.filter(function(d){ return d.id === id; })[0];
      var _thing = ({ medical:'medical expenses', retirement:'retirement fund contributions',
                      donations:'donations to charity', homeoffice:'a home office',
                      travel:'a travel allowance' })[id]
                || (_def ? (_def.short || _def.label).toLowerCase() : 'this');
      confirmContradiction({
        thing: _thing,
        onConfirm: function() {
          APP.dedChecks[id] = false;
          APP.appliedValues[id] = 0;
          APP.pendingValues[id] = 0;
          if(APP.autoReason && APP.autoReason[id]) delete APP.autoReason[id];
          /* Write-back: the setup answer no longer claims this applies. */
          if(APP.onboardingAutoToggled && APP.onboardingAutoToggled[id]) delete APP.onboardingAutoToggled[id];
          /* F3 (Phase 6): clearing onboardingAutoToggled stopped the app
             ASKING again, but left the Profile answer still reading "Yes" —
             so Profile and the selector disagreed, which is the drift this
             confirmation exists to prevent. Write the real answer back (both
             the APP flag and the visible select), record that the user
             overrode their own setup answer so the row can explain itself,
             and tell them it happened rather than changing Profile silently
             behind their back. */
          if(!APP.dedUserOverride) APP.dedUserOverride = {};
          APP.dedUserOverride[id] = true;
          var _pq = PROFILE_DED_Q[id];
          if(_pq) {
            APP[_pq.flag] = 'no';
            var _sel = document.getElementById(_pq.sel);
            if(_sel) _sel.value = 'no';
          }
          if(id === 'medical') {
            APP.hasMedical = 'no'; APP.hasMedicalAid = 'no';
            var _pm = document.getElementById('p_q_medical_combined'); if(_pm) _pm.value = 'no';
            var _ph = document.getElementById('p_has_medical_aid');    if(_ph) _ph.value = 'no';
          }
          if(typeof showToast === 'function') {
            showToast('Turned off. Your setup answer was updated to match.', 'check_circle');
          }
          if(id === 'retirement') APP.pyRetExcessHandled = true;
          renderDeductionsChecklist();
          debounceSave();
          if(typeof renderAll === 'function') renderAll();
          if(typeof renderTaxReturn === 'function') renderTaxReturn();
        }
      });
      return; /* defer to confirm callback */
    }
  }
  APP.dedChecks[id] = !APP.dedChecks[id];
  /* F3: switching it back on retires the override note — the answer and the
     selector agree again, so there is nothing left to explain. */
  if(APP.dedChecks[id] && APP.dedUserOverride) delete APP.dedUserOverride[id];
  if(!APP.dedChecks[id]) {
    // V8.4 B3: toggle-off is an explicit user gesture — clear BOTH pending and applied
    APP.appliedValues[id] = 0;
    APP.pendingValues[id] = 0;
    /* V8.9 B3.4/B3.5: honour a manual toggle-off — drop the auto-reason note and don't re-enable */
    if (APP.autoReason && APP.autoReason[id]) delete APP.autoReason[id];
    if (id === 'retirement') APP.pyRetExcessHandled = true;
  }
  renderDeductionsChecklist();
  debounceSave();
  /* V8.6 I2.1: manual toggle ON auto-navigates immediately to the subpage */
  if (wasOff && APP.dedChecks[id] && typeof navigateTo === 'function') {
    const tabMap = {retirement:'retirement',medical:'medical',travel:'travel',homeoffice:'homeoffice',tools:'tools',donations:'donations',subscrip:'subscrip',subsistence:'subsistence'};
    setTimeout(() => navigateTo('deductions', tabMap[id] || id), 100);
  }
  /* V8.6 A1: refresh tax calc / return on toggle (applied changed) */
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderTaxReturn === 'function') renderTaxReturn();
}

/* Drawer items and glance chips can deep-link to a deduction whose tab is
   not enabled in Selections. The tab-section carries inline display:none in
   that state, so navigation used to land on a titled, completely blank
   screen. Instead: offer one-tap activation (reusing the canonical
   toggleDedCheck flow, which enables, persists, re-renders and navigates). */
export const DED_TAB_LABELS = {
  retirement: 'Retirement', medical: 'Medical', travel: 'Travel',
  homeoffice: 'Home Office', tools: 'Tools & Equipment', donations: 'Donations',
  subscrip: 'Subscriptions', subsistence: 'Subsistence Allowance'
};
export function maybeOfferDedActivation(tab) {
  const prompt = $('ded-activation-prompt');
  if (!prompt) return;
  if (DED_TAB_LABELS[tab] && !APP.dedChecks[tab]) {
    prompt.querySelectorAll('.ded-activation-name').forEach(el => { el.textContent = DED_TAB_LABELS[tab]; });
    prompt.dataset.dedKey = tab;
    prompt.style.display = '';
  } else {
    prompt.style.display = 'none';
    delete prompt.dataset.dedKey;
  }
}
export function enableDeductionFromPrompt() {
  const prompt = $('ded-activation-prompt');
  const key = prompt && prompt.dataset.dedKey;
  if (!key || APP.dedChecks[key]) return;
  prompt.style.display = 'none';
  toggleDedCheck(key);
}

export function updateDeductionTabs() {
  // V8.5 Session 5: bucket subpages relocated to Income mode.
  // This function now only handles pure deduction calculators.
  const tabIds = {
    retirement:'ded-retirement', medical:'ded-medical', travel:'ded-travel',
    homeoffice:'ded-homeoffice', tools:'ded-tools',
    donations:'ded-donations',
    subscrip:'ded-subscrip', subsistence:'ded-subsistence',
    additional:'ded-additional'
  };
  // Show/hide pure deduction tab sections based on dedChecks
  Object.entries(tabIds).forEach(([key, tabId]) => {
    const section = $(`tab-${tabId}`);
    if(section) section.style.display = APP.dedChecks[key] ? '' : 'none';
  });

  // Rebuild deductions tab bar (Selections + active dedChecks only)
  const bar = $('tabs-deductions');
  if(!bar) return;
  /* B1 (item 23): the leading "Selections" button is gone — the back bar
     replaces it.
     B3 (§6.3, items 29/30): the trailing "Other 4000" button is gone too,
     now that its replacement exists. The PAGE survives and is reached from
     the "Other claims" selector row, gated by APP.dedChecks.additional like
     every other deduction — it is the only capture path for
     APP.deductionItems, which feeds additionalDed in the engine
     (02-IMPACT.md R2). migrateDedChecksAdditional() turns the gate on for
     users who already have entries, so nothing becomes unreachable. */
  let html = '';
  const tabDefs = [
    {id:'retirement', icon:'savings',          label:'Retirement'},
    {id:'medical',    icon:'stethoscope',          label:'Medical'},
    {id:'travel',     icon:'directions_car',                  label:'Travel'},
    {id:'homeoffice', icon:'home_work',         label:'Home Office'},
    {id:'tools',      icon:'handyman',   label:'Tools & Equipment'},
    {id:'donations',  icon:'volunteer_activism',   label:'Donations'},
    {id:'subscrip',   icon:'crown',             label:'Subscriptions'},
    {id:'subsistence', icon:'restaurant',             label:'Subsistence'},
    /* B3 §6.3: the former standalone "Other 4000" button — now a gated tab
       like every other deduction, reached from its selector row. */
    {id:'additional',  icon:'order_approve',                label:'Other claims'},
  ];
  /* QA 2026-08: deductions pills already followed toggle state (unlike the
     income pills, which followed data presence) — what they lacked was the
     done / still-to-add distinction. Each pill now declares it via data-state,
     the same contract the income pills use, so D-7's lip styling can serve
     both from one rule. "done" means an amount actually reaches the engine
     for that deduction, which is the same test the card uses. */
  const dedCalcForState = (function(){ try { return calcFullTax(); } catch(e) { return {}; } })();
  const dedAmtForState = {
    retirement: dedCalcForState.retAllowed || 0,
    medical:    (dedCalcForState.med && dedCalcForState.med.total) || 0,
    travel:     dedCalcForState.travelDed || 0,
    homeoffice: dedCalcForState.homeOfficeDed || 0,
    tools:      dedCalcForState.toolsDed || 0,
    donations:  dedCalcForState.donAllowed || 0,
    subscrip:   dedCalcForState.subscripDed || 0,
    subsistence: dedCalcForState.subsistenceDed || 0,
    additional: dedCalcForState.additionalDed || 0,
  };
  tabDefs.forEach(t => {
    if(APP.dedChecks[t.id]) {
      const dedState = (dedAmtForState[t.id] || 0) > 0 ? 'done' : 'todo';
      /* Monetization M2: onboarding-active but entitlement-locked tabs stay
         VISIBLE (greyed + lock, per the approved mockups); the tap opens the
         locked-feature modal instead of the calculator. */
      const entKey = entFeatureForScreen('ded-' + t.id);
      if (entKey && !entUnlocked(entKey)) {
        html += `<button class="tab-btn ent-locked" data-tab="ded-${t.id}" data-state="${dedState}" aria-disabled="true" aria-label="${esc(t.label)}" onclick="entOnLockedTap('${entKey}')"><i class="${iconClassFor(t.icon)}"></i><i class="material-symbols-outlined msi-lock ent-lock-glyph" aria-hidden="true"></i><span class="tab-btn-label">${esc(t.label)}</span></button>`;
      } else {
        html += `<button class="tab-btn" data-tab="ded-${t.id}" data-state="${dedState}" aria-label="${esc(t.label)}" onclick="switchTab('deductions','${t.id}')"><i class="${iconClassFor(t.icon)}"></i><span class="tab-btn-label">${esc(t.label)}</span></button>`;
      }
    }
  });
  bar.innerHTML = html;

  // Refresh income tab bar too (which now hosts the bucket tabs)
  if(typeof updateIncomeTabs === 'function') updateIncomeTabs();
}

/* Income bucket "has data" checks — shared by the tab bar (Batch M: active-only
   gating, matching deduction tabs) and the Other Income tile split. */
export function incomeBucketActive(bucket) {
  var av = APP.appliedValues || {};
  switch(bucket) {
    case 'b1employment': return (APP.incomeItems||[]).length > 0;
    case 'paye':         return (APP.employerPaye||[]).length > 0;
    case 'b2investment': return !!(APP.it3bItems && APP.it3bItems.length);
    case 'b3rental':     return !!av.rental;
    case 'b4business':   return !!(APP.businessItems && APP.businessItems.length) || !!av.business;
    case 'b5cgt': {
      // task #21: CGT bucket should also read "active" when the gain
      // originates from a foreign disposal (IT3(b)) or a crypto disposal,
      // not only a direct CGT-asset entry — cgtAggregate() folds all three
      // into the same aggregate (06b-cgt.js), this just mirrors that for
      // the status badge. Presence-only (no tax math) to avoid importing
      // 06b-cgt.js/06-crypto.js here, which would cycle back through
      // 05-list-modules.js (hard rule 10).
      var hasForeignCgtViaIt3b = taxableIt3bItems().some(function(i){ return (i.foreignCapitalGains||0) > 0; });
      var hasCryptoDisposal = (APP.cryptoDisposals||[]).length > 0;
      return !!(APP.cgtAssets && APP.cgtAssets.length) || hasForeignCgtViaIt3b || hasCryptoDisposal;
    }
    case 'b6foreign':
      try {
        var fi = collectForeignIncome();
        return ((fi.foreignInterest||0)+(fi.foreignDividends||0)+(fi.foreignRental||0)
          +(fi.foreignBusiness||0)+(fi.foreignCgt||0)+(fi.foreignService||0)+(fi.catchAll||0)+(fi.foreignPension||0)) > 0;
      } catch(e) { return false; }
    /* Bug fix (found while auditing this function for Batch D's data-driven
       hamburger menu): pensionItems/lumpsumItems/twopotItems are never
       assigned anywhere — the real arrays are pensionAnnuityItems/
       retirementLumpsums/twopotWithdrawals — so this bucket always read as
       inactive regardless of actual retirement records. */
    case 'b7retirement': return !!(APP.pensionAnnuityItems && APP.pensionAnnuityItems.length) || !!(APP.retirementLumpsums && APP.retirementLumpsums.length) || !!(APP.twopotWithdrawals && APP.twopotWithdrawals.length);
    case 'b9other':      return !!(APP.otherReceipts && APP.otherReceipts.length);
    case 'b10crypto':    return !!(APP.cryptoDisposals && APP.cryptoDisposals.length) || !!(APP.cryptoRevenue && APP.cryptoRevenue.length);
    default: return false;
  }
}

/* Income tab bar (Batch M: only active buckets show, matching how deduction
   tabs already gate by APP.dedChecks — the always-visible Accordion 1/2
   buttons on the Income main page remain the entry point for a bucket's
   first record). */
export function updateIncomeTabs() {
  const bar = $('tabs-income');
  if(!bar) return;

  /* OD-18 (2026-09) removed the Batch-2 special case that used to live here:
     the SARS Account page (income/prioryear) was a tab of THIS bar, faking
     membership of Taxation by swapping in tax-related destinations whenever
     it was active. It is now a real tab of the Taxation (summary) panel, so
     this bar never shows it and never needs to disguise itself. */

  /* QA 2026-08 (12b-9): `type` is the income-type value that turns this bucket
     on. A pill appears when the bucket is ON — declared in setup or captured —
     never merely when data happens to exist. */
  const TABS = [
    {tab:'b1employment', icon:'work', label:'Employment',    type:'employment_income'},
    {tab:'paye',         icon:'credit_score',    label:'PAYE',          type:null},
    {tab:'b2investment', icon:'finance_mode',          label:'Investment',    type:'investment_income'},
    {tab:'b3rental',     icon:'home',               label:'Rental',        type:'rental_income'},
    {tab:'b4business',   icon:'storefront',               label:'Business',      type:'business_income'},
    {tab:'b5cgt',        icon:'arrow_split',      label:'Capital Gains', type:'cgt'},
    {tab:'b6foreign',    icon:'public',               label:'Foreign',       type:null},
    {tab:'b7retirement', icon:'beach_access',      label:'Retirement',    type:'retirement_income'},
    {tab:'b9other',      icon:'money',             label:'Other',         type:'other_income'},
    {tab:'b10crypto',    icon:'currency_bitcoin',        label:'Crypto',        type:'crypto_income'}
  ];
  /* QA 2026-08 (12b-9, owner decision): a pill shows when the type is toggled
     ON **or** an amount has been captured — previously it was captured-only, so
     a source the user had just declared had no pill until they entered
     something, which contradicts the on / still-to-add / off model. Each pill
     then declares which of the two it is via data-state, so the pill styling
     (D-7's lip system) can tell "done" from "still to add" without recomputing
     anything. PAYE additionally honours the "employer withheld none"
     confirmation, matching the Income selector row. */
  const selectedTypes = (typeof getSelectedIncomeTypes === 'function') ? getSelectedIncomeTypes() : [];

  /* B1 Simplification (item 23): the leading "Income" button is gone. It only
     ever returned to the page the tab bar was reached from — which the back
     bar now does explicitly, naming its destination. The bar starts at the
     first real bucket. */
  let html = '';
  TABS.forEach(function(t) {
    var captured = incomeBucketActive(t.tab);
    var toggledOn = !!(t.type && selectedTypes.indexOf(t.type) >= 0);
    if (t.tab === 'paye') {
      /* PAYE is not independently chosen: it follows employment income, and is
         suppressed outright once the user confirms none was withheld. */
      toggledOn = !APP.noPayeConfirmed && selectedTypes.indexOf('employment_income') >= 0;
      if (APP.noPayeConfirmed) captured = false;
    } else if (t.tab === 'b6foreign') {
      /* B7.1 (INC-1/IEM-3): Foreign has no INCOME_TYPE_DEF (t.type is null
         above), so toggledOn was always false here and this pill only ever
         appeared once something was captured — a user who declared foreign
         income but hadn't captured anything yet had no pill at all, so the
         row incomeSelectorRows() now switches on (see the 2×2 comment
         there) still had nowhere to tap through to. */
      toggledOn = APP.foreignIncomeYN === 'yes';
    }
    if (!captured && !toggledOn) return;
    var state = captured ? 'done' : 'todo';
    /* Monetization M2: active-but-locked income buckets render greyed with a
       lock; tap → locked-feature modal (data stays computed, 00-DESIGN §4.1). */
    var entKey = entFeatureForScreen('income-' + t.tab);
    if (entKey && !entUnlocked(entKey)) {
      html += '<button class="tab-btn ent-locked" data-tab="income-' + t.tab + '" data-state="' + state + '" aria-disabled="true" aria-label="' + esc(t.label) + '" onclick="entOnLockedTap(\'' + entKey + '\')"><i class="' + iconClassFor(t.icon) + '"></i><i class="material-symbols-outlined msi-lock ent-lock-glyph" aria-hidden="true"></i><span class="tab-btn-label">' + esc(t.label) + '</span></button>';
    } else {
      html += '<button class="tab-btn" data-tab="income-' + t.tab + '" data-state="' + state + '" aria-label="' + esc(t.label) + '" onclick="switchTab(\'income\',\'' + t.tab + '\')"><i class="' + iconClassFor(t.icon) + '"></i><span class="tab-btn-label">' + esc(t.label) + '</span></button>';
    }
  });
  /* C6 (2026-07-29 follow-up): the trailing "+ Add" button removed — the
     selector on the Income main page ("Still to add") is the discoverability
     path now; a duplicate action in the tab bar was owner-flagged as
     unwanted clutter. */

  bar.innerHTML = html;

  // Set 'active' class on whichever tab matches the currently visible section
  const activeSection = document.querySelector('#mode-income .tab-section.active');
  if(activeSection) {
    const activeId = activeSection.id.replace('tab-income-','income-');
    bar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeId));
  }
}

/* ── RETIREMENT ── */
/* QR9b.6 (QD-27, pattern P3): which of the three contribution rows show.
   The rows are the existing inputs (RETIREMENT_FUNDS, 01-data.js); this only
   decides their visibility and draws the "Which fund did you pay into?"
   choices for the rest. It NEVER writes an amount.

   A row shows when ANY of these holds:
     1. its input holds an amount — however it got there (typed, restored on
        unlock, imported, set by a test). This is the load-bearing rule: an
        amount the engine deducts can never sit in a row the user cannot see;
     2. the user chose its fund from the choices, or has typed in it, in this
        session (APP._retFundsOpen — transient, never saved);
     3. it has focus — so backspacing a figure to nothing while editing it
        does not pull the field out from under the cursor.
   Only Remove takes a row away again. The choices are redrawn only when the
   set of hidden funds changes, so typing does not rebuild them. */
function retFundsOpen() { return APP._retFundsOpen || (APP._retFundsOpen = {}); }
export function retSyncFundRows() {
  const host = $('ret-fund-chooser'); if (!host) return;
  const open = retFundsOpen();
  const hidden = [];
  RETIREMENT_FUNDS.forEach(f => {
    const row = $('ret-fund-row-' + f.key), inp = $(f.field);
    if (!row || !inp) return;
    if (document.activeElement === inp) open[f.key] = true;
    const show = gv(f.field) > 0 || !!open[f.key];
    row.style.display = show ? '' : 'none';
    if (!show) hidden.push(f);
  });
  const sig = hidden.map(f => f.key).join(',');
  if (host.getAttribute('data-sig') === sig) return;
  host.setAttribute('data-sig', sig);
  const first = hidden.length === RETIREMENT_FUNDS.length;
  host.innerHTML = !hidden.length ? '' :
    '<div class="form-label" id="ret-fund-chooser-lbl">' + (first ? 'Which fund did you pay into?' : 'Paid into another fund?') + '</div>'
    + '<div class="yn-group col1" role="group" aria-labelledby="ret-fund-chooser-lbl">'
    + hidden.map(f => '<button type="button" class="yn-tile kind-tile" data-fund="' + f.key + '" onclick="retRevealFund(\'' + f.key + '\')">'
        + '<span class="yn-lbl">' + esc(f.title) + '<span class="kind-desc">Code ' + esc(f.code) + ' on your IRP5 or fund certificate</span></span>'
        + '<i class="material-symbols-outlined msi-add ret-fund-add" aria-hidden="true"></i></button>').join('')
    + '</div>';
}
/* A fund was chosen: show its row and put the cursor in its amount. */
export function retRevealFund(key) {
  const f = RETIREMENT_FUNDS.find(x => x.key === key); if (!f) return;
  retFundsOpen()[key] = true;
  retSyncFundRows();
  const inp = $(f.field);
  if (inp) { try { inp.focus(); } catch (e) {} }
}
/* Remove a fund's row: blank its amount through the same calls typing makes
   (renderRetirementCap → updateCalc → the blur commit, applyDeduction), then
   hand focus to that fund's choice so a keyboard user keeps their place. An
   amount is only ever removed after a confirmation. */
export function retRemoveFund(key) {
  const f = RETIREMENT_FUNDS.find(x => x.key === key); const inp = f && $(f.field);
  if (!inp) return;
  const drop = () => {
    inp.value = '';
    retFundsOpen()[key] = false;
    renderRetirementCap();
    updateCalc();
    applyDeduction('retirement');
    const card = document.querySelector('#ret-fund-chooser [data-fund="' + key + '"]');
    if (card) { try { card.focus(); } catch (e) {} }
  };
  if (gv(f.field) > 0) {
    showConfirm('Remove contribution', 'Remove the ' + f.title.toLowerCase() + ' amount of ' + fmt(gv(f.field)) + '?', drop, { tier: 'del', okLabel: 'Remove' });
    return;
  }
  drop();
}
export function renderRetirementCap() {
  retSyncFundRows();
  const el = $('ret-cap-display'); if(!el) return;
  // V8.4 VI.1a + VI.4 FIX: Use canonical retirement computation from calcFullTax
  // (excludes lump sums from base; prior excess subject to cap).
  const r = calcFullTax();
  const pyEx = r.pyRetExcess;
  const pension = gv('ded_pension'), provident = gv('ded_provident'), ra = gv('ded_ra');
  const total = pension + provident + ra;
  const combined = total + pyEx;
  const cap = r.retMax;
  const allowed = r.retAllowed;
  const excess = r.retExcess;
  const exDisp = $('ret-excess-display'); if(exDisp) exDisp.textContent = fmt(pyEx);
  APP.pendingValues.retirement = Math.round(allowed);
  /* T-C2: keep the Retirement Income page's mirror of this same field in
     sync immediately (not just on the next renderRetirementGlance() pass) —
     same pattern as renderCarriedBalances()'s mirrorIn() on the SARS
     Account page. Never overwrite while the user is typing in it. */
  (function(){
    const m = $('py_ret_excess_ret');
    if (m && document.activeElement !== m) m.value = String(pyEx || '');
  })();

  // V8.6 J6+J7+J8: Warning flags — replace "Implausible" with "Warning"; add zero-income + carry-forward
  // The statutory 27.5% s11F percentage cap applies to the s11F BASE (greater of
  // remuneration or taxable income, net of lump sums), NOT gross income — measuring
  // the contribution % against gross understated it and fired this warning on the
  // wrong figure. Use the same base the cap itself is computed from (s11F(2)).
  const s11FBase = r.s11FBase || 0;
  const pctBase = s11FBase > 0 ? (total / s11FBase) * 100 : 0;
  let implausibleFlag = '', overPct = false;
  if(total > 0 && s11FBase <= 0) {
    /* V8.6 J7: zero base + contribution = red warning (any contribution is infinite % of the cap base) */
    implausibleFlag = noteHtml('error', `No income to deduct ${fmt(total)} of contributions against.`, `Retirement contributions of ${fmt(total)} are recorded but there is no remuneration or taxable income (excluding lump sums) to base the deduction on. The deduction will be entirely disallowed and carried forward. Verify your income capture.`, { style: 'margin-top:8px', title: 'Contributions with no income' });
  } else if(total > 0 && s11FBase > 0) {
    /* BACKLOG 88: retirement.pct is stored as a percentage (27.5) — the ×100
       made this compare pctBase with 2750, so the warning never fired. */
    const capPct = r.ty.retirement.pct;
    if(pctBase > 35) {
      implausibleFlag = noteHtml('error', `Contributions are ${pctBase.toFixed(1)}% of your income — please check them.`, `Retirement contributions are ${pctBase.toFixed(1)}% of your s11F base (greater of remuneration or taxable income, net of lump sums). Above 35% is highly unusual — verify amounts entered.`, { style: 'margin-top:8px', title: 'Unusually high contributions' });
    } else if(pctBase > capPct) {
      implausibleFlag = noteHtml('warning', `Above the ${capPct}% cap — ${fmt(excess)} carries forward.`, `Contributions are ${pctBase.toFixed(1)}% of your s11F base (greater of remuneration or taxable income) \u2014 above the statutory ${capPct}% s11F percentage cap. ${fmt(excess)} carries forward to next year.`, { style: 'margin-top:8px', title: 'Over the s11F cap' });
      overPct = true;
    }
  }
  /* V8.6 J8: amber audit-risk note when disallowed excess is being carried
     forward to next year — not repeated when the percentage note above
     already names the amount (BACKLOG 88). */
  if (excess > 0 && !overPct) {
    implausibleFlag += noteHtml('warning', `${fmt(excess)} over the cap carries forward to next year.`, `${fmt(excess)} of contributions are disallowed (over cap) and will be carried forward to the next tax year. Ensure the carry-forward is tracked correctly across years.`, { style: 'margin-top:6px', title: 'Carried forward' });
  }

  /* S2 Batch 12 (B9): expandable per the brief's \u00a74 rule (collapsed =
     label + amount; expanded = full calculation chain) \u2014 was a flat,
     always-open block. No chart: a single subtraction chain with a
     possible negative intermediate (cap \u2212 combined can go negative before
     flooring at 0 for "allowed"), same rule the Taxable income card
     follows. Chain matches S7 (cap 220,000 \u2212 contributions 250,000 \u2212
     brought-forward 40,000 = \u221270,000, shown as R70,000 carried forward)
     and S8 (rand cap applies) exactly \u2014 both already correct in the
     underlying r.retMax/retAllowed/retExcess fields; this only changes
     the presentation. */
  /* B10: breakdown by fund type, folded into this same card rather than a
     second mount point \u2014 body.html has no dedicated "retirement hero"
     element separate from #ret-cap-display, and both batches describe the
     same underlying summary from different angles (cap math vs.
     composition). */
  const fundBreakdown = (pension > 0 ? '<div class="mini-row"><span>Pension fund</span><span class="v">' + fmt(pension) + '</span></div>' : '')
    + (provident > 0 ? '<div class="mini-row"><span>Provident fund</span><span class="v">' + fmt(provident) + '</span></div>' : '')
    + (ra > 0 ? '<div class="mini-row"><span>Retirement annuity fund</span><span class="v">' + fmt(ra) + '</span></div>' : '');
  const collapsedLbl = excess > 0 ? 'Retirement cap \u2014 ' + fmt(excess) + ' carried forward' : 'Retirement cap';
  const wasOpen = !!APP._retCapOpen;
  const carriedOrUnused = excess > 0 ? excess : Math.max(0, cap - combined);
  const chainHtml = total > 0 ? fundBreakdown
      + '<div class="mini-row" data-role="cap" data-val="' + cap + '" style="font-weight:600;border-top:1px solid var(--bd);padding-top:6px;margin-top:4px"><span>27.5% s11F cap</span><span class="v">' + fmt(cap) + '</span></div>'
      + '<div class="mini-row" data-role="current" data-val="' + total + '"><span>Less current-year contributions</span><span class="v">\u2212' + fmt(total) + '</span></div>'
      + (pyEx > 0 ? '<div class="mini-row" data-role="broughtforward" data-val="' + pyEx + '"><span>Less balance brought forward</span><span class="v">\u2212' + fmt(pyEx) + '</span></div>' : '')
      + '<div class="mini-row" data-role="carried" data-val="' + carriedOrUnused + '" style="font-weight:600"><span>' + (excess > 0 ? 'Balance carried forward' : 'Unused cap') + '</span><span class="v"' + (excess > 0 ? ' style="color:var(--er)"' : '') + '>' + fmt(carriedOrUnused) + '</span></div>'
      + '<div class="mini-row" data-role="allowed" data-val="' + allowed + '" style="font-weight:600;border-top:1px solid var(--bd);padding-top:6px;margin-top:4px"><span>Allowed this year</span><span class="v">' + fmt(allowed) + '</span></div>'
    : '<div class="mini-row"><span>No retirement contributions captured</span></div>';
  el.innerHTML = total > 0
    ? '<details class="mini-card" id="ret-cap-acc"' + (wasOpen ? ' open' : '') + ' ontoggle="APP._retCapOpen=this.open">'
      + '<summary><div class="mini-sum-main"><div class="mini-name">' + esc(collapsedLbl) + '</div><div class="mini-val">' + fmt(allowed) + '</div>'
      + capMeterHtml({ used: allowed, cap: cap, over: excess, label: 'Retirement deduction cap used',
          remainLabel: 'of the cap still unused', overLabel: 'over the cap \u2014 carried forward to next year' })
      + '</div><i class="material-symbols-outlined msi-expand-more mini-chev"></i></summary>'
      + '<div class="mini-body">' + chainHtml + implausibleFlag + '</div></details>'
    : '';
}

/* ── MEDICAL ── */
/* "How your credit is worked out": collapsed by default; expanded it shows
   the s6A/s6B split, then the s6B chain with a bar of how much of the
   qualifying expenses the 7.5% threshold absorbs — the usual reason the
   extra credit is R 0. Every figure is a medicalCreditComposition() field;
   the only arithmetic here is the bar's below-threshold share (q − above). */
function medicalBreakdownHtml(med, ty, deps, isMain) {
  if (med.total <= 0 && med.qualifying <= 0 && med.contributions <= 0) return '';
  const row = (lbl, val, cls) => '<div class="mini-row' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><span class="v">' + val + '</span></div>';
  const pctTxt = v => (Math.round(v * 1000) / 10) + '%';
  const s6bPart = 'color-mix(in srgb, var(--violet) 45%, var(--sf3))';
  let html = '';
  if (med.s6a > 0 && med.s6b > 0) {
    html += stackBarHtml(med.total, [
      { label: 'Set monthly credit', val: med.s6a, color: 'var(--violet)' },
      { label: 'Extra credit', val: med.s6b, color: s6bPart },
    ]);
  }
  if (isMain) {
    const people = 1 + deps;
    html += '<div class="med-bd-head">Set monthly credit</div>'
      + row(people + (people === 1 ? ' person' : ' people') + ' on the scheme, 12 months', fmt(med.s6a))
      + '<p class="med-bd-note">' + fmt(ty.medical.main) + ' a month for you' + (deps >= 1 ? ', ' + fmt(ty.medical.firstDep) + ' for your first dependant' : '')
      + (deps > 1 ? ', ' + fmt(ty.medical.addDep) + ' for each other dependant' : '') + '.</p>';
  }
  if (med.contributions > 0 || med.oop > 0) {
    const rateTxt = med.senior ? pctTxt(1 / MEDICAL_S6B.seniorRateDivisor) : pctTxt(MEDICAL_S6B.rate);
    html += '<div class="med-bd-head">Extra credit</div>'
      + (med.contributions > 0
          ? row('Scheme contributions (you and employer)', fmt(med.contributions))
            + row('Less ' + med.multiple + ' × your set monthly credit', '−' + fmt(med.contribLimit))
            + row('Contributions above that limit', fmt(med.excessContrib), 'is-sub')
          : '')
      + row((med.contributions > 0 ? 'Plus ' : '') + 'out-of-pocket expenses', (med.contributions > 0 ? '+' : '') + fmt(med.oop))
      + row('Qualifying expenses', fmt(med.qualifying), 'is-sub');
    if (!med.senior) {
      html += row('Less ' + pctTxt(MEDICAL_S6B.thresholdPct) + ' of taxable income', '−' + fmt(med.threshold))
        + row('Amount above the threshold', fmt(med.aboveThreshold), 'is-sub');
      if (med.qualifying > 0) {
        html += stackBarHtml(med.qualifying, [
          { label: 'Absorbed by the threshold', val: med.qualifying - med.aboveThreshold, color: 'var(--neutral)' },
          { label: 'Above the threshold', val: med.aboveThreshold, color: 'var(--violet)' },
        ]);
      }
    }
    html += row('× ' + rateTxt + ' = extra credit', fmt(med.s6b), 'is-total')
      + (med.senior ? '<p class="med-bd-note">At 65 or older, or with a disability, there is no taxable-income threshold.</p>' : '');
  }
  const wasOpen = !!APP._medBreakdownOpen;
  return '<details class="mini-card med-bd" id="med-breakdown-acc"' + (wasOpen ? ' open' : '') + ' ontoggle="APP._medBreakdownOpen=this.open">'
    + '<summary><div><div class="mini-name">How your credit is worked out</div><div class="mini-val">' + fmt(med.total) + '</div></div>'
    + '<i class="material-symbols-outlined msi-expand-more mini-chev" aria-hidden="true"></i></summary>'
    + '<div class="mini-body">' + html + '</div></details>';
}

export function renderMedicalCreditsDisplay() {
  const el = $('medical-credits-display'); if(!el) return;
  const ty = getActiveTaxYear(); const age = calcAgeAtYearEnd();
  const r = calcFullTax();
  const annualSelf = gv('med_monthly');     // V8.4 V.7: field now holds ANNUAL self-paid total
  const annualEmp  = gv('med_employer');    // V8.4 V.7: field now holds ANNUAL employer-paid total
  const deps = gv('med_deps');
  const oop = gv('med_oop');
  const isMain = isMedicalSchemeMemberDom();
  const med = medicalCreditComposition(age, ty, isMain, deps, annualSelf, annualEmp, oop, gv('med_disability')===1, r.taxableIncome);
  APP.pendingValues.medical = med.total;
  /* B-2 (UX #1/#5): provenance popovers on the medical credit cards. */
  const _s6aTip = '<strong>The set monthly credit</strong><br>A fixed amount off your tax for every month, for you and each person on your medical aid (you + ' + deps + '), across 12 months.<br><strong>Credit: ' + fmt(med.s6a) + '</strong>';
  const _s6bTip = '<strong>Section 6B — Additional medical credit</strong><br>A percentage (25%, or 33.3% if 65+ or disabled) of out-of-pocket expenses (' + fmt(oop) + ') plus any scheme contributions above a multiple of the s6A credit, to the extent they exceed 7.5% of taxable income.<br><strong>Credit: ' + fmt(med.s6b) + '</strong>';
  const _totTip = provTip('Your medical credit', [['Set monthly credit', med.s6a], ['Extra credit', med.s6b]], 'Total credit', med.total);
  const _lblStyle = 'display:flex;align-items:center;justify-content:center;gap:5px';
  el.innerHTML = `<div class="calc-result-box u-cursor-pointer" style="margin-top:0" onclick="var _ib=this.querySelector('.info-btn');if(_ib)showInfoTip(_ib)">
      <div class="calc-result-big">${fmt(med.total)}</div>
      <div class="calc-result-sub">Your medical credit for the year${provBtn(_totTip)}</div>
    </div>
    <div class="stat-row" style="margin-top:12px">
    <div class="stat-card u-cursor-pointer" onclick="var _ib=this.querySelector('.info-btn');if(_ib)showInfoTip(_ib)"><div class="stat-value">${fmt(med.s6a)}</div><div class="stat-label" style="${_lblStyle}">Set monthly credit${provBtn(_s6aTip)}</div></div>
    <div class="stat-card u-cursor-pointer" onclick="var _ib=this.querySelector('.info-btn');if(_ib)showInfoTip(_ib)"><div class="stat-value">${fmt(med.s6b)}</div><div class="stat-label" style="${_lblStyle}">Extra credit${provBtn(_s6bTip)}</div></div>
  </div>` + medicalBreakdownHtml(med, ty, deps, isMain);

  // V8.6 K3.1 + K3.2 + K3.3: Dependent thresholds — 7-9 amber, 10+ red with acknowledgment
  const depsWarn = $('med-deps-warning');
  if(depsWarn) {
    if(deps >= 10) {
      depsWarn.innerHTML = '<div class="note error" style="margin:0"><i class="material-symbols-outlined msi-warning u-mr-5"></i>' + deps + ' dependants is unusually high — please check.<div style="margin-top:6px"><label style="display:flex;gap:6px;align-items:center;font-size:0.75rem;font-weight:normal"><input type="checkbox" id="med_deps_ack" onchange="onMedDepsAck()"> I understand and confirm the count is correct</label></div></div>';
    } else if(deps >= 7) {
      depsWarn.innerHTML = noteHtml('warning', deps + ' dependants is above the usual range.', 'Dependent count of ' + deps + ' is above the typical range. This may increase your audit / verification risk. Ensure you have documentation supporting each dependent\u2019s medical aid membership.', { style: 'margin:0', title: 'Many dependants' });
    } else {
      depsWarn.innerHTML = '';
    }
  }

  // V8.4 V.1: OOP edge case flags (vs taxable income)
  const oopWarn = $('med-oop-warning');
  if(oopWarn) {
    const ti = Math.max(0, r.taxableIncome || 0);
    const oopPct = ti > 0 ? (oop / ti * 100) : 0;
    if(oopPct > 25) oopWarn.innerHTML = noteHtml('error', 'Own costs are ' + oopPct.toFixed(1) + '% of taxable income — keep every receipt.', 'Out-of-pocket medical costs are ' + oopPct.toFixed(1) + '% of taxable income \u2014 audit / verification risk (>25%). Ensure receipts and ITR-DD (if disability) are on hand.', { style: 'margin:0', title: 'High out-of-pocket costs' });
    else if(oopPct > 15) oopWarn.innerHTML = noteHtml('warning', 'Own costs are ' + oopPct.toFixed(1) + '% of taxable income — keep receipts.', null, { style: 'margin:0' });
    else oopWarn.innerHTML = '';
  }

  // V8.4 V.2: Non-refundable AMTC info note (when taxable income is negative or zero)
  const amtcEl = $('medical-amtc-note');
  if(amtcEl) {
    const ti = r.taxableIncome || 0;
    var parts = [];
    /* V8.75 2b: 65+ taxpayers — different s6B limits (33⅓%, no 7.5% threshold) */
    if(age >= 65) {
      parts.push(noteHtml('info', 'Age 65+: a larger medical credit applies.', 'Your additional medical expenses credit (s6B) is <strong>33\u2153% of all qualifying expenses</strong> (scheme contributions above 3\u00d7 the s6A credit, plus unreimbursed out-of-pocket expenses), with <strong>no 7.5%-of-taxable-income threshold</strong>. Capturing out-of-pocket expenses is worthwhile even without a medical scheme.', { style: 'margin:0 0 6px', title: 'Age 65 or older' }));
    }
    if(ti <= 0 && med.total > 0) {
      parts.push(noteHtml('info', 'Medical credits are not paid out in cash.', 'Your taxable income is zero or negative. Medical tax credits (s6A/s6B) reduce tax liability but are <strong>not refundable in cash</strong>. Excess unused credit is forfeited (it does not carry forward). Only PAYE already withheld is refundable.', { style: 'margin:0', title: 'Credits are not refundable' }));
    }
    amtcEl.innerHTML = parts.join('');
  }
}

export function renderMedicalExplanation() {
  const el = $('medical-explanation'); if(!el) return;
  const ty = getActiveTaxYear();
  el.innerHTML = `<div style="font-size:0.75rem;color:var(--tx2);line-height:1.7">
    <strong class="u-c-teal">Section 6A \u2014 Medical Scheme Fees Tax Credit</strong><br>
    A fixed monthly credit per member/dependant, applied directly against tax payable (not a deduction from income).<br>
    <strong>${ty.label} rates:</strong> Main member R${ty.medical.main}/mo \u00b7 First dependant R${ty.medical.firstDep}/mo \u00b7 Each additional dependant R${ty.medical.addDep}/mo<br>
    Annual credit = sum of monthly credits \u00d7 12<br><br>
    <strong class="u-c-teal">Section 6B \u2014 Additional Medical Expenses Tax Credit</strong><br>
    Additional relief when qualifying medical expenses exceed prescribed thresholds.<br>
    <strong>Under 65, no disability:</strong> 25% \u00d7 Max(0, [Max(0, contributions \u2212 4 \u00d7 s6A) + OOP] \u2212 7.5% \u00d7 taxable income)<br>
    <strong>Age 65+ or disability (taxpayer / spouse / child):</strong> 33.3% \u00d7 [Max(0, contributions \u2212 3 \u00d7 s6A) + OOP] (no 7.5% threshold)<br><br>
    <strong>Disability scope (SARS):</strong> applies only to the <strong>taxpayer, spouse, or child</strong> (own or spouse's). Extended family members do not qualify for the full s6B treatment.<br><br>
    <strong>Qualifying:</strong> contributions to a registered medical scheme (self + employer) + unreimbursed out-of-pocket expenses paid to registered practitioners, hospitals, nursing services, or pharmacist for prescribed medicines.
  </div>`;
}

/* The "Self-paying?" question was removed (2026-06): medical-scheme membership is
   now derived from the "My contributions" / "Employer paid" fields, so the scheme
   name and contribution blocks are always visible and there is nothing to toggle.
   Retained as a harmless refresh hook for any residual callers. */
export function onMedSelfPremiumToggle() {
  updateCalc();
  renderMedicalCreditsDisplay();
}

/* V8.4 V.7(c): Toggle for dependants */
/* ── B5 Simplification: home office answer, sourced not re-asked (A2, §7.4) ──
   The page no longer carries the ">50% of duties" question. This writes the
   stored onboarding/Profile answer into the hidden #ho_over50 select — which
   remains the engine input, unchanged — and states it in plain language with
   a way to change it.

   The engine sees exactly what it saw before; only who supplies the value,
   and when, has changed. */
export function syncHomeOfficeAnswer() {
  const sel = $('ho_over50');
  const line = $('ho-over50-stated');
  if (!sel) return;

  /* The stored answer. workFromHomeYN is set by onboarding and mirrored by
     the Profile question; it always resolves to 'yes' or 'no' once
     onboarding has run. */
  const answered = APP.onboardingCompleted === true;
  const stored = (APP.workFromHomeYN === 'yes') ? 'yes' : 'no';

  if (answered) {
    /* Never clobber a value the user set directly on this page in an older
       build, or one a test/fixture set — only fill when it disagrees with
       nothing. sv() is safe here because the select always has a value. */
    if (sel.value !== stored) { sel.value = stored; }
  }

  if (!line) return;
  if (!answered) {
    /* No stored answer yet: the question is asked once, at the moment the
       user applies the deduction (applyHomeoffice), not as another field. */
    line.innerHTML = '<div class="note info"><i class="material-symbols-outlined msi-info u-mr-5"></i>'
      + "We'll ask about this desk when you apply.</div>";
    return;
  }
  const yes = sel.value === 'yes';
  line.innerHTML = '<div class="note ' + (yes ? 'good' : 'warning') + '">'
    + '<i class="' + iconClassFor(yes ? 'check' : 'info') + ' u-mr-5"></i>'
    + 'You told us you ' + (yes ? 'work from home most of the time' : 'do not work from home most of the time')
    + '. <button class="btn-link" onclick="openProfileModal()">Change</button></div>';
}

/* ── B5 Simplification: one dependants field (§8 census line 6, P10) ──
   The "Dependants? yes/no" + "Number of dependants" pair collapses to a
   single count. Per the owner's decision the question INCLUDES the user:
   "How many people are on your medical aid, including you?" — so an answer
   of 2 means the taxpayer plus 1 dependant.

   The ENGINE INPUT IS UNCHANGED. calcFullTax reads gv('med_deps'), which is
   still dependants EXCLUDING the main member, and #med_deps is still that
   field — now hidden and derived. That is what keeps the golden values
   identical: nothing about how the s6A credit is computed moved, only which
   box the user types in.

   members (visible) -> med_deps = max(0, members - 1) (hidden, engine). */
export function onMedMembersChange() {
  const members = Math.max(0, Math.floor(gv('med_members') || 0));
  const deps = Math.max(0, members - 1);
  const depEl = $('med_deps');
  if (depEl) depEl.value = String(deps);
  const hasEl = $('med_has_deps');
  if (hasEl) hasEl.value = deps > 0 ? 'yes' : 'no';
  renderMedMembersEcho(members, deps);
  updateCalc();
  renderMedicalCreditsDisplay();
  debounceSave();
}

/* Reads the derived count back to the user in words, so the "including you"
   rule is visible rather than something they have to trust. */
export function renderMedMembersEcho(members, deps) {
  const el = $('med-members-echo'); if (!el) return;
  if (!members) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="note good" style="margin-top:6px">'
    + "That's you" + (deps > 0 ? ' plus ' + deps + ' dependant' + (deps === 1 ? '' : 's') : ' only')
    + '.</div>';
}

/* Fills the visible field from the stored engine value on load — the inverse
   derivation, so a return captured before B5 opens showing the right total. */
export function syncMedMembersFromDeps() {
  const depEl = $('med_deps'); const memEl = $('med_members');
  if (!depEl || !memEl) return;
  /* Never overwrite while the user is typing in it. */
  if (document.activeElement === memEl) return;
  const deps = Math.max(0, Math.floor(gv('med_deps') || 0));
  memEl.value = String(deps + 1);
  const hasEl = $('med_has_deps');
  if (hasEl) hasEl.value = deps > 0 ? 'yes' : 'no';
  renderMedMembersEcho(deps + 1, deps);
}

/* ── TRAVEL CALCULATOR ── */
export function setTravelMethod(method) {
  APP.travelMethod = method;
  var isActual = method === 'actual';
  var el = $('travel-actual-inputs'); if(el) el.style.display = isActual ? 'block' : 'none';
  var d = $('travel-method-deemed'); if(d) d.classList.toggle('active', !isActual);
  var a = $('travel-method-actual'); if(a) a.classList.toggle('active', isActual);
  /* v8.14 T3a suggestion: grey-out acq-type in Fixed-Cost mode (irrelevant — table is value-based) */
  var acqSel = document.getElementById('tv_acq_type');
  if (acqSel) {
    acqSel.disabled = !isActual;
    acqSel.style.opacity = isActual ? '' : '0.45';
    acqSel.style.cursor = isActual ? '' : 'not-allowed';
  }
  updateTravelAcqNote();
  calcTravel();
}

/* Batch H2 (#54/#56): shared by setTravelMethod() and applyTravelAcqType()
   (13-patches.js, which already imports from this module \u2014 kept here
   rather than duplicated to avoid an import cycle, Hard rule 10) so both
   entry points (method toggle, acquisition-type toggle) stay in sync.
   #56/#57: a leased vehicle does not get wear-and-tear at all under the
   app's current s11(e) treatment (calcTravel() always zeroes it for
   acqType==='lease') \u2014 the note used to imply a live "either/or" choice
   existed; it doesn't, so state plainly that only lease payments apply
   and link to the SARS value-bracket table used to cap them.

   engine-remediation A8 (#53/#58, owner-confirmed citation, see
   docs/programmes/engine-remediation/05-A5-A8-RESEARCH-ADDENDUM.md): the
   Fixed Cost deemed-cost calculation itself (calcTravel()'s `deemed`
   branch, 04-deductions.js) has never actually branched on acqType \u2014 it
   only reads vehicle value, so it already computes correctly for a
   leased vehicle (its "value" for this purpose is the VAT Act s1 cash
   value). The old copy telling users to "switch to Actual Expenses if
   you are on a lease" was therefore actively steering leased-vehicle
   users to a method that can understate their deduction \u2014 Actual
   Expenses disallows a maintenance-cost claim entirely when a lease's
   maintenance plan already covers it. Corrected below; no calculation
   changed, only guidance copy. */
export function updateTravelAcqNote() {
  var isActual = APP.travelMethod === 'actual';
  var acqType = (typeof gs === 'function') ? gs('tv_acq_type') : 'purchase';
  var noteEl = document.getElementById('tv-acq-note');
  if (noteEl) {
    if (isActual && acqType === 'lease') {
      noteEl.innerHTML = '<i class="material-symbols-outlined msi-info u-mr-5"></i>Wear-and-tear does not apply to a leased vehicle \u2014 only lease payments are deductible here, capped at the annual fixed-cost element for your value bracket. <a href="#" onclick="jumpToTravelValueTable();return false">See the SARS vehicle-value table &rarr;</a>';
    } else if (isActual) {
      noteEl.innerHTML = '<i class="material-symbols-outlined msi-info u-mr-5"></i>Finance charges (interest only) and wear-and-tear both apply to a purchased vehicle.';
    } else if (acqType === 'lease') {
      noteEl.innerHTML = '<i class="material-symbols-outlined msi-info u-mr-5"></i>Fixed Cost Method works the same way for a leased vehicle \u2014 it uses the SARS table for your vehicle value regardless of acquisition type. Actual Expenses may understate your deduction on a lease with a maintenance plan, since no maintenance cost may be claimed if the plan already covers it.';
    } else {
      noteEl.innerHTML = '<i class="material-symbols-outlined msi-info u-mr-5"></i>Fixed Cost Method uses the SARS table for your vehicle value \u2014 acquisition type does not affect the table calculation.';
    }
  }
  /* Sync W&T / Finance-vs-Lease field visibility: W&T only for actual-cost
     + purchase; the charge field shown depends on acquisition type. */
  var wf = document.getElementById('tv-wandt-field');
  if (wf) wf.style.display = (isActual && acqType !== 'lease') ? '' : 'none';
  var ff = document.getElementById('tv-finance-field');
  var lf = document.getElementById('tv-lease-pay-field');
  if (ff) ff.style.display = (acqType !== 'lease') ? '' : 'none';
  if (lf) lf.style.display = (acqType === 'lease') ? '' : 'none';
}

export function jumpToTravelValueTable() {
  var acc = document.getElementById('travel-value-table-acc');
  if (!acc) return;
  acc.open = true;
  acc.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* V8.6 N4 (locked):
   - 7-year straight-line depreciation (N4.2 c lock: per-tax-year constant; default 7)
   - Cost cap R665,000 from 1 March 2020 (N4.1 a lock: per-tax-year constant)
   - Pro-rata in year of acquisition: whole months, acquisition month counts as full month (N4.3 b lock) */
export const WANDT_CONST = {
  '2025': { period: 7, capR: 665000 },
  '2026': { period: 7, capR: 665000 },
  '2027': { period: 7, capR: 665000 }
};
export function calcWearAndTear(price, dateAcq) {
  if(!price) return 0;
  const tyKey = (typeof gs === 'function' ? gs('taxYear') : '2027') || '2027';
  const cfg = WANDT_CONST[tyKey] || WANDT_CONST['2027'];
  /* Cap the cost basis at R665,000 */
  const cappedPrice = Math.min(Number(price) || 0, cfg.capR);
  const annual = cappedPrice / cfg.period;

  /* Whole months of this tax year inside the cfg.period-year write-off
     period (writeOffMonthsInTaxYear, 01-data): the first and the last year
     are apportioned — the last one got the full annual amount before
     BACKLOG 91. task #59: no date entered assumes the vehicle was used the
     whole tax year, so the auto-calc shows before a date is given. */
  return Math.round(annual * writeOffMonthsInTaxYear(dateAcq, cfg.period, tyKey) / 12);
}

/* task #52: reference table of the SARS deemed-cost brackets (fixed cost,
   fuel, maintenance per vehicle value) — sourced from SARS_TRAVEL
   (01-data.js), never hardcoded, so it can't drift from the table the
   calculator itself uses. */
export function renderTravelValueTable() {
  const el = $('travel-value-table'); if(!el) return;
  const tyKey = gs('taxYear') || '2027';
  /* GLOB-2: the reimbursive-rate note was typed into body.html for one year
     ("2026/27: R4.95") and shown for every year. It now reads the active
     year's rate from SARS_REIMBURSIVE_RATE and shows no figure for a year
     the table does not hold. */
  const rateNote = $('travel-reimb-rate-note');
  if (rateNote) {
    const rate = SARS_REIMBURSIVE_RATE[tyKey], label = getActiveTaxYear().label;
    rateNote.innerHTML = rate
      ? 'SARS prescribed reimbursive rate for ' + esc(label) + ': <strong>R' + rate.toFixed(2) + ' per business kilometre</strong>.'
      : 'SARS sets a reimbursive rate per business kilometre for each tax year. We do not hold the rate for ' + esc(label) + ' — check the SARS travel rates for that year.';
  }
  const tbl = SARS_TRAVEL[tyKey] || SARS_TRAVEL['2027'];
  let prevMax = 0;
  el.innerHTML = '<div class="u-overflow-x"><table class="data-table"><thead><tr>'
    + '<th scope="col">Vehicle value</th><th scope="col">Fixed cost (R/yr)</th><th scope="col">Fuel (c/km)</th><th scope="col">Maintenance (c/km)</th>'
    + '</tr></thead><tbody>'
    + tbl.map(row => {
        const band = row.max === Infinity ? 'Above ' + fmt(prevMax) : fmt(prevMax) + ' – ' + fmt(row.max);
        prevMax = row.max;
        return '<tr><td>' + band + '</td><td>' + fmt(row.fixed) + '</td><td>' + row.fuel.toFixed(1) + '</td><td>' + row.maint.toFixed(1) + '</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

export function calcTravel() {
  /* v8.13 B2.4: travelPool = sum of IRP5 codes 3701+3702+3722 (exclude 3703 non-taxable) */
  var _items = APP.incomeItems || [];
  var _tv3701 = _items.filter(function(i){ return i.code === '3701'; }).reduce(function(s,i){ return s+(i.amount||0); }, 0);
  var _tv3702 = _items.filter(function(i){ return i.code === '3702'; }).reduce(function(s,i){ return s+(i.amount||0); }, 0);
  var _tv3722 = _items.filter(function(i){ return i.code === '3722'; }).reduce(function(s,i){ return s+(i.amount||0); }, 0);
  /* v8.15 TX: 3703 is non-taxable reimbursive travel — excluded from the pool, but tracked for gate/warning */
  var _tv3703 = _items.filter(function(i){ return i.code === '3703'; }).reduce(function(s,i){ return s+(i.amount||0); }, 0);
  var travelPool = Math.round(_tv3701 + _tv3702 + _tv3722);

  /* Update read-only pool card (T3a) */
  var _poolCard = document.getElementById('travel-pool-card');
  if (_poolCard) {
    _poolCard.innerHTML = '<strong><i class="material-symbols-outlined msi-receipt-long u-mr-5"></i>Travel income from your IRP5 (read-only):</strong>'
      /* Breakable spaces BETWEEN the code/amount pairs, non-breaking only
         WITHIN one (so 3701 never separates from its figure). Every gap here
         used to be &nbsp;, which made the whole line a single unbreakable
         token: it could not wrap at any width and pushed the page into
         horizontal scroll once Android's font scale was above 100%. */
      + ' 3701&nbsp;<span class="mono">' + fmt(_tv3701) + '</span>'
      + ' &middot; 3702&nbsp;<span class="mono">' + fmt(_tv3702) + '</span>'
      + ' &middot; 3722&nbsp;<span class="mono">' + fmt(_tv3722) + '</span>'
      + ' <strong>Total&nbsp;<span class="mono" style="color:var(--ac)">' + fmt(travelPool) + '</span></strong>'
      + (_tv3703 > 0 ? '<div style="margin-top:5px;font-size:0.71875rem;color:var(--tx3)">3703 (non-taxable, excluded)&nbsp;<span class="mono">' + fmt(_tv3703) + '</span></div>' : '');
  }
  renderTravelValueTable();

  /* T2a / TX1a gate: show/hide calculator body based on travelPool */
  var _gate = document.getElementById('travel-gate');
  var _calcBody = document.getElementById('travel-calc-body');
  if (travelPool === 0) {
    /* TX1a: tailor the gate message when the ONLY travel income is non-taxable 3703 */
    if (_gate) {
      _gate.style.display = '';
      var _gateInner = _gate.querySelector('.note');
      if (_gateInner) {
        if (_tv3703 > 0) {
          setNote(_gateInner, 'info', 'Only a tax-free reimbursement (3703): no travel deduction.', 'You have only non-taxable reimbursive travel (code 3703). <strong>No travel deduction may be claimed</strong> \u2014 the reimbursement already covered your business travel tax-free, so there is nothing left to deduct.', { title: 'Reimbursed travel' });
        } else {
          _gateInner.className = 'note warning';
          _gateInner.innerHTML = '<i class="material-symbols-outlined msi-warning u-mr-6"></i>Add your travel allowance (3701 / 3702 / 3722) under Income first.'
            + '<div style="margin-top:8px"><button class="btn btn-secondary btn-sm" onclick="navigateTo(\'income\',\'main\')"><i class="material-symbols-outlined msi-arrow-forward u-mr-5"></i>Go to Income</button></div>';
        }
      }
    }
    if (_calcBody) _calcBody.style.display = 'none';
    APP.pendingValues.travel = 0;
    APP.travelForfeited = 0;
    renderTravelTips();
    return;
  }
  if (_gate) _gate.style.display = 'none';
  if (_calcBody) _calcBody.style.display = '';

  /* TX2a: misclassification warning — 3703 present alongside taxable travel income (likely mis-coded; should be 3702) */
  var _tx2El = document.getElementById('travel-3703-warning');
  if (!_tx2El && _calcBody) {
    _tx2El = document.createElement('div');
    _tx2El.id = 'travel-3703-warning';
    _calcBody.insertBefore(_tx2El, _calcBody.firstChild);
  }
  if (_tx2El) {
    if (_tv3703 > 0) {
      _tx2El.innerHTML = noteHtml('warning', 'Code 3703 is a tax-free reimbursement — check it isn\u2019t 3702.', 'Code 3703 (non-taxable) applies only when you receive no other travel allowance. Because you also have travel-allowance income, this reimbursement is likely mis-coded \u2014 it should probably be 3702 (taxable). As entered, nothing may be deducted against the 3703 amount.', { style: 'margin:0 0 12px', title: 'Check your 3703 coding' });
    } else {
      _tx2El.innerHTML = '';
    }
  }

  const price    = gv('tv_vehicle_val');
  const odoOpen  = gv('tv_odo_open');
  const odoClose = gv('tv_odo_close');
  const busKm    = gv('tv_bus_km');
  const totalKm  = Math.max(0, odoClose - odoOpen);
  const busPct   = totalKm > 0 ? busKm / totalKm : 0;
  const el       = $('travel-result'); if(!el) return;

  if(!price) {
    // task #50: don't fall back to the lowest SARS table bracket when no
    // vehicle value is entered — that silently understated/misstated the
    // deduction rather than showing nothing until a real value is given.
    el.innerHTML = '<p style="color:var(--tx3);font-size:0.75rem;margin-top:12px">Enter your vehicle value and business kilometres to calculate.</p>';
    APP.pendingValues.travel = 0;
    renderTravelTips(); return;
  }
  if(!busKm) {
    el.innerHTML = '<p style="color:var(--tx3);font-size:0.75rem;margin-top:12px">Enter business kilometres to calculate.</p>';
    renderTravelTips(); return;
  }

  const tyKey = gs('taxYear') || '2027';
  const tbl   = SARS_TRAVEL[tyKey] || SARS_TRAVEL['2027'];
  let computedDeduction = 0, breakdownHtml = '';

  if(APP.travelMethod === 'deemed') {
    const row = tbl.find(r => price <= r.max) || tbl[tbl.length-1];
    /* Fixed cost pro-rated by whole months from the date the car was brought
       into use (monthsInTaxYearFrom, BACKLOG 90 — same rule as W&T); the full
       year when there is no date or it is before the tax year. */
    var _monthsUsed = monthsInTaxYearFrom(gs('tv_date_acq'), gs('taxYear') || '2027');
    var _isPartYear = _monthsUsed < 12;
    const fixedProRata = row.fixed * (_monthsUsed / 12);
    const fixedBiz = fixedProRata * busPct;
    const fuelBiz  = (row.fuel / 100) * busKm;
    const maintBiz = (row.maint / 100) * busKm;
    computedDeduction = fixedBiz + fuelBiz + maintBiz;
    breakdownHtml = `
      ${_isPartYear ? ('<div class="sum-line"><span class="lbl">Fixed cost (' + fmt(row.fixed) + ') \u00d7 ' + _monthsUsed + '/12 months (part-year)</span><span class="val">' + fmt(fixedProRata) + '</span></div>') : ''}
      <div class="sum-line"><span class="lbl">Fixed cost \u00d7 ${(busPct*100).toFixed(1)}% business</span><span class="val">${fmt(fixedBiz)}</span></div>
      <div class="sum-line"><span class="lbl">Fuel (${row.fuel}c/km \u00d7 ${busKm.toLocaleString()} km)</span><span class="val">${fmt(fuelBiz)}</span></div>
      <div class="sum-line"><span class="lbl">Maintenance (${row.maint}c/km \u00d7 ${busKm.toLocaleString()} km)</span><span class="val">${fmt(maintBiz)}</span></div>
      ${totalKm > 0 ? `<div class="sum-line"><span class="lbl">Business km %</span><span class="val" style="${busPct>0.85?'color:var(--er)':busPct>0.70?'color:var(--wa)':'color:var(--tx2)'}">${(busPct*100).toFixed(1)}%${busPct>0.85?' \u26a0':''}</span></div>` : ''}
      <div class="sum-line divider total"><span class="lbl">Computed s8(1)(b) deduction (4015)</span><span class="val">${fmt(computedDeduction)}</span></div>`;
  } else {
    const fuel=gv('tv_fuel'), maint=gv('tv_maint'), insure=gv('tv_insure');
    /* V8.6 N5 (a lock): when acquisition type = lease, W&T is zero */
    const acqType = (typeof gs === 'function' ? gs('tv_acq_type') : 'purchase') || 'purchase';
    /* Batch H2 (#54): tv_finance (Purchase) and tv_lease_pay (Lease) are
       now separate fields with their own labels/tooltips — same
       underlying "finance" cost the rest of this calc already expected,
       just read from whichever field is relevant. No calc-behavior
       change: same cap logic, same total. */
    let finance = (acqType === 'lease') ? gv('tv_lease_pay') : gv('tv_finance');
    /* V8.9 R4: leased-vehicle lease rentals capped at annual fixed-cost element */
    var _leaseCap = 0, _leaseCapped = false;
    if(acqType === 'lease') {
      var _lrow = tbl.find(r => price <= r.max) || tbl[tbl.length-1];
      _leaseCap = _lrow.fixed;
      if(finance > _leaseCap) { finance = _leaseCap; _leaseCapped = true; }
    }
    /* engine-remediation W19: purchase finance charges are capped to the
       portion of the debt within the s8(1)(b) vehicle-cost cap \u2014 scale the
       finance charges down proportionally when the vehicle price exceeds it.
       Uncapped for prices at or below the cap. Applies to purchase only
       (lease finance is already handled by the lease-rental cap above). */
    var _financeCapped = false;
    if(acqType !== 'lease' && price > TRAVEL_ACTUAL_COST_CAP) {
      var _financeCapForValue = finance * (TRAVEL_ACTUAL_COST_CAP / price);
      if(finance > _financeCapForValue) { finance = _financeCapForValue; _financeCapped = true; }
    }
    const wandt = (acqType === 'lease') ? 0 : calcWearAndTear(price, gs('tv_date_acq'));
    sv('tv_wandt', wandt > 0 ? String(Math.round(wandt)) : '');
    const totalCosts = fuel + maint + insure + finance + wandt;
    computedDeduction = totalKm > 0 ? totalCosts * (busKm / totalKm) : 0;
    breakdownHtml = `
      <div class="sum-line"><span class="lbl">Total annual costs</span><span class="val">${fmt(totalCosts)}</span></div>
      ${_leaseCapped ? noteHtml('warning', 'Lease rentals capped at ' + fmt(_leaseCap) + '.', 'Lease rentals are capped at the annual fixed-cost element (' + fmt(_leaseCap) + ') for this value bracket per s8(1)(b).', { style: 'margin:6px 0', title: 'Lease rental cap' }) : ''}
      ${_financeCapped ? noteHtml('warning', 'Finance charges count only on debt up to the cost cap.', 'Finance charges are capped to the portion of the vehicle debt within the ' + fmt(TRAVEL_ACTUAL_COST_CAP) + ' s8(1)(b) cost cap.', { style: 'margin:6px 0', title: 'Finance charge cap' }) : ''}
      ${wandt > 0 ? `<div class="sum-line"><span class="lbl">W&amp;T (${fmt(price)} \u00f7 7yr, capped at R665,000)</span><span class="val">${fmt(wandt)}</span></div>` : ''}
      <div class="sum-line"><span class="lbl">Business portion (${totalKm>0?(busKm/totalKm*100).toFixed(1):0}%)</span><span class="val">${fmt(computedDeduction)}</span></div>
      <div class="sum-line divider total"><span class="lbl">Computed s8(1)(b) deduction (4015)</span><span class="val">${fmt(computedDeduction)}</span></div>`;
  }

  /* T1a: cap deduction at travelPool */
  var deductionAllowed = Math.min(Math.round(computedDeduction), travelPool);
  var isCapped = Math.round(computedDeduction) > travelPool;
  var netTaxableTravel = Math.max(0, travelPool - deductionAllowed);

  APP.pendingValues.travel = deductionAllowed;
  /* v8.14 F1: store forfeited amount (excess computed deduction over the pool) for carry-forward page */
  APP.travelForfeited = isCapped ? Math.max(0, Math.round(computedDeduction) - travelPool) : 0;

  /* Build result HTML — string concatenation for new dynamic lines */
  var _poolLine = '<div class="sum-line"><span class="lbl">Travel income pool (3701+3702+3722)</span><span class="val">' + fmt(travelPool) + '</span></div>';
  var _capLine = isCapped ? ('<div class="note warning" style="margin:6px 0;font-size:0.75rem;padding:8px 10px"><i class="material-symbols-outlined msi-warning u-mr-5"></i>Capped at travel income received: <strong>' + fmt(deductionAllowed) + '</strong></div>') : '';
  var _netLine = '<div class="sum-line"><span class="lbl">Net taxable travel income</span><span class="val" style="color:' + (netTaxableTravel > 0 ? 'var(--wa)' : 'var(--ok)') + '">' + fmt(netTaxableTravel) + '</span></div>';

  el.innerHTML = '<div class="u-mt-12">'
    + _poolLine
    + breakdownHtml
    + _capLine
    + _netLine
    + '</div>'
    + '<div class="calc-result-box"><div class="calc-result-big">' + fmt(deductionAllowed) + '</div>'
    + '<div class="calc-result-sub">Deductible travel amount \u2014 s8(1)(b) / code 4015</div></div>'
    + capMeterHtml({ used: deductionAllowed, cap: travelPool, over: APP.travelForfeited, unit: 'allowance claimed',
        label: 'Travel allowance claimed', remainLabel: 'of the allowance stays taxable',
        overLabel: 'over your travel allowance \u2014 not deductible' })
    + (busPct > 0.85 ? '<div class="note error u-mt-9">\u26a0 Business km '+((busPct*100).toFixed(1))+'% above 85% \u2014 SARS commonly queries claims above this level.</div>' : '');
  renderTravelTips();
}

export function renderTravelTips() {
  const el = $('travel-tips'); if(!el) return;
  const busKm=gv('tv_bus_km'), totalKm=Math.max(1,gv('tv_odo_close')-gv('tv_odo_open')), busPct=busKm/totalKm;
  const tips = [
    {i:'menu_book',t:'Logbook is mandatory',d:'Record every business trip: date, odometer start/end, destination and purpose. SARS disallows without a contemporaneous logbook.'},
    {i:'calendar_month',t:'Method choice is annual',d:'Once you choose Deemed or Actual for a tax year, you cannot switch mid-year.'}
  ];
  if(busPct > 0.70) tips.push({i:'warning',t:`High business % (${(busPct*100).toFixed(0)}%)`,d:'SARS scrutinises claims above 70\u201380%. Claims above 85% are almost certain to be queried.'});
  el.innerHTML = tips.map(t => `<div class="tip-card teal"><i class="${iconClassFor(t.i)}"></i><div><div class="tip-title">${esc(t.t)}</div><div class="tip-desc">${esc(t.d)}</div></div></div>`).join('');
}

/* \u2500\u2500 COMPANY CAR / RIGHT OF USE OF A MOTOR VEHICLE (B-2, Seventh Schedule
   para 7) \u2500\u2500
   Distinct from calcTravel() above by design (coverage-gap-analysis B-2):
   codes 3802 (no maintenance plan) / 3816 (operating lease) are a FRINGE
   BENEFIT already included in gross income at its full annual value, not a
   travel ALLOWANCE under s8(1)(b) \u2014 calcTravel()'s travelPool deliberately
   excludes them. On assessment the benefit is reduced (para 7(4)): where a
   log book is kept, by the ratio business km bears to total km travelled
   (the business-use portion is not taxed); further reduced (para 7(7)/(8))
   by the actual cost of fuel and/or maintenance where the EMPLOYEE (not the
   employer) bore it, and by any consideration paid to the employer for the
   right of use (para 7(1) proviso). Detection is automatic \u2014 presence of a
   3802/3816 income item \u2014 same pattern as calcSubsistence() above. Writes
   its own appliedValues key ('companycar', committed alongside 'travel' by
   applyDeduction() in 02-core.js) so this deduction's trace/citation never
   merges with the travel-allowance figure. */
export function ccToggleCosts() {
  const show = (id, v) => { const e = $(id); if (e) e.classList.toggle('u-hidden', !v); };
  show('cc-fuel-cost-row', gs('cc_fuel_borne') === 'yes');
  show('cc-maint-cost-row', gs('cc_maint_borne') === 'yes');
  calcCompanyCarDeduction();
}

export function calcCompanyCarDeduction() {
  const items = (APP.incomeItems || []).filter(i => i.code === '3802' || i.code === '3816');
  const benefitTotal = Math.round(items.reduce((s,i) => s + (i.amount || 0), 0));
  const card = $('companycar-card');
  if (benefitTotal === 0) {
    if (card) card.style.display = 'none';
    APP.pendingValues.companycar = 0;
    return;
  }
  /* Auto-open the first step the moment this card is first revealed — it
     is never the first .ded-step-head in the tab (Travel's own step 1 owns
     that per resetPageToPrimary(), 02-core.js), so without this a user
     landing here would see nothing but a collapsed "Logbook kilometres"
     heading. Only fires on the hidden→visible transition, so a user who
     deliberately collapses it afterwards is not fought on every re-render. */
  const _wasHidden = card && card.style.display === 'none';
  if (card) card.style.display = '';
  if (_wasHidden) {
    const h = $('cc-vehicle-head'), b = $('cc-vehicle-body');
    if (h && b) { h.classList.add('open'); b.classList.add('open'); }
  }

  const poolCard = $('companycar-pool-card');
  if (poolCard) {
    poolCard.innerHTML = '<strong><i class="material-symbols-outlined msi-directions-car u-mr-5"></i>Right-of-use benefit from your IRP5 (read-only):</strong>'
      + '&nbsp;&nbsp;<span class="mono">' + fmt(benefitTotal) + '</span> (codes 3802/3816)';
  }

  const el = $('companycar-result'); if (!el) return;
  const odoOpen = gv('cc_odo_open'), odoClose = gv('cc_odo_close'), busKm = gv('cc_bus_km');
  const totalKm = Math.max(0, odoClose - odoOpen);

  if (!totalKm || !busKm) {
    el.innerHTML = '<p style="color:var(--tx3);font-size:0.75rem;margin-top:12px">Enter your logbook odometer readings and business kilometres to calculate.</p>';
    APP.pendingValues.companycar = 0;
    return;
  }
  const busRatio = Math.min(1, busKm / totalKm);
  const ratioReduction = benefitTotal * busRatio;

  const fuelBorne = gs('cc_fuel_borne') === 'yes';
  const fuelCost = fuelBorne ? gv('cc_fuel_cost') : 0;
  const maintBorne = gs('cc_maint_borne') === 'yes';
  const maintCost = maintBorne ? gv('cc_maint_cost') : 0;
  const consideration = gv('cc_consideration') || 0;

  const rawReduction = ratioReduction + fuelCost + maintCost + consideration;
  const totalReduction = Math.min(benefitTotal, rawReduction);
  APP.pendingValues.companycar = Math.round(totalReduction);

  el.innerHTML = '<div class="sum-line"><span class="lbl">Business-use ratio reduction (' + (busRatio*100).toFixed(1) + '% \u00d7 ' + fmt(benefitTotal) + ')</span><span class="val">' + fmt(ratioReduction) + '</span></div>'
    + (fuelCost > 0 ? '<div class="sum-line"><span class="lbl">Fuel cost you bore in full</span><span class="val">' + fmt(fuelCost) + '</span></div>' : '')
    + (maintCost > 0 ? '<div class="sum-line"><span class="lbl">Maintenance cost you bore in full</span><span class="val">' + fmt(maintCost) + '</span></div>' : '')
    + (consideration > 0 ? '<div class="sum-line"><span class="lbl">Consideration paid to employer</span><span class="val">' + fmt(consideration) + '</span></div>' : '')
    + '<div class="calc-result-box"><div class="calc-result-big">' + fmt(APP.pendingValues.companycar) + '</div>'
    + '<div class="calc-result-sub">Deductible company-car reduction \u2014 Seventh Schedule para 7</div></div>'
    + (rawReduction > benefitTotal ? '<div class="note info" style="margin-top:6px"><i class="material-symbols-outlined msi-info u-mr-5"></i>Your reductions exceed the benefit value \u2014 capped at ' + fmt(benefitTotal) + '.</div>' : '')
    + (busRatio > 0.85 ? noteHtml('warning', 'Business use of ' + (busRatio*100).toFixed(1) + '% — keep a full logbook.', 'Business use at ' + (busRatio*100).toFixed(1) + '% \u2014 SARS scrutinises claims this high. Make sure your logbook is contemporaneous and complete.', { style: 'margin-top:6px', title: 'High business use' }) : '');
}

/* ── SUBSISTENCE ALLOWANCE CALCULATOR (A3, s8(1)(c)) ──
   Deemed daily expenditure on meals/incidentals (or incidentals only, where
   accommodation is provided separately) claimable against a local
   subsistence allowance, capped at the allowance received — no receipts
   required up to the SARS deemed rate. Rates: SUBSISTENCE_RATES
   (01-data.js). Follows the calcTravel-style gate + result pattern. */
/* PAYE-GEN-01-G03 review (2026-08-28): 3704 and 3714 are NOT two halves of
   one pool. Per the SARS codes guide (PAYE-AE-06-G06) and this guide's own
   §3.1, code 3704 is used ONLY when the employer already determined the
   allowance EXCEEDS the deemed daily rate (so the whole amount is taxable,
   included in gross, cat:'allowance' remunerationBase:true); code 3714 is
   used ONLY when the employer determined it does NOT exceed the deemed
   rate (so it's fully non-taxable and already excluded from gross via
   IRP5_CODE_MAP's cat:'nontaxable', 02-core.js's nonTaxableTotal). Pooling
   both together and granting a deduction against the combined total (the
   pre-2026-08-28 behaviour) subtracted a 3714 amount from adjGross a
   second time — adjGross never included it in the first place, so this
   invented an unwarranted extra deduction for every 3714 certificate. The
   fix: only 3704 can ever generate a deduction; 3714 is disclosed as
   already tax-free and contributes nothing to the pool. */
export function calcSubsistence() {
  const taxablePool = (APP.incomeItems || []).filter(i => i.code === '3704')
    .reduce((s, i) => s + (i.amount || 0), 0);
  const nonTaxablePool = (APP.incomeItems || []).filter(i => i.code === '3714')
    .reduce((s, i) => s + (i.amount || 0), 0);
  const gate = $('subsistence-gate'), calcBody = $('subsistence-calc-body');
  const nonTaxableNote = $('subsistence-nontaxable-note');
  if (taxablePool === 0 && nonTaxablePool === 0) {
    if (gate) gate.style.display = '';
    if (calcBody) calcBody.style.display = 'none';
    if (nonTaxableNote) nonTaxableNote.style.display = 'none';
    APP.pendingValues.subsistence = 0;
    return;
  }
  if (gate) gate.style.display = 'none';

  if (nonTaxableNote) {
    nonTaxableNote.style.display = nonTaxablePool > 0 ? '' : 'none';
    if (nonTaxablePool > 0) {
      nonTaxableNote.innerHTML = '<i class="material-symbols-outlined msi-check-circle u-mr-5"></i>' + fmt(nonTaxablePool) + ' of your subsistence allowance (code 3714) was already within the SARS deemed daily rate — your employer treated it as tax-free, and it needs no further deduction here.';
    }
  }

  if (taxablePool === 0) {
    /* Nothing taxable to deduct against — hide the days/rate calculator
       entirely rather than showing an input form with nowhere for it to go. */
    if (calcBody) calcBody.style.display = 'none';
    APP.pendingValues.subsistence = 0;
    return;
  }
  if (calcBody) calcBody.style.display = '';

  const el = $('subsistence-result'); if (!el) return;
  const ty = gs('taxYear') || '2027';
  const rates = SUBSISTENCE_RATES[ty];
  if (!rates) {
    el.innerHTML = noteHtml('info', 'This year\u2019s SARS subsistence rate is not in the app yet.', 'The SARS deemed subsistence rate for this tax year has not yet been confirmed in-app. No deduction can be calculated until it is added — this does not affect any other part of your return.', { style: 'margin-top:8px', title: 'Subsistence rate pending' });
    APP.pendingValues.subsistence = 0;
    return;
  }
  const days = gv('subsistence-days') || 0;
  const rateType = gs('subsistence-rate-type') || 'mealsIncidentals';
  const dailyRate = rateType === 'incidentalsOnly' ? rates.localIncidentals : rates.localMealsIncidentals;
  const deemed = Math.round(days * dailyRate);
  const deductionAllowed = Math.min(deemed, taxablePool);
  APP.pendingValues.subsistence = deductionAllowed;
  el.innerHTML = '<div class="sum-line"><span class="lbl">Taxable subsistence allowance received (3704)</span><span class="val">' + fmt(taxablePool) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Deemed expenditure (' + days + ' × ' + fmt(dailyRate) + ')</span><span class="val">' + fmt(deemed) + '</span></div>'
    + '<div class="calc-result-box"><div class="calc-result-big">' + fmt(deductionAllowed) + '</div>'
    + '<div class="calc-result-sub">Deductible subsistence amount — s8(1)(c) / code 4017</div></div>'
    + (deemed > taxablePool ? '<div class="note info" style="margin-top:6px"><i class="material-symbols-outlined msi-info u-mr-5"></i>Deemed expenditure exceeds the taxable allowance received — capped at the allowance.</div>' : '');
}

/* ── FOREIGN SUBSISTENCE ALLOWANCE CALCULATOR (PAYE-GEN-01-G03 review,
   2026-08-28, s8(1)(c) "outside the Republic" limb) ──
   A distinct calculator from calcSubsistence() above — same design
   decision as B-2's company-car deduction (its own comment explains why):
   foreign subsistence is a DIFFERENT SARS table (per-country, in that
   country's own currency — FOREIGN_SUBSISTENCE_RATES, 01-data.js) with a
   currency-conversion step calcSubsistence() never needs, so folding it
   into the same function would blur two genuinely different citations.
   Detection is automatic — code 3715 only (the taxable-excess code; 3716
   is retired into 3714 since 2010, already excluded from tax, same fix as
   local's 3714). Deemed expenditure = country's daily amount × days,
   converted to Rand via FOREIGN_EXCHANGE_RATES (C-3) for the four
   currencies it covers, or directly (rate=1) where SARS itself denominates
   the deemed amount in Rand (code:'ZAR' — Eswatini/Lesotho/Namibia); any
   other currency is disclosed as unconfirmed rather than guessed, same
   convention as fxApply() (02-core.js). */
/* Country <select> is populated lazily from FOREIGN_SUBSISTENCE_RATES'
   own keys (single source of truth — no separate hardcoded option list to
   drift out of sync) the first time the card becomes relevant, rather
   than at boot, since most users never touch this page. */
function _populateForeignSubsistenceCountries() {
  const sel = $('fs-sub-country');
  if (!sel || sel.options.length > 1) return;
  const countries = Object.keys(FOREIGN_SUBSISTENCE_RATES).sort((a, b) => a.localeCompare(b));
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

export function calcForeignSubsistence() {
  _populateForeignSubsistenceCountries();
  const taxablePool = (APP.incomeItems || []).filter(i => i.code === '3715')
    .reduce((s, i) => s + (i.amount || 0), 0);
  const card = $('foreign-subsistence-card');
  if (taxablePool === 0) {
    if (card) card.style.display = 'none';
    APP.pendingValues.foreignSubsistence = 0;
    return;
  }
  /* Auto-open the first step on reveal — same reasoning as B-2's Company
     Car card (its comment explains why resetPageToPrimary() alone can't
     do this for a page's second card). */
  const _wasHidden = card && card.style.display === 'none';
  if (card) card.style.display = '';
  if (_wasHidden) {
    const h = $('fs-sub-step-head'), b = $('fs-sub-step-body');
    if (h && b) { h.classList.add('open'); b.classList.add('open'); }
  }

  const poolCard = $('foreign-subsistence-pool-card');
  if (poolCard) {
    poolCard.innerHTML = '<strong><i class="material-symbols-outlined msi-flight u-mr-5"></i>Taxable foreign subsistence allowance from your IRP5 (read-only):</strong>'
      + '&nbsp;&nbsp;<span class="mono">' + fmt(taxablePool) + '</span> (code 3715)';
  }

  const el = $('foreign-subsistence-result'); if (!el) return;
  const country = gs('fs-sub-country');
  const days = gv('fs-sub-days') || 0;

  if (!country || !days) {
    el.innerHTML = '<p style="color:var(--tx3);font-size:0.75rem;margin-top:12px">Select the country and enter nights away to calculate.</p>';
    APP.pendingValues.foreignSubsistence = 0;
    return;
  }
  const rateInfo = FOREIGN_SUBSISTENCE_RATES[country];
  if (!rateInfo) {
    el.innerHTML = '<div class="note warning" style="margin-top:8px"><i class="material-symbols-outlined msi-warning u-mr-6"></i>No SARS deemed rate found for that country.</div>';
    APP.pendingValues.foreignSubsistence = 0;
    return;
  }
  const taxYear = gs('taxYear') || '2027';
  let rateToRand;
  if (rateInfo.code === 'ZAR') {
    rateToRand = 1;
  } else if (rateInfo.code && FOREIGN_EXCHANGE_RATES[taxYear] && FOREIGN_EXCHANGE_RATES[taxYear][rateInfo.code] != null) {
    rateToRand = FOREIGN_EXCHANGE_RATES[taxYear][rateInfo.code];
  } else {
    el.innerHTML = noteHtml('warning', 'The exchange rate for this year is not in the app yet.', 'The SARS deemed daily amount for ' + esc(country) + ' is ' + rateInfo.amount.toLocaleString('en-ZA') + ' ' + esc(rateInfo.currency) + ', but the exchange rate to convert that to Rand for this tax year has not yet been confirmed in-app — no deduction can be calculated until it is added. This does not affect any other part of your return.', { style: 'margin-top:8px', title: 'Exchange rate pending' });
    APP.pendingValues.foreignSubsistence = 0;
    return;
  }
  const dailyRand = Math.round(rateInfo.amount * rateToRand);
  const deemed = Math.round(dailyRand * days);
  const deductionAllowed = Math.min(deemed, taxablePool);
  APP.pendingValues.foreignSubsistence = deductionAllowed;
  el.innerHTML = '<div class="sum-line"><span class="lbl">Taxable foreign subsistence allowance received (3715)</span><span class="val">' + fmt(taxablePool) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Deemed daily amount (' + rateInfo.amount.toLocaleString('en-ZA') + ' ' + esc(rateInfo.currency) + (rateInfo.code === 'ZAR' ? '' : ' × ' + rateToRand.toFixed(4)) + ')</span><span class="val">' + fmt(dailyRand) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Deemed expenditure (' + days + ' × ' + fmt(dailyRand) + ')</span><span class="val">' + fmt(deemed) + '</span></div>'
    + '<div class="calc-result-box"><div class="calc-result-big">' + fmt(deductionAllowed) + '</div>'
    + '<div class="calc-result-sub">Deductible foreign subsistence amount — s8(1)(c)</div></div>'
    + (deemed > taxablePool ? '<div class="note info" style="margin-top:6px"><i class="material-symbols-outlined msi-info u-mr-5"></i>Deemed expenditure exceeds the taxable allowance received — capped at the allowance.</div>' : '');
}

/* ── HOME OFFICE CALCULATOR ── */
export function calcHomeOffice() {
  const total  = gv('ho_area_total'), office = gv('ho_area_office');
  const el     = $('home-office-result'); if(!el) return;
  /* QR4.6 (QD-19): an office larger than the home is not "capped" quietly by the
     Math.min below — say so. Non-blocking; the calculation still runs. */
  const hoWarn = $('ho-area-warning');
  if (hoWarn) hoWarn.innerHTML = plausibilityHtml(plausibilityNotes(['officeAreaOverTotal'], { officeArea: office, totalArea: total }));
  /* v8.22: prefill months with 12 when blank (and not being edited) */
  var _mEl = document.getElementById('ho_months_used');
  if (_mEl && _mEl.value === '' && document.activeElement !== _mEl) _mEl.value = '12';
  /* v8.22 HO: conditional CGT cross-warning icon by the >50% question - N/A when renting */
  var cgtPrimarySelected = ((APP.cgtAssets || []).some(function(a){ return a && a.primaryRes; }) || (gs('cgt-primary-res') === 'yes')) && (gs('ho_ownership') === 'own');
  var warnIco = document.getElementById('ho-cgt-warn-ico');
  if (warnIco) warnIco.style.display = cgtPrimarySelected ? 'inline-flex' : 'none';
  if(!total || !office) {
    el.innerHTML = '<p style="color:var(--tx3);font-size:0.75rem;margin-top:12px">Enter total and office area to calculate.</p>';
    renderHomeOfficeTips(); return;
  }
  const areaRatio = Math.min(1, office / total);
  /* v8.17 HO-A: cost time factor is calendar period (months used / 12), NOT working-days ratio. */
  var monthsUsed = gv('ho_months_used'); if(!monthsUsed || monthsUsed <= 0) monthsUsed = 12; if(monthsUsed > 12) monthsUsed = 12;
  const periodFactor = monthsUsed / 12;
  const combinedRatio = areaRatio * periodFactor;
  /* v8.22 HO (revises v8.17 HO-B): over50='no' → s23(b) does NOT qualify → deduction R0 (confirm gate on Apply). */
  const over50 = (gs('ho_over50') || 'yes') === 'yes';
  /* Phase 8 (F2/E1): dedicated & exclusive use — s23(b) proviso (a) for
     employees, s11(a)/s23(g) "regularly and exclusively" for a trade. This
     was previously only a static disclaimer ("the equipped/regular/
     exclusive-use requirements still apply") with nothing behind it; now a
     real second gate, universal to every profile (unlike >50%-duties,
     s23(b)'s gateApplies test does not scope this one — SARS's exclusive-use
     requirement is not limited to employees). Defaults to 'yes' when unset,
     matching ho_over50's own default, so an account with no saved answer
     computes exactly as it did before this field existed — no golden drift. */
  const exclusive = (gs('ho_exclusive') || 'yes') === 'yes';

  const ownership = gs('ho_ownership');
  /* T-4: ho_rent is now an annual figure like every other premises cost
     (bond interest, rates, electricity, levies are all already annual) —
     it used to be entered as monthly and multiplied by 12 here, the one
     field inconsistent with its neighbours, a real user-error trap (a
     taxpayer entering their actual annual rent into a field asking for
     "monthly rent" would have it overstated 12x). No new tax math — same
     s23(b)/IN28 premises-cost treatment, just a consistent annual input
     convention across all five cost fields. */
  const rent = gv('ho_rent');
  const bondInt = gv('ho_bond_int'), rates = gv('ho_rates');
  const elec = gv('ho_elec'), levies = gv('ho_levies');
  /* v8.22 HO-EMP: IN28/s23(m) employee limits - bond interest AND rates disallowed for employees.
     Employee-only (employment income, no trade) -> excluded + fields greyed.
     Self-employed/trade -> all allowed. Neither -> allowed, Apply requires non-employment confirmation.
     s23(m) carve-out: mainly-commission earners (>50% of remuneration) are NOT
     subject to the employee limits — bond interest stays claimable (s11(a)). */
  /* Employment detected from the income-type selection OR captured IRP5 codes
     (3601 etc.) — entering a salary code must trigger the employee bond-interest
     disallowance even when the selection checkbox was never ticked. */
  const hasEmp = (typeof hasEmploymentIncome === 'function') && hasEmploymentIncome();
  const selfEmp = (typeof isSelfEmployed === 'function') && isSelfEmployed();
  const mainlyComm = (typeof isMainlyCommission === 'function') && isMainlyCommission();
  const empOnly = hasEmp && !selfEmp && !mainlyComm;
  /* v8.22 r3 (Allan's IN28 table): employees MAY claim rates & taxes, electricity, cleaning, security,
     levies (subject to support). Only BOND INTEREST is disallowed for employees (from 2023). */
  const bondAllowed = empOnly ? 0 : bondInt;
  const ratesAllowed = rates;
  (function(){
    var el2 = document.getElementById('ho-bond-wrap'); if(!el2) return;
    el2.classList.toggle('fld-off', empOnly);
    var inp = el2.querySelector('input'); if(inp) inp.disabled = empOnly;
  })();
  var _bn = document.getElementById('ho-bond-na'); if(_bn) _bn.style.display = empOnly ? '' : 'none';
  const occBase = ownership === 'own' ? bondAllowed + ratesAllowed + elec + levies : rent + elec + levies;
  const occDed = occBase * combinedRatio;
  const direct = gv('ho_phone') + gv('ho_other_direct');
  /* engine-remediation W15: the >50%-duties proviso (b) test (s23(b)) only
     applies where the trade "constitutes any employment or office" — a pure
     self-employed taxpayer (no employment income) is not gated by it. A mixed
     profile (employment AND self-employment) answering 'no' still defaults to
     R0 unless explicitly overridden on Apply (applyHomeoffice, 02-core.js). */
  const gateApplies = hasEmp;
  const mixedOverride = !!(APP.appliedValues && APP.appliedValues.ho_mixed_override);
  const qualifies = (over50 || !gateApplies || (selfEmp && mixedOverride)) && exclusive;
  const totalDed = qualifies ? (occDed + direct) : 0;

  APP.pendingValues.homeoffice = Math.round(totalDed);

  /* Batch M: Area ratio / Apportionment ratio are still computed (used above
     for the scrutiny-tier warnings) but no longer shown as their own lines \u2014
     only Occupancy / Direct costs / Total Deductible, tucked into a
     collapsible on the result card itself. */
  var h = '<div class="calc-result-box"><div class="calc-result-big">' + fmt(totalDed) + '</div><div class="calc-result-sub">Home office deduction \u2014 s23(b)</div></div>'
    + '<details class="calc-card" style="margin-top:8px">'
    + '<summary><div class="calc-card-lbl">Show calculation</div><i class="material-symbols-outlined msi-expand-more chev"></i></summary>'
    + '<div class="calc-card-body">'
    + '<div class="calc-row"><span>Occupancy \u00d7 ' + (combinedRatio*100).toFixed(1) + '%</span><span class="amt">' + fmt(occDed) + '</span></div>'
    + '<div class="calc-row"><span>Direct costs (100%)</span><span class="amt">' + fmt(direct) + '</span></div>'
    + '<div class="calc-row total"><span>Total Deductible</span><span class="amt">' + fmt(totalDed) + '</span></div>'
    + '</div></details>';
  /* Phase 8 (F2/E1): exclusivity is checked FIRST \u2014 a shared space fails
     regardless of how much time is spent there or which employment test
     applies, so it should not be buried under the duties-percentage notes
     below (which would only ever be reached if this one passed anyway). */
  if (!exclusive) {
    h += noteHtml('error', 'Does not qualify: the space is not used only for work.', 'The deduction is <strong>R 0</strong> because this space is also used for something other than work. SARS requires the space to be used exclusively for work.', { cls: 'u-mt-9', title: 'Does not qualify' });
  } else if (!over50 && !gateApplies) {
    h += noteHtml('info', 'Self-employed: the more-than-half-your-duties test does not apply.', '50% or less of your duties are performed here, but the proviso (b) &gt;50%-duties test does not apply to a pure self-employed trade with no employment income \u2014 the equipped / regular / exclusive-use requirements still apply.', { cls: 'u-mt-9', title: 'Self-employed home office' });
  } else if (!over50 && gateApplies && !(selfEmp && mixedOverride)) {
    if (selfEmp) {
      h += noteHtml('warning', 'R 0 unless you confirm this office is mainly for your business.', '50% or less of your duties are performed here, so the s23(b) deduction defaults to <strong>R 0</strong> unless you confirm on Apply that this office is used mainly for your non-employment trade.', { cls: 'u-mt-9', title: 'Mixed employment and business income' });
    } else {
      h += noteHtml('error', 'Does not qualify: under half your work is done here.', '50% or less of your duties are performed here, so the s23(b) deduction is <strong>R 0</strong>. More than 50% of duties must be performed in the office.', { cls: 'u-mt-9', title: 'Does not qualify' });
    }
  }
  if (areaRatio > 0.35) {
    h += '<div class="note error u-mt-9">\u26a0 Area ratio exceeds 35% \u2014 SARS likely to query.</div>';
  } else if (areaRatio > 0.25) {
    h += '<div class="note warning u-mt-9">Area ratio above 25% \u2014 may attract scrutiny.</div>';
  }
  if (ownership === 'own' && empOnly && bondInt > 0) {
    h += noteHtml('warning', 'Bond interest of ' + fmt(bondInt) + ' is left out — employees cannot claim it.', fmt(bondInt) + ' not included \u2014 disallowed for employees from 2023 (IN28 / s23(m)). Your profile indicates employment income (salary / IRP5 remuneration). You will be asked to confirm this exclusion when you Apply.<br><br>The one item that moved from allow to disallow from 2023 is mortgage bond interest. Rent, rates &amp; taxes, electricity, cleaning and security remain claimable premises expenses, apportioned by floor area. Self-employed and mainly-commission taxpayers may still claim bond interest.', { cls: 'u-mt-9', title: 'Bond interest excluded (employee)' });
  }
  if (ownership === 'own' && hasEmp && !selfEmp && mainlyComm && bondInt > 0) {
    h += noteHtml('lime', 'Bond interest of ' + fmt(bondInt) + ' is included (mainly commission).', 'Over half your remuneration is commission (code 3606), so the s23(m) employee limitations do not apply \u2014 ' + fmt(bondInt) + ' is claimable under s11(a).', { cls: 'u-mt-9', icon: 'check', title: 'Bond interest included (commission earner)' });
  }
  el.innerHTML = h;
  renderHomeOfficeTips();
}

export function renderHomeOfficeTips() {
  const el = $('home-office-tips'); if(!el) return;
  const tips = [
    {i:'square_foot',t:'Area must be dedicated and exclusive',d:'The space must be used regularly and exclusively for trade. A dual-purpose room does not qualify.'},
    {i:'history_edu',t:'Employees need employer confirmation',d:'A letter on employer letterhead confirming you are required to work from home.'},
    {i:'percent',t:'More than 50% of duties must be performed there',d:'SARS IN28 requires more than 50% of duties performed in the home office.'},
    {i:'photo_camera',t:'Photograph and measure your office',d:'Keep floor plan, measurements, and 360\u00b0 photographs of the dedicated space.'},
    {i:'home',t:'Bond interest \u2014 employees excluded',d:'From the 2023 year, employees cannot claim bond interest (IN28 / s23(m)). Self-employed taxpayers trading from home can, as can employees earning mainly (>50%) commission \u2014 the s23(m) limits do not apply to them.'},
    {i:'table_view',t:'Expense classification',d:'Premises costs (rent, rates, electricity, cleaning, security, levies) \u2014 floor-area ratio. Phone/internet \u2014 business-use portion. Capital assets (desk, computer, router) \u2014 wear-and-tear s11(e) under Tools.'},
    {i:'undo',t:'Assessed losses carry forward',d:'If the deduction creates an assessed loss it carries forward under s20.'}
  ];
  el.innerHTML = tips.map(t => `<div class="tip-card teal"><i class="${iconClassFor(t.i)}"></i><div><div class="tip-title">${esc(t.t)}</div><div class="tip-desc">${esc(t.d)}</div></div></div>`).join('');
}


/* ── INTEREST EXEMPTION ── */
export function calcInterest() {
  const el = $('interest-result'); if(!el) return;
  // V8.5 Batch 3 B2: derive gross from IT3(b) items if present; fall back to legacy int_gross field
  let gross = 0;
  if(APP.it3bItems && APP.it3bItems.length > 0) {
    /* C-11 (s12T): TFSA interest is exempt outright and must not appear to
       consume s10(1)(i) headroom — taxableIt3bItems() keeps any certificate
       still flagged isTfsa out (QR9a: TFSAs are their own list now). */
    taxableIt3bItems().forEach(item => {
      gross += (item.localInterest || 0) + (item.sarsInterest || 0);
    });
    // Sync legacy field for backward compat
    const legacyEl = $('int_gross'); if(legacyEl) legacyEl.value = gross || '';
  } else {
    gross = gv('int_gross') || 0;
  }
  const age = calcAgeAtYearEnd();
  const ty = getActiveTaxYear();
  const exemption = age >= 65 ? ty.interest.age65 : ty.interest.under65;
  const ageCat = $('int_age_cat'); if(ageCat) ageCat.value = age >= 65 ? 'Age 65+ (' + fmt(exemption) + ' exempt)' : 'Under 65 (' + fmt(exemption) + ' exempt)';
  const exempt = Math.min(gross, exemption);
  const taxable = Math.max(0, gross - exemption);
  APP.pendingValues.interest = exempt;
  el.innerHTML = `<div class="stat-row">
    <div class="stat-card"><div class="stat-value">${fmt(gross)}</div><div class="stat-label">Gross Interest</div></div>
    <div class="stat-card"><div class="stat-value u-c-ok">${fmt(exempt)}</div><div class="stat-label">Exempt Portion</div></div>
    <div class="stat-card"><div class="stat-value" style="color:${taxable>0?'var(--wa)':'var(--tx2)'}">${fmt(taxable)}</div><div class="stat-label">Taxable Interest</div></div>
  </div>`;
}

/* v8.27 Focus: live "saves about R X" echo under add-sheet amount fields.
   Estimate uses the current marginal rate from the engine; labelled "about". */
export function donAmountEcho() {
  const el = $('don-amount-echo'); if(!el) return;
  const amt = gv('don-amount') || 0;
  if(amt <= 0) { el.innerHTML = ''; return; }
  const r = calcFullTax();
  const mRate = (typeof r.marginalRate === 'number' && r.marginalRate) ? r.marginalRate : 0;
  const saving = Math.round(amt * mRate);
  el.innerHTML = saving > 0
    ? '<i class="material-symbols-outlined msi-trending-down" style="color:var(--au)"></i> Reduces taxable income \u2014 saves about <span class="mono" style="color:var(--au)">' + fmt(saving) + '</span>'
    : '<i class="material-symbols-outlined msi-info"></i> Deductible up to ' + getFact('donationPct') + '% of taxable income (s18A)';
}
/* F5 (Phase 7): an asset costing WT_SMALL_ITEM_LIMIT or less is written off
   in full in the year of purchase, regardless of what kind of asset it is
   (ITR12 guide IT-AE-36-G05 s9.8.3(c); IN47 Issue 5 s4.3.5 \u2014 the constant's
   comment in 01-data.js says where the two differ, QD-29).
   That concession previously only applied if the user manually picked the
   "Small tool" TYPE \u2014 a R5,000 laptop left on the default "Computer" type
   still depreciated over 3 years unless the user happened to know to
   re-categorise it. Owner decision (2026-07-29): default to the full
   write-off once the cost is at/under the threshold, and let the user
   override back to a depreciated type if they have a reason to (e.g. they
   want to match a fixed-asset register that already has it on a schedule).

   The auto-switch only ever fires while the type is one THIS FUNCTION set \u2014
   `APP._toolsTypeAuto` distinguishes that from a type the user chose
   themselves, so typing a cost never clobbers a deliberate selection. The
   flag is per open-modal state (reset in M_toolsWt.onForm below), not
   persisted \u2014 it only needs to survive one add/edit session. */
export function toolsCostEcho() {
  const el = $('tools-wt-cost-echo'); if(!el) return;
  const cost = gv('tools-wt-cost') || 0;
  const typeEl = $('tools-wt-type');
  /* APP._toolsTypeAuto holds the type name while the CURRENT value of the
     select is one this logic set, not one the user picked \u2014 null the
     moment a real choice happens (toolsTypeUserChanged, or an edit's loaded
     value via M_toolsWt.onLoad). Only ever act while that is true, so a
     deliberate selection is never overridden by typing a cost. */
  if (typeEl && APP._toolsTypeAuto) {
    const currentType = typeEl.value;
    if (cost > 0 && cost <= WT_SMALL_ITEM_LIMIT && currentType !== 'small_tool') {
      typeEl.value = 'small_tool';
      APP._toolsTypeAuto = 'small_tool';
    } else if (cost > WT_SMALL_ITEM_LIMIT && currentType === 'small_tool') {
      /* Past the threshold, small_tool is no longer a legal choice
         (validate() would reject it) \u2014 fall back rather than leave the
         user staring at a save error for a value they did not choose. */
      typeEl.value = APP._toolsTypePicked || 'computer';   // UI-CAP-1: back to what the user said it is
      APP._toolsTypeAuto = typeEl.value;
    }
  }
  if(cost <= 0) { el.innerHTML = ''; return; }
  const type = gs('tools-wt-type') || 'other';
  const life = wtLife(type);
  const annual = life === 1 ? cost : cost / life;
  const r = calcFullTax();
  const mRate = (typeof r.marginalRate === 'number' && r.marginalRate) ? r.marginalRate : 0;
  const saving = Math.round(annual * mRate);
  /* UI-CAP-1: the type is picked on the chooser and its select is no longer
     on the form, so the way back to depreciating is a button here. */
  const spreadLife = wtLife(APP._toolsTypePicked || 'computer');
  const autoNote = (type === 'small_tool' && APP._toolsTypeAuto === 'small_tool')
    ? ' <span style="color:var(--tx3)">(' + randText(WT_SMALL_ITEM_LIMIT) + ' or less \u2014 full write-off applied automatically)</span>'
      + ' <button type="button" class="btn-link" onclick="toolsSpreadOut()">Spread it over ' + spreadLife + ' years instead</button>'
    : '';
  /* One inline run beside the glyph: .field-echo is a flex row, and loose
     text nodes and spans each became a column of their own. */
  el.innerHTML = '<i class="material-symbols-outlined msi-trending-down" style="color:var(--au)"></i> <span>'
    + (life === 1 ? 'Full write-off this year' : 'About <span class="mono">' + fmt(annual) + '</span>/yr wear &amp; tear (' + life + 'yr)')
    /* OI-C1e (owner 2026-10-09): a full write-off is a one-off, so the tax it
       saves is this year's, not a yearly figure. The "/yr" suffix was
       appended whatever the life, which overstated a small item's benefit to
       anyone reading it as recurring. */
    + (saving > 0 ? ' \u00b7 saves ~<span class="mono" style="color:var(--au)">' + fmt(saving) + '</span>' + (life === 1 ? ' this year' : '/yr') : '')
    + autoNote + '</span>';
}

/* The type select's own onchange \u2014 separate from toolsCostEcho's cost-driven
   logic so a MANUAL pick always clears the auto flag, even to 'small_tool'
   itself (choosing it on purpose is not the same state as the app choosing
   it for you, though the resulting deduction is identical). */
export function toolsTypeUserChanged() {
  APP._toolsTypeAuto = null;
  toolsCostEcho();
}
/* "Spread it over N years instead": the user turns the automatic full
   write-off down — back to the kind they picked, as a deliberate choice. */
export function toolsSpreadOut() {
  const typeEl = $('tools-wt-type'); if (!typeEl) return;
  typeEl.value = APP._toolsTypePicked || 'computer';
  APP._toolsTypeAuto = null;
  toolsCostEcho();
  refreshOptionNotes($('modal-tools-wt'));
}

/* Tools & Equipment W&T (s11(e)) moved to 05-list-modules.js (task #39) —
   migrated to makeCrudModule for edit+delete, consistent with every other
   list in the app. See M_toolsWt there. */

/* ── DONATIONS ── s18A deductible donations to PBOs, 10% cap with carry-forward */
export function addDonation() {
  const name = gs('don-name'), ref = gs('don-ref'), amount = gv('don-amount');
  const hasS18a = gs('don-has-s18a');
  const kind = gs('don-kind') || 'cash';
  /* On-blur validation (BACKLOG 36): problems show at their field. */
  if(!name) { flagField('don-name', 'This is required.'); return; }
  if(amount <= 0) { flagField('don-amount', 'Enter an amount.'); return; }
  if(hasS18a !== 'yes' && hasS18a !== 'no') { flagField('don-has-s18a', 'Choose an option.'); return; }
  /* QA 2026-08 (B1-20): the receipt reference is no longer mandatory. What
     makes the donation deductible under s18A is HOLDING a valid certificate,
     which the previous question already establishes; the reference number is
     a record-keeping convenience for the user's own filing. Blocking the save
     on it meant someone who had the certificate in a drawer, or was capturing
     from a bank statement before the PBO issued it, could not record the
     donation at all — so the amount went missing from the return entirely,
     which is the worse outcome by far. */
  APP.donationItems.push({id:Date.now(), name, ref, amount, hasS18a, kind});
  const ne=$('don-name');if(ne)ne.value=''; const re=$('don-ref');if(re)re.value='';
  const ae=$('don-amount');if(ae)ae.value=''; const se=$('don-has-s18a');if(se)se.value='';
  const ke=$('don-kind');if(ke)ke.value='cash';
  donToggleS18a(); donToggleKindNote();
  closeModal('modal-donation');
  renderDonationsList(); applyDeduction('donations');
}

/* Reveal the s18A reference field and the "not deductible" warning based on
   the certificate answer — see CFG_DONATION (00-forms.js) for the field. */
export function donToggleS18a() {
  const has = gs('don-has-s18a');
  const refRow = $('don-ref-row'); if(refRow) refRow.style.display = has === 'yes' ? '' : 'none';
  const warn = $('don-no-s18a-note'); if(warn) warn.style.display = has === 'no' ? '' : 'none';
}

/* In-kind donation valuation note — s18A(3) values differ from the donor's
   own market-value estimate. See CFG_DONATION (00-forms.js). */
export function donToggleKindNote() {
  const note = $('don-kind-note'); if(note) note.style.display = gs('don-kind') === 'kind' ? '' : 'none';
}
export function removeDonation(id) {
  APP.donationItems = APP.donationItems.filter(d => d.id !== id);
  renderDonationsList(); applyDeduction('donations');   /* Batch A (UX #7) */
}
export function renderDonationsList() {
  const el = $('donations-list');
  const sumEl = $('donations-summary');
  if(el) {
    if(!APP.donationItems.length) {
      /* QA 2026-09: persistent "+ Add donation" button at the top of this
         page is the only add-CTA now — this duplicated it. */
      el.innerHTML = '';
    } else {
      el.innerHTML = APP.donationItems.map(d => {
        const deductible = d.hasS18a !== 'no';
        return `<div class="item-row">
          <span class="item-code deduction" style="${deductible?'':'opacity:.5'}">${deductible?'s18A':'Not deductible'}</span>
          <span class="item-desc">${esc(d.name)}${d.ref?' — '+esc(d.ref):''}${d.kind==='kind'?' (in-kind)':''}</span>
          <span class="item-amount" style="${deductible?'':'text-decoration:line-through;opacity:.6'}">${fmt(d.amount)}</span>
          <button class="item-remove del" onclick="removeDonation(${d.id})" aria-label="Remove donation"><i class="material-symbols-outlined msi-delete"></i></button>
        </div>`;
      }).join('');
    }
  }
  if(!sumEl) return;
  /* Only certificated (hasS18a !== 'no') donations are deductible under
     s18A — items without a valid certificate are recorded but excluded
     from the amount that reaches calcFullTax(). Items saved before this
     field existed (hasS18a === undefined) are treated as certificated —
     preserves existing behaviour for records already in a user's data. */
  const total = APP.donationItems.reduce((s,d) => s + (d.hasS18a === 'no' ? 0 : d.amount), 0);
  APP.pendingValues.donations = Math.round(total); // Store gross (rounded) — tax engine caps it
  /* Read the cap/allowed/carry-forward straight off calcFullTax() — never
     re-derive the s18A 10% cap here (Hard Rule 2). r.donTotal already folds
     in py_s18a_excess (prior-year b/f, itself re-capped this year per the
     s18A(1) proviso), so donAllowed/donExcess are the true, single-source
     figures — this list's own `total` only ever reflects this year's own
     donation items, kept separate for the taxpayer's own record. */
  const r = calcFullTax();
  const bfExcess = gv('py_s18a_excess');
  APP.donationAllowed = r.donAllowed;   // V8.75 6c-ii: capped (net deductible) amount for Selections badge
  APP.donationCF = r.donExcess;         // s18A(1) proviso: excess carried forward to next year (re-capped there)
  sumEl.innerHTML = total > 0 ? `
    <div class="calc-result-box" style="margin-top:0;margin-bottom:10px">
      <div class="calc-result-big">${fmt(r.donAllowed)}</div>
      <div class="calc-result-sub">Donations allowed this year — s18A</div>
    </div>
    ${capMeterHtml({ used: r.donAllowed, cap: r.donMax, over: r.donExcess, label: 'Donations cap used',
        remainLabel: 'of the cap still unused', overLabel: 'over the cap \u2014 carried forward to next year' })}
    <div class="sum-line"><span class="lbl">This year's donations</span><span class="val">${fmt(total)}</span></div>
    ${bfExcess > 0 ? `<div class="sum-line"><span class="lbl">Excess b/f from last year (s18A)</span><span class="val">${fmt(bfExcess)}</span></div>` : ''}
    <div class="sum-line"><span class="lbl">10% cap (of taxable before donations)</span><span class="val">${fmt(r.donMax)}</span></div>
    ${r.donExcess > 0 ? noteHtml('info', `${fmt(r.donExcess)} over the cap carries forward to next year.`, `Excess of ${fmt(r.donExcess)} above the 10% cap is carried forward to next year (s18A) and again capped at 10% then — it is not lost.`, { style: 'margin-top:6px', title: 'Donations carried forward' }) : ''}` : '';
}

/* ── ADDITIONAL 4000-SERIES ── manual IRP5 deduction codes */
/* Deduction-code CRUD is provided by M_deductionCode in 05-list-modules.js
   (shared makeCrudModule factory). renderDeductionCodeList emits index-based
   edit/remove handlers that delegate to it. */
export function renderDeductionCodeList() {
  const el = $('deduction-code-list'); if(!el) return;
  if(!APP.deductionItems.length) {
    /* QA 2026-09: persistent "+ Add a claim" button at the top of this page
       is the only add-CTA now — this duplicated it. */
    el.innerHTML=''; return;
  }
  el.innerHTML = APP.deductionItems.map((i, idx) =>
    `<div class="item-row">
      <span class="item-code deduction">${esc(i.code)}</span>
      <span class="item-desc">${esc(i.name)}${(i.desc && i.desc !== i.name)?' — '+esc(i.desc):''}</span>
      <span class="item-amount">${fmt(i.amount)}</span>
      <button class="item-remove" onclick="editDeductionItem(${idx})" aria-label="Edit deduction item"><i class="material-symbols-outlined msi-edit"></i></button>
      <button class="item-remove del" onclick="removeDeductionItem(${idx})" aria-label="Remove deduction item"><i class="material-symbols-outlined msi-delete"></i></button>
    </div>`
    + (i.code === '4116' ? noteHtml('info', 'Already inside your employer\u2019s PAYE — not added again.', 'Code 4116 is informational — this credit is already reflected inside your employer’s PAYE (code 4102) and is not added as a separate deduction here.', { style: 'margin:4px 0 8px', title: 'Code 4116' }) : '')
).join('');
}

/* Batch 2: single source of truth for "how much has the deductions page
   saved me" — bracket-delta tax saving from deductions, plus medical tax
   credits (a direct rand-for-rand reduction, not a deduction, so summed
   separately). Both renderDeductionsGlanceBottom's chip and the new
   "Total tax benefit this year" hero call this, so they can never diverge.
   Reuses calcTaxOnIncome() — never re-derives bracket math inline. */
export function dedTaxBenefit() {
  const r = calcFullTax();
  const totalDeds = (r.retAllowed || 0) + (r.donAllowed || 0) + (r.additionalDed || 0) +
    (r.travelDed || 0) + (r.homeOfficeDed || 0) + (r.toolsDed || 0) +
    (r.subscripDed || 0) + (r.subsistenceDed || 0) +
    (r.companyCarDed || 0) + (r.foreignSubsistenceDed || 0);
  // Bracket-delta: tax on income without deductions minus tax with — more accurate than marginalRate × deds
  const taxWithoutDeds = totalDeds > 0 ? calcTaxOnIncome(r.taxableIncome + totalDeds, r.ty.brackets) : r.taxOnIncome;
  const taxSaving = Math.max(0, taxWithoutDeds - r.taxOnIncome);
  const taxCredits = (r.med && r.med.total) || 0;
  return { r, totalDeds, taxSaving, taxCredits, totalBenefit: taxSaving + taxCredits };
}

/* A3 (revised 2026-09-28, Q-NEW-1): single source of truth for "how many
   deductions are active" — the checklist categories (retirement/medical/
   travel/homeoffice/tools/donations/subscrip/subsistence) plus "Other"
   IRP5-code claims (APP.deductionItems, feeding additionalDed), which
   DEDUCTION_CHECKLIST does not cover at all. Kept separate from
   dedTaxBenefit() so that function's contract stays narrow (Saved-ded +
   medical credit only).

   Originally counted a checklist row as active purely from
   APP.dedChecks[d.id] — the toggle switch — so a row switched on with
   nothing captured yet counted the same as one with a real rand amount.
   That produced a hero reading "8 deductions" next to a tax benefit only
   one of them actually produced (owner report, 2026-09-28). The count now
   requires the same thing the hero's own expandable breakdown and the Tax
   Saving mini-card's own row list already require to show a line item:
   a non-zero calculated amount. A toggled-but-empty row (still shown to
   the user so they can open its calculator) no longer inflates this
   count — it is not "active" until it has a rand figure behind it. */
export function dedActiveCount() {
  const r = calcFullTax();
  const calcAmts = {
    retirement: r.retAllowed || 0, medical: (r.med && r.med.total) || 0,
    travel: r.travelDed || 0, homeoffice: r.homeOfficeDed || 0, tools: r.toolsDed || 0,
    donations: r.donAllowed || 0, subscrip: r.subscripDed || 0,
    subsistence: r.subsistenceDed || 0,
  };
  /* 'additional' ("Other claims") is counted separately below from the
     live deductionItems array — DEDUCTION_CHECKLIST has no calcAmts entry
     for it, so it is excluded here to avoid ever double-counting it. */
  const checklistActive = DEDUCTION_CHECKLIST.filter(function(d){
    if (d.id === 'additional') return false;
    return (calcAmts[d.id] || 0) > 0;
  }).length;
  return checklistActive + (APP.deductionItems || []).filter(function(i){ return (i.amount||0) > 0; }).length;
}

/* Batch C3 — deductions selection screen at-a-glance strip.
   Chip 1: rand tax saving from all deductions applied (bracket-delta calculation).
   Chip 2: retirement cap meter — contributions vs s11F cap, only when active. */
export function renderDeductionsGlanceBottom() {
  const el = $('deductions-glance-bottom');
  if (!el) return;
  const _b = dedTaxBenefit();
  const r = _b.r, totalDeds = _b.totalDeds, taxSaving = _b.taxSaving;

  function _enc(str) { return str.replace(/"/g, '&quot;'); }
  function _iBtn(tip) {
    return '<span class="info-btn" data-tip="' + _enc(tip) + '" tabindex="0" role="button" aria-label="Details"><i class="material-symbols-outlined msi-info"></i></span>';
  }

  /* S2 Batch 12 (B8): "Tax Saving" small card, distinct from the
     Deductions hero (S2 Batch 3, which lists deductions at their GROSS
     amount). This one lists each deduction NET — its own apportioned
     share of Saved-ded (deduction amount / total deductions × taxSaving)
     — replacing the old rand-amount popover chip with the count-collapsed,
     expandable mini-card idiom used throughout this stage. */
  const activeCount = dedActiveCount();
  const apportioned = [
    ['Retirement contributions', r.retAllowed], ['Travel', r.travelDed],
    ['Company car', r.companyCarDed], ['Home office', r.homeOfficeDed],
    ['Tools/equipment', r.toolsDed],
    ['Professional memberships', r.subscripDed], ['Subsistence', r.subsistenceDed],
    ['Foreign subsistence', r.foreignSubsistenceDed], ['Donations', r.donAllowed],
    ['Other deductions', r.additionalDed],
  ].filter(function(row){ return row[1] > 0; })
    .map(function(row){ return { label: row[0], net: totalDeds > 0 ? (row[1] / totalDeds) * taxSaving : 0 }; });
  const chip1 = activeCount > 0
    ? '<details class="mini-card" data-card="Tax Saving" data-raw="' + taxSaving + '"' + (APP._dedSavingOpen ? ' open' : '') + ' ontoggle="APP._dedSavingOpen=this.open">'
      + '<summary><div><div class="mini-name">Tax Saving</div><div class="mini-val">' + activeCount + ' deduction' + (activeCount === 1 ? '' : 's') + '</div></div>'
      + '<i class="material-symbols-outlined msi-expand-more mini-chev"></i></summary>'
      + '<div class="mini-body">' + apportioned.map(function(a){
          return '<div class="mini-row" data-val="' + a.net + '"><span>' + esc(a.label) + '</span><span class="v">' + fmt(a.net) + '</span></div>';
        }).join('')
      + '<div class="mini-row" style="font-weight:600;border-top:1px solid var(--bd);padding-top:6px;margin-top:4px"><span>Total tax saved</span><span class="v">' + fmt(taxSaving) + '</span></div>'
      + '</div></details>'
    : '<div class="gc gc-off">' +
      '<div class="gc-ico ico-bg-grey"><i class="material-symbols-outlined msi-savings"></i></div>' +
      '<div class="gc-info">' +
      '<div class="gc-name">Tax Saving</div>' +
      '<div class="gc-val d prose">Enable deductions above</div>' +
      '</div></div>';

  // Chip 2: retirement cap meter — only when retirement deduction is active
  let chip2 = '';
  if (APP.dedChecks && APP.dedChecks.retirement && r.retMax > 0) {
    const fillPct = Math.min(100, ((r.retTotal || 0) / r.retMax) * 100).toFixed(0);
    const barCol = r.retExcess > 0 ? 'var(--er)' : fillPct > 80 ? 'var(--wa)' : 'var(--ok)';
    let retTip = '<strong>Retirement Cap Meter (s11F)</strong>';
    retTip += '<br>Contributions: ' + fmt(r.retTotal);
    const capPct = String(r.ty.retirement.pct);   /* BACKLOG 88: stored as a percentage; read "2750.0%" */
    retTip += '<br>Cap (' + capPct + '%): ' + fmt(r.retMax);
    retTip += '<br>Allowed: ' + fmt(r.retAllowed);
    if (r.retExcess > 0) retTip += '<br>Excess c/f: ' + fmt(r.retExcess);
    chip2 = '<div class="gc" onclick="var _ib=this.querySelector(\'.info-btn\');if(_ib)showInfoTip(_ib)">' +
      '<div class="gc-ico ico-bg-pink"><i class="material-symbols-outlined msi-tune"></i></div>' +
      '<div class="gc-info">' +
      '<div class="gc-name">' + lblWithInfo('Retirement Cap', _iBtn(retTip)) + '</div>' +
      '<div style="background:var(--sf3);border-radius:3px;height:6px;overflow:hidden;margin:4px 0 2px">' +
      '<div style="height:100%;width:' + fillPct + '%;background:' + barCol + ';border-radius:3px;transition:width .3s"></div></div>' +
      '<div class="gc-val prose" style="font-size:0.6875rem;font-weight:400;color:var(--tx2)">' +
      fmt(r.retAllowed) + ' / ' + fmt(r.retMax) + (r.retExcess > 0 ? ' — excess ' + fmt(r.retExcess) : '') +
      '</div></div></div>';
  }

  /* S2 Batch 12 (B9... actually B8/B9 correction: "Medical credits" is the
     new card, per the stage doc's own point 2). Reuses calcMedicalCredits()
     — the same call renderMedicalCreditsDisplay() (the Medical sub-page)
     already makes — so this glance card and that page's detail can never
     disagree. Shows s6A + AMTC (s6B) each on their own line, with the
     AMTC's own calculation steps (base × rate, threshold subtracted) read
     from calcMedicalCredits()'s own returned composition, not re-derived. */
  let chip3 = '';
  if (APP.dedChecks && APP.dedChecks.medical) {
    const ty2 = getActiveTaxYear(); const age2 = calcAgeAtYearEnd();
    const annualSelf2 = gv('med_monthly'), annualEmp2 = gv('med_employer');
    const deps2 = gv('med_deps'), oop2 = gv('med_oop');
    const med = calcMedicalCredits(age2, ty2, isMedicalSchemeMemberDom(), deps2, annualSelf2, annualEmp2, oop2, gv('med_disability')===1, r.taxableIncome);
    if (med.total > 0) {
      const amtcRateLbl = (age2 >= 65 || gv('med_disability')===1) ? '33.3%' : '25%';
      chip3 = '<details class="mini-card" data-card="Medical credits" data-raw="' + med.total + '"' + (APP._dedMedOpen ? ' open' : '') + ' ontoggle="APP._dedMedOpen=this.open">'
        + '<summary><div><div class="mini-name">Medical credits</div><div class="mini-val">' + fmt(med.total) + '</div></div>'
        + '<i class="material-symbols-outlined msi-expand-more mini-chev"></i></summary>'
        + '<div class="mini-body">'
        + '<div class="mini-row" data-val="' + med.s6a + '"><span>Medical Scheme Fees Tax Credit (s6A)</span><span class="v">' + fmt(med.s6a) + '</span></div>'
        + '<div class="mini-row" data-val="' + med.s6b + '"><span>Additional Medical Expenses Tax Credit (s6B)</span><span class="v">' + fmt(med.s6b) + '</span></div>'
        + '<div class="mini-row" style="font-size:var(--fs-3xs);color:var(--tx3)"><span>AMTC = ' + amtcRateLbl + ' × qualifying expenses' + (age2 >= 65 || gv('med_disability')===1 ? ' (no threshold)' : ', above 7.5% of taxable income') + '</span></div>'
        + '<div class="mini-row" style="font-weight:600;border-top:1px solid var(--bd);padding-top:6px;margin-top:4px"><span>Total credit</span><span class="v">' + fmt(med.total) + '</span></div>'
        + '</div></details>';
    }
  }

  el.innerHTML = chip1 + chip2 + chip3;
}

/* S2 Batch 3 (rebuild per Allan's spec, 2026-09-19): collapsed headline is
   Saved-ded — tax saved by deductions ALONE, no rebates/medical/FTC folded
   in (that combined figure is Tax-saved, shown only on the Dashboard hero,
   S2 Batch 4) — with a plain count of active deductions, not their rand
   total. Expanded lists every deduction at its gross captured amount (no
   Saved-ded apportionment — that's the separate Deductions "Tax Saving"
   card, S2 Batch 12). Reuses dedTaxBenefit()/dedActiveCount() so neither
   figure can diverge from the glance chip or the checklist's own count. */
export function renderDeductionsHero() {
  const el = $('deductions-hero'); if (!el) return;
  const b = dedTaxBenefit();
  const count = dedActiveCount();
  if (count > 0) {
    const r = b.r;
    const grossRows = [
      ['Retirement contributions', r.retAllowed], ['Travel', r.travelDed],
      ['Home office', r.homeOfficeDed], ['Tools/equipment', r.toolsDed],
      ['Professional memberships', r.subscripDed],
      ['Subsistence', r.subsistenceDed], ['Company car', r.companyCarDed],
      ['Foreign subsistence', r.foreignSubsistenceDed], ['Donations', r.donAllowed],
      ['Other deductions', r.additionalDed],
    ].filter(function(row){ return row[1] > 0; })
      .map(function(row){ return '<div class="sum-line"><span class="lbl">' + esc(row[0]) + '</span><span class="val">' + fmt(row[1]) + '</span></div>'; })
      .join('');
    el.innerHTML = '<details class="dhero-acc" id="deductions-hero-acc"' + (APP._dedHeroOpen ? ' open' : '') + ' ontoggle="APP._dedHeroOpen=this.open">'
      + '<summary class="dhero sv">'
      + '<div class="dhero-top"><div class="dhero-lbl dhero-lbl-nodot">Total tax benefit this year</div>'
      + '<i class="material-symbols-outlined msi-expand-more dhero-tri"></i></div>'
      + '<div class="dhero-num" data-count="' + (b.taxSaving) + '" data-count-key="ded-tax-saving">' + fmt(b.taxSaving) + '</div>'
      + '<div class="dhero-break" data-active-count="' + count + '">' + count + ' total deduction' + (count === 1 ? '' : 's') + '</div>'
      + '</summary>'
      + '<div class="dhero-detail">' + grossRows + '</div>'
      + '</details>';
  } else {
    el.innerHTML = '<div class="dhero sv u-empty">'
      + '<div class="dhero-top"><div class="dhero-lbl dhero-lbl-nodot">Total tax benefit this year</div></div>'
      + '<div class="dhero-num" data-count="' + (0) + '" data-count-key="ded-tax-saving">' + fmt(0) + '</div>'
      + '<div class="dhero-break" data-active-count="0"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> Enable deductions below to see your tax benefit.</div>'
      + '</div>';
  }
}

/* Batch 2: "Outstanding deductions" — mirrors renderOutstandingBottom()'s
   pattern from the Income page (03-income.js), applied to deductions: an
   enabled deduction with no amount captured yet. Reuses the same
   APP.overrides/toggleOverride() dismiss mechanism, keyed with a distinct
   'ded_missing_' prefix so it can never collide with an income override key. */
/* Theme 4: raw (pre-override-filter) deductions outstanding-item list —
   shared by this page's own render below AND the unified Dashboard
   outstanding-items section (renderDashboardOutstanding, 08-dashboard-theme.js). */
/* QA 2026-08 (B1-23) — a step is done when an amount was ENTERED, not when the
   entry survived the caps.

   This read r.retAllowed and r.donAllowed: the amounts left AFTER s11F's
   27.5%/annual ceiling and s18A's 10%-of-taxable-income cap. Both collapse to
   zero when there is no income to deduct from, so the owner's case — capture
   R20,000 of donations against zero income — left "What you can claim" stuck
   on "still to add" forever, with no amount the user could type to clear it.
   Capping is the engine doing its job correctly; it is not an unfinished task,
   and a checklist that cannot be completed is worse than no checklist.

   So each entry below is the CAPTURED figure, taken before any cap:
     retirement — retTotal, contributions as captured (retAllowed is post-s11F)
     donations  — donTotal, donations as captured plus any prior-year excess
                  (donAllowed is post-10% cap)
     medical    — the amounts the user types, not the resulting s6A/s6B credit,
                  which is a credit against tax rather than a deduction and can
                  stand at zero on a full capture
     the rest   — already the captured value: travel/homeoffice/tools/subscrip/
                  subsistence read appliedValues, which the engine consumes
                  uncapped.

   The ENGINE IS UNTOUCHED. Nothing here feeds a calculation — this decides
   which rows appear in an outstanding list. */
export function getDeductionsOutstanding() {
  const r = calcFullTax();
  const CAPTURED = {
    retirement: r.retTotal,
    medical: (gv('med_monthly') || 0) + (gv('med_employer') || 0) + (gv('med_oop') || 0),
    travel: r.travelDed,
    homeoffice: r.homeOfficeDed,
    tools: r.toolsDed,
    donations: r.donTotal,
    subscrip: r.subscripDed,
    subsistence: r.subsistenceDed
  };
  return DEDUCTION_CHECKLIST.filter(function(d) {
    return APP.dedChecks && APP.dedChecks[d.id] && !(CAPTURED[d.id] > 0);
  /* B7 copy: the plain-language `short` name, not the formal `label` —
     "Medical Expenses enabled but no amount captured yet" was the one place
     B6's P7 pass missed, because the string is built here rather than sitting
     in the markup. */
  }).map(function(d) { return { key: 'ded_missing_' + d.id, label: (d.short || d.label), route: d.id, nav: captureNav(d.id), icon: d.icon }; });
}

/* STD-IA-1/DIP-1 (§L.6): renderDeductionsOutstanding() (removed) rendered
   this exact list a second time at the bottom of Deductions Main —
   getDeductionsOutstanding() already drives the "Still to add" marking at
   the TOP of the page (dedTodo, above), so it was the same warning list
   twice on one screen. Its now-empty #deductions-outstanding-bottom div
   is removed from body.html too. */

/* ── C6: Deduction sub-page 2-chip glance strips ── */
export function renderDeductionSubpageGlances() {
  const r = calcFullTax();
  if (!r || !r.ty || !r.ty.brackets) return;

  function _enc(str) { return str.replace(/"/g, '&quot;'); }
  function _iBtn(tip) {
    return '<span class="info-btn" data-tip="' + _enc(tip) + '" tabindex="0" role="button" aria-label="Details"><i class="material-symbols-outlined msi-info"></i></span>';
  }

  // Bracket-delta tax saving from a deduction amount
  function taxSaving(dedAmount) {
    if (dedAmount <= 0) return 0;
    const tiNow = r.taxableIncome;
    const tiWithout = tiNow + dedAmount;
    return Math.max(0, calcTaxOnIncome(tiWithout, r.ty.brackets) - calcTaxOnIncome(tiNow, r.ty.brackets));
  }

  function renderChips(containerId, dedAmount, label, color) {
    const el = $(containerId);
    if (!el) return;
    if (dedAmount <= 0) { el.innerHTML = ''; return; }
    const saving = taxSaving(dedAmount);
    const catTip = '<strong>' + label + '</strong><br>Deduction allowed: ' + fmt(dedAmount);
    const saveTip = '<strong>Tax saving from ' + label + '</strong><br>'
      + 'This deduction of ' + fmt(dedAmount) + ' reduces your tax by approximately ' + fmt(saving) + '<br>'
      + 'Based on your current marginal rate of ' + ((r.marginalRate || 0) * 100).toFixed(0) + '%';
    el.innerHTML = '<div class="gc">'
      + '<div class="gc-val" style="color:' + color + '">' + fmt(dedAmount) + '</div>'
      + '<div class="gc-lbl">' + lblWithInfo(label, _iBtn(catTip)) + '</div>'
      + '</div>'
      + '<div class="gc">'
      + '<div class="gc-val" style="color:var(--ok)">−' + fmt(saving) + '</div>'
      + '<div class="gc-lbl">' + lblWithInfo('Tax saving', _iBtn(saveTip)) + '</div>'
      + '</div>';
  }

  renderChips('glance-ded-retirement', r.retAllowed || 0, 'Retirement deduction cap', 'var(--ico-pink)');
  renderChips('glance-ded-travel', r.travelDed || 0, 'Travel Deduction', 'var(--ico-amber)');
  // Batch M: Home office's duplicate "Home Office"/"Tax saving" glance cards
  // removed — the consolidated result card + collapsible breakdown covers this.
  renderChips('glance-ded-tools', r.toolsDed || 0, 'Tools & Equipment', 'var(--ico-purple)');
  renderChips('glance-ded-donations', r.donAllowed || 0, 'Donations (s18A)', 'var(--ico-red)');
  renderChips('glance-ded-subscrip', r.subscripDed || 0, 'Subscriptions', 'var(--tx2)');
  renderChips('glance-ded-subsistence', r.subsistenceDed || 0, 'Subsistence', 'var(--tx2)');
}
