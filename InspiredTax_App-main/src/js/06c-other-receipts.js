import { $, APP, esc, fmt, gs, heroBreakdownLink, renderBucketNav, iconClassFor, noteHtml, otherReceiptCosts, parseFmt } from './02-core.js';
import { B9_CATEGORIES, addCostRow, costRowsUntouched, costChipsHtml, renderCostChips } from './05-list-modules.js';
import { USUAL_COSTS, OTHER_RECEIPT_COST_KINDS, OTHER_RECEIPT_COSTS } from './01-data.js';

/* ═══════════════════════════════════════════════════════════
   B9 OTHER RECEIPTS — render + calc
   Income vs capital receipts; capital receipts join the CGT aggregate.
   CRUD (M_otherReceipt) lives in 05-list-modules.js; the per-item edit/
   remove handlers are resolved through the window bridge.
   ═══════════════════════════════════════════════════════════ */

/* FB5: show/hide income vs capital fields in the modal. Since UI-CAP-1 the
   income/capital answer is set by the kind picked (CAPTURE_KINDS
   .otherReceipt), so its "Info" note — which also typed the inclusion rate
   and annual exclusion as text (GLOB-2) — went with the visible select. */
export function onReceiptTypeChange() {
  var type = (document.getElementById('or-receipt-type') && document.getElementById('or-receipt-type').value) || 'income';
  var incF = document.getElementById('or-income-fields');
  var capF = document.getElementById('or-capital-fields');
  if(incF) incF.style.display = type === 'capital' ? 'none' : '';
  if(capF) capF.style.display = type === 'capital' ? 'block' : 'none';
}

export function otherReceiptUpdateCategory() {
  const cat = gs('or-category');
  /* BACKLOG 63: the costs block, for a royalty or "something else" income. */
  const costs = $('or-costs-block');
  if (costs) costs.style.display = otherReceiptTakesCosts() ? '' : 'none';
  otherReceiptCostCheck();

  /* s10(1)(u): alimony/maintenance under a court order or written agreement
     is exempt. The block is category-gated (only alimony asks this) rather
     than a generic exempt toggle — this fixes an incorrect treatment for
     one specific, named category, not a general exemption feature. */
  const isAlimony = cat === 'alimony';
  const block = $('or-alimony-block');
  if(block) block.style.display = isAlimony ? '' : 'none';
  if(isAlimony) otherReceiptAlimonyOrderChange();
}

/* ── BACKLOG 63 (OI-C1d): costs on a royalty or "something else" receipt ──
   Which kinds take costs, and why, is OTHER_RECEIPT_COST_KINDS (01-data:
   s11(a), s23(g)); otherReceiptCosts (02-core) is what the engine deducts.
   Rule 6 like the other cost lists: usual lines seeded per kind, the next
   ones as chips, re-seeded only while untouched. */
function otherReceiptTakesCosts() {
  return (gs('or-receipt-type') || 'income') === 'income' && OTHER_RECEIPT_COST_KINDS.indexOf(gs('or-category')) >= 0;
}
const orCostSet = () => USUAL_COSTS.otherReceipt[gs('or-category')] || { usual: [], more: [] };
export function otherReceiptAddExpRow(exp) {
  addCostRow('or-expense-rows', 'or-exp-cat', 'or-exp-amt', 'or-exp-note', OTHER_RECEIPT_COSTS, '', exp);
  /* Listeners, not inline handlers (the bridge cannot see a handler held in
     a variable); they run after the button's inline remove(). */
  const rows = document.querySelectorAll('#or-expense-rows > div'), row = rows[rows.length - 1];
  if (row) {
    row.querySelector('.or-exp-cat').addEventListener('change', otherReceiptRenderCostChips);
    row.querySelector('button').addEventListener('click', otherReceiptRenderCostChips);
    row.querySelector('.or-exp-amt').addEventListener('input', otherReceiptCostCheck);
  }
}
/* Owner 2026-10-17 (OI-C1d): costs above the receipt are not deducted here —
   say so where the user is typing, and point a loss to Business. The same
   cap as otherReceiptCosts (02-core), read from the rows on screen. */
export function otherReceiptCostCheck() {
  const box = $('or-costs-over'); if (!box) return;
  const amt = parseFmt(gs('or-amount'));
  const costs = [...document.querySelectorAll('#or-expense-rows .or-exp-amt')].reduce((t, el) => t + (parseFmt(el.value) || 0), 0);
  box.innerHTML = otherReceiptTakesCosts() && costs > amt
    ? noteHtml('info', 'Costs above the amount received are not deducted here.',
        '<strong>Costs are more than this receipt</strong>' + fmt(costs - amt) + ' is not deducted here — costs can bring a receipt down to nil, not below. If you earn this in a business that made a loss, capture it on the Business page instead, where a loss can be carried forward.',
        { title: 'Costs above the receipt' })
    : '';
}
export function otherReceiptRenderCostChips() {
  const have = [...document.querySelectorAll('#or-expense-rows .or-exp-cat')].map(x => x.value);
  renderCostChips('or-cost-chips', costChipsHtml(orCostSet().more, have, id => OTHER_RECEIPT_COSTS[id], 'otherReceipt'));
  const note = $('or-costs-note');
  if (note && !note.innerHTML) note.innerHTML = noteHtml('info', 'Costs count only if you earn this by carrying on a trade.',
    '<strong>Costs</strong>Enter what you spent to earn this — for royalties, for example, agent or publisher fees. Costs count only if you earn it by carrying on a trade, and never private or capital spending. They can reduce this receipt to nil, not below: if the trade made a loss, capture it under Business instead.',
    { title: 'Costs' });
}
export function otherReceiptSeedCosts() {
  if (!otherReceiptTakesCosts() || !costRowsUntouched('#or-expense-rows')) { otherReceiptRenderCostChips(); return; }
  const rows = $('or-expense-rows'); if (rows) rows.innerHTML = '';
  const usual = orCostSet().usual;
  usual.forEach(id => otherReceiptAddExpRow({ type: id }));
  if (!usual.length) otherReceiptAddExpRow();
  otherReceiptRenderCostChips();
}
export function otherReceiptLoadCosts(item) {
  const rows = $('or-expense-rows'); if (rows) rows.innerHTML = '';
  const saved = (item && item.expenses) || [];
  if (saved.length) { saved.forEach(e => otherReceiptAddExpRow(e)); otherReceiptRenderCostChips(); }
  else otherReceiptSeedCosts();
}
export function otherReceiptAddCost(cat) {
  otherReceiptAddExpRow(cat ? { type: cat } : null);
  otherReceiptRenderCostChips();
  const rows = document.querySelectorAll('#or-expense-rows > div');
  const amt = rows.length && rows[rows.length - 1].querySelector('.or-exp-amt'); if (amt) amt.focus();
}

/* s10(1)(u) qualification note — toggled by the alimony court-order/written-
   agreement answer. 'yes' routes the item to receiptType 'exempt' at save
   time (see M_otherReceipt.collect in 05-list-modules.js); 'no' leaves it
   taxable and warns that informal support does not meet the exemption. */
export function otherReceiptAlimonyOrderChange() {
  const ordered = gs('or-alimony-order') === 'yes';
  const note = $('or-alimony-note');
  if(note) note.innerHTML = ordered
    ? '<i class="material-symbols-outlined msi-check-circle u-mr-4" style="color:var(--ok)"></i>Exempt under s10(1)(u) — recorded for your records, not added to your taxable income.'
    : '<i class="material-symbols-outlined msi-warning u-mr-4" style="color:var(--wa)"></i>Without a court order, divorce order, or written agreement, this does not qualify for the s10(1)(u) exemption and is taxed as ordinary income. If an order or agreement exists, select "Yes" above.';
}

export function renderOtherReceiptsList() {
  const el = $('other-receipts-list'); if(!el) return;
  if(!(APP.otherReceipts||[]).length) {
    /* QA 2026-09: persistent "+ Add receipt" button at the top of this page
       is the only add-CTA now — this duplicated it. */
    el.innerHTML = '';
    const sumEl = $('other-receipts-summary'); if(sumEl) sumEl.innerHTML = '';
    const glEl = $('glance-b9other'); if(glEl) glEl.innerHTML = '';
    const heroElO0 = $('hero-b9other'); if(heroElO0) heroElO0.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')"><div class="dhero-top"><div class="dhero-lbl">Total other receipts</div></div><div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b9other">' + fmt(0) + '</div><div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No other receipts yet — add your first below.</div></div>';
    if(typeof renderBucketNav === 'function') renderBucketNav();
    return;
  }

  // Group by category; handle income vs capital types
  const byCategory = {};
  let incomeTotal = 0, capitalGainTotal = 0;
  APP.otherReceipts.forEach((r, i) => {
    const cat = r.category || 'other';
    if(!byCategory[cat]) byCategory[cat] = {items:[], incomeTotal:0, capitalTotal:0};
    byCategory[cat].items.push(Object.assign({}, r, {idx:i}));
    if(r.receiptType === 'capital') {
      const gain = (r.proceeds||0) - (r.baseCost||0);
      byCategory[cat].capitalTotal += gain;
      capitalGainTotal += gain;
    } else {
      const net = (r.amount||0) - otherReceiptCosts(r);   // BACKLOG 63: after costs, as the engine takes it
      byCategory[cat].incomeTotal += net;
      incomeTotal += net;
    }
  });

  const ALL_CATS = (typeof B9_CATEGORIES !== 'undefined') ? B9_CATEGORIES : [];
  const catMap = {}; ALL_CATS.forEach(c => { catMap[c.id] = c; });

  el.innerHTML = Object.keys(byCategory).map(catId => {
    const group = byCategory[catId];
    const c = catMap[catId] || {label:catId, icon:'receipt_long'};
    const itemRows = group.items.map(r => {
      var isCapital = r.receiptType === 'capital';
      var gain = isCapital ? ((r.proceeds||0)-(r.baseCost||0)) : 0;
      var valDisplay = isCapital
        ? (gain < 0 ? '<span style="color:var(--er)">(' + fmt(Math.abs(gain)) + ' loss)</span>' : '<span style="color:var(--ok)">' + fmt(gain) + ' gain</span>')
        : '<span style="font-family:var(--mono);font-weight:700">' + fmt(r.amount||0) + '</span>';
      var subLine = isCapital
        ? 'Proceeds ' + fmt(r.proceeds||0) + ' − Base cost ' + fmt(r.baseCost||0) + ' → CGT aggregate'
        : (otherReceiptCosts(r) > 0 ? 'Less costs ' + fmt(otherReceiptCosts(r)) + ' — ' + fmt((r.amount||0) - otherReceiptCosts(r)) + ' taxable' : 'Taxable at marginal rate');
      return '<div class="card" style="margin-bottom:8px;padding:12px 14px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
        + '<span style="font-size:0.875rem;font-weight:700">' + esc(r.description) + '</span>'
        + '<span class="pill" style="font-size:0.625rem;' + (isCapital ? 'background:rgba(31,175,115,.15);color:var(--ok)' : 'background:var(--sf3);color:var(--tx2)') + '">' + (isCapital ? 'Capital' : 'Income') + '</span>'
        + '</div>'
        + '<div style="font-size:0.6875rem;color:var(--tx3)">' + subLine + '</div>'
        + (r.note ? '<div style="font-size:0.625rem;color:var(--tx3);margin-top:2px"><em>' + esc(r.note) + '</em></div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'
        + '<div style="font-size:0.8125rem">' + valDisplay + '</div>'
        + '<div style="display:flex;gap:4px">'
        + '<button class="btn btn-ghost btn-xs" onclick="editOtherReceipt(' + r.idx + ')" aria-label="Edit"><i class="material-symbols-outlined msi-edit"></i></button>'
        + '<button class="btn btn-danger btn-xs" onclick="removeOtherReceipt(' + r.idx + ')" aria-label="Remove"><i class="material-symbols-outlined msi-delete"></i></button>'
        + '</div></div></div></div>';
    }).join('');
    return '<div style="margin-bottom:12px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid var(--bd);margin-bottom:6px">'
      + '<div style="font-size:0.75rem;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px">'
      + '<i class="' + iconClassFor(c.icon||'receipt_long') + '" style="color:var(--tx3);font-size:0.6875rem;margin-right:6px"></i>'
      + esc(c.label||catId) + '</div></div>'
      + itemRows + '</div>';
  }).join('');

  const sumEl = $('other-receipts-summary');
  if(sumEl) {
    var sumLines = '';
    if(incomeTotal > 0) sumLines += '<div class="sum-line"><span class="lbl">Income receipts (marginal rate)</span><span class="val">' + fmt(incomeTotal) + '</span></div>';
    if(capitalGainTotal !== 0) sumLines += '<div class="sum-line"><span class="lbl">Capital receipts (net gain → CGT aggregate)</span><span class="val">' + (capitalGainTotal < 0 ? '− ' + fmt(Math.abs(capitalGainTotal)) : fmt(capitalGainTotal)) + '</span></div>';
    sumEl.innerHTML = sumLines
      ? '<div class="note info" style="padding:10px 12px">' + sumLines
        + '<div style="font-size:0.65625rem;color:var(--tx3);margin-top:6px"><i class="material-symbols-outlined msi-info u-mr-4"></i>Capital gains are worked out on the Capital Gains page.</div></div>'
      : '';
  }

  const heroElO = $('hero-b9other');
  if(heroElO) {
    var _oReceiptCount = (APP.otherReceipts||[]).length;
    var _oHeadLbl = incomeTotal > 0 ? 'Income receipts' : 'Capital receipts';
    var _oHeadVal = incomeTotal > 0 ? incomeTotal : capitalGainTotal;
    var _oNeg = _oHeadVal < 0;
    heroElO.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
      + '<div class="dhero-top"><div class="dhero-lbl">' + _oHeadLbl + '</div>'
      + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + _oReceiptCount + (_oReceiptCount===1?' receipt':' receipts') + '</span></div>'
      + '<div class="dhero-num">' + (_oNeg?'('+fmt(Math.abs(_oHeadVal))+')':fmt(_oHeadVal)) + '</div>'
      + '<div class="dhero-break">' + (incomeTotal > 0 && capitalGainTotal !== 0 ? 'Capital ' + (capitalGainTotal<0?'loss':'gain') + ' \u2192 CGT <span class="mono" style="color:' + (capitalGainTotal<0?'var(--er)':'var(--au)') + '">' + (capitalGainTotal<0?'('+fmt(Math.abs(capitalGainTotal))+')':fmt(capitalGainTotal)) + '</span>' : '') + heroBreakdownLink('other') + '</div>'
      + '</div>';
  }
  const glEl = $('glance-b9other');
  if(glEl) {
    const cards = [];
    if(false && incomeTotal > 0) {
      cards.push('<div class="card" style="padding:12px 14px;margin-bottom:8px">'
        + '<div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Income Receipts</div>'
        + '<div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--tx)">' + fmt(incomeTotal) + '</div>'
        + '<div style="font-size:0.6875rem;color:var(--tx3);margin-top:4px">Fully taxable at marginal rate</div>'
        + '</div>');
    }
    if(capitalGainTotal !== 0) {
      var isCapLoss = capitalGainTotal < 0;
      cards.push('<div class="card" style="padding:12px 14px;margin-bottom:8px">'
        + '<div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Capital ' + (isCapLoss ? 'Loss' : 'Gain') + ' → CGT</div>'
        + '<div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:' + (isCapLoss ? 'var(--er)' : 'var(--ok)') + '">' + (isCapLoss ? '(' + fmt(Math.abs(capitalGainTotal)) + ')' : fmt(capitalGainTotal)) + '</div>'
        + '<div style="font-size:0.6875rem;color:var(--tx3);margin-top:4px">Added to your capital gains — the inclusion rate and yearly exclusion apply</div>'
        + '</div>');
    }
    glEl.innerHTML = cards.join('');
  }

  if(typeof renderBucketNav === 'function') renderBucketNav();
}
