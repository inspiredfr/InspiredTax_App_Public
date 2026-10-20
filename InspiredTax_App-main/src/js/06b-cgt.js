import { getFact, PARA45_PROCEEDS_LIMIT, randText } from './01-data.js';
import { $, APP, esc, fmt, getActiveTaxYear, gs, gv, heroBreakdownLink, renderBucketNav, taxableIt3bItems, iconClassFor } from './02-core.js';
import { makeCrudModule } from './05-list-modules.js';
import { cryptoTotals } from './06-crypto.js';

/* ═══════════════════════════════════════════════════════════
   B5 CGT — BATCH 5 SESSION 4 (REWRITE)
   Full net calculator: Proceeds − Selling Costs − (Base Cost + Improvements) = Gain
   Asset types: property, listed_shares, unlisted_shares, crypto, collective, other
   Foreign flag (matches B3/B4 pattern)
   Crypto routed via crypto_cgt sub-checkbox (Batch 3 architecture)
   ═══════════════════════════════════════════════════════════ */

/* cgtAssets carry BOTH `desc` (the record descriptor) and `note` (a separate
   free-text note) — two intentionally distinct fields, not duplicates. */
export const M_cgt = makeCrudModule({
  array: 'cgtAssets', entKey: 'income.cgt', applyType: 'cgt', modalId: 'modal-cgt-asset', titleId: 'cgt-modal-title',
  titles: { add: 'Add CGT disposal', edit: 'Edit CGT disposal' },
  fields: [
    { el:'cgt-type',           key:'type',            kind:'raw', def:'property' },
    { el:'cgt-desc',           key:'desc',            kind:'str' },
    { el:'cgt-proceeds',       key:'proceeds',        kind:'num' },
    { el:'cgt-basecost',       key:'baseCost',        kind:'num' },
    { el:'cgt-improvements',   key:'improvements',    kind:'num' },
    { el:'cgt-selling-costs',  key:'sellingCosts',    kind:'num' },
    { el:'cgt-source-country', key:'sourceCountry',   kind:'str' },
    { el:'cgt-ownership-share', key:'ownershipShare', kind:'num', def:100 },
    { el:'cgt-note',           key:'note',            kind:'str' }
  ],
  onClear: () => { const e = $('cgt-primary-res'); if(e) e.value = 'no'; const p = $('cgt-para45b'); if(p) p.value = 'no'; },
  onLoad:  (a) => { const e = $('cgt-primary-res'); if(e) e.value = a.primaryRes ? 'yes' : 'no';
    const p = $('cgt-para45b'); if(p) p.value = a.para45b === 'yes' ? 'yes' : 'no'; },
  onForm: () => { cgtToggleType(); cgtUpdateLiveCalc(); },
  validate: () => {
    if(!(gs('cgt-desc')||'').trim()) return { el:'cgt-desc', msg:'This is required.' };
    if((gv('cgt-proceeds')||0) <= 0) return { el:'cgt-proceeds', msg:'Enter an amount.' };
    return null;
  },
  collect: (cur) => {
    const type = gs('cgt-type') || 'property';
    return {
      id:              cur ? cur.id : Date.now() + Math.random(),
      type,
      desc:            (gs('cgt-desc')||'').trim(),
      proceeds:        gv('cgt-proceeds') || 0,
      sellingCosts:    gv('cgt-selling-costs') || 0,
      baseCost:        gv('cgt-basecost') || 0,
      improvements:    gv('cgt-improvements') || 0,
      primaryRes:      gs('cgt-primary-res') === 'yes',
      para45b:         gs('cgt-para45b') === 'yes' ? 'yes' : 'no',
      foreign:         type === 'foreign' ? 'yes' : 'no',
      sourceCountry:   (gs('cgt-source-country')||'').trim(),
      ownershipShare:  Math.min(100, Math.max(0, gv('cgt-ownership-share') != null ? gv('cgt-ownership-share') : 100)),
      note:            (gs('cgt-note')||'').trim()
    };
  },
  refresh: () => renderCgtResult(),
  confirm: { title: 'Remove Disposal', msg: 'Delete this CGT disposal?' },
  removeBy: 'idOrIndex'
});
export function addCgtAsset()           { M_cgt.add(); }
export function editCgtAsset(i)         { M_cgt.edit(i); }
export function saveCgtAsset()          { M_cgt.save(); }
export function removeCgtAsset(idOrIdx) { M_cgt.remove(idOrIdx); }

export function cgtToggleType() {
  const t = gs('cgt-type');
  const primaryRow = $('cgt-primary-res-row');
  if(primaryRow) primaryRow.style.display = (t === 'property') ? '' : 'none';
  const countryRow = $('cgt-country-row');
  if(countryRow) countryRow.style.display = (t === 'foreign') ? '' : 'none';
  cgtTogglePara45b();
  cgtUpdateLiveCalc();
}

// engine-remediation W14: the para 45(1)(b) full-disregard question only
// makes sense for a primary-residence property disposal.
export function cgtTogglePara45b() {
  const row = $('cgt-para45b-row');
  if(row) row.style.display = (gs('cgt-type') === 'property' && gs('cgt-primary-res') === 'yes') ? '' : 'none';
}

export function cgtUpdateLiveCalc() {
  const proceeds = gv('cgt-proceeds') || 0;
  const sellingCosts = gv('cgt-selling-costs') || 0;
  const baseCost = gv('cgt-basecost') || 0;
  const improvements = gv('cgt-improvements') || 0;
  const primaryRes = gs('cgt-primary-res') === 'yes';
  const isProperty = gs('cgt-type') === 'property';
  const para45b = gs('cgt-para45b');
  const ownershipShare = gv('cgt-ownership-share');

  // engine-remediation W14: live preview now calls the same calcCgtAssetGain
  // used at save time (house rule: one calculation path, never a parallel
  // inline re-implementation) — this also picks up the para 45(1)(a)
  // symmetric loss disregard and the para 45(1)(b) full-disregard field for
  // free instead of hand-duplicating them here.
  const r = calcCgtAssetGain({
    proceeds, sellingCosts, baseCost, improvements,
    primaryRes, type: isProperty ? 'property' : gs('cgt-type'), para45b, ownershipShare
  });
  const netProceeds = r.netProceeds, totalCost = r.totalCost, gain = r.gain, excludedAmount = r.primaryResExcluded;
  /* v8.22 HO: cross-warning — primary residence + active home-office deduction */
  var _hoCross = primaryRes && !!(APP.dedChecks && APP.dedChecks.homeoffice) && (gs('ho_ownership') === 'own');
  const isLoss = gain < 0;
  const para45bDisabled = primaryRes && isProperty && para45b === 'yes' && proceeds > PARA45_PROCEEDS_LIMIT;

  const liveEl = $('cgt-live-calc'); if(!liveEl) return;
  if(proceeds === 0 && baseCost === 0) { liveEl.innerHTML = ''; return; }

  liveEl.innerHTML = `<div style="background:var(--sf3);border-radius:6px;padding:10px 12px;margin-top:10px;font-size:0.75rem">
    <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Proceeds</span><span>${fmt(proceeds)}</span></div>
    ${sellingCosts > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Less: Selling costs</span><span>− ${fmt(sellingCosts)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Net proceeds</span><span>${fmt(netProceeds)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Less: Base cost</span><span>− ${fmt(baseCost)}</span></div>
    ${improvements > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Less: Improvements</span><span>− ${fmt(improvements)}</span></div>` : ''}
    ${excludedAmount !== 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--ok)"><span>${isLoss || excludedAmount < 0 ? 'Less: Primary residence loss disregarded' : 'Less: Primary residence exclusion'}</span><span>− ${fmt(Math.abs(excludedAmount))}</span></div>` : ''}
    ${para45bDisabled ? '<div style="padding:4px 0;color:var(--wa);font-size:0.6875rem"><i class="material-symbols-outlined msi-warning u-mr-5"></i>Full-disregard answer ignored — proceeds exceed the ${randText(PARA45_PROCEEDS_LIMIT)} para 45(1)(b) limit. The standard exclusion still applies.</div>' : ''}
    ${_hoCross ? '<div style="padding:4px 0;color:var(--wa);font-size:0.6875rem"><i class="material-symbols-outlined msi-warning u-mr-5"></i>Home-office deduction active — the office portion may not qualify for the primary residence exclusion.</div>' : ''}
    <div style="display:flex;justify-content:space-between;padding:4px 0;margin-top:4px;border-top:1px solid var(--bd);font-weight:700;color:${isLoss?'var(--er)':'var(--ok)'}">
      <span>Capital ${isLoss?'Loss':'Gain'} (this disposal)</span><span>${fmt(Math.abs(gain))}</span>
    </div>
  </div>`;
}


export function calcCgtAssetGain(a) {
  const netProceeds = (a.proceeds || 0) - (a.sellingCosts || 0);
  const totalCost = (a.baseCost || 0) + (a.improvements || 0);
  let gain = netProceeds - totalCost;
  let primaryResExcluded = 0;
  if(a.primaryRes && a.type === 'property') {
    // engine-remediation W14: para 45(1)(b) full disregard — sole domestic
    // use for the WHOLE period of ownership + proceeds <= R2m disregards the
    // entire gain (never a loss — a loss falls through to the para 45(1)(a)
    // symmetric treatment below). Hard-disabled above the R2m proceeds
    // limit: the flag is ignored regardless of its value, no warn-but-apply
    // state. PARA45_PROCEEDS_LIMIT is NOT cgt.primaryResExcl and does not
    // move with it. C-2a: the R2m/R3m thresholds test the FULL disposal's
    // own proceeds/gain, not a co-owner's derived share — the share
    // multiplier is applied to the OUTCOME below, after the exclusion.
    if(a.para45b === 'yes' && gain > 0 && (a.proceeds || 0) <= PARA45_PROCEEDS_LIMIT) {
      primaryResExcluded = gain;
      gain = 0;
    } else {
      // para 45(1)(a): "a natural person must disregard so much of a capital
      // gain OR capital loss" attributable to the primary residence, up to
      // the annual exclusion — symmetric for gains and losses.
      const excl = getFact('cgt.primaryResExcl');
      if(gain > 0)      { primaryResExcluded = Math.min(gain, excl);  gain -= primaryResExcluded; }
      else if(gain < 0) { primaryResExcluded = Math.max(gain, -excl); gain -= primaryResExcluded; }
    }
  }
  /* C-2a: a co-owned asset's gain/loss accrues only to the extent of this
     taxpayer's own beneficial ownership share (general accrual principle;
     para 1 Eighth Schedule "proceeds" — an amount received by or accrued to
     the person who disposed of their own interest in the asset). */
  const share = Math.min(100, Math.max(0, a.ownershipShare != null ? a.ownershipShare : 100)) / 100;
  gain *= share;
  primaryResExcluded *= share;
  return { netProceeds, totalCost, gain, primaryResExcluded };
}

/* Batch 2: pure aggregate read, no side effects — the single source of
   truth for the CGT breakdown cards on the Income main "At a glance"
   panel (Eighth Schedule: general/primary-residence/crypto gains ->
   annual exclusion (para 5) -> loss b/f -> 40% inclusion (para 10)).
   renderCgtResult() below calls this too, so the two never diverge. */
export function cgtAggregate() {
  let totalGains = 0, totalLosses = 0, totalForeignGain = 0, hasPrimaryRes = false;
  let general = 0, primaryRes = 0, primaryResExcluded = 0;
  (APP.cgtAssets || []).forEach(a => {
    const r = calcCgtAssetGain(a);
    if(r.gain > 0) {
      totalGains += r.gain;
      if(a.type === 'foreign' || a.foreign === 'yes') totalForeignGain += r.gain;
    } else {
      totalLosses += Math.abs(r.gain);
    }
    /* The gain the s45 exclusion took out of each residence (already scaled
       by ownership share). An excluded loss is not an exemption, so only a
       positive amount counts — the Exempt income card's memo line reads this. */
    if(a.primaryRes && a.type === 'property') { hasPrimaryRes = true; primaryRes += r.gain; primaryResExcluded += Math.max(0, r.primaryResExcluded); }
    else { general += r.gain; }
  });
  const cryptoCgt = (typeof cryptoTotals === 'function') ? (cryptoTotals().cgtNet || 0) : 0;
  const otherCapitalGain = (APP.otherReceipts || []).reduce((s,i) => i.receiptType === 'capital' ? s + ((i.proceeds||0)-(i.baseCost||0)) : s, 0);
  const it3bForeignCgt = taxableIt3bItems().reduce((s,i) => s + (i.foreignCapitalGains || 0), 0);
  const netGain = totalGains - totalLosses + cryptoCgt + otherCapitalGain + it3bForeignCgt;
  const annualExcl = getFact('cgt.annualExcl');
  const inclusionRate = getFact('cgt.inclusion');
  const cgtLossBf = gv('cgt_loss_bf') || 0;
  const aggAfterExcl = netGain >= 0
    ? Math.max(0, netGain - annualExcl)
    : -Math.max(0, Math.abs(netGain) - annualExcl);
  const afterExcl = Math.max(0, aggAfterExcl - cgtLossBf);
  const taxableGain = afterExcl * inclusionRate;
  const capitalLossCF = aggAfterExcl < 0
    ? (Math.abs(aggAfterExcl) + cgtLossBf)
    : Math.max(0, cgtLossBf - aggAfterExcl);
  return {
    totalGains, totalLosses, totalForeignGain, hasPrimaryRes, general, primaryRes, primaryResExcluded, cryptoCgt,
    otherCapitalGain, it3bForeignCgt, netGain, annualExcl, inclusionRate, cgtLossBf,
    aggAfterExcl, afterExcl, taxableGain, capitalLossCF,
    totalGrossByCategory: general + primaryRes + cryptoCgt
  };
}

export function renderCgtResult() {
  const listEl  = $('cgt-asset-list');
  const resEl   = $('cgt-result');
  const glanceEl = $('glance-b5cgt');
  const ty = getActiveTaxYear();
  const typeLabels = {
    property:'Property', shares:'Shares', vehicle:'Vehicle / Equipment / Movables',
    foreign:'Foreign', other:'Other',
    listed_shares:'Listed Shares', unlisted_shares:'Unlisted Shares',
    crypto:'Crypto', collective:'Collective Investment'
  };
  const typeIcons = {
    property:'home', shares:'show_chart', vehicle:'directions_car',
    foreign:'public', other:'inventory_2',
    listed_shares:'show_chart', unlisted_shares:'business',
    crypto:'currency_bitcoin', collective:'layers'
  };

  if(listEl) {
    if(!(APP.cgtAssets||[]).length) {
      /* QA 2026-09: persistent "+ Add disposal" button at the top of this
         page is the only add-CTA now — this duplicated it. */
      listEl.innerHTML = '';
    } else {
      listEl.innerHTML = APP.cgtAssets.map((a, i) => {
        const r = calcCgtAssetGain(a);
        const isLoss = r.gain < 0;
        const isForeign = a.type === 'foreign' || a.foreign === 'yes';
        return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <i class="${iconClassFor(typeIcons[a.type]||'inventory_2')}" style="color:var(--ico-amber);font-size:0.75rem"></i>
                <strong style="font-size:0.875rem">${esc(a.desc)}</strong>
                <span class="pill" style="font-size:0.625rem;background:rgba(217,119,6,0.15);color:var(--ico-amber)">${esc(typeLabels[a.type]||a.type)}</span>
                ${a.primaryRes && a.type === 'property' ? '<span class="pill ok" style="font-size:0.625rem">Primary Res</span>' : ''}
                ${isForeign && a.sourceCountry ? '<span class="pill" style="font-size:0.625rem;background:rgba(31,95,175,0.18);color:var(--tel)">'+esc(a.sourceCountry)+'</span>' : ''}
                ${(a.ownershipShare != null && a.ownershipShare < 100) ? `<span class="pill" style="font-size:0.625rem">${a.ownershipShare}% share</span>` : ''}
              </div>
              <div style="display:flex;gap:14px;margin-top:7px;font-size:0.75rem;color:var(--tx2);flex-wrap:wrap">
                <span><strong>Proceeds:</strong> ${fmt(a.proceeds)}</span>
                <span><strong>Base:</strong> ${fmt(r.totalCost)}</span>
                ${r.primaryResExcluded > 0 ? `<span style="color:var(--ok)"><strong>Excl:</strong> ${fmt(r.primaryResExcluded)}</span>` : ''}
                <span style="font-weight:700;color:${isLoss?'var(--er)':'var(--ok)'}">${isLoss?'Loss':'Gain'}: ${fmt(Math.abs(r.gain))}</span>
              </div>
              ${a.note ? '<div style="margin-top:4px;font-size:0.6875rem;color:var(--tx3)"><em>'+esc(a.note)+'</em></div>' : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-xs" onclick="editCgtAsset(${i})" aria-label="Edit disposal"><i class="material-symbols-outlined msi-edit"></i></button>
              <button class="btn btn-danger btn-xs" onclick="removeCgtAsset(${i})" aria-label="Remove disposal"><i class="material-symbols-outlined msi-delete"></i></button>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  /* The CGT base also receives crypto capital gains (cryptoTotals().cgtNet) and
     capital-nature other-receipts, aggregated into netGain below. Only short-circuit
     when there is genuinely NO CGT input — otherwise a taxpayer with a crypto capital
     disposal (which defaults to classification 'capital') but no manual CGT asset would
     have that gain silently dropped from the CGT base (s26A / Eighth Schedule). */
  var _cgtCryptoPreview = (typeof cryptoTotals === 'function') ? (cryptoTotals().cgtNet || 0) : 0;
  var _cgtOtherCapPreview = (APP.otherReceipts || []).reduce(function(s,i){ return i.receiptType === 'capital' ? s + ((i.proceeds||0)-(i.baseCost||0)) : s; }, 0);
  /* engine-remediation W4 (s26A, paras 3-8 Eighth Schedule): IT3(b)-certificate
     foreign capital gains (income code 4252) are capital, not revenue — they
     enter the Eighth Schedule CGT aggregate here (annual exclusion, loss b/f,
     40% inclusion all apply), not calcTaxableInvestment's ordinary-income sum. */
  var _it3bForeignCgt = taxableIt3bItems().reduce(function(s,i){ return s + (i.foreignCapitalGains || 0); }, 0);
  if(!(APP.cgtAssets||[]).length && _cgtCryptoPreview === 0 && _cgtOtherCapPreview === 0 && _it3bForeignCgt === 0) {
    if(resEl) resEl.innerHTML = '';
    if(glanceEl) glanceEl.innerHTML = '';
    { const heroElC = $('hero-b5cgt'); if(heroElC) heroElC.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')"><div class="dhero-top"><div class="dhero-lbl">Taxable capital gain</div></div><div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b5cgt">' + fmt(0) + '</div><div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No disposals yet — add an asset sale below to calculate your CGT.</div></div>'; }
    APP.pendingValues.cgt = 0;
    APP.appliedValues.cgt = 0;
    /* engine-remediation W9: reset the s6quat foreign-CGT inputs too when there's no CGT base at all. */
    APP.pendingValues.cgtAfterExclBeforeInclusion = 0;
    APP.appliedValues.cgtAfterExclBeforeInclusion = 0;
    APP.pendingValues.foreignCgtRawGain = 0;
    APP.appliedValues.foreignCgtRawGain = 0;
    if(typeof renderBucketNav === 'function') renderBucketNav();
    return;
  }

  const _agg = cgtAggregate();
  const { totalGains, totalLosses, totalForeignGain, hasPrimaryRes, netGain, annualExcl,
    inclusionRate, cgtLossBf, aggAfterExcl, afterExcl, taxableGain, capitalLossCF,
    cryptoCgt: _cryptoCgt, otherCapitalGain: _otherCapitalGain } = _agg;
  const primaryResExcl = getFact('cgt.primaryResExcl');
  APP.capitalLossCF = capitalLossCF;
  APP.pendingValues.cgt = taxableGain;
  APP.appliedValues.cgt = taxableGain;
  /* engine-remediation W9 (s6quat single overall limitation): the engine needs
     the post-exclusion/post-loss-b/f net gain BEFORE the inclusion rate (to
     clamp the foreign-included portion against it) and the raw (pre-exclusion)
     foreign-sourced gain that entered this aggregate — both manually-flagged
     foreign CGT-asset disposals AND W4's IT3(b) foreign capital gains (code
     4252), which are 100% foreign by definition. Persisted here (not
     re-derived in the engine) so there is one source of truth for the CGT
     composition, same as .cgt itself. */
  APP.pendingValues.cgtAfterExclBeforeInclusion = afterExcl;
  APP.appliedValues.cgtAfterExclBeforeInclusion = afterExcl;
  APP.pendingValues.foreignCgtRawGain = totalForeignGain + _it3bForeignCgt;
  APP.appliedValues.foreignCgtRawGain = totalForeignGain + _it3bForeignCgt;

  if(resEl) {
    const exclApplied = netGain >= 0 ? Math.min(netGain, annualExcl) : Math.min(Math.abs(netGain), annualExcl);
    const lossBfApplied = Math.min(Math.max(0, aggAfterExcl), cgtLossBf);
    resEl.innerHTML = `
      <div class="sum-line"><span class="lbl">Total gains</span><span class="val">${fmt(totalGains)}</span></div>
      ${totalLosses > 0 ? `<div class="sum-line"><span class="lbl">Less: current-year losses</span><span class="val">&minus; ${fmt(totalLosses)}</span></div>` : ''}
      ${_cryptoCgt !== 0 ? `<div class="sum-line"><span class="lbl">Crypto CGT (net)</span><span class="val">${_cryptoCgt < 0 ? '&minus; '+fmt(Math.abs(_cryptoCgt)) : fmt(_cryptoCgt)}</span></div>` : ''}
      ${_otherCapitalGain !== 0 ? `<div class="sum-line"><span class="lbl">Capital receipts (net)</span><span class="val">${fmt(_otherCapitalGain)}</span></div>` : ''}
      ${_it3bForeignCgt !== 0 ? `<div class="sum-line"><span class="lbl">Foreign capital gains (IT3(b))</span><span class="val">${fmt(_it3bForeignCgt)}</span></div>` : ''}
      <div class="sum-line" style="border-top:1px solid var(--bd);padding-top:6px;margin-top:4px"><span class="lbl">Net capital ${netGain < 0 ? 'loss' : 'gain'}</span><span class="val">${netGain < 0 ? '('+fmt(Math.abs(netGain))+')' : fmt(netGain)}</span></div>
      <div class="sum-line"><span class="lbl">Less: annual exclusion (${fmt(annualExcl)})</span><span class="val">&minus; ${fmt(exclApplied)}</span></div>
      ${cgtLossBf > 0 ? `<div class="sum-line"><span class="lbl">Capital loss brought forward</span><span class="val">${fmt(cgtLossBf)}</span></div>
      <div class="sum-line"><span class="lbl">Less: prior-year capital loss b/f (applied)</span><span class="val">&minus; ${fmt(lossBfApplied)}</span></div>` : ''}
      <div class="sum-line"><span class="lbl">× ${(inclusionRate*100).toFixed(0)}% inclusion rate</span><span class="val"></span></div>
      <div class="sum-line divider ${taxableGain > 0 ? 'total owing' : ''}"><span class="lbl"><strong>Included in taxable income</strong></span><span class="val"><strong>${fmt(taxableGain)}</strong></span></div>
      ${capitalLossCF > 0 ? `<div class="note info u-mt-8"><i class="material-symbols-outlined msi-info u-mr-5"></i>Capital loss of ${fmt(capitalLossCF)} carried forward to next year (CGT-only).</div>` : ''}
      ${(totalForeignGain + _it3bForeignCgt) > 0 ? `<div class="note u-mt-8" style="background:var(--tebg);border-color:var(--tel);font-size:0.75rem"><i class="material-symbols-outlined msi-public u-mr-5" style="color:var(--tel)"></i>Foreign capital gains of ${fmt(totalForeignGain + _it3bForeignCgt)} included — visit <strong>B6 Foreign</strong> for s6quat credit.</div>` : ''}`;
  }

  /* at-a-glance: 4 cards */
  if(glanceEl) {
    const isLoss = netGain < 0;
    const breakdownHtml = `
      <div style="font-size:0.6875rem;color:var(--tx3);margin-bottom:8px">How it's calculated:</div>
      <div style="font-size:0.75rem;color:var(--tx2);line-height:1.8">
        <div style="display:flex;justify-content:space-between"><span>Net capital gain / (loss)</span><span style="font-family:var(--mono)">${netGain<0?'('+fmt(Math.abs(netGain))+')':fmt(netGain)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Less: Annual exclusion</span><span style="font-family:var(--mono)">− ${fmt(netGain >= 0 ? Math.min(netGain, annualExcl) : Math.min(Math.abs(netGain), annualExcl))}</span></div>
        ${cgtLossBf > 0 ? `<div style="display:flex;justify-content:space-between"><span>Less: Prior-year capital loss</span><span style="font-family:var(--mono)">− ${fmt(Math.min(Math.max(0, aggAfterExcl), cgtLossBf))}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between"><span>× ${(inclusionRate*100).toFixed(0)}% inclusion rate</span><span></span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--bd);margin-top:4px;padding-top:4px"><span>Included in taxable income</span><span style="font-family:var(--mono);color:var(--ok)">${fmt(taxableGain)}</span></div>
      </div>`;

    const heroElC = $('hero-b5cgt');
    if(heroElC) {
      heroElC.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
        + '<div class="dhero-top"><div class="dhero-lbl">CGT in taxable income</div>'
        + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + (APP.cgtAssets||[]).length + ((APP.cgtAssets||[]).length===1?' disposal':' disposals') + '</span></div>'
        + '<div class="dhero-num" data-count="' + (taxableGain) + '" data-count-key="income-b5cgt">' + fmt(taxableGain) + '</div>'
        + '<div class="dhero-break">Net capital ' + (isLoss?'loss':'gain') + ' <span class="mono" style="color:' + (isLoss?'var(--er)':'var(--au)') + '">' + (isLoss?'('+fmt(Math.abs(netGain))+')':fmt(netGain)) + '</span>' + heroBreakdownLink('cgt') + '</div>'
        + '</div>';
    }
    const cards = [
      `<div class="card" style="padding:0;margin-bottom:8px;overflow:hidden">
        <details>
          <summary style="padding:12px 14px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Net Capital ${isLoss?'Loss':'Gain'} <i class="material-symbols-outlined msi-expand-more" style="font-size:0.5625rem;opacity:.5;margin-left:4px"></i></div>
              <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:${isLoss?'var(--er)':'var(--ok)'}">${isLoss?'('+fmt(Math.abs(netGain))+')':fmt(netGain)}</div>
            </div>
          </summary>
          <div style="padding:0 14px 12px;border-top:1px solid var(--bd);font-size:0.75rem;color:var(--tx2);line-height:1.8">
            <div style="display:flex;justify-content:space-between"><span>Total gains</span><span style="font-family:var(--mono)">${fmt(totalGains)}</span></div>
            <div style="display:flex;justify-content:space-between"><span>Total losses</span><span style="font-family:var(--mono)">− ${fmt(totalLosses)}</span></div>
            ${_cryptoCgt !== 0 ? `<div style="display:flex;justify-content:space-between"><span>Crypto CGT net</span><span style="font-family:var(--mono)">${fmt(_cryptoCgt)}</span></div>` : ''}
          </div>
        </details>
      </div>`,
    ];

    if(capitalLossCF > 0) {
      cards.push(`<div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Capital Loss Carried Forward</div>
        <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--er)">${fmt(capitalLossCF)}</div>
        <div style="font-size:0.6875rem;color:var(--tx3);margin-top:4px">Offsets future capital gains only — no expiry</div>
      </div>`);
    }

    const allowances = [];
    allowances.push(`Annual exclusion: ${fmt(annualExcl)}`);
    if(hasPrimaryRes) allowances.push(`Primary residence exclusion: ${fmt(primaryResExcl)} (first R${(primaryResExcl/1e6).toFixed(0)}m of gain)`);
    cards.push(`<div class="card" style="padding:12px 14px;margin-bottom:8px">
      <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Deductions &amp; Allowances</div>
      ${allowances.map(a => `<div style="font-size:0.75rem;color:var(--tx2);padding:2px 0">${a}</div>`).join('')}
    </div>`);

    glanceEl.innerHTML = cards.join('');
  }

  if(typeof renderBucketNav === 'function') renderBucketNav();
}
