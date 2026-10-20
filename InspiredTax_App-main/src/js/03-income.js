import { barsHtml, noteHtml, setNote, captureNav, lblWithInfo, navigateToCapture, $, APP, confirmContradiction, setIncomeType, calcAgeAtYearEnd, calcFullTax, calcRetirementReceipts, calcTaxForYear, calcTaxOnIncome, calcTaxableInvestment, closeModal, openModal, debounceSave, donutHtml, esc, fmt, foreignIncomeBreakdown, getActiveTaxYear, getSelectedIncomeTypes, giSourceBreakdown, gs, gv, iconClassFor, isProvisionalAutoDetermined, showConfirm, showFxWidgetFor, showToast, sv, taxableIt3bItems, teiBreakdown, exemptMemoBreakdown, _foreignIncomeTotal} from './02-core.js';
import { cryptoTotals } from './06-crypto.js';
import { cgtAggregate } from './06b-cgt.js';
import { renderAll, refreshDerived } from './07-render-summary.js';
import { getFilingSeasonTaxYear, lastDayOfFeb, renderDashboard, renderTaxMilestones } from './08-dashboard-theme.js';
import { BALANCE_SOURCE, EMPLOYMENT_INCOME_CODES, FILING_DEADLINES, INCOME_TYPE_DEFS, INCOME_CODE_SHORT, itemCount, IRP5_INCOME, incomeDeductionNoteFor, katHtml, PROVISIONAL_INCOME_TYPES, SARS_BALANCE_TYPES, FOREIGN_SERVICE_CODES } from './01-data.js';
import { updateCurrentYear } from './10-current-year-planner.js';
import { incomeBucketActive, renderSelectorList, selectorRow } from './04-deductions.js';
import { getCarriedBalanceStatus, setCarriedBalanceAnswer } from './13-patches.js';

/* ============================================================
   InspiredTax v8.5 — INCOME & TAX MODE
   Income items, stats, provisional tax, prior year carry-forwards
   ============================================================ */

/* Batch K (#16/#68/#69/#75): a negative amount (business/rental loss) is
   still real, engine-included income-page data — render it in the app's
   existing loss convention (parentheses, red) rather than fmt()'s bare
   minus sign, matching CGT/crypto/rental elsewhere. Shared by
   renderIncomeGlance() and renderIncomeSelector() so the two views of
   the same figure can never disagree on formatting. */
function fmtSigned(n) { return n < 0 ? '(' + fmt(Math.abs(n)) + ')' : fmt(n); }

/* B7.5 (D-24/INC-9) — the income hero's breakdown donut, exempt from D-19
   (that rule governs icon TILES; a donut must distinguish its slices).
   Fixed declaration order, not amount order, so a given income type is
   always the same colour across renders however the legend is sorted. */
/* Exported (S2 Batch 5) so the Dashboard's GTI donut uses the same
   source-to-hue mapping as this hero's own donut — one income source is
   always one colour everywhere, not just within this card. */
/* Ordered so the 11 MOST COMMONLY co-occurring categories (a taxpayer with
   salary + investments + a side business + rental is an ordinary combo)
   get the first 11 — genuinely distinct — colours; only the five rarest,
   narrowest categories (each a fairly unusual line item on its own) sit
   past the wrap point and reuse an earlier colour. Reordering can reduce
   this risk but not eliminate it past 11 simultaneous non-zero
   categories, which is itself the residual case flagged for S3. */
export var INCOME_DONUT_COLOUR = {
  /* One hue each — the sources a typical return actually turns on. */
  'Employment':                 'var(--emerald)',
  'Foreign income':             'var(--cyan)',
  'Investment':                 'var(--amber)',
  'Pension/Annuity':            'var(--violet)',
  'Capital Gains':              'var(--mint)',
  'Rental (net)':               'var(--rose)',
  'Business':                   'var(--blue)',

  /* FAMILIES. The Income hero can chart fourteen sources and only eleven
     category hues exist, so some sources must share. Rather than let the
     sharing fall out of an index wrap — which is what put Fringe Benefits in
     Employment's exact emerald — each shared hue is a deliberate family whose
     members mean the same kind of money. The legend names and prices every
     slice, so a family reads as a group rather than as one mislabelled slice.

     Employment extras: the non-salary parts of an IRP5 package. */
  'Allowances':                 'var(--ico-pink)',
  'Fringe Benefits':            'var(--ico-pink)',

  /* Money taken out of a retirement fund. */
  'Two-Pot':                    'var(--navy)',
  'Lump Sums':                  'var(--navy)',
  'Retirement Lump Sum':        'var(--navy)',

  /* Tail receipts — neither is a mainstream source. */
  'Crypto':                     'var(--red)',
  'Other Receipts':             'var(--red)',

  /* Not income at all: adjustments that are never taxed. GI-only. */
  'Non-taxable income':                            'var(--neutral)',
  'Non-deducted contributions relief (lump sum)':  'var(--neutral)',

  /* Foreign-income donut (foreignIncomeBreakdown(), 02-core.js). Its labels
     are not income-type names, so they need their own entries — before this
     they were coloured by POSITION in the filtered list, which repainted every
     surviving slice whenever one fell to zero. Each mirrors the hue of its
     domestic equivalent above, so "foreign rental" reads as rental. */
  'Foreign employment (net of exemption)': 'var(--emerald)',
  'Foreign interest':                      'var(--amber)',
  'Foreign dividends (taxable portion)':   'var(--violet)',
  'Foreign rental':                        'var(--rose)',
  'Foreign business':                      'var(--blue)',
  'Foreign capital gains':                 'var(--mint)',
  'Other foreign income':                  'var(--neutral)',
};

/* One hue per income source, fixed to the SOURCE and never to its rank or to
   its position in a list, so a slice keeps its colour as amounts change and as
   other sources come and go.
   Replaces an ORDER array indexed with `idx % PALETTE.length`. That wrapped on
   the label's fixed index, not on how many slices were live, so every label
   past the 11th was permanently identical to one of the first five — Fringe
   Benefits rendered in exactly Employment's emerald on the Income hero for any
   salaried user with a fringe benefit. (The comment that survived the 8->11
   palette expansion said the wrap needed "11 simultaneous non-zero
   categories", which is why the collision outlived the expansion.)
   Unknown labels fall back to the neutral, which reads as unclassified rather
   than impersonating a category.

   KNOWN LIMIT, measured not assumed — the app's category tokens are tuned for
   TEXT contrast, not for telling shapes apart. Checked with the dataviz
   skill's validator (all-pairs, both themes): of the eleven, only five
   (emerald, amber, violet, rose, blue) clear the normal-vision distinctness
   floor against each other. Worst offenders: emerald/mint 2.9 in light
   (Employment vs Capital Gains) and rose/ico-pink 4.8 in dark (Rental vs
   Crypto); navy/violet collapse to 0.5 under protanopia. The assignment above
   fixes what can be fixed without new hues: no two slices of one chart share a
   colour by accident any more, and the ones that do share are declared
   families. Giving all fourteen hero sources a genuinely distinguishable
   colour needs a chart-specific palette and an owner decision. See 06-STAGE-S4.md (E12). Every slice is also directly
   labelled with its name and amount in the legend, so identity is never
   carried by colour alone. */
export function donutColour(label) {
  return INCOME_DONUT_COLOUR[label] || 'var(--neutral)';
}

/* V8.4 II.6: Income at a Glance — broken-out income breakdown */
export function renderIncomeGlance() {
  const elHero = $('income-hero');
  if (!elHero) return;
  const items = APP.incomeItems || [];
  /* S2 Batch 8 (A5): computed once, up front — every source amount below
     must agree with what r.adjGross actually counts, not a parallel sweep
     over APP.incomeItems that can (and did) diverge from it. */
  const r = calcFullTax();
  const sumCat = (cats) => items.filter(i => cats.includes(i.cat)).reduce((s,i)=>s+i.amount, 0);
  const sumCode = (codes) => items.filter(i => codes.includes(i.code)).reduce((s,i)=>s+i.amount, 0);
  const gross = items.reduce((s,i)=>s+i.amount, 0);
  /* A5 divergence: codes 3651/3655/3656 (foreign salary/bonus/commission)
     share cat salary/bonus/commission with LOCAL employment codes, so
     they're inside this sum unless subtracted — the Foreign income chip
     below shows them net of the s10(1)(o)(ii) exemption instead, so they
     must not also sit inside Employment (double count). */
  const employment = sumCat(['salary','bonus','commission','overtime','contractor','director']) - (r.foreignEmpQualifying || 0);
  /* A5 divergence #1/#6: pension/annuity must be the array and NET figure
     the engine actually counts (APP.pensionAnnuityItems via r.pensionAnnuity,
     s10C-reduced) — the engine never reads incomeItems.cat==='pension' for
     this, and a category sweep over incomeItems would show the gross
     captured figure the engine doesn't count, not the net it does. */
  const pensionAnnuity = r.pensionAnnuity || 0;
  const fringe = sumCat(['fringe']);
  const allowances = sumCat(['allowance','travel']);
  const lumpSums = sumCat(['lumpsum']);
  const other = sumCat(['other','equity']);
  /* A5 divergence #4/#5: foreign employment's TAXABLE portion (over the
     s10(1)(o)(ii) exemption) and other foreign income (the catch-all) had
     no chip at all. Combined into one, matching gtiSourceBreakdown()'s
     own "Foreign income" definition (02-core.js) so this and the
     Dashboard's GTI donut can never diverge. The exemption itself is TEI —
     it belongs on the Exempt income card (S2 Batch 11), not duplicated
     here. */
  const foreignTaxable = Math.max(0, (r.foreignEmpQualifying || 0) - (r.foreignEmpExempt || 0)) + (r.foreignOtherIncome || 0);
  const paye = (APP.employerPaye || []).reduce((s,e)=>s+(e.paye||0), 0);
  /* FB1: net-calc buckets — read from appliedValues / APP arrays (#32) */
  const av = APP.appliedValues || {};
  const rentalAmt   = av.rental   || 0;
  const cgtAmt      = av.cgt      || 0;
  const businessAmt = av.business || 0;
  var investAmt = 0; try { investAmt = calcTaxableInvestment(getActiveTaxYear(), calcAgeAtYearEnd()); } catch(e){}
  var twopotAmt = 0, lumpSumAmt = 0; try { var _rr = calcRetirementReceipts(getActiveTaxYear(), calcAgeAtYearEnd()); twopotAmt = _rr.twopotTotal || 0; lumpSumAmt = _rr.lumpSumGross || 0; } catch(e){}
  var cryptoRevAmt = 0, cryptoCgtAmt = 0;
  try { if(typeof cryptoTotals === 'function') { var _ct = cryptoTotals(); cryptoRevAmt = _ct.netRevenue || 0; cryptoCgtAmt = _ct.cgtNet || 0; } } catch(e){}
  const otherReceiptsAmt = (APP.otherReceipts || []).reduce(function(s,i){ return s+(i.amount||0); }, 0);
  /* v8.22 D6: chip-grid with short name + icon + colour + ⓘ full label. Data + click unchanged. */
  /* Batch 2: Gross IRP5/IT3, Rental (net), Business, Crypto Income, Crypto CGT
     and Other Receipts cards removed from this strip per the standardization
     pass — each is still reachable via its own section button. Capital Gains
     is kept (not in the removal list). */
  /* Batch K (#16/#68/#69/#75): filter changed from amt>0 to amt!==0 so a
     business/rental LOSS still shows a chip (styled negative — see
     fmtSigned) and counts toward the "N income types" badge, instead of
     silently vanishing. adjGross (the hero number) already includes these
     losses today — the engine nets them in by default since automatic s20A
     ring-fencing isn't implemented (see renderRentalResult()'s own loss
     warning, 06a-rental.js) — so this is pure re-presentation, not a calc
     change. "Retirement Lump Sum" is a new chip: APP.retirementLumpsums
     (the dedicated Retirement Income entry) was previously invisible here,
     distinct from the IRP5-code-driven "Lump Sums" chip above it. */
  const cells = [
    {full:'Employment Income',         short:'Employment',      amt:employment,      ico:'work',           col:'ico-bg-blue', route:'employment_income'},
    {full:'Foreign income (taxable)',  short:'Foreign income',  amt:foreignTaxable,  ico:'public',           col:'ico-bg-navy', route:'foreign_income'},
    {full:'Pension / Annuity',         short:'Pension/Annuity', amt:pensionAnnuity,  ico:'beach_access',      col:'ico-bg-purple', route:'retirement_income'},
    {full:'Fringe Benefits',           short:'Fringe Benefits', amt:fringe,          ico:'redeem',                col:'ico-bg-teal', route:'employment_income'},
    {full:'Allowances',                short:'Allowances',      amt:allowances,      ico:'payments',     col:'ico-bg-teal', route:'employment_income'},
    {full:'Lump Sums',                 short:'Lump Sums',       amt:lumpSums,        ico:'trending_up', col:'ico-bg-purple', route:'retirement_income'},
    {full:'Retirement Lump Sum',       short:'Retirement Lump Sum', amt:lumpSumAmt,  ico:'trending_up', col:'ico-bg-purple', route:'retirement_income'},
    {full:'PAYE Withheld',             short:'PAYE Withheld',   amt:paye,            ico:'receipt_long',             col:'ico-bg-grey', route:'paye'},
    {full:'Capital Gains', short:'Capital Gains',   amt:cgtAmt,          ico:'trending_up',      col:'ico-bg-orange', route:'cgt'},
    {full:'Investment Income (net)',   short:'Investment',      amt:investAmt,       ico:'show_chart',          col:'ico-bg-blue',   route:'investment_income'},
    {full:'Two-Pot Savings Withdrawal',short:'Two-Pot',         amt:twopotAmt,       ico:'savings',          col:'ico-bg-purple', route:'retirement_income'},
  ].filter(function(c){ return c.amt !== 0; });
  /* Cards removed from the strip above still count toward the hero total and
     the full source-split breakdown below — only the redundant chip tiles
     were trimmed, not the income itself. */
  const allSourceCells = cells.concat([
    {short:'Rental (net)',   amt:rentalAmt,                    col:'ico-bg-teal', route:'rental_income'},
    {short:'Business',       amt:businessAmt,                  col:'ico-bg-green', route:'business_income'},
    {short:'Crypto',         amt:cryptoRevAmt + cryptoCgtAmt,  col:'ico-bg-amber', route:'crypto_income'},
    {short:'Other Receipts', amt:otherReceiptsAmt,             col:'ico-bg-grey', route:'other_income'},
  ]).filter(function(c){ return c.amt !== 0; });
  // ── v8.27 Focus: income summary hero (authoritative total = engine adjGross) ──
  if (elHero) {
    if (r.adjGross > 0) {
      /* A5 divergence #2: "sources" excludes the gross aggregate + PAYE
         (never part of adjGross), AND Lump Sums / Retirement Lump Sum —
         adjGross is built on grossNetOfLumpSums (lump sums excluded; taxed
         separately via the Second Schedule tables, S1 gi/tei), so these
         chips were inflating the breakdown total past the hero's own
         headline whenever a lump sum was captured. Still shown elsewhere
         (the source grid below, and their own Tax balances/Retirement
         cards) — just not counted toward THIS total. */
      const srcCells = allSourceCells.filter(function(c){
        return c.short !== 'Gross IRP5/IT3' && c.short !== 'PAYE Withheld'
            && c.short !== 'Lump Sums' && c.short !== 'Retirement Lump Sum';
      });
      /* Batch 2: wrap ALL captured sources (not just the top 3), so the
         breakdown is legible at a glance without truncation. Each dot wears
         the same donutColour() as its slice in the donut directly above —
         one source, one colour within a card. */
      const breakdown = srcCells.slice().sort(function(a,b){ return b.amt - a.amt; }).map(function(c){
        return '<span class="src-chip" data-src="' + esc(c.short) + '" data-val="' + c.amt + '"' + (c.route ? ' data-route="' + c.route + '" onclick="navigateToCapture(\'' + c.route + '\')" role="button" tabindex="0" style="cursor:pointer"' : '') + '><span class="src-dot" style="background:' + donutColour(c.short) + '"></span>' + esc(c.short) + ' <b' + (c.amt<0?' style="color:var(--er)"':'') + '>' + fmtSigned(c.amt) + '</b></span>';
      }).join('');
      /* Batch K: a business/rental loss is netted into r.adjGross above, so
         say so rather than let the number look unexplained. BACKLOG 16
         (C-85): no "yet" — s20A is not applied by decision (OI-D1b), and
         the loss card says when SARS might apply it. */
      var lossNotes = '';
      if (businessAmt < 0) {
        lossNotes += '<div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> Business loss of ' + fmt(Math.abs(businessAmt)) + ' is included in the total above — the app does not apply SARS ring-fencing (s20A).</div>';
      }
      if (rentalAmt < 0) {
        var _rentalN = (APP.rentalProperties || []).length;
        lossNotes += '<div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> Rental loss of ' + fmt(Math.abs(rentalAmt)) + (_rentalN > 1 ? ' (net across ' + _rentalN + ' properties)' : '') + ' is included in the total above — the app does not apply SARS ring-fencing (s20A).</div>';
      }
      /* QA 2026-08 (§6, Income restructure note 3): the hero is itself
         expandable — a native <details> accordion (the app's existing
         disclosure pattern, e.g. .stmt-row/.calc-card) rather than a
         click-to-navigate div. The summary keeps the always-visible total;
         the source breakdown, loss notes and PAYE note move into the body,
         shown only when expanded. */
      /* B7.5 (D-24) — the hero's head row, rebuilt from
         _mockups/ui-polish-2026-09.html §4: ring, label, chevron, then Kat
         pinned permanently at the card's right edge (supersedes INC-11 on
         Income — D-24 puts Kat here unconditionally, not only once nothing
         is outstanding). The "N income types" pill (INC-8) is gone — there
         is no pill to fit, so its old nowrap/min() sizing is cancelled with
         it, not tuned.

         QA 2026-08 (§6 rev 3, note 3 adapted): the mockup's 3-segment
         PAYE/provisional/owing ring doesn't map onto the Income hero — here
         it shows the Income page's own semantics, captured vs still
         outstanding income types. Reuses the existing dashboard-completeness
         ring markup/CSS (.dcomp-ring*, 08-dashboard-theme.js) rather than
         inventing a second ring technique; counts come from
         getIncomeSelectorCounts() so this can never disagree with the
         selector groups it is summarising. */
      var counts = getIncomeSelectorCounts();
      var ringPct = counts.total > 0 ? Math.round((counts.captured / counts.total) * 100) : 0;
      var C = 2 * Math.PI * 20;
      var ringHtml = counts.total > 0
        ? '<div class="dcomp-ringwrap inc-hero-ring" title="' + counts.captured + ' of ' + counts.total + ' income types captured">'
          + '<svg class="dcomp-ring" viewBox="0 0 48 48" aria-hidden="true">'
          + '<circle cx="24" cy="24" r="20" class="dcomp-ring-bg"></circle>'
          + '<circle cx="24" cy="24" r="20" class="dcomp-ring-fg"'
          + ' style="stroke:var(--ico-mint,var(--accent));stroke-dasharray:' + C.toFixed(1) + ';stroke-dashoffset:' + (C * (1 - ringPct / 100)).toFixed(1) + '"></circle>'
          + '</svg><span class="dcomp-ring-pct">' + counts.captured + '/' + counts.total + '</span></div>'
        : '';
      /* INC-9: the expanded donut. Chart segments are exempt from D-19 (that
         rule governs TILES) — a breakdown must distinguish its slices, so it
         keeps a multi-hue categorical ramp. donutColour() (below this
         function) fixes each income type to one hue regardless of amount, so
         the same source is always the same colour across renders even
         though the legend itself lists larger amounts first. */
      var donutSegments = srcCells.slice().sort(function(a,b){ return b.amt - a.amt; })
        .filter(function(c){ return c.amt > 0; })
        .map(function(c){
          return { label: c.short, val: c.amt, color: donutColour(c.short) };
        });
      var donut = donutHtml(donutSegments, { size: 76 });
      /* S2 Batch 10 (A7): the collapsed summary shows total income, PAYE
         paid and foreign income together — not just the total, with the
         other two buried in the expanded body. Both figures are the exact
         same ones the expanded view already uses (paye, foreignTaxable),
         so this can never disagree with the breakdown below it. */
      var subStats = [];
      if (paye > 0) subStats.push('<span class="inc-hero-substat" data-stat="paye" data-val="' + paye + '">' + fmt(paye) + ' PAYE paid</span>');
      if (foreignTaxable > 0) subStats.push('<span class="inc-hero-substat" data-stat="foreign" data-val="' + foreignTaxable + '">' + fmt(foreignTaxable) + ' foreign income</span>');
      var subStatsHtml = subStats.length ? '<div class="inc-hero-substats">' + subStats.join('') + '</div>' : '';
      elHero.innerHTML = '<details class="dhero-acc" id="income-hero-acc"' + (APP._incomeHeroOpen ? ' open' : '') + ' ontoggle="APP._incomeHeroOpen=this.open">'
        + '<summary class="dhero bl inc-hero">'
        + '<div class="inc-hero-l1">'
        + ringHtml
        + '<span class="inc-hero-lab">Income captured</span>'
        + '<i class="material-symbols-outlined msi-expand-more dhero-tri"></i>'
        + katHtml('celebrating', 30)
        + '</div>'
        + '<div class="inc-hero-l2"><div class="dhero-num" data-count="' + (r.adjGross) + '" data-count-key="income-total">' + fmt(r.adjGross) + '</div></div>'
        + subStatsHtml
        + '</summary>'
        + '<div class="dhero-detail">'
        + (donut ? '<div class="inc-hero-donut">' + donut + '</div>' : '')
        + '<div class="src-wrap">' + (breakdown || 'Income captured') + '</div>'
        + lossNotes
        + (paye > 0 ? '<div class="paye-withheld-note" data-val="' + paye + '" style="font-size:var(--fs-xs);color:var(--tx3);margin-top:7px;border-top:1px solid var(--bd);padding-top:9px"><span class="mono">' + fmt(paye) + '</span> <strong>PAYE already withheld</strong></div>' : '')
        + '<div class="jump-link" onclick="event.stopPropagation();navigateTo(\'summary\',\'return\')"><i class="material-symbols-outlined msi-arrow-forward"></i> Open Tax Return</div>'
        + '</div>'
        + '</details>';
    } else {
      elHero.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')">'
        + '<div class="dhero-top"><div class="dhero-lbl">Income captured</div></div>'
        + '<div class="dhero-num" data-count="' + (0) + '" data-count-key="income-total">' + fmt(0) + '</div>'
        + '<div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No income captured yet — add your IRP5, investments or other sources below.</div>'
        + '</div>';
    }
  }
}

/* S2 Batch 11 (final spec, Gate 2 Q7, Allan 2026-09-19): four cards, in
   this exact order — Gross income, Foreign income, Taxable income, Exempt
   income — replacing "Local vs foreign" / the old "Taxable income" (with
   a fabricated, non-data-bound line graph, audit B5) / "Income split"
   (renderIncomeGlanceBottom's chip2, removed there). Every figure comes
   from calcFullTax() or its canonical breakdown helpers (giSourceBreakdown/
   foreignIncomeBreakdown/teiBreakdown, 02-core.js) — none re-derived here. */
export function renderIncomeMiniCards() {
  var el = $('income-mini-cards'); if (!el) return;
  var r = calcFullTax();
  if (!r.adjGross) { el.innerHTML = ''; return; }
  var totalDed = (r.retAllowed || 0) + (r.otherDed || 0) + (r.donAllowed || 0) + (r.additionalDed || 0);
  var lossSetOff = Math.max(0, (r.pyLoss || 0) - (r.lossUnabsorbed || 0));

  function bodyRows(items) {
    return items.map(function(c){
      return '<div class="mini-row" data-src="' + esc(c.label) + '" data-val="' + c.val + '"><span>' + esc(c.label) + '</span><span class="v"' + (c.val < 0 ? ' style="color:var(--er)"' : '') + '>' + fmtSigned(c.val) + '</span></div>';
    }).join('');
  }
  function card(lbl, raw, body) {
    return '<details class="mini-card" data-card="' + esc(lbl) + '" data-raw="' + raw + '">'
      + '<summary><div><div class="mini-name">' + esc(lbl) + '</div><div class="mini-val">' + fmt(raw) + '</div></div>'
      + '<i class="material-symbols-outlined msi-expand-more mini-chev"></i></summary>'
      + '<div class="mini-body">' + body + '</div></details>';
  }

  var html = '';

  /* 1. Gross income — every GI source, INCLUDING TEI-bearing ones at
     their gross figure (contrast with the Dashboard's GTI donut, S2
     Batch 5, which nets those out). A business/rental loss can't be a
     donut slice (same "no chart on a negative intermediate" rule as
     Batch 5) — chart skipped, not just the negative slice, whenever one
     exists, so the remaining positive slices never oversum the total. */
  var giItems = giSourceBreakdown(r);
  var giHasLoss = giItems.some(function(c){ return c.val < 0; });
  var giDonut = giHasLoss ? '' : donutHtml(giItems.map(function(c){ return { label: c.label, val: c.val, color: donutColour(c.label) }; }), { size: 70 });
  html += card('Gross income', r.gi, bodyRows(giItems) + giDonut);

  /* 2. Foreign income — collapsed is the TAXABLE portion (post-exemption),
     pinned at Gate 2 after being ambiguous in the draft. Cross-category
     overlay (interest/dividends/rental/business/employment/CGT can each
     be foreign), so this total is not itself a GI/GTI component and only
     needs to sum to itself, not to adjGross. */
  var fiItems = foreignIncomeBreakdown(r);
  var fiTotal = fiItems.reduce(function(s, c){ return s + c.val; }, 0);
  if (fiTotal > 0) {
    var fiDonut = donutHtml(fiItems.map(function(c){ return { label: c.label, val: c.val, color: donutColour(c.label) }; }), { size: 70 });
    html += card('Foreign income', fiTotal, bodyRows(fiItems) + fiDonut);
  }

  /* 3. Taxable income — GI − TEI = GTI (must agree with the Income hero's
     own collapsed total, S2 Batch 8/10 — same r.adjGross field) − total
     deductions [− assessed loss] = TI. No chart: a subtraction chain, per
     the chart rule. Line graph removed (was hardcoded, no data binding). */
  html += card('Taxable income', r.taxableIncome,
    '<div class="mini-row"><span>Gross income (GI)</span><span class="v">' + fmt(r.gi) + '</span></div>'
    + '<div class="mini-row"><span>Less tax-exempt income (TEI)</span><span class="v">−' + fmt(r.tei) + '</span></div>'
    + '<div class="mini-row" style="font-weight:600"><span>Income captured (GTI)</span><span class="v">' + fmt(r.adjGross) + '</span></div>'
    + '<div class="mini-row"><span>Less total deductions</span><span class="v">−' + fmt(totalDed) + '</span></div>'
    + (lossSetOff > 0 ? '<div class="mini-row"><span>Less assessed loss</span><span class="v">−' + fmt(lossSetOff) + '</span></div>' : '')
    + '<div class="mini-row" style="font-weight:600"><span>Taxable income</span><span class="v">' + fmt(r.taxableIncome) + '</span></div>');

  /* 4. Exempt income (new, Allan 2026-09-19) — every tei component its
     own line, not summed silently. No chart specified. */
  var memoItems = exemptMemoBreakdown(r);
  if (r.tei > 0 || memoItems.length) {
    /* INC-20: exempt amounts that are in neither gi nor tei sit under the total, apart,
       so the rows above still add up to it. data-memo-val, not data-val: the casting
       check sums data-val rows to the total. */
    var memoRows = memoItems.length
      ? '<div class="mini-memo-head">Also exempt \u2014 not counted in the total above</div>'
        + memoItems.map(function(c){ return '<div class="mini-row mini-memo" data-memo="' + esc(c.label) + '" data-memo-val="' + c.val + '"><span>' + esc(c.label) + '</span><span class="v">' + fmt(c.val) + '</span></div>'; }).join('')
      : '';
    html += card('Exempt income', r.tei, bodyRows(teiBreakdown(r)) + memoRows);
  }

  el.innerHTML = html;
}

/* Batch 2 — "Total gross capital gains" and "Capital gains in taxable
   income" cards, on the Income main "At a glance" panel. Both read
   cgtAggregate() (06b-cgt.js) — the same function renderCgtResult() calls
   for the CGT sub-page itself, so this can never diverge from the real CGT
   base. The "primary residence" bucket is the NET remainder after the
   per-asset s45 exclusion already applied inside cgtAggregate() (usually
   zero) — shown as its own category rather than re-subtracted a second time
   in the taxable-income card below, which would double-count the exclusion. */
export function renderIncomeCgtGlanceCards() {
  const el = $('income-cgt-glance-cards'); if (!el) return;
  const elCard = $('income-cgt-card');
  const agg = cgtAggregate();
  if (agg.totalGrossByCategory === 0 && agg.netGain === 0) {
    el.innerHTML = '';
    if (elCard) elCard.hidden = true;
    return;
  }
  if (elCard) elCard.hidden = false;
  el.innerHTML = '<details style="margin-top:12px" open>'
    + '<summary style="cursor:pointer;font-size:0.75rem;color:var(--lnk);text-decoration:underline;user-select:none">Total gross capital gains</summary>'
    + '<div style="margin-top:6px">'
    + '<div class="sum-line"><span class="lbl">CGT — general disposals</span><span class="val">' + fmt(agg.general) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">CGT — primary residence (net of s45 exclusion)</span><span class="val">' + fmt(agg.primaryRes) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Crypto capital disposals</span><span class="val">' + fmt(agg.cryptoCgt) + '</span></div>'
    + '<div class="sum-line divider total"><span class="lbl">Total gross capital gains</span><span class="val">' + fmt(agg.totalGrossByCategory) + '</span></div>'
    + '</div></details>'
    + '<details style="margin-top:8px">'
    + '<summary style="cursor:pointer;font-size:0.75rem;color:var(--lnk);text-decoration:underline;user-select:none">Capital gains in taxable income</summary>'
    + '<div style="margin-top:6px">'
    + '<div class="sum-line"><span class="lbl">Net capital gains (all categories, primary residence already excluded)</span><span class="val">' + fmt(agg.netGain) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Less: annual exclusion</span><span class="val">− ' + fmt(Math.min(agg.annualExcl, Math.abs(agg.netGain))) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Less: capital losses carried forward</span><span class="val">− ' + fmt(Math.min(agg.cgtLossBf, Math.max(0, agg.aggAfterExcl))) + '</span></div>'
    + '<div class="sum-line divider"><span class="lbl">Net capital gain after allowances</span><span class="val">' + fmt(agg.afterExcl) + '</span></div>'
    + '<div class="sum-line total"><span class="lbl">× ' + (agg.inclusionRate*100).toFixed(0) + '% inclusion = taxable capital gain</span><span class="val">' + fmt(agg.taxableGain) + '</span></div>'
    + '</div></details>';
}

/* Batch C2 — bottom at-a-glance strip for the Income Main tab.
   Chip 1: running tax estimate (live, navigates to summary on tap).
   Chip 2: income source split bar (proportional coloured segments).
   Uses the existing .gc/.glance-cards design + .ob-pop info-btn popovers. */
/* S2 Batch 11: this strip's one remaining chip ("Income Split", a
   source-breakdown bar) is removed — the new Gross income card
   (renderIncomeMiniCards()) already shows the same breakdown as a donut,
   and having both is drift risk, not redundancy for clarity, per the same
   reasoning INC-9 already applied to this strip's other two chips. */
export function renderIncomeGlanceBottom() {
  const el = $('income-glance-bottom');
  if (!el) return;
  el.innerHTML = '';
}

/* Glyph and colour per income type, for the outstanding lists. */
/* QA 2026-09 round 2: Retirement income -> holiday (beach_access — already
   the app's "getaway"-coded glyph), Business & Trade -> storefront, Other
   Income -> money. */
const _INCOME_CHIP_META = {
  employment_income:  { label: 'Employment Income',   icon: 'badge',           col: 'ico-bg-blue' },
  investment_income:  { label: 'Investment Income',   icon: 'finance_mode',         col: 'ico-bg-mint' },
  rental_income:      { label: 'Rental Income',       icon: 'home',              col: 'ico-bg-green' },
  retirement_income:  { label: 'Retirement Income',   icon: 'beach_access',    col: 'ico-bg-pink' },
  business_income:    { label: 'Business & Trade',    icon: 'storefront',   col: 'ico-bg-purple' },
  cgt:                { label: 'Capital Gains',        icon: 'arrow_split',     col: 'ico-bg-amber' },
  crypto_income:      { label: 'Crypto / Digital',    icon: 'currency_bitcoin',       col: 'ico-bg-orange' },
  other_income:       { label: 'Other Income',        icon: 'money',              col: 'ico-bg-grey' },
};

/* QR2 (2026-09-28): renderIncomeProfileGuidance() (a collapsed chip row of the
   user's income types) was removed. Its target element, #income-profile-guidance,
   was not in body.html, so every call was a silent no-op (found by QR0.4); it
   also carried its own tab map that disagreed with the outstanding list
   (Employment: main vs b1employment) — CAPTURE_ROUTES is the one map now. */

/* V8.5, extended by EMP-3 (§L.8): when the user picks a source code in the
   Add Income modal, suggest the matching deduction — the second of EMP-3's
   two surfaces (the first, CODE_SUGGESTIONS on captured rows below, already
   covered most of these). Every `ded` code here is DEDUCTION_DEFS' own
   `code` field (01-data.js), never re-typed — 4001/4003/4006 (retirement),
   4005 (medical), 4015 (travel), 4016 (professional subscriptions), 4017
   (subsistence), 4027 (tools & equipment), 4028 (home office).

   3817/3825/3828 are employer RETIREMENT fringe-benefit codes, not medical —
   verified against source (OD-25) after the second QA pass mismapped them.
   3704 is genuinely a Subsistence code and 3722 genuinely a Travel one
   (Reimbursive Travel — Taxable Excess) per IRP5_INCOME's own descriptions —
   the reverse of how EMP-3's finding table grouped this pair; ground truth
   here is the app's own source-code table, not the finding. 3616/3606
   (independent contractor / commission) point at three deductions at once,
   so they take a plain-text tip rather than this map's single "Code X"
   shape. */
export function onIncomeCodeChange() {
  const tip = $('income-code-tip'); if(!tip) return;
  const code = gs('add-income-code');
  /* QR4.5: the tip, the captured-row suggestion and the deduction pills read ONE
     table — INCOME_DEDUCTION_LINKS (01-data.js). No map of codes lives here. */
  const note = incomeDeductionNoteFor(code);
  tip.innerHTML = note
    ? `<div class="note info"><i class="material-symbols-outlined msi-lightbulb u-mr-6"></i><strong>Tip:</strong> ${note} Capture it under <strong>Deductions</strong>.</div>`
    : '';
  /* S3 Batch 6 (C8): foreign-employment codes (3651/3655/3656 — IRP5_INCOME's
     'Foreign Service' group; checked by group, not a second hardcoded code
     list, so this can never drift from the picker's own data) are commonly
     paid in a foreign currency — offer the same conversion widget pension/
     rental/business/IT3(b) already have (fxWidgetHtml/fxApply, 00-forms.js/
     02-core.js), gated to only those codes. */
  const isForeignEmp = IRP5_INCOME.some(x => x.code === code && x.group === 'Foreign Service');
  showFxWidgetFor('add-income-amount', isForeignEmp);
}

/* V8.4 II.3: Multiple employer PAYE/UIF entries */
/* Employer PAYE CRUD is provided by M_employerPaye in 05-list-modules.js. */

export function renderEmployerPaye() {
  const el = $('employer-paye-list');
  const items = APP.employerPaye || [];
  // v8.27 Focus: PAYE & UIF hero (always visible, empty state at R0)
  const heroEl = $('hero-paye');
  if(heroEl) {
    const totalPaye = items.reduce((s,e)=>s+(e.paye||0), 0);
    const totalUif = items.reduce((s,e)=>s+(e.uif||0), 0);
    if(totalPaye > 0 || items.length) {
      /* S3 Batch 9 (C11): "x employers" chip removed and the label loses
         its dot (dhero-lbl-nodot, same modifier the Deductions tax-benefit
         hero already uses) — with the chip gone the label is the sole
         .dhero-top child, so it reads full width by the same flex
         mechanics as that precedent, no extra CSS needed. The multi-
         employer note that used to live here moved out of the hero
         entirely — see the D9 block below, now placed after the captured
         rows instead of above them. */
      heroEl.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
        + '<div class="dhero-top"><div class="dhero-lbl dhero-lbl-nodot">Total PAYE withheld</div></div>'
        + '<div class="dhero-num" data-count="' + (totalPaye) + '" data-count-key="paye-total">' + fmt(totalPaye) + '</div>'
        + '<div class="dhero-break"><i class="material-symbols-outlined msi-check-circle" style="color:var(--au)"></i> Credited against your tax'
        + (totalUif > 0 ? ' \u00b7 <span class="mono">' + fmt(totalUif) + '</span> UIF (info only)' : '') + '</div>'
        + '</div>';
    } else {
      heroEl.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="addEmployerPaye()">'
        + '<div class="dhero-top"><div class="dhero-lbl dhero-lbl-nodot">Total PAYE withheld</div></div>'
        + '<div class="dhero-num" data-count="' + (0) + '" data-count-key="paye-total">' + fmt(0) + '</div>'
        + '<div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No employer PAYE yet \u2014 add each IRP5 below so the tax already withheld is credited to you.</div>'
        + '</div>';
    }
  }
  if(!el) return;
  if(!items.length) {
    /* S3 Batch 9 (C11): the "Without a PAYE entry…" empty-state card that
       used to render here is gone — it duplicated the empty hero's own
       "No employer PAYE yet — add each IRP5 below" message immediately
       above (both shown only when items.length is 0), a second copy of
       the same point rather than new information. (DIP-1/5, INC-10 §L.6
       already dropped this card's own add-CTA for the identical reason.) */
    el.innerHTML = ''; return;
  }
  /* S3 Batch 9 (C11): name on its own line, amount(s) on the line below —
     the old single-line `<strong>name</strong> — PAYE x · UIF y` used the
     shared .item-desc class (white-space:nowrap + ellipsis, still needed
     by the other lists that class serves), which truncated a long
     employer name and its amount together with no way to read the tail. */
  el.innerHTML = items.map((e, idx) =>
    `<div class="item-row">
      <div class="item-desc-stack">
        <div class="item-desc-name">${esc(e.name)}</div>
        <div class="item-desc-amt">PAYE ${fmt(e.paye)}${e.uif>0?' \u00b7 UIF '+fmt(e.uif)+' (info)':''}</div>
      </div>
      <button class="item-remove" onclick="editEmployerPaye(${idx})" aria-label="Edit"><i class="material-symbols-outlined msi-edit"></i></button>
      <button class="item-remove del" onclick="removeEmployerPaye(${idx})" aria-label="Remove"><i class="material-symbols-outlined msi-delete"></i></button>
    </div>`).join('')
    /* D9 (verbatim, owner-approved text) — moved out of the hero (it used
       to sit above the captured rows) to below them instead; the employer
       count interpolates via items.length. Same one-per-two-employers
       threshold as before — nothing to reconcile against for one. */
    + (items.length > 1
      ? noteHtml('info', items.length + ' employers: PAYE is often short of the tax due.', 'You had ' + items.length + ' employers this year. Each employer withholds PAYE as if its salary were your only income, so each applies a lower tax rate than your combined income attracts. As a result, total PAYE withheld is often less than the tax due on your combined income. This is normal and is included in your tax payable calculation.', { style: 'margin-top:8px', title: 'More than one employer' })
      : '');
}

/* V8.4 II.6: Hook into renderAll — replace old renderIncomeStats with renderIncomeGlance */
/* C4-VISIBILITY-002 (2026-07-29 follow-up): renderAccordion1Buttons() removed —
   it duplicated Employment/Investment/PAYE/Retirement navigation, amounts and
   status that renderIncomeSelector() (B2, 01-SPEC.md §4.2) already shows for
   all ten income sources on the same page. Dead since B2 shipped; #acc1-nav-buttons
   removed from body.html in the same change. */
export function renderIncomeStats() { renderIncomeGlance(); renderIncomeMiniCards(); renderIncomeSelector(); renderEmployerPaye(); renderOutstandingBottom(); }

/* Accordion 2: manual income sub-page tiles (Batch M: restyled to match the
   deduction selection tiles — icon, label, amount, toggle, Active/Available
   split). Investment and Retirement are covered by Accordion 1 links; this
   grid shows the net-calculator income types only. The "toggle" has no
   independent on/off state (unlike deductions) — income types are "active"
   purely from having records, so it's a navigation affordance, not a flag. */
/* ── B2 Simplification: the income selector (01-SPEC.md §4.2, P9) ──

   Replaces renderIncomeManualTiles(), which listed five "manually entered"
   sources inside a seg panel. All TEN income sources are now listed on the
   main page, always, none hidden behind a reveal button — a user cannot
   declare income they cannot see (items 5, 33, 34).

   Grouped: "Still to add" (declared in setup, nothing captured yet) → "On" →
   "Off". The first group is getIncomeOutstanding()'s own list, so this page
   and the Dashboard can never disagree about what is outstanding. QA 2026-08
   rev 3: "Still to add" now renders into its own DOM slot ahead of the hero
   while "Completed"/"Off" render lower down — see renderIncomeSelector().

   Toggle semantics differ by row, deliberately:
   - Eight rows map to an INCOME_TYPE_DEFS value and are WRITE-THROUGH via
     setIncomeType() — the proxy contract in 02-core §2.1. They carry
     data-income-type, never name="income-type".
   - Foreign income and PAYE have no profile answer to write to
     (neither is an INCOME_TYPE_DEF — "foreign" exists only as a subtype of
     business/rental/CGT). Their toggle stays a read-only status light, as
     every row's was before this batch, and the row still navigates. */
/* QA 2026-08 (§6 rev 3): the ROWS/_on/_todo classification used to live
   only inside renderIncomeSelector(). The income hero's ring (see
   renderIncomeGlance) needs the same "how many applicable income types are
   captured vs still outstanding" ratio — factored out here so both callers
   read one derivation of "applicable income type" rather than the hero
   re-deriving it. */
export function getIncomeSelectorCounts() {
  var ROWS = incomeSelectorRows().ROWS;
  var captured = ROWS.filter(function(r){ return r._on && !r._todo; }).length;
  var todo = ROWS.filter(function(r){ return r._todo; }).length;
  return { captured: captured, todo: todo, total: captured + todo };
}

/* The PAYE row's withholding note — owner decision 6.6, approved verbatim,
   split in two by B7.3/D-12. The row's own note is now the brief's short
   sentence; the full original text survives as PAYE_WITHHOLDING_CAUTION,
   still doing the two jobs that need its weight: the switch's aria-label
   and the body of the untoggle confirmation dialog — a row note is read at
   a glance, but a confirmation the user must act on keeps the fuller
   warning. */
export const PAYE_WITHHOLDING_NOTE = 'Your employer should have paid PAYE to SARS.';
export const PAYE_WITHHOLDING_CAUTION = 'Your employer should have withheld PAYE on employment income and paid it to SARS. Only switch this off if you are certain none was withheld.';

function incomeSelectorRows() {
  var av = APP.appliedValues || {};
  var selected = getSelectedIncomeTypes();

  /* nav tab → true when the bucket holds records. */
  function active(tab) { try { return incomeBucketActive(tab); } catch(e) { return false; } }

  var ROWS = [
    { tab:'b1employment', type:'employment_income', label:'Employment',        icon:'work',       colour:'ico-bg-blue',
      amt:function(){ return (APP.incomeItems||[]).reduce(function(s,i){ return s+(i.amount||0); },0); } },
    { tab:'paye',         type:null,                label:'PAYE',  icon:'credit_score', colour:'ico-bg-blue',
      amt:function(){ return (APP.employerPaye||[]).reduce(function(s,i){ return s+(i.paye||0); },0); },
      activeOverride:function(){ return !!(APP.employerPaye && APP.employerPaye.length); } },
    /* A6: av.investment is never written — commitPending('interest')
       (the it3b module's actual applyType) writes appliedValues.interest,
       a different key, so this always read 0. renderIncomeGlance()'s own
       Investment chip already gets this right by calling
       calcTaxableInvestment() directly instead of reading a cached
       appliedValues key at all — same fix here. */
    { tab:'b2investment', type:'investment_income', label:'Investment income', icon:'finance_mode',     colour:'ico-bg-mint',
      amt:function(){ try { return calcTaxableInvestment(getActiveTaxYear(), calcAgeAtYearEnd()) || 0; } catch(e){ return 0; } } },
    { tab:'b3rental',     type:'rental_income',     label:'Rental',            icon:'home',          colour:'ico-bg-green',
      amt:function(){ return av.rental || 0; } },
    { tab:'b4business',   type:'business_income',   label:'Your own business', icon:'storefront',      colour:'ico-bg-purple',
      amt:function(){ return av.business || 0; } },
    { tab:'b5cgt',        type:'cgt',               label:'Capital gains & losses',   icon:'arrow_split', colour:'ico-bg-amber',
      amt:function(){ return av.cgt || 0; } },
    /* A6: av.retirementReceipts is never written anywhere (verified via
       grep — no assignment exists in src/), so this row always read 0
       regardless of what was captured. Sum what's actually captured
       instead: pension/annuity gross (APP.pensionAnnuityItems) plus the
       same lump-sum/two-pot totals renderIncomeGlance() already computes
       via calcRetirementReceipts(). */
    { tab:'b7retirement', type:'retirement_income', label:'Retirement income', icon:'beach_access',     colour:'ico-bg-pink',
      amt:function(){
        var pensionGross = (APP.pensionAnnuityItems||[]).reduce(function(s,p){ return s+(p.amount||0); },0);
        var rr = calcRetirementReceipts(getActiveTaxYear(), calcAgeAtYearEnd());
        return pensionGross + (rr.lumpSumGross||0) + (rr.twopotTotal||0);
      } },
    /* A6: av.foreign was retired (engine-remediation W9 — the s6quat
       credit moved to a single calcFullTax() output) but this row was
       never updated to match, so it always read 0. _foreignIncomeTotal()
       (02-core.js) is the same one-source-of-truth collector the engine
       itself uses, and what dashChecklist()'s own bucket-6 status already
       reads instead of the retired field. */
    { tab:'b6foreign',    type:null,                label:'Foreign income',    icon:'public',          colour:'ico-bg-teal',
      amt:function(){ return _foreignIncomeTotal(); } },
    { tab:'b10crypto',    type:'crypto_income',     label:'Crypto',            icon:'currency_bitcoin',   colour:'ico-bg-orange',
      amt:function(){ try { var ct=(typeof cryptoTotals==='function')?cryptoTotals():null;
                            return ct ? (ct.netRevenue||0)+(ct.cgtNet||0) : 0; } catch(e){ return 0; } } },
    { tab:'b9other',      type:'other_income',      label:'Other money you received', icon:'money', colour:'ico-bg-grey',
      amt:function(){ return (APP.otherReceipts||[]).reduce(function(s,i){ return s+(i.amount||0); },0); } }
  ];

  /* "Still to add" is getIncomeOutstanding()'s list, keyed by its nav tab. */
  var todo = {};
  try { getIncomeOutstanding().forEach(function(o){ todo[o.nav[1]] = true; }); } catch(e) {}

  ROWS.forEach(function(r) {
    r._active = r.activeOverride ? r.activeOverride() : active(r.tab);
    r._on = r._active || (r.type && selected.indexOf(r.type) >= 0);
    r._todo = !!todo[r.tab];
  });

  /* Phase 1 (G3): PAYE is not an independent choice. If you have employment
     income your employer withheld PAYE, so the two belong together — the row
     is forced on and locked while Employment is on. Without this the PAYE row
     read "Off" for a salaried user until they happened to add an employer
     record, which is exactly backwards: PAYE is the thing they most need to
     capture to see a refund. The row already sits directly beneath Employment
     in ROWS, which is where the feedback asked for it. */
  var _emp  = ROWS.filter(function(r){ return r.tab === 'b1employment'; })[0];
  var _paye = ROWS.filter(function(r){ return r.tab === 'paye'; })[0];
  if (_emp && _paye && _emp._on) {
    /* QA 2026-08 (B2-BUG-5): PAYE used to jump straight to the captured group
       the moment Employment was on, so a salaried user saw it sitting under
       "Completed" having entered nothing. It now stays in "Still to add" until
       an amount actually exists, and only then moves across — the same rule
       every other row follows.
       Some employers genuinely withhold nothing, and for them an item that can
       never be completed is a permanent false outstanding. The confirmation
       below is the way out: it takes the row off the list entirely. */
    /* A captured PAYE amount contradicts the confirmation, so it wins. */
    if (APP.noPayeConfirmed && _paye.amt() > 0) APP.noPayeConfirmed = false;
    if (APP.noPayeConfirmed) {
      _paye._on = false;
      _paye._todo = false;
      _paye._lockedOn = false;
      _paye._noPaye = true;
    } else {
      _paye._on = true;
      _paye._lockedOn = true;
      _paye._todo = _paye.amt() <= 0;
    }
  }

  /* B7.1 (INC-1/IEM-3) — the Foreign Income row's full 2×2, rewritten after
     the original crossed declared × captured × attested into a dead end:
     declared-but-not-yet-captured left `_on` false, so the row read "Still
     to add" but never switched on, and its nav pill (updateIncomeTabs()
     below) never appeared either — a switched-on row with nowhere to go.

     declared (APP.foreignIncomeYN, the profile answer — Foreign is a
     SUBTYPE of business/rental/CGT/IT3(b), never its own INCOME_TYPE_DEF,
     but the profile question exists all the same) crossed with captured
     (the row's own `_active`, i.e. incomeBucketActive('b6foreign') — true
     once any foreign sub-type actually has an amount):

       declared, captured       -> on; Still to add until attested (INC-3)
       declared, !captured      -> on; Still to add (nothing to attest yet)
       !declared, captured      -> on; Completed directly, no checkbox (INC-4)
       !declared, !captured     -> row does not appear at all (INC-2)

     `_on` (the row switches on) now follows "declared or captured" — the
     user said yes, or there is data, either is enough to show the row as
     active. `_todo` (Still-to-add grouping) follows "declared and not yet
     attested" regardless of capture state, since attestation is the one
     completion signal for a declared foreign income, not capture. */
  var _foreign = ROWS.filter(function(r){ return r.tab === 'b6foreign'; })[0];
  if (_foreign) {
    var fDeclared = APP.foreignIncomeYN === 'yes';
    var fCaptured = _foreign._active;
    if (!fDeclared && !fCaptured) {
      ROWS.splice(ROWS.indexOf(_foreign), 1);
    } else {
      _foreign._declared = fDeclared;
      _foreign._captured = fCaptured;
      _foreign._on = fDeclared || fCaptured;
      _foreign._todo = fDeclared && !APP.foreignIncomeAttested;
    }
  }

  /* INC-3's own attestation checkbox — only when declared, since it asks
     the user to confirm "all foreign income has been captured", which has
     nothing to confirm when nothing was ever declared (INC-4's row skips it
     entirely). B7.1: shown whenever declared, not only once something is
     captured — the checkbox is the *completion* signal for a declared
     foreign income, not a reward for having captured something first. Same
     stopPropagation idiom as payeNote's checkbox below. */
  function foreignNote(r) {
    if (!r._declared) return '';
    /* B7.2 (INC-3): checkbox at the leading edge, outside the amber note
       text — an explicit id/for pair (hard rule 11) rather than the old
       wrap-the-input-in-a-label idiom, copy shortened to fit one line at
       360px. */
    return '<div class="ded-tile-note foreign-attest" onclick="event.stopPropagation()">'
      + '<input type="checkbox" id="foreign-attest-cb"' + (APP.foreignIncomeAttested ? ' checked' : '') + ' onchange="toggleForeignAttested(this.checked)">'
      + '<label for="foreign-attest-cb">I\'ve captured all foreign income</label></div>';
  }

  /* The PAYE row's own note, including the "my employer withheld nothing"
     confirmation. Checkbox clicks must not bubble into the row's navigate
     handler, hence the stopPropagation on the label. */
  function payeNote(r) {
    /* B7.3 (D-12): the note runs edge to edge under a top border
       (.paye-note-block, main.css) — same treatment whether it is the
       withholding note or the confirmed-off text below. */
    if (r._noPaye) {
      return '<div class="ded-tile-note paye-note-block">You confirmed no PAYE was withheld. '
        + '<button type="button" class="btn-link" onclick="event.stopPropagation();confirmNoPaye(false)">Undo</button></div>';
    }
    /* A11Y-3 / decision 6.6: the withholding note is rendered HERE, visibly,
       rather than on a title= attribute the WebView drops on the floor. */
    var withholding = r._lockedOn
      ? '<div class="ded-tile-note paye-note-block">' + esc(PAYE_WITHHOLDING_NOTE) + '</div>' : '';
    /* S3 Batch 13 (D3): once an amount is captured, the reminder to expect
       PAYE has done its job — showing it forever after reads as the app
       still waiting on something the user already did. Only shown while
       still outstanding (the branch below, alongside the "no PAYE was
       withheld" confirmation checkbox). */
    if (!r._todo) return '';
    /* ROW-20 (§L.8): "Nothing captured yet" removed here too. B7.3: the
       checkbox sits on its own line beneath the note, copy revised to read
       as a confirmation ("I confirm...") rather than a statement of fact. */
    return withholding
      + '<div class="ded-tile-note paye-confirm-row" onclick="event.stopPropagation()">'
      + '<input type="checkbox" id="paye-none-cb" onchange="confirmNoPaye(this.checked)">'
      + '<label for="paye-none-cb">I confirm my employer withheld no PAYE</label></div>';
  }

  function row(r) {
    var amt = r.amt();
    var tip = (r.type && INCOME_TYPE_DEFS.filter(function(d){ return d.value===r.type; })[0] || {}).tip;
    return selectorRow({
      icon: r.icon,
      /* ICON-22 (§L.7 step 4a; owner decision OD-2) — the three-state row
         icon. The ico-bg-* palette is DOCUMENTED as the category system
         (main.css: .ico-bg-blue = PAYE, .ico-bg-green = Income,
         .ico-bg-purple = Deductions), but the per-row assignments never
         followed it: Employment wore PAYE's blue, Investment and Foreign wore
         the Dashboard's cyan, Business wore Deductions' violet, CGT and Crypto
         wore Tax Balances' amber. 15 of the 19 selector rows across income and
         deductions carried a colour belonging to some other area.

         This also closes ICON-1. The QA complaint was that the retirement icon
         "doesn't read well in dark mode" — the row was painted the WRONG
         COLOUR, and tuning its contrast would only have made a wrong colour
         more legible.

         D-19 (UI/UX polish 2026-09, round 2): one colour per page, app-wide,
         no exceptions — PAYE no longer gets its own category on the Income
         page. `.mode-panel[data-area]:not([data-area="dashboard"])
         [class*="ico-bg-"][class]` (main.css) forces --ico-c to the page's
         --area-accent regardless of which ico-bg-* class is named here, so
         the three-branch conditional this used to be was dead: every branch
         rendered identically. A single constant class documents that
         truth — the override is what supplies the actual hue. "Still to
         add" status rides solely on the row's own amber outline
         (.ded-tile-outstanding, set via `outstanding` below), never the
         icon fill. Each row's decorative `colour` field is kept in ROWS
         above as the record of what it used to be. */
      iconColour: 'ico-bg-green',
      /* Status (Still to add) lives on the row's own outline, not the icon —
         see selectorRow()'s .ded-tile-outstanding branch. */
      outstanding: r._todo,
      labelHtml: esc(r.label),
      tip: tip,
      amountHtml: (r._active && amt !== 0)
        ? '<div class="ded-tile-amt"' + (amt<0?' style="color:var(--er)"':'') + '>' + fmtSigned(amt) + (amt<0?' Loss':'') + '</div>'
        : '',
      /* ROW-20 (§L.8): "Nothing captured yet" removed — a Still-to-add row
         is already in the amber group with its own icon, which says this. */
      notesHtml: r.tab === 'paye' ? payeNote(r)
        : r.tab === 'b6foreign' ? foreignNote(r)
        : '',
      active: r._active,
      tabindex: 0,
      click: 'if(event.target.closest(\'.toggle-switch\')||event.target.closest(\'.info-btn\'))return;navigateTo(\'income\',\'' + r.tab + '\')',
      /* Write-through only where a profile answer exists to write to.
         data-income-type, NEVER name="income-type" (§2.1 / R1).

         ROW-22 (§L.4 item 0b-7; owner decisions 0.2 / 6.4) — the two-branch
         untoggle rule. Every one of these switches used to be inert once its
         row was Completed: `_on` recomputes from `_active` (the bucket holds
         records), so a row switched off simply repainted itself on. PAYE was
         worse — `_lockedOn` rendered it `disabled`, so the tap did nothing at
         all; and Foreign income rendered `readonly`, which HTML checkboxes
         ignore, so its switch flipped while the row stayed Completed.

         The branches, per the owner's decision:
           · PAYE          → WARN-AND-ALLOW. Confirm, then switch off.
           · every other   → BLOCK while the row holds its own captured
                             entries, and say why (onIncomeSelectorToggle).
         The decision names Foreign, Business, Investment, CGT, Retirement,
         Crypto and Other for the block branch; that list is read here as an
         illustration of its own stated rule ("rows that hold their own
         captured entries") rather than an exhaustive enumeration, so
         Employment and Rental — which equally hold captured entries — get
         the same treatment. PAYE is the only stated exception. */
      toggle: (r.tab === 'paye' && r._lockedOn)
        ? { checked: true, onchange: 'onPayeSelectorToggle(this.checked)',
            ariaLabel: PAYE_WITHHOLDING_CAUTION }
        : (r.type
            ? { checked: r._on, onchange: 'onIncomeSelectorToggle(\'' + r.type + '\',this.checked)' }
            : (r.tab === 'b6foreign'
                ? { checked: r._on, onchange: 'onForeignSelectorToggle(this.checked)' }
                : { checked: r._on }))
    });
  }

  return { ROWS: ROWS, row: row };
}

/* QA 2026-08 (§6 rev 3): "Still to add" now renders into its own slot ahead
   of the hero, while "Completed"/"Off" render into #income-selector further
   down the page — the owner-confirmed order is pills → Still to add → hero
   → mini-cards → Completed/Off. incomeSelectorRows() still computes the
   groups exactly once; this function only decides which container each
   group's HTML lands in, via two calls to the shared renderSelectorList()
   render helper (no grouping/classification logic duplicated). */
export function renderIncomeSelector() {
  var elTodo = $('income-still-to-add');
  var elCard = $('income-still-to-add-card');
  var elDone = $('income-selector');
  if (!elTodo && !elDone) return;

  var built = incomeSelectorRows();
  var ROWS = built.ROWS, row = built.row;

  var todoItems = ROWS.filter(function(r){ return r._todo; });
  if (elTodo) {
    elTodo.innerHTML = renderSelectorList({ groups: [
      { label: 'Still to add', sublabel: 'you told us these apply to you', items: todoItems, renderRow: row,
        headClass: 'ded-split-hd-amber' }
    ]});
  }
  if (elCard) elCard.hidden = !todoItems.length;

  if (elDone) {
    var doneItems = ROWS.filter(function(r){ return r._on && !r._todo; });
    var offItems  = ROWS.filter(function(r){ return !r._on && !r._todo; });

    /* QA 2026-08 (B2-INC-B2-9): the collapsed "Completed" card shows three
       things, and the owner named all three — the total income captured, how
       many steps that is, and the PAYE amount SEPARATELY.

       Separately is the substantive part, not a layout preference: PAYE is
       tax already paid, not income. Folding it into the total would overstate
       income by whatever was withheld, and this card sits directly under a
       hero whose figure is engine `adjGross` — the two would visibly
       disagree. So the total sums the income rows only, and PAYE gets its own
       figure, shown only once an amount exists. */
    var payeRow  = doneItems.filter(function(r){ return r.tab === 'paye'; })[0];
    var payeAmt  = payeRow ? (payeRow.amt() || 0) : 0;
    /* S3 Batch 14 (found in the follow-up sweep): this total was a sum of
       each row's own amt(), with 'paye'/'b6foreign' rows excluded to avoid
       double-counting cross-category overlays (S2 fix). That stopped the
       literal double-count, but the Employment row's amt() is a raw sum
       over APP.incomeItems — GROSS, and unfiltered by category — so it
       also carries the qualifying foreign-employment codes before their
       s10(1)(o)(ii) exemption, IRP5-coded lump sums (taxed separately,
       Second Schedule), and non-taxable IRP5 codes (TEI) — three more
       amounts adjGross nets out that a per-row sum has no way to know
       about without re-deriving adjGross's own arithmetic a second time
       (CLAUDE.md rule 2: no alternate calc path). Confirmed live: a
       fully-exempt R200,000 foreign salary made this total read R600,000
       against an adjGross of R400,000; the S10a/S10b lump-sum-only
       fixtures made it read the lump sum instead of the correct R0. Since
       this total's whole job (per the card's own design note above) is to
       agree with the hero's adjGross-based figure, read the canonical
       field directly instead of re-summing rows that can drift from it. */
    var onTotal = calcFullTax().adjGross;


    var doneMeta = '<div class="sel-sec-meta">'
      + '<span class="sel-sec-total" data-val="' + onTotal + '">' + fmt(onTotal) + '</span>'
      + '<span class="sel-sec-count">' + itemCount(doneItems.length) + '</span>'
      + (payeAmt > 0 ? '<span class="sel-sec-paye">PAYE ' + fmt(payeAmt) + '</span>' : '')
      + '</div>';
    var offMeta = '<div class="sel-sec-meta">'
      + '<span class="sel-sec-count">' + itemCount(offItems.length) + '</span>'
      + '</div>';

    elDone.innerHTML = renderSelectorList({ groups: [
      { label: 'Completed, well done!', items: doneItems, renderRow: row,
        collapsible: true, name: 'inc-sel-group', stateKey: '_incSecDoneOpen', metaHtml: doneMeta,
        /* Both default CLOSED. The section above them is the one asking the
           user to do something; finished and off-by-choice work should not
           push it down the page on every visit. State is per-session only —
           deliberately not persisted, so a return visit starts from the
           outstanding work rather than from wherever the last session was
           left scrolled open. */
        open: APP._incSecDoneOpen === true },
      { label: 'Off', items: offItems, renderRow: row,
        collapsible: true, name: 'inc-sel-group', stateKey: '_incSecOffOpen', metaHtml: offMeta,
        open: APP._incSecOffOpen === true }
    ]});
  }
}

/* QA 2026-08 (B2-BUG-5): "my employer withheld no PAYE". Takes the PAYE row
   off the outstanding list for employers that genuinely withhold nothing, so it
   is not a permanent false outstanding. Capturing a PAYE amount later clears
   the confirmation automatically — see renderIncomeSelector. */
export function confirmNoPaye(on) {
  APP.noPayeConfirmed = !!on;
  if (typeof debounceSave === 'function') debounceSave();
  if (typeof renderIncomeSelector === 'function') renderIncomeSelector();
  if (typeof renderAll === 'function') renderAll();
}

/* ROW-22 (§L.4 item 0b-7) — branch 2 of the owner's two-branch untoggle
   rule (decisions 0.2 option A / 6.4): a row that holds its own captured
   entries cannot be switched off, and says why. The alternative the audit
   explicitly warned against is soft-exclusion (keep the entries, drop them
   from the calculation): that introduces a THIRD state into calcFullTax()'s
   inputs and is a hard-rule-2 risk, so it is not done here.
   Re-rendering is what actually returns the switch to "on" — the row's
   checked state is derived, so one render restores the truth. */
function blockIncomeUntoggle(label) {
  showToast("You've already captured " + label + " entries. To switch this off, first remove them.",
    'info', 'warning');
  renderIncomeSelector();
}

/* ROW-22 — branch 1, PAYE: warn and allow (decision 6.4, refining 0.2).
   The row rendered `disabled aria-disabled="true"`, so the second QA pass's
   "PAYE: clicking does nothing at all" was the switch working as built.
   Untoggling now confirms and then goes through, landing on exactly the
   state the in-row "I confirm my employer withheld no PAYE" checkbox
   already reaches — deliberately one state reached two ways, not two
   competing states. B7.3: the confirmation dialog keeps the full caution
   text — this is the moment the warning has to carry weight, unlike the
   row's own now-shortened note. */
export function onPayeSelectorToggle(on) {
  if (on) { confirmNoPaye(false); return; }
  showConfirm(
    'Switch off PAYE?',
    PAYE_WITHHOLDING_CAUTION,
    function() { confirmNoPaye(true); },
    { tier: 'tax', okLabel: 'None was withheld', cancelLabel: 'Keep PAYE on',
      consequence: 'Your return will claim no PAYE credit, so any refund that credit would have produced disappears.' }
  );
  renderIncomeSelector();   /* revert the switch until the choice is made */
}

/* INC-5 (§L.8): which specific foreign sub-types actually hold an entry —
   read the same underlying arrays/fields collectForeignIncome() (02-core.js)
   sums, not its derived amounts (a captured row netting to exactly R0 must
   still block, e.g. a foreign rental with equal income and expenses). */
function foreignCapturedTypeLabels() {
  var types = [];
  if ((APP.rentalProperties || []).some(function(p){ return p.foreign === 'yes'; })) types.push('rental');
  if ((APP.businessItems || []).some(function(b){ return b.foreign === 'yes'; })) types.push('business');
  if ((APP.cgtAssets || []).some(function(a){ return a.foreign === 'yes'; })) types.push('capital gains');
  if (taxableIt3bItems().some(function(it){ return (it.foreignInterest||0) > 0 || (it.foreignDividends||0) > 0; })) types.push('investment');
  if ((APP.incomeItems || []).some(function(it){ return FOREIGN_SERVICE_CODES.has(it.code); })) types.push('employment');
  if (gv('b6-catchall-amount') > 0) types.push('other');
  return types;
}
function joinTypes(types) {
  return types.length > 1 ? types.slice(0, -1).join(', ') + ' and ' + types[types.length - 1] : types[0];
}

/* INC-3's checkbox handler — see foreignNote() above. */
export function toggleForeignAttested(on) {
  APP.foreignIncomeAttested = !!on;
  refreshDerived();
  debounceSave();
  renderIncomeSelector();
}

/* ROW-22 / INC-2..5 (§L.8) — the Foreign income row. It has no
   INCOME_TYPE_DEFS value (foreign is a SUBTYPE of business / rental / CGT /
   IT3(b), never a type of its own) but DOES have a profile answer to write
   to — APP.foreignIncomeYN (Phase 1 G1), set by the onboarding/Profile
   question. Turning the switch on declares it, exactly like setIncomeType()
   does for a typed row; turning it off follows the same two-branch rule as
   every other row (onIncomeSelectorToggle, below) — BLOCK while specific
   foreign sub-types hold captured entries (INC-5), else sync the answer
   like any other declared-but-uncaptured row (CONF-1). Not
   provisional-status-adjacent (STD-BEHAV-2): foreignIncomeYN is never read
   by isProvisionalAutoDetermined(), only actual captured foreign amounts
   are (and those are exactly what the block branch protects). */
export function onForeignSelectorToggle(on) {
  if (on) {
    APP.foreignIncomeYN = 'yes';
    refreshDerived();
    debounceSave();
    if (typeof navigateTo === 'function') navigateTo('income', 'b6foreign');
    renderIncomeSelector();
    return;
  }

  var capturedTypes = foreignCapturedTypeLabels();
  if (capturedTypes.length) {
    showToast("You've already captured " + joinTypes(capturedTypes) + " foreign income. To switch off foreign income, first remove existing entries.",
      'info', 'warning');
    renderIncomeSelector();
    return;
  }

  /* Declared but nothing captured — the ordinary contradiction-confirm flow,
     same as onIncomeSelectorToggle's declared branch below. */
  confirmContradiction({
    thing: 'foreign income',
    onConfirm: function() {
      APP.foreignIncomeYN = 'no';
      APP.foreignIncomeAttested = false;
      refreshDerived();
      debounceSave();
      renderIncomeSelector();
    }
  });
  renderIncomeSelector();   /* revert the switch until the choice is made */
}

/* Selector toggle → the authoritative Profile checkbox (§2.1). Turning a
   source ON is never destructive, so it applies straight away.

   B5 (§3.3, decision A4): turning one OFF that the user declared during
   setup is a contradiction between two of their own answers — warn in plain
   language, and on confirm write back to the setup answer so Profile and
   this page can never afterwards disagree. */
/* H5 (2026-07-29 follow-up): bucket -> nav tab, matching the map
   updateDrawerIncomeCalcs() (04-deductions.js) already uses for the same
   purpose, plus bucket 1 (Employment), which that map deliberately skips
   (reached via "Income overview" there) but which IS a valid toggle target
   here since Employment is one of the write-through selector rows. */
const INCOME_BUCKET_TAB = {1:'b1employment',2:'b2investment',3:'b3rental',4:'b4business',5:'b5cgt',6:'b6foreign',7:'b7retirement',9:'b9other',10:'b10crypto'};

export function onIncomeSelectorToggle(type, on) {
  const apply = function() {
    setIncomeType(type, on);
    refreshDerived();
    debounceSave();
    renderIncomeSelector();
    /* Manual toggle ON auto-navigates immediately to the subpage — matches
       toggleDedCheck()'s equivalent behaviour for deductions (04-deductions.js). */
    if (on && typeof navigateTo === 'function') {
      var def = INCOME_TYPE_DEFS.filter(function(d){ return d.value === type; })[0];
      var tab = def && INCOME_BUCKET_TAB[def.bucket];
      if (tab) setTimeout(function(){ navigateTo('income', tab); }, 100);
    }
  };
  if (on) { apply(); return; }

  const def = INCOME_TYPE_DEFS.filter(function(d){ return d.value === type; })[0];

  /* ROW-22 (§L.4 item 0b-7) — branch 2: block while this type's own bucket
     holds captured entries. Previously the write went through to the profile
     answer, then `_on = _active || declared` recomputed true from _active and
     the switch repainted itself on: the reported "toggle does nothing, no
     modal". Checked BEFORE the contradiction prompt, because "you already
     captured entries" is the more specific and more actionable reason —
     prompting the user to update a profile answer that cannot take effect
     would be the wrong conversation. */
  const blockTab = def && INCOME_BUCKET_TAB[def.bucket];
  let hasEntries = false;
  try { hasEntries = !!(blockTab && incomeBucketActive(blockTab)); } catch (e) { hasEntries = false; }
  if (hasEntries) {
    blockIncomeUntoggle(def ? def.label.toLowerCase() : 'these');
    return;
  }

  const declared = getSelectedIncomeTypes().indexOf(type) >= 0;
  if (declared && typeof confirmContradiction === 'function') {
    confirmContradiction({
      thing: def ? def.label.toLowerCase() : 'this income',
      onConfirm: function() {
        /* STD-BEHAV-2/OD-17 (§L.8): this confirm is about to sync the
           profile answer (apply() below calls setIncomeType), which for a
           provisional-triggering type (PROVISIONAL_INCOME_TYPES) is exactly
           the input isProvisionalAutoDetermined() reads. CONF-2 forbids this
           dialog from moving provisional status as a side effect — flag it
           for review instead of letting the next refreshDerived() silently
           recompute it (see updateProvisionalAutoStatus, 02-core.js). A
           non-provisional type (e.g. Employment, Investment) never changes
           the determination, so it does not need the flag. */
        if (type && PROVISIONAL_INCOME_TYPES.indexOf(type) >= 0) {
          APP.provisionalReviewNeeded = true;
        }
        apply();
      }
    });
    renderIncomeSelector();   /* revert the switch until the choice is made */
    return;
  }
  apply();
}

/* ── INCOME ITEMS ── */
/* Employment income CRUD (add/edit/save/remove) is provided by M_income in
   05-list-modules.js (the shared makeCrudModule factory). renderIncomeList
   below emits index-based edit/remove handlers that delegate to it. */

export function renderIncomeList() {
  const el = $('income-list'); if(!el) return;
  if(!APP.incomeItems.length) {
    /* DIP-1/5, INC-10 (§L.6): dropped the button — "+ Add employment income"
       is already a persistent button at the top of this page (body.html),
       so this was a second add-CTA for the same action below the fold. */
    el.innerHTML = '<div class="empty-state"><i class="material-symbols-outlined msi-inbox"></i><p>Without an income source, your tax payable will show as zero.</p></div>'; return;
  }
  /* QR4.5: contextual deduction suggestions per income code are
     INCOME_DEDUCTION_LINKS rows (01-data.js) — the same rows the Add-income tip and
     the deduction pills read. (V8.6 E2 / EMP-3 (§L.8) history: 3702/3722/3816/3704
     were added there; ground truth for Travel vs Subsistence is IRP5_INCOME's own
     description.) What stays here is not a deduction link: the warning that a
     foreign-employment code must not be captured a second time. */
  const FOREIGN_CODE_WARNING = '<i class="material-symbols-outlined msi-warning u-mr-5"></i>Foreign income code — do <strong>not duplicate</strong> under the Foreign Income calculator or "Other income sources" section.';
  const CODE_SUGGESTIONS = {};
  FOREIGN_SERVICE_CODES.forEach(function(c){ CODE_SUGGESTIONS[c] = FOREIGN_CODE_WARNING; });
  /* v8.22 D6: card-style rows with category icon. Delete-only (income items have no edit fn). */
  var INCOME_CAT_STYLE = {
    salary:{ico:'work',col:'ico-bg-blue'}, bonus:{ico:'redeem',col:'ico-bg-blue'},
    overtime:{ico:'schedule',col:'ico-bg-blue'}, commission:{ico:'percent',col:'ico-bg-green'},
    contractor:{ico:'person',col:'ico-bg-green'}, director:{ico:'person',col:'ico-bg-green'},
    pension:{ico:'beach_access',col:'ico-bg-purple'}, fringe:{ico:'redeem',col:'ico-bg-teal'},
    allowance:{ico:'payments',col:'ico-bg-teal'}, travel:{ico:'directions_car',col:'ico-bg-teal'},
    lumpsum:{ico:'trending_up',col:'ico-bg-purple'}, interest_local:{ico:'percent',col:'ico-bg-blue'},
    equity:{ico:'donut_small',col:'ico-bg-orange'}, other:{ico:'layers',col:'ico-bg-grey'}
  };
  el.innerHTML = APP.incomeItems.map(function(i, idx){
    var st = INCOME_CAT_STYLE[i.cat] || {ico:'request_quote', col:'ico-bg-grey'};
    var linkNote = incomeDeductionNoteFor(i.code);
    var suggestion = linkNote ? '<i class="material-symbols-outlined msi-lightbulb u-mr-5"></i>' + linkNote : CODE_SUGGESTIONS[i.code];
    /* S3 Batch 8/13 (C10/D7): short name, not i.name (the full SARS
       wording, still what IRP5_CODE_MAP/collect() store on the item \u2014
       unchanged, only the DISPLAY reads the short map) \u2014 INCOME_CODE_SHORT
       (01-data.js) is the same map D6's dropdown reads, so they can't
       drift. The source-code/doc badge (irp5-code) is gone entirely, not
       just visually hidden \u2014 with it gone this short name is the row's
       only identifying text, which is why it has to be the canonical map,
       not a second guess at a shorter name. */
    var shortName = INCOME_CODE_SHORT[i.code] || i.name;
    var nameText = shortName ? esc(shortName) + (i.desc ? ' \u2014 ' + esc(i.desc) : '') : esc(i.desc || '');
    var row = '<div class="irp5-row">'
      + '<div class="irp5-ico ' + st.col + '"><i class="' + iconClassFor(st.ico) + '"></i></div>'
      + '<div class="irp5-info"><div class="irp5-name">' + nameText + '</div></div>'
      + '<div class="irp5-amt">' + fmt(i.amount) + '</div>'
      + '<div class="irp5-acts">'
      + '<div class="ibtn" onclick="editIncomeItem(' + idx + ')" role="button" aria-label="Edit income item"><i class="material-symbols-outlined msi-edit"></i></div>'
      + '<div class="ibtn del" onclick="removeIncomeItem(' + idx + ')" role="button" aria-label="Remove income item"><i class="material-symbols-outlined msi-delete"></i></div>'
      + '</div>'
      + '</div>';
    var note = suggestion ? ('<div class="note-chip"><span>' + suggestion + '</span></div>') : '';
    /* W22 (folded into A2's 3907 work): legacy/restored income entries stored under a lump-sum
       IRP5 code must not be taxed here at marginal rate — they belong on the SARS lump-sum tables. */
    var lumpsumWarning = i.cat === 'lumpsum'
      ? noteHtml('warning', 'Lump-sum code ' + esc(i.code) + ': add it under Retirement → Lump sums.', 'This amount is excluded from normal tax here and must be captured under Retirement → Lump sums to be taxed on the SARS lump-sum tables.', { title: 'Lump-sum code ' + esc(i.code) })
      : '';
    return row + note + lumpsumWarning;
  }).join('');
}

/* ── PRIOR YEAR FLAGS + NAV LINKS ── */
export function renderPriorYearFlags() {
  // Render navigation buttons with live BF/CF amounts
  const navEl = $('prioryear-nav-links');
  if(navEl) {
    function navBtnHtml(icon, label, dest, destSub, openAcc, amt) {
      const amtStr = amt > 0 ? `<span class="mono" style="margin-left:auto;font-weight:700;color:var(--accent)">${fmt(amt)}</span>` : '';
      /* Batch 2: income-main's "Assessed loss b/f" section is a .seg-btn/
         .seg-panel (segShow), not a <details> — click it instead of setting
         an `open` attribute nothing reads. Other targets (retirement/
         deductions .acc-card) are unaffected until their own batch lands.
         #48: the loss panel is now nested as a collapsed .card-sec inside
         the IRP5/IT3 tab — openAcc can be an array so a deep-link both
         switches tabs AND expands the nested section, each click chained
         after the previous with a short delay so the DOM it targets exists. */
      const openTargets = openAcc ? (Array.isArray(openAcc) ? openAcc : [openAcc]) : [];
      const accOpen = openTargets.map((sel, i) => {
        const delay = 200 + i * 150;
        /* B3: .ded-step-head joins .card-sec-head — both are cardSecToggle
           heads that carry .open, so both are "click unless already open".
           Anything else is a <details> and takes the open attribute. */
        return sel.indexOf('.seg-btn') === 0
          ? `;setTimeout(()=>{var b=document.querySelector('${sel}');if(b)b.click()},${delay})`
          : (sel.indexOf('.card-sec-head') === 0 || sel.indexOf('.ded-step-head') === 0)
            ? `;setTimeout(()=>{var h=document.querySelector('${sel}');if(h&&!h.classList.contains('open'))h.click()},${delay})`
            : `;setTimeout(()=>{var d=document.querySelector('${sel}');if(d)d.setAttribute('open','')},${delay})`;
      }).join('');
      const navCall = destSub ? `navigateTo('${dest}','${destSub}')${accOpen}` : `navigateTo('${dest}','')`;
      return `<button class="btn btn-secondary btn-sm" style="justify-content:flex-start;gap:8px;text-align:left;width:100%" onclick="${navCall}"><i class="${icon}"></i> <span style="flex:1">${label}</span>${amtStr}</button>`;
    }
    const pyLoss = gv('py_loss');
    /* T-C2: non-deducted retirement contributions are now ONE balance
       (py_ret_excess), mirrored onto both the Retirement Income and
       Retirement Deductions pages — see calcFullTax. Both nav rows below
       show the same figure; they just land on the two different pages
       where it's editable. */
    const retExcess = gv('py_ret_excess');
    const cgtLossBf = gv('cgt_loss_bf');
    const ftcBf = gv('ftc_bf');
    const lumpsumPool = APP.priorLumpsumTaxable || 0;
    const s18aExcess = gv('py_s18a_excess');
    const rows = [
      /* B2: py_loss is a plain input near the foot of Income main now — no
         section to expand, so the deep link just lands on the page. */
      navBtnHtml('material-symbols-outlined msi-paid', 'Prior year tax loss → Income Main', 'income', 'main', '', pyLoss),
      navBtnHtml('material-symbols-outlined msi-beach-access', 'Non-deducted contributions balance → Retirement Income', 'income', 'b7retirement', '.seg-btn[data-seg=ret-seg-carried]', retExcess),
      /* S3 Batch 11 (C15): the target field is now its own always-visible
         card (was behind a shared 3-step accordion, #ret-carried-head) —
         no section left to expand, so the deep link just lands on the
         page, same as py_loss above. */
      navBtnHtml('material-symbols-outlined msi-savings', 'Non-deducted contributions balance → Retirement Deductions', 'deductions', 'retirement', '', retExcess),
      navBtnHtml('material-symbols-outlined msi-request-quote', 'Basic Amount (Para 20) → Provisional Tax', 'summary', 'provtax', '', 0),
      navBtnHtml('material-symbols-outlined msi-show-chart', 'Capital loss b/f → Capital Gains', 'income', 'b5cgt', '', cgtLossBf),
      navBtnHtml('material-symbols-outlined msi-public', 'Foreign tax credit b/f → Foreign Income', 'income', 'b6foreign', '', ftcBf),
      navBtnHtml('material-symbols-outlined msi-beach-access', 'Lump-sum cumulative pool → Retirement Income', 'income', 'b7retirement', '', lumpsumPool),
      navBtnHtml('material-symbols-outlined msi-volunteer-activism', 'Excess s18A donations b/f (this page)', 'summary', 'prioryear', '', s18aExcess),
    ];
    navEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">${rows.join('')}</div>`;
  }

  const el = $('prior-year-flags'); if(!el) return;
  el.innerHTML = '';
}

/* Batch E (#9/#10): SARS Account page — a collapsed-by-default accordion
   row per carried balance that's actually applicable (per the owner's
   explicit request, a row with nothing to show doesn't render at all, not
   just collapsed). Rows are static <details> elements (never regenerated
   via innerHTML), so the browser preserves each one's own open/closed
   state across re-renders, and typing in a live field is never interrupted
   by a background renderAll(). All read-only Current-year/Year-end figures
   reuse calcFullTax()'s existing outputs (r.lossUnabsorbed, r.retExcess,
   r.s10cRemaining, r.ftcCarryOut, r.donExcess) and cgtAggregate()'s
   capitalLossCF — no new tax math, purely re-presentation of what the engine
   already computes elsewhere. "This year" movement is derived arithmetically
   as (year-end minus prior-year), never independently computed, so it can
   never disagree with the year-end figure by construction. */
export function renderCarriedBalances() {
  const anchor = $('carried-seg-loss'); if (!anchor) return;
  const r = calcFullTax();

  function mirrorIn(mirrorId, canonicalId) {
    const m = $(mirrorId), c = $(canonicalId);
    if (!m || !c) return;
    if (document.activeElement !== m) m.value = c.value;
  }
  mirrorIn('py_loss_sars', 'py_loss');
  mirrorIn('cgt_loss_bf_sars', 'cgt_loss_bf');
  mirrorIn('ftc_bf_sars', 'ftc_bf');
  mirrorIn('py_ret_excess_sars', 'py_ret_excess');

  /* Sets the chip (collapsed summary value), the Year-end ledger total, and
     (if the row has a movement line — ringfence/payecredits/sarsbalance
     don't) the delta badge text + up/down colour. */
  function setBalance(id, prior, end, opts) {
    opts = opts || {};
    const endText = fmt(end);
    const chipEl = $('bal-' + id + '-chip'); if (chipEl) chipEl.textContent = endText;
    const endEl = $('bal-' + id + '-end'); if (endEl) endEl.textContent = endText;
    decorateBalanceSource(id, prior);
    if (opts.noDelta) return;
    const d = end - prior;
    const deltaEl = $('bal-' + id + '-delta');
    if (deltaEl) {
      deltaEl.textContent = (Math.abs(d) < 0.5 ? fmt(0) : (d > 0 ? '+ ' : '− ') + fmt(Math.abs(d)));
      deltaEl.classList.toggle('up', d >= 0);
      deltaEl.classList.toggle('down', d < 0);
    }
  }

  const lossPrior = gv('py_loss'), lossEnd = r.lossUnabsorbed || 0;
  setBalance('loss', lossPrior, lossEnd);

  /* renderCgtResult() only recomputes+sets APP.capitalLossCF when there's a
     current-year CGT base (assets/crypto/other-capital/it3b-foreign-cgt); with
     none, the b/f balance simply carries forward unchanged. Same fallback
     the old carry-forward summary used (since removed) to avoid trusting a
     stale/unset APP.capitalLossCF. */
  const capPrior = gv('cgt_loss_bf');
  const capEnd = (APP.cgtAssets && APP.cgtAssets.length) ? (APP.capitalLossCF || 0) : capPrior;
  setBalance('capital', capPrior, capEnd);

  const ftcPrior = gv('ftc_bf'), ftcEnd = r.ftcCarryOut || 0;
  setBalance('ftc', ftcPrior, ftcEnd);
  // A credit fully utilised this year (r.ftc > 0) leaves neither a b/f nor a
  // carry-out balance, so it fell through the old applicable test entirely —
  // the s6quat row never appeared even though a real credit was claimed.
  const ftcUsedThisYear = (r.ftc || 0) > 0;
  const ftcNoteEl = $('bal-ftc-used-note');
  if (ftcNoteEl) {
    if (ftcUsedThisYear) {
      ftcNoteEl.style.display = 'block';
      ftcNoteEl.textContent = 'Foreign tax credit (s6quat) of ' + fmt(r.ftc) + ' applied against this year’s tax.';
    } else {
      ftcNoteEl.style.display = 'none';
    }
  }

  /* T-C2: retExEnd is the FINAL closing balance for next year's single
     py_ret_excess — after this year's s11F re-deduction (r.retExcess) AND
     the lump-sum/annuity walk that consumes whatever's left of it
     (r.s10cRemaining is strictly <= r.retExcess, since the walk can only
     use what the s11F step didn't). Never r.retExcess alone — that's only
     the mid-year figure before lump sums/annuities have had their turn. */
  const retExPrior = gv('py_ret_excess'), retExEnd = r.s10cRemaining || 0;
  setBalance('retexcess', retExPrior, retExEnd);

  /* 2026-07-29 follow-up: mirrors the lump-sum cumulative pool (canonical
     input: prior-lumpsum-taxable, Retirement Income → Lump sums). Running
     lifetime total, not a prior/this-year movement — informational only,
     same pattern as ringfence/payecredits/sarsbalance below. */
  mirrorIn('prior_lumpsum_bf_sars', 'prior-lumpsum-taxable');
  const lumpsumPool = gv('prior-lumpsum-taxable');
  setBalance('lumpsum', lumpsumPool, lumpsumPool, { noDelta: true });


  /* s18A(1) proviso: r.donExcess is the engine's own carry-out (single
     source of truth, shared with the Donations deduction page — see
     renderDonationsList in 04-deductions.js). Never re-derive the 10% cap
     here. */
  const donPrior = gv('py_s18a_excess'), donEnd = r.donExcess || 0;
  setBalance('donations', donPrior, donEnd);

  /* QA 2026-08: the "PAYE / provisional tax credits" and "SARS statement of
     account balance" rows were removed at the owner's request. Neither was a
     carried balance: both rendered with noDelta (opening == closing, no
     movement), and neither ever reached calcFullTax or calcTaxForYear.
     py_prov_credits in particular duplicated p_prov_p1 / p_prov_p2 /
     p_prov_topup, which DO reach the engine and are deducted under para 21 of
     the Fourth Schedule — while its tooltip promised "it comes off your final
     bill", which that field could not deliver. A user who captured their
     provisional payments there instead would have been shown too much owing. */

  /* QA 2026-08 (§6, 12c — toggle model): row order fixed to the mockup's
     TYPES array. Each row now lands in one of three groups purely by its
     bucket — off (explicitly switched off), captured (has a real figure) or
     still-to-add (the default) — read via getCarriedBalanceStatus()
     (13-patches.js), the same expectedCarriedBalances/carriedBalanceAnswers
     state the Dashboard step and Profile's mirrored questions read, so none
     of the three can ever disagree about what "off"/"captured" means.
     A row with an actual figure is always "captured" regardless of the
     off-flag (data beats a stale declaration, same rule as before). */
  const status = {};
  getCarriedBalanceStatus().forEach(function(s) { status[s.flag] = s; });
  const MOVEMENT_ROWS = [
    { id:'retexcess', flag:'retirement', prior:retExPrior,  end:retExEnd,  cumulative:false },
    { id:'lumpsum',   flag:'lumpsum',    prior:r.cumPoolOpening, end:r.cumPoolClosing, cumulative:true },
    { id:'capital',   flag:'capital',    prior:capPrior,    end:capEnd,    cumulative:false },
    { id:'donations', flag:'donations',  prior:donPrior,    end:donEnd,    cumulative:false },
    { id:'ftc',       flag:'ftc',        prior:ftcPrior,    end:ftcEnd,    cumulative:false, extraApplicable: ftcUsedThisYear },
    { id:'loss',      flag:'loss',       prior:lossPrior,   end:lossEnd,   cumulative:false },
  ];
  const mounts = {
    out: $('carried-still-to-add'),
    cap: $('carried-captured-body'),
    off: $('carried-off-body'),
  };
  const counts = { out: 0, cap: 0, off: 0 };
  MOVEMENT_ROWS.forEach(function(row) {
    /* note 7/8: "captured" — a real opening or closing figure exists — shows
       the year's movement instead of re-showing the opening-balance input
       (the closing amount is already the row's own heading/chip value).
       Cumulative lump sums only ever grow, so their wording never says
       "utilised" (note 8). */
    const captured = row.prior > 0 || row.end > 0;
    const st = status[row.flag] || {};
    /* While the user is typing INTO this row, it must not change bucket.
       The first digit makes captured true, and the 'cap' branch below both
       reparents the panel (appendChild blurs the live input) and hides the
       very input row being filled — together those capped opening-balance
       entry at a single character. Holding the row in 'out' until focus
       leaves keeps the field mounted and visible; it settles into its real
       bucket on the next render after blur (onchange →
       onCarriedBalanceAmountChange). Same guard mirrorIn() above already
       applies to a focused mirror field. */
    const panel = $('carried-seg-' + row.id);
    if (panel) panel.dataset.fixtureRow = row.id;
    const editing = !!(panel && panel.contains(document.activeElement));
    /* A credit actually used this year (extraApplicable) must stay visible
       even if the user separately switched the row off — same guarantee the
       old "applicable" test gave it. */
    const bucket = editing ? 'out' : (captured ? 'cap' : (st.off && !row.extraApplicable ? 'off' : 'out'));
    counts[bucket]++;

    const mount = mounts[bucket];
    if (panel && mount && panel.parentNode !== mount) {
      /* Reparenting the row that just fired the change event which led here
         (e.g. its own toggle-switch, still mid-onchange) can race Chromium's
         own focus-restoration bookkeeping and throw
         "NotFoundError: ... Perhaps it was moved in a 'blur' event handler".
         Deferring one tick sidesteps the race without changing anything a
         user can see — the row still lands in the right group this render
         pass in every ordinary case (typing, unrelated toggles). */
      try { mount.appendChild(panel); }
      catch (e) { setTimeout(function() { try { mount.appendChild(panel); } catch (e2) {} }, 0); }
    }

    const toggleEl = $('bal-' + row.id + '-toggle');
    if (toggleEl) toggleEl.checked = bucket !== 'off';

    const inputRow = $(row.id + '-input-row');
    const connector = $(row.id + '-connector');
    const closingRow = $(row.id + '-closing-row');
    const moveEl = $('bal-' + row.id + '-movement');
    const subEl = $('bal-' + row.id + '-sub');
    const offNoteEl = $('bal-' + row.id + '-off-note');
    if (offNoteEl) offNoteEl.style.display = bucket === 'off' ? 'block' : 'none';
    /* UI-CARD-1 (BACKLOG 28; owner 2026-10-07: balances stay rows): a row
       carrying an amount wears the card lip. */
    if (panel) panel.classList.toggle('is-carrying', bucket === 'cap');
    if (bucket === 'cap') {
      /* B9.4 (BAL-4/D-14/SC-2): the opening INPUT stays hidden here —
         editing only ever happens in the 'out' bucket, above — its value
         now appears as read-only text in the reconciliation below instead.
         Every figure is row.prior/row.end, already computed above; the only
         arithmetic here is the same signed delta the old single sentence
         already used. Cumulative balances (lump sums) only ever grow, so
         the middle line always reads "Added", never "Utilised" — but
         row.prior (cumPoolOpening) and row.end (cumPoolClosing) are a real
         opening/closing split post-A1-fix, so the amount added is their
         delta, not row.end again (that was the A1 display bug: showing the
         closing balance a second time under a different label). */
      if (inputRow) inputRow.style.display = 'none';
      if (connector) connector.style.display = 'none';
      if (closingRow) closingRow.style.display = 'none';
      const delta = row.end - row.prior;
      let sentence, moveLbl, moveVal;
      if (row.cumulative) {
        sentence = fmt(delta) + ' added this year.';
        moveLbl = 'Added this year'; moveVal = fmt(delta);
      } else if (Math.abs(delta) < 0.5) {
        sentence = 'No movement this year.';
        moveLbl = 'Movement this year'; moveVal = fmt(0);
      } else {
        sentence = fmt(Math.abs(delta)) + ' ' + (delta < 0 ? 'utilised' : 'added') + ' this year.';
        moveLbl = delta < 0 ? 'Utilised this year' : 'Added this year';
        moveVal = (delta < 0 ? '− ' : '+ ') + fmt(Math.abs(delta));
      }
      if (subEl) subEl.textContent = sentence;
      if (moveEl) {
        moveEl.style.display = 'block';
        /* UI-CARD-1: the movement as bars on one scale — the same three
           figures the lines below state. */
        moveEl.innerHTML = barsHtml([
            { label: 'Opening balance', val: row.prior, color: 'color-mix(in srgb, var(--amber) 45%, var(--sf3))' },
            { label: moveLbl, val: Math.abs(delta), color: 'var(--amber)' },
            { label: 'Closing balance', val: row.end, color: 'var(--amber)' }
          ], { label: 'Balance movement', keepZero: true })
          + '<div class="sum-line"><span class="lbl">Opening balance</span><span class="val" data-val="' + row.prior + '">' + fmt(row.prior) + '</span></div>'
          + '<div class="sum-line"><span class="lbl">' + moveLbl + '</span><span class="val">' + moveVal + '</span></div>'
          + '<div class="sum-line divider total"><span class="lbl">Closing balance</span><span class="val" data-val="' + row.end + '">' + fmt(row.end) + '</span></div>';
      }
    } else if (bucket === 'off') {
      if (inputRow) inputRow.style.display = 'none';
      if (connector) connector.style.display = 'none';
      if (closingRow) closingRow.style.display = 'none';
      if (moveEl) moveEl.style.display = 'none';
      if (subEl) subEl.textContent = '';
    } else {
      if (inputRow) inputRow.style.display = '';
      if (connector) connector.style.display = row.cumulative ? 'none' : '';
      if (closingRow) closingRow.style.display = row.cumulative ? 'none' : '';
      if (moveEl) moveEl.style.display = 'none';
      if (subEl) subEl.textContent = '';
    }
  });

  const capturedGroup = $('carried-captured-group');
  if (capturedGroup) capturedGroup.hidden = counts.cap === 0;
  const offGroup = $('carried-off-group');
  if (offGroup) offGroup.hidden = counts.off === 0;

}

/* QA 2026-08 (§6, 12c): each row's own toggle-switch. Matches the pattern
   every other write-through toggle in the app already uses (toggleDedCheck,
   04-deductions.js; onIncomeSelectorToggle above) — ON just applies (no
   confirmation needed, nothing is being contradicted); OFF contradicts the
   applicable setup/profile answer, so it goes through confirmContradiction()
   first, reverting the switch's visual immediately in case the user cancels.
   Both branches write through setCarriedBalanceAnswer() (13-patches.js),
   the SAME two-property write onProfileCarriedQ() uses for the Profile
   mirror of this question, so the two pages can never disagree. */
export function onCarriedBalanceRowToggle(id, on) {
  const flag = BALANCE_EXPECT_KEY[id]; if (!flag) return;
  const t = SARS_BALANCE_TYPES.filter(function(x){ return x.id === id; })[0];
  const label = t ? t.label : id;
  if (on) {
    setCarriedBalanceAnswer(flag, 'yes');
    refreshDerived();
    debounceSave();
    renderCarriedBalances();
    showToast('Also updated your setup answer for “' + label + '” to Yes.', 'check_circle');
    const panel = $('carried-seg-' + id);
    if (panel) {
      panel.setAttribute('open', '');
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function() {
        const input = panel.querySelector('.ledger-row input');
        if (input) input.focus();
      }, 60);
    }
    return;
  }
  renderCarriedBalances(); /* revert the checkbox visually unless/until confirmed */
  confirmContradiction({
    thing: label.toLowerCase(),
    onConfirm: function() {
      setCarriedBalanceAnswer(flag, 'no');
      refreshDerived();
      debounceSave();
      renderCarriedBalances();
      showToast('Also updated your setup answer for “' + label + '” to No.', 'check_circle');
    }
  });
}

const BALANCE_EXPECT_KEY = {
  loss: 'loss', capital: 'capital', ftc: 'ftc',
  retexcess: 'retirement', lumpsum: 'lumpsum', donations: 'donations',
};

/* GLOB-3 / STD-BEHAV-1 (§L.8): the other half of the bidirectional contract
   TB-2 already covers. TB-2 is "answer No -> row switches off" (already
   true — the row's off/captured bucket above reads straight off
   carriedBalanceAnswers/expectedCarriedBalances, so a Profile answer change
   repaints it with no extra code). GLOB-3 is the reverse: typing a real
   opening balance into a row the user had earlier said "No" to. Until now
   that only ever changed which BUCKET the row displayed in (captured beats
   a stale off-flag, unchanged above) — the underlying answer stayed "No",
   so Profile's mirrored question and the Dashboard's "reviewed" signal
   silently disagreed with what the user had just typed. Wired to `onchange`
   (not `oninput`, which already fires the totals/mirror sync above) so the
   confirm appears once, when the user finishes editing the field, not on
   every keystroke. Never provisional-status-adjacent (STD-BEHAV-2): these
   six balances do not feed isProvisionalAutoDetermined(). */
export function onCarriedBalanceAmountChange(id) {
  const flag = BALANCE_EXPECT_KEY[id]; if (!flag) return;
  if ((APP.carriedBalanceAnswers || {})[flag] !== 'no') return; /* already Yes/unset — nothing to sync */
  const t = SARS_BALANCE_TYPES.filter(function(x){ return x.id === id; })[0];
  const label = t ? t.label : id;
  const el = t ? $(t.field) : null;
  const val = el ? parseFloat(String(el.value).replace(/[^0-9.-]/g, '')) || 0 : 0;
  if (!(val > 0)) return;
  confirmContradiction({
    thing: label.toLowerCase(),
    onConfirm: function() {
      setCarriedBalanceAnswer(flag, 'yes');
      refreshDerived();
      debounceSave();
      renderCarriedBalances();
      showToast('Also updated your setup answer for “' + label + '” to Yes.', 'check_circle');
    }
  });
}
/* QA 2026-08 (B2-AC-8, B2-AC-10): rewrite a row's "Also editable on: X"
   prose into a real jump control, and add a short note saying why the balance
   is on screen when it is here because a figure was captured on that page.

   The prose stays in body.html as the fallback: a balance with no source
   entry (the ones captured on this page itself) keeps whatever its markup
   says, so nothing has to be maintained in two places. */
function decorateBalanceSource(id, prior) {
  const src = BALANCE_SOURCE[id];
  const row = $('carried-seg-' + id);
  if (!src || !row) return;
  const srcEl = row.querySelector('.ledger-source');
  if (!srcEl) return;
  const nav = "navigateTo('" + src.mode + "','" + src.tab + "')";
  srcEl.innerHTML = '<button type="button" class="ledger-jump" onclick="' + nav + '">'
    + '<i class="material-symbols-outlined msi-open-in-new"></i> Open ' + esc(src.label)
    + '</button>'
    /* Only when the figure actually came from there. A zero opening balance
       means the row is showing for the other reason — the user said in
       onboarding that this balance applies — and explaining it as though an
       amount had been captured would be wrong. */
    /* QA 2026-08 (B2-AC-B2-10): the "Shown because ..." sub-text was removed at
       the owner's request — the card heading already says what the balance is.
       CARRIED_BALANCE_SOURCE.why is retained in 01-data as the copy source. */
    + '';
}

/* ── PROVISIONAL TAX SUMMARY ── */

/* §5 H-4 fix: Paragraph 20 of the Fourth Schedule underestimation penalty.

   Authority: Income Tax Act, Fourth Schedule, paragraph 20(1) and 20(2);
              SARS Interpretation Note 1 (Issue 3) "Provisional Tax — Estimates";
              SARS Guide to Provisional Tax (sars.gov.za/guide-to-provisional-tax/).

   Two-tier rule based on actual taxable income for the year:

   ── Tier (a) — actual TI > R1,000,000 ──
     Penalty triggered if total provisional + PAYE paid < tax on (80% × actual TI).
     Penalty = 20% × [tax on 80% × actual TI − (PAYE + provisional tax paid)].
     No basic-amount consideration.

   ── Tier (b) — actual TI ≤ R1,000,000 ──
     Two thresholds: 90% × actual TI, OR the basic amount (preceding year's assessed TI).
     Required payment = tax on the LESSER of {90% × actual TI, basic amount}.
     Penalty triggered if total paid < required payment.
     Penalty = 20% × (required payment − total paid).
     Net effect: paying tax on the basic amount is a safe harbour ("basic amount safe
     harbour applies" when the basic amount is the binding constraint).

   The "tax" in both tiers is normal tax payable AFTER the s6quat rebate AND s6A/s6B
   medical scheme credits (per SARS IN1 worked examples — the calculation uses
   normal-tax-payable).

   This calculator treats `r.taxableIncome` as the user's projected actual TI for the
   year, and asks: do their total payments (PAYE + provisional) cover the required
   amount, or will they incur a penalty? This is the correct planning interpretation
   and matches the legal trigger because the user's "estimate" on the second IRP6
   determines the provisional tax they paid.

   Note: lump-sum benefits (codes 3915, 3920, 3921, 3924, 3926) and severance (3901)
   are technically excluded from the para 20 calculation per the SARS Guide. This is
   left as a future refinement; in the typical case (no lump sums in the year), the
   exclusion is a no-op. */
/* Fourth Schedule para 20 statutory parameters. These are set by the
   Schedule itself (not annual tax tables), unlike the tier-flip threshold
   which is tax-year-keyed (ty.para20Threshold). */
export const PARA20 = {
  HIGH_INCOME_COVERAGE: 0.80,  // tier (a): tax on 80% of actual TI
  LOW_INCOME_COVERAGE:  0.90,  // tier (b): tax on 90% of actual TI
  PENALTY_RATE:         0.20,  // 20% of the shortfall
};

export function calcProvisionalPenalty(r, opts) {
  const ty = r.ty;
  const actualTI = r.taxableIncome || 0;
  const provTotal = gv('p_prov_p1') + gv('p_prov_p2') + gv('p_prov_topup');
  /* BACKLOG 26: PAYE defaults to the engine's own figure. It read the
     single-field #paye_deducted, gone since V8.4 II.3 (per-employer PAYE),
     so every caller without opts.payeTotal — the risk assessment and the
     optimisation tips — counted PAYE as R0 and could warn of a para 20
     penalty that the PAYE already covers (IN1: PAYE and provisional
     payments both count towards the para 20 test). */
  const payeTotal = (opts && opts.payeTotal != null) ? opts.payeTotal : (r.payeDeducted || 0);
  const totalPaid = provTotal + payeTotal;
  const basicAmount = gv('py_basic_amount');
  // §5: tier-flip threshold is tax-year-keyed (R1m through 2025/26;
  // R1.8m from 2026/27 per Budget 2026, pending TLAB 2026 enactment).
  // Fallback to R1m if tax-year config is missing the field.
  const para20Threshold = (ty && ty.para20Threshold) || 1000000;

  // Empty-state result (zero TI, no inputs)
  if (actualTI <= 0) {
    return {
      actualTI: 0, basicAmount, provTotal, payeTotal, totalPaid,
      isHighIncome: false, thresholdPct: 0, para20Threshold,
      thresholdTI: 0, taxOnThreshold: 0, taxOnBasic: null,
      requiredPayment: 0, triggered: false, safeHarbour: null,
      penaltyBase: 0, penalty: 0
    };
  }

  const isHighIncome = actualTI > para20Threshold;
  const thresholdPct = isHighIncome ? PARA20.HIGH_INCOME_COVERAGE : PARA20.LOW_INCOME_COVERAGE;
  const thresholdTI = actualTI * thresholdPct;

  // Tax on a given TI, after rebates, medical credits AND the foreign tax
  // credit (per SARS IN1 / para 20(1) "normal tax ... after taking into
  // account any applicable rebate" — engine-remediation W12: r.ftc was
  // previously omitted, overstating the required provisional payment for a
  // taxpayer with an s6quat credit). Stays on r.rebates (not calcTaxForYear):
  // the v8.8 planner path passes a synthetic r carrying precomputed rebates
  // without an age.
  const medCredits = (r.med && r.med.total) ? r.med.total : 0;
  const ftcCredit = r.ftc || 0;
  const taxOn = (ti) => Math.max(0,
    calcTaxOnIncome(ti, ty.brackets) - r.rebates - medCredits - ftcCredit
);

  const taxOnThreshold = taxOn(thresholdTI);
  const taxOnBasic = (basicAmount > 0) ? taxOn(basicAmount) : null;

  // Required payment to avoid penalty
  let requiredPayment;
  let safeHarbour = null;
  if (isHighIncome) {
    // Tier (a): straight 80% of actual; basic amount irrelevant
    requiredPayment = taxOnThreshold;
  } else {
    // Tier (b): LESSER of tax-on-90%-actual or tax-on-basic-amount
    if (basicAmount > 0 && taxOnBasic < taxOnThreshold) {
      requiredPayment = taxOnBasic;
      safeHarbour = 'basic_amount';  // basic amount caps the requirement (safe harbour active)
    } else {
      requiredPayment = taxOnThreshold;
    }
  }

  const triggered = totalPaid < requiredPayment;
  const penaltyBase = Math.max(0, requiredPayment - totalPaid);
  const penalty = triggered ? Math.round(penaltyBase * PARA20.PENALTY_RATE * 100) / 100 : 0;

  return {
    actualTI, basicAmount, provTotal, payeTotal, totalPaid,
    isHighIncome, thresholdPct, para20Threshold, thresholdTI, taxOnThreshold, taxOnBasic,
    requiredPayment, triggered, safeHarbour, penaltyBase, penalty
  };
}



/* ============================================================
   v8.8 — PROVISIONAL TAX HUB (D1/D2/D7/D12)
   Orchestrator + plain-language status strip + next-deadline helper.
   Recommendation (PB3) and penalty wiring (PB4) attach via guarded calls.
   String concatenation only (no nested template literals).
   ============================================================ */
export function nextProvDeadline() {
  var yr = parseInt((typeof gs === 'function' ? gs('taxYear') : '') || '2027', 10);
  var ldf = (typeof lastDayOfFeb === 'function') ? lastDayOfFeb(yr) : 28;
  var list = [
    { key:'p1', label:'P1 — First Provisional', date:new Date(yr-1, 7, 31) },
    { key:'p2', label:'P2 — Second Provisional', date:new Date(yr, 1, ldf) },
    { key:'p3', label:'P3 — Optional Top-up',    date:new Date(yr, 8, 30) }
  ];
  var now = new Date(); now.setHours(0,0,0,0);
  for (var i = 0; i < list.length; i++) {
    var days = Math.round((list[i].date - now) / 86400000);
    if (days >= 0) return { key:list[i].key, label:list[i].label, date:list[i].date, daysUntil:days };
  }
  return null;
}

export function provWhy(prov) {
  /* BACKLOG 93 R-6: keyed by the taxonomy's own values (the old keys were
     pre-taxonomy values no answer produces, so this line was always the
     generic one). */
  var typeLabels = { business_income:'business', rental_income:'rental', crypto_income:'crypto', other_income:'other' };
  var sel = (prov && prov.selected) || [];
  var names = [];
  sel.forEach(function (t) { if (typeLabels[t] && names.indexOf(typeLabels[t]) < 0) names.push(typeLabels[t]); });
  if (names.length) {
    return 'You earn ' + names.join(', ') + ' income, which has little or no PAYE withheld \u2014 so SARS requires you to pay tax in advance during the year.';
  }
  return 'You have income that is not fully covered by PAYE, so SARS requires advance payments during the year.';
}

export function renderProvTaxStatus() {
  var el = document.getElementById('provtax-status'); if (!el) return;
  var prov = (typeof isProvisionalAutoDetermined === 'function') ? isProvisionalAutoDetermined() : { auto:false };
  var isProv = (typeof gs === 'function' && gs('p_provisional') === 'yes') || prov.auto;
  if (!isProv) {
    el.innerHTML = '<div class="card" style="border-left:3px solid var(--tx3)">'
      + '<div style="font-weight:700;margin-bottom:4px"><i class="material-symbols-outlined msi-info u-mr-6"></i>You are not a provisional taxpayer</div>'
      + '<div style="font-size:0.78125rem;color:var(--tx3)">Based on the income you have captured, provisional tax does not apply. If you have rental, business, freelance, or significant investment income not yet captured, add it under Income, or set Provisional = Yes in your Profile.</div></div>';
    return;
  }
  var nd = nextProvDeadline();
  var deadlineHtml;
  if (nd) {
    var urgency = nd.daysUntil <= 14 ? 'var(--er)' : nd.daysUntil <= 45 ? 'var(--wa)' : 'var(--accent2)';
    var dateStr = nd.date.toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
    deadlineHtml = '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<span style="font-weight:700;color:' + urgency + '"><i class="material-symbols-outlined msi-schedule u-mr-5"></i>Next: ' + esc(nd.label) + '</span>'
      + '<span style="font-size:0.78125rem;color:var(--tx2)">' + dateStr + ' \u00b7 in ' + nd.daysUntil + ' day' + (nd.daysUntil === 1 ? '' : 's') + '</span></div>';
  } else {
    deadlineHtml = '<div style="margin-top:8px;font-size:0.78125rem;color:var(--tx2)"><i class="material-symbols-outlined msi-info u-mr-5"></i>This tax year\u2019s provisional deadlines have passed. Make sure your IRP6 returns were filed and complete your ITR12.</div>';
  }
  var recHtml = (typeof provStatusMoney === 'function') ? provStatusMoney(nd) : '';
  el.innerHTML = '<div class="card" style="border-left:3px solid var(--accent2)">'
    + '<div style="font-weight:800;font-size:0.9375rem;margin-bottom:2px"><i class="material-symbols-outlined msi-payments u-mr-6" style="color:var(--accent2)"></i>You are a provisional taxpayer</div>'
    + '<div style="font-size:0.78125rem;color:var(--tx3)">' + provWhy(prov) + '</div>'
    + deadlineHtml + recHtml
    + noteHtml('warning', 'File your IRP6 by each deadline, even with nothing to pay.', 'Filing is separate from paying: submit your IRP6 by each deadline even if no payment is due, and your ITR12 at year-end is still required.', { style: 'margin:10px 0 0', title: 'Filing is separate from paying' })
    + '</div>';
}

export function renderProvTaxHub() {
  /* v8.27: the planner markup lives statically inside #provtax-forecast in
     body.html (the former relocatePlanner() runtime DOM-move and the empty
     #mode-currentyear husk it left behind are gone). */
  if (typeof updateCurrentYear === 'function') updateCurrentYear();
  renderProvTaxStatus();
  if (typeof renderProvRecommendation === 'function') renderProvRecommendation();
  if (typeof renderProvPenalty === 'function') renderProvPenalty();
  renderTaxMilestones();
  renderProvTaxGlanceBottom();
}

/* v8.8 D3/D5: recommended P1/P2/P3 from the planner forecast + safe-harbour note.
   P1 = ½·annual tax − PAYE to August; P2 = annual tax − full PAYE − P1 paid;
   P3 = remaining shortfall to full estimated liability. */
export function renderProvRecommendation() {
  var note = document.getElementById('prov-rec-note'); if (!note) return;
  var f = APP.provForecast || {};
  var annualTax = Math.max(0, Math.round(f.annualTax || 0));
  var payeFull = Math.max(0, Math.round(f.payeFull || 0));
  var payeToAug = Math.max(0, Math.round(f.payeToAug || 0));
  var p1paid = (typeof gv === 'function' ? gv('p_prov_p1') : 0) || 0;
  var p2paid = (typeof gv === 'function' ? gv('p_prov_p2') : 0) || 0;
  var p3paid = (typeof gv === 'function' ? gv('p_prov_topup') : 0) || 0;
  var hasForecast = (f.annualTI || 0) > 0 || annualTax > 0;

  function setRec(id, val) { var e = document.getElementById(id); if (e) e.textContent = hasForecast ? fmt(Math.max(0, Math.round(val))) : '—'; }
  function setRem(id, rec, paid) {
    var e = document.getElementById(id); if (!e) return;
    if (!hasForecast) { e.textContent = ''; return; }
    var rm = Math.max(0, Math.round(rec) - (paid || 0));
    e.innerHTML = 'Paid ' + fmt(paid || 0) + ' \u00b7 ' + (rm > 0 ? ('about <strong>' + fmt(rm) + '</strong> still to reach the recommendation') : '<span style="color:var(--accent2)">fully covered \u2713</span>');
  }

  var p1 = 0.5 * annualTax - payeToAug;
  var p2 = annualTax - payeFull - p1paid;
  var p3 = annualTax - payeFull - p1paid - p2paid;
  setRec('rec-p1', p1); setRem('rem-p1', p1, p1paid);
  setRec('rec-p2', p2); setRem('rem-p2', p2, p2paid);
  setRec('rec-p3', p3); setRem('rem-p3', p3, p3paid);

  /* §5.4: pinned year-end position — visible on every step. Same figures the
     recommendation rows above already display (forecast tax − PAYE − paid). */
  var pin = document.getElementById('provtax-pinbar');
  if (pin) {
    if (!hasForecast) {
      pin.innerHTML = '<span>Year-end projected position</span><span class="prov-pin-amt" style="color:var(--tx3)">complete the forecast</span>';
    } else {
      var outstanding = Math.max(0, Math.round(annualTax - payeFull - p1paid - p2paid - p3paid));
      pin.innerHTML = '<span>Year-end projected position</span><span class="prov-pin-amt" style="color:' +
        (outstanding > 0 ? 'var(--wa)' : 'var(--au)') + '">' +
        (outstanding > 0 ? fmt(outstanding) + ' still due' : fmt(0) + ' — covered ✓') + '</span>';
    }
  }

  if (!hasForecast) {
    setNote(note, 'warning', 'Complete Step 1 above to see what to pay at each deadline.', null, { icon: 'arrow_upward' });
    return;
  }
  var basic = (typeof gv === 'function' ? gv('py_basic_amount') : 0) || 0;
  var safeNote = basic > 0
    ? ' Your safe-harbour minimum uses your last assessed taxable income (basic amount ' + fmt(basic) + ').'
    : ' Tip: enter your <strong>Basic Amount</strong> (last assessed taxable income) below to unlock the lower safe-harbour minimum.';
  var ftcEstimate = (typeof gv === 'function' ? gv('cyr_fc_ftc') : 0) || 0;
  var ftcNote = ftcEstimate > 0
    ? ' The s6quat foreign tax credit reflected here is your <strong>projected year-end credit</strong> based on the foreign tax estimate you entered — it will change if your actual foreign income/tax differs.'
    : '';
  setNote(note, 'info', 'Paying these keeps you penalty-safe.', 'These amounts aim to pay your <strong>full estimated tax for the year</strong> across the deadlines, which keeps you penalty-safe.' + safeNote + ftcNote, { icon: 'lightbulb', title: 'Provisional payments' });
}

export function onProvPaidInput() {
  if (typeof debounceSave === 'function') debounceSave();
  renderProvRecommendation();
  if (typeof renderProvPenalty === 'function') renderProvPenalty();
  if (typeof renderProvTaxStatus === 'function') renderProvTaxStatus();
  if (typeof renderDashboard === 'function') renderDashboard();
}

/* v8.8 D4: penalty & safe-harbour check driven by the planner forecast (not actuals). */
export function renderProvPenalty() {
  var host = document.getElementById('provtax-penalty-note'); if (!host) return;
  var bIn = document.getElementById('provtax_basic');
  if (bIn && document.activeElement !== bIn) {
    var bv = (typeof gv === 'function' ? gv('py_basic_amount') : 0) || 0;
    bIn.value = bv > 0 ? String(Math.round(bv)) : '';
  }
  var f = APP.provForecast || {};
  if ((f.annualTI || 0) <= 0 && (f.annualTax || 0) <= 0) {
    host.innerHTML = '<div class="note info" style="margin:8px 0 0;font-size:0.78125rem"><i class="material-symbols-outlined msi-info u-mr-5"></i>Complete the forecast in Step 1 to check your penalty exposure.</div>';
    return;
  }
  var ty = (typeof getActiveTaxYear === 'function') ? getActiveTaxYear() : null;
  var r = { ty: ty, taxableIncome: f.annualTI || 0, rebates: f.rebates || 0, med: { total: f.medTotal || 0 } };
  var pp = calcProvisionalPenalty(r, { payeTotal: f.payeFull || 0 });
  var thresholdLabel = pp.isHighIncome ? '80%' : '90%';
  var safeHarbour = (pp.safeHarbour === 'basic_amount') ? ' <span class="pill ok" style="font-size:0.625rem"><i class="material-symbols-outlined msi-no-encryption"></i> basic-amount safe harbour</span>' : '';
  var cls, msg;
  if (pp.triggered) {
    cls = 'error';
    msg = '<i class="material-symbols-outlined msi-error u-mr-6"></i><strong>Penalty risk on your forecast:</strong>' + safeHarbour + '<br>'
      + 'You should have paid about <strong>' + fmt(pp.requiredPayment) + '</strong> (the ' + thresholdLabel + ' safe-harbour). '
      + 'PAYE + provisional so far = <strong>' + fmt(pp.totalPaid) + '</strong>. '
      + 'If this holds, SARS could add a <strong>' + fmt(pp.penalty) + '</strong> penalty (20% of the ' + fmt(pp.penaltyBase) + ' shortfall). Top up before 28 February to avoid it.';
  } else {
    cls = 'lime';
    msg = '<i class="material-symbols-outlined msi-check-circle u-mr-6"></i><strong>No penalty risk on your forecast.</strong>' + safeHarbour + '<br>'
      + 'PAYE + provisional = <strong>' + fmt(pp.totalPaid) + '</strong>, at or above the ' + thresholdLabel + ' safe-harbour of ' + fmt(pp.requiredPayment) + '.';
  }
  host.innerHTML = '<div class="note ' + cls + '" style="margin-top:8px">' + msg + '</div>';
}

export function onProvBasicInput() {
  var bIn = document.getElementById('provtax_basic');
  if (bIn && typeof sv === 'function') sv('py_basic_amount', bIn.value || '');
  if (typeof debounceSave === 'function') debounceSave();
  renderProvRecommendation();
  renderProvPenalty();
  if (typeof renderProvTaxStatus === 'function') renderProvTaxStatus();
}

/* v8.8 D6: pure recommended-amount compute (no DOM) so the dashboard milestones can
   show the same P1/P2/P3 figures as the hub. */
export function provRecommendations() {
  var f = APP.provForecast || {};
  var annualTax = Math.max(0, Math.round(f.annualTax || 0));
  var payeFull = Math.max(0, Math.round(f.payeFull || 0));
  var payeToAug = Math.max(0, Math.round(f.payeToAug || 0));
  var p1paid = (typeof gv === 'function' ? gv('p_prov_p1') : 0) || 0;
  var p2paid = (typeof gv === 'function' ? gv('p_prov_p2') : 0) || 0;
  return {
    hasForecast: (f.annualTI || 0) > 0 || annualTax > 0,
    p1: Math.max(0, Math.round(0.5 * annualTax - payeToAug)),
    p2: Math.max(0, Math.round(annualTax - payeFull - p1paid)),
    p3: Math.max(0, Math.round(annualTax - payeFull - p1paid - p2paid)),
    estAnnual: annualTax
  };
}

/* ── PROVTAX GLANCE-BOTTOM: at-a-glance strip with 2 metrics ── */
export function renderProvTaxGlanceBottom() {
  const el = $('provtax-glance-bottom');
  if (!el) return;

  function _enc(str) { return str.replace(/"/g, '&quot;'); }
  function _iBtn(tip) {
    return '<span class="info-btn" data-tip="' + _enc(tip) + '" tabindex="0" role="button" aria-label="Details"><i class="material-symbols-outlined msi-info"></i></span>';
  }

  const p1 = gv('p_prov_p1') || 0;
  const p2 = gv('p_prov_p2') || 0;
  const p3 = gv('p_prov_topup') || 0;
  const provTotal = p1 + p2 + p3;

  const recs = (typeof provRecommendations === 'function') ? provRecommendations() : { hasForecast:false, estAnnual:0 };
  const estAnnual = recs.estAnnual || 0;

  let html = '';

  // Chip 1: Provisional Tax Summary
  const status = provTotal >= estAnnual ? 'Paid' : 'Under';
  const statusColor = provTotal >= estAnnual ? 'var(--ok)' : 'var(--wa)';
  const diff = Math.abs(provTotal - estAnnual);

  const provTip = '<strong>Provisional Tax Summary</strong><br>'
    + 'P1: ' + fmt(p1) + '<br>'
    + 'P2: ' + fmt(p2) + '<br>'
    + 'P3: ' + fmt(p3) + '<br>'
    + '<strong>Total Paid: ' + fmt(provTotal) + '</strong><br>'
    + 'Estimated Annual: ' + fmt(estAnnual) + '<br>'
    + (provTotal >= estAnnual ? '<strong style="color:var(--ok)">Over by ' + fmt(diff) + '</strong>' : '<strong style="color:var(--wa)">Short by ' + fmt(diff) + '</strong>');

  html += '<div class="gc">'
    + '<div class="gc-val" style="color:' + statusColor + '">' + fmt(provTotal) + '</div>'
    + '<div class="gc-lbl">' + lblWithInfo('Provisional Tax ' + status, _iBtn(provTip)) + '</div>'
    + '</div>';

  // Chip 2: Next Deadline Countdown
  const yr = parseInt(gs('taxYear') || '2027');
  const today = new Date();

  const deadlines = [
    { label:'P1 due', date:new Date(yr-1, 7, 31), recField:'p1' },
    { label:'P2 due', date:new Date(yr, 1, lastDayOfFeb(yr)), recField:'p2' },
    { label:'P3 due', date:new Date(yr, 8, 30), recField:'p3' },
  ];
  /* Return due is anchored to the tax year currently IN its filing season
     (getFilingSeasonTaxYear), NOT the active/in-progress `yr` above used
     for P1/P2/P3 — you can't file a return for a year that hasn't ended.
     This hub only renders for provisional taxpayers, so always the
     extended (January) date, not the non-provisional October one. Device
     QA found the old formula showing a return date over a year away. */
  const filingDl = FILING_DEADLINES[String(getFilingSeasonTaxYear(today))];
  if (filingDl) {
    deadlines.push({ label:'Return due', date:new Date(filingDl.provisional), recField:null });
  }
  deadlines.sort((a, b) => a.date - b.date);

  const nextDl = deadlines.find(d => d.date >= today);
  if (nextDl) {
    const daysLeft = Math.ceil((nextDl.date - today) / (1000*60*60*24));
    const recAmt = (nextDl.recField && recs[nextDl.recField]) ? recs[nextDl.recField] : 0;

    const dlTip = '<strong>' + nextDl.label + '</strong><br>'
      + 'Due: ' + nextDl.date.toLocaleDateString('en-ZA', {day:'numeric', month:'long', year:'numeric'}) + '<br>'
      + 'Days remaining: ' + daysLeft + '<br>'
      + (recAmt > 0 ? 'Recommended amount: ' + fmt(recAmt) : '');

    const dlColor = daysLeft < 0 ? 'var(--er)' : daysLeft < 7 ? 'var(--wa)' : 'var(--tx)';
    html += '<div class="gc">'
      + '<div class="gc-val" style="color:' + dlColor + '">' + (daysLeft < 0 ? 'Overdue' : daysLeft + 'd') + '</div>'
      + '<div class="gc-lbl">' + lblWithInfo('Next: ' + nextDl.label, _iBtn(dlTip)) + '</div>'
      + '</div>';
  }

  el.innerHTML = html;
}

/* ── C6: Income sub-page 2-chip glance strips ── */
export function renderIncomeSubpageGlances() {
  const r = calcFullTax();
  if (!r || !r.ty || !r.ty.brackets) return;

  function _enc(str) { return str.replace(/"/g, '&quot;'); }
  function _iBtn(tip) {
    return '<span class="info-btn" data-tip="' + _enc(tip) + '" tabindex="0" role="button" aria-label="Details"><i class="material-symbols-outlined msi-info"></i></span>';
  }

  // Bracket-delta tax impact of adding `amount` of income to current taxable income
  function taxImpact(amount) {
    if (amount <= 0) return 0;
    const tiWith = r.taxableIncome;
    const tiWithout = Math.max(0, tiWith - amount);
    return Math.max(0, calcTaxOnIncome(tiWith, r.ty.brackets) - calcTaxOnIncome(tiWithout, r.ty.brackets));
  }

  function renderChips(containerId, amount, label, color, categoryNav) {
    const el = $(containerId);
    if (!el) return;
    if (amount <= 0) { el.innerHTML = ''; return; }
    const impact = taxImpact(amount);
    const catTip = '<strong>' + label + '</strong><br>Category total: ' + fmt(amount);
    const impTip = '<strong>Tax impact of ' + label + '</strong><br>'
      + 'Adding ' + fmt(amount) + ' increases your tax by approximately ' + fmt(impact) + '<br>'
      + 'Based on your current bracket position at ' + ((r.marginalRate || 0) * 100).toFixed(0) + '% marginal rate';
    let html = '';
    html += '<div class="gc"' + (categoryNav ? ' onclick="' + categoryNav + '" style="cursor:pointer"' : '') + '>'
      + '<div class="gc-val" style="color:' + color + '">' + fmt(amount) + '</div>'
      + '<div class="gc-lbl">' + lblWithInfo(label, _iBtn(catTip)) + '</div>'
      + '</div>';
    html += '<div class="gc">'
      + '<div class="gc-val" style="color:var(--er)">+' + fmt(impact) + '</div>'
      + '<div class="gc-lbl">' + lblWithInfo('Est. tax on this', _iBtn(impTip)) + '</div>'
      + '</div>';
    el.innerHTML = html;
  }

  // task #27: Employment "at a glance" — reuses this same renderChips()
  // component (owner's explicit direction). Sums the same IRP5 income
  // categories renderIncomeGlance()'s hero tile already uses for
  // "Employment", so the two can't disagree.
  const employmentTotal = (APP.incomeItems || [])
    .filter(function(i) { return ['salary','bonus','commission','overtime','contractor','director'].includes(i.cat); })
    .reduce(function(s, i) { return s + (i.amount || 0); }, 0);
  renderChips('glance-b1employment', employmentTotal, 'Employment Income', 'var(--ico-blue)', null);

  // Investment income (Batch M: #glance-b2investment now holds the 4 calc-cards
  // rendered by renderIt3bList() — that runs after this step in renderAll(), so
  // no renderChips() call here to avoid a pointless overwrite-then-overwrite).

  // Rental — net income
  renderChips('glance-b3rental', r.rentalIncome || 0, 'Rental Income', 'var(--ico-green)', null);

  // Business — net profit
  renderChips('glance-b4business', r.businessIncome || 0, 'Business Income', 'var(--ico-orange)', null);

  // CGT — taxable gain
  renderChips('glance-b5cgt', r.cgtTaxableGain || 0, 'Taxable Capital Gain', 'var(--ico-purple)', null);

  // Foreign income (Batch M: "Foreign Income"/"Est. tax on this" cards removed —
  // the b6 Foreign sub-page's own summary + FTC card cover this).

  // Retirement B7 — pension/annuity income (regular receipts)
  // engine-remediation W12: pensionAnnuityItems store `amount` (see M_pension,
  // 05-list-modules.js) — this previously read nonexistent `annual`/`monthly`
  // fields, so retRegular was always 0 regardless of entries.
  const retRegular = (APP.pensionAnnuityItems || []).reduce(function(s, i) { return s + (i.amount || 0); }, 0);
  renderChips('glance-b7retirement', retRegular, 'Retirement Income', 'var(--ico-pink)', null);

  // Crypto
  renderChips('glance-b10crypto', r.cryptoRevenue || 0, 'Crypto Income', 'var(--ico-amber)', null);

  // Other receipts
  renderChips('glance-b9other', r.otherReceiptsIncome || 0, 'Other Receipts', 'var(--tx3)', null);
}

/* D2 — outstanding items accordion at bottom of income main page.
   */
/* Theme 4: raw (pre-override-filter) income outstanding-item list — the
   single source shared by this page's own render below AND the unified
   Dashboard outstanding-items section (renderDashboardOutstanding,
   08-dashboard-theme.js), so neither can disagree with the other. Each
   item's `nav` is the [tab, sub] pair for navigateTo(). */
/* OD-21 / STD-BEHAV-6 (§L.8): rebuilt data-driven over the FULL income-type
   list, keyed by INCOME_TYPE_DEFS value rather than one hand-written `if`
   per type. The previous version simply had no entry for `other_income`
   (bucket 9) — selecting it in onboarding and never capturing anything left
   it neither "captured" nor "todo", so it fell out of both this list AND
   HERO-16's ring denominator (`captured/(captured+todo)`), reading as if it
   were 100% done. */
const INCOME_OUTSTANDING_CHECKS = {
  employment_income: { label: 'Employment income (IRP5)',
    /* INC-17 (§L.4 0b-3): this was `!itemCats.includes('salary')`, so
       capturing a 3605 bonus, a 3606 commission or a 3801 fringe benefit
       left the row simultaneously Completed (the bucket holds records) and
       Still-to-add. It now asks the taxonomy directly: any captured code in
       bucket 1 is employment income. Items predating the source-code
       capture path carry no `code`, so the original 'salary' test is kept
       as the fallback for those and nothing regresses. */
    hasData: () => (APP.incomeItems || []).some(i => (i.code != null && i.code !== '')
      ? EMPLOYMENT_INCOME_CODES.has(String(i.code))
      : i.cat === 'salary') },
  business_income: { label: 'Business / self-employment income',
    hasData: () => {
      const itemCats = (APP.incomeItems || []).map(i => i.cat);
      return itemCats.includes('contractor') || itemCats.includes('commission')
        || !!(APP.businessItems && APP.businessItems.length)
        || !!(APP.appliedValues && APP.appliedValues.business);
    } },
  rental_income: { label: 'Rental income',
    hasData: () => !!(APP.appliedValues && APP.appliedValues.rental) },
  cgt: { label: 'Capital gains disposals',
    hasData: () => !!(APP.cgtAssets && APP.cgtAssets.length) },
  investment_income: { label: 'Investment income (IT3(b))',
    hasData: () => !!(APP.it3bItems && APP.it3bItems.length) || !!gv('int_gross') },
  retirement_income: { label: 'Retirement / pension income',
    hasData: () => {
      const itemCats = (APP.incomeItems || []).map(i => i.cat);
      return itemCats.includes('pension') || itemCats.includes('lumpsum')
        || !!(APP.pensionAnnuityItems && APP.pensionAnnuityItems.length)
        || !!(APP.retirementLumpsums && APP.retirementLumpsums.length);
    } },
  crypto_income: { label: 'Crypto income / disposals',
    hasData: () => !!(APP.cryptoDisposals || []).length || !!(APP.cryptoRevenue || []).length },
  other_income: { label: 'Other money you received',
    hasData: () => !!(APP.otherReceipts && APP.otherReceipts.length) },
};

export function getIncomeOutstanding() {
  const selected = getSelectedIncomeTypes();
  const outstanding = [];

  /* QA 2026-09 round 2: PAYE has no entry in INCOME_OUTSTANDING_CHECKS
     below (it's a selector-page toggle, not an INCOME_TYPE_DEFS bucket),
     so it never appeared in the dashboard's "Add your income" outstanding
     list even when Employment income is selected and no PAYE amount has
     been captured or confirmed-none. Mirrors incomeSelectorRows()'s own
     _paye._todo rule (same file, above) rather than duplicating a second
     source of truth for "is PAYE still outstanding". */
  if (selected.includes('employment_income') && !APP.noPayeConfirmed) {
    const payeAmt = (APP.employerPaye || []).reduce(function(s, e) { return s + (e.paye || 0); }, 0);
    if (payeAmt <= 0) {
      outstanding.push({ key: 'missing_paye', label: 'PAYE', route: 'paye', nav: captureNav('paye'), icon: 'account_balance' });
    }
  }

  if (!selected.length) return outstanding;

  selected.forEach(function(type) {
    const check = INCOME_OUTSTANDING_CHECKS[type];
    if (!check) return; /* no capture screen for this type */
    if (!check.hasData()) {
      const meta = _INCOME_CHIP_META[type];
      outstanding.push({ key: 'missing_' + type, label: check.label, route: type, nav: captureNav(type),
                          icon: meta && meta.icon });
    }
  });
  return outstanding;
}

export function renderOutstandingBottom() {
  const el = $('income-outstanding-bottom'); if(!el) return;
  /* B4 (01-SPEC.md §3.2, item 42): no dismiss checkbox. There is one way to
     make an outstanding item go away — capture it, or tell the app it does
     not apply (which the selector toggle does, writing back to Profile).
     A checkbox that hid the reminder without changing anything let a real
     gap in a return look resolved. Rows are clickable straight to their
     page — the `nav` this list always carried but never wired (item 3). */
  const pending = getIncomeOutstanding();
  if (!pending.length) { el.innerHTML = ''; return; }

  const rows = pending.map(function(o) {
    const nav = o.route ? 'navigateToCapture(\'' + o.route + '\')' : '';
    return '<div class="outstanding-item"' + (nav ? ' onclick="' + nav + '" role="button" tabindex="0" style="cursor:pointer"' : '') + '>'
      + '<i class="material-symbols-outlined msi-warning" style="color:var(--wa);font-size:0.75rem"></i>'
      + '<span>' + esc(o.label) + '</span>'
      + (o.nav ? '<i class="material-symbols-outlined msi-chevron-right" style="margin-left:auto;color:var(--tx3);font-size:0.6875rem"></i>' : '')
      + '</div>';
  }).join('');

  el.innerHTML = '<details class="outstanding-acc">'
    + '<summary>\u26a0 ' + pending.length + ' still to add <span class="chev">\u25be</span></summary>'
    + '<div class="body">' + rows + '</div>'
    + '</details>';
}
