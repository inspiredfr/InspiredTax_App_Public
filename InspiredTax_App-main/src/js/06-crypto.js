import { noteHtml, $, APP, esc, fmt, gv, gs, heroBreakdownLink, maskAll, parseFmt, iconClassFor } from './02-core.js';
import { makeCrudModule, costRowsUntouched, costChipsHtml, renderCostChips, addCostRow, collectCostRows } from './05-list-modules.js';
import { USUAL_COSTS } from './01-data.js';

/* ============================================================
   CRYPTO & DIGITAL ASSETS
   Data model: APP.cryptoDisposals + APP.cryptoRevenue.
   Record shapes (consumed live by cryptoTotals() → calcFullTax):
     disposal { id, classification:'capital'|'trading', desc,
                proceeds, costBasis, expenses:[{id,type,desc,amount}] }
     revenue  { id, type, desc, amount, expenses:[{id,type,desc,amount}] }
   Entry runs through the shared makeCrudModule factory + the
   config-driven modal renderer (00-forms.js): modal-crypto-disposal
   (wizard) and modal-crypto-revenue.
   ============================================================ */

/* ── Lookup tables ──────────────────────────────────────────── */
export var CRYPTO_DISP_EXP = {
  exchange_fees:'Exchange / Trading Fees', withdrawal_fees:'Withdrawal Fees',
  gas_fees:'Gas / Network Fees', platform_fees:'Platform / Margin Fees',
  trading_software:'Trading Software', market_data:'Market Data / Analytics',
  internet:'Internet (business %)', accounting_fees:'Accounting / Tax Fees',
  bank_charges:'Bank Charges', interest:'Interest on Borrowings',
  stock_adjustment:'Trading Stock Adjustment', other:'Other'
};
export var CRYPTO_REV_EXP = {
  electricity:'Electricity (mining)', pool_fees:'Mining Pool Fees',
  hardware:'Hardware / Equipment (W&T)', internet:'Internet (business %)',
  hosting:'Server / Hosting / Cloud', validator:'Validator Infrastructure',
  monitoring:'Monitoring Software', accounting_fees:'Accounting / Tax Fees', other:'Other'
};
export var CRYPTO_REV_TYPE = {
  staking:'Staking / Proof-of-Stake', mining:'Mining (Proof-of-Work)',
  defi:'DeFi / Yield Farming', airdrops:'Airdrops', other:'Other Crypto Income'
};

/* ── Unique ID generator ──────────────────────────────────────── */
export function cryptoGenId(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* ════════════════════════════════════════════════════════════════
   EXPENSE ROWS — dynamic rows inside each modal (mirrors M_business).
   Rows live in #cd-expense-rows / #cr-expense-rows; collected on save.
   The row builder and collector are shared (addCostRow / collectCostRows,
   05-list-modules.js — other receipts use them too, BACKLOG 63).
   ════════════════════════════════════════════════════════════════ */
function clearRows(containerId) { const el = $(containerId); if (el) el.innerHTML = ''; }
function loadRows(containerId, expenses, adder) { clearRows(containerId); (expenses || []).forEach(e => adder(e)); }

export function cryptoDispAddExpRow(exp) {
  addCostRow('cd-expense-rows', 'cd-exp-cat', 'cd-exp-amt', 'cd-exp-note', CRYPTO_DISP_EXP, 'cryptoDispPreview()', exp);
}
export function cryptoRevAddExpRow(exp) {
  addCostRow('cr-expense-rows', 'cr-exp-cat', 'cr-exp-amt', 'cr-exp-note', CRYPTO_REV_EXP, '', exp);
  /* The chips follow the row's type (BACKLOG 44). A listener, not an inline
     handler: this sheet has no live preview to hang it on. */
  const rows = document.querySelectorAll('#cr-expense-rows > div'), row = rows[rows.length - 1];
  if (row) {
    row.querySelector('.cr-exp-cat').addEventListener('change', cryptoRevRenderCostChips);
    /* Runs after the button's inline remove(): listeners fire in the order they were added. */
    row.querySelector('button').addEventListener('click', cryptoRevRenderCostChips);
  }
}

/* BACKLOG 44 (UI-CAP-1 rule 6, OI-B6a): both cost lists start with the usual
   lines for the holding or the income type (USUAL_COSTS.crypto) and offer the
   next ones as chips, as rental and business do (05-list-modules.js). A line
   left at 0 is not saved (collectExp), so seeding changes nothing until the
   user fills one in; costRowsUntouched keeps re-seeding on a change of
   holding or type from throwing away anything typed. */
function seedExpRows(rowsId, usual, adder) {
  if (!costRowsUntouched('#' + rowsId)) return;
  clearRows(rowsId);
  usual.forEach(id => adder({ type: id }));
  if (!usual.length) adder();
}
function rowTypes(rowsId, catCls) { return [...document.querySelectorAll('#' + rowsId + ' .' + catCls)].map(x => x.value); }
function lastAmountFocus(rowsId, amtCls) {
  const rows = document.querySelectorAll('#' + rowsId + ' > div');
  const amt = rows.length && rows[rows.length - 1].querySelector('.' + amtCls); if (amt) amt.focus();
}
const dispSet = () => USUAL_COSTS.crypto.disposal[gs('cd-class') === 'trading' ? 'trading' : 'capital'];
const revSet = () => USUAL_COSTS.crypto.revenue[gs('cr-type') || 'staking'] || { usual: [], more: [] };
export function cryptoDispSeedCosts() { seedExpRows('cd-expense-rows', dispSet().usual, cryptoDispAddExpRow); cryptoDispRenderCostChips(); }
export function cryptoRevSeedCosts()  { seedExpRows('cr-expense-rows', revSet().usual, cryptoRevAddExpRow); cryptoRevRenderCostChips(); }
export function cryptoDispRenderCostChips() {
  renderCostChips('cd-cost-chips', costChipsHtml(dispSet().more, rowTypes('cd-expense-rows', 'cd-exp-cat'), id => CRYPTO_DISP_EXP[id], 'cryptoDisp'));
}
export function cryptoRevRenderCostChips() {
  renderCostChips('cr-cost-chips', costChipsHtml(revSet().more, rowTypes('cr-expense-rows', 'cr-exp-cat'), id => CRYPTO_REV_EXP[id], 'cryptoRev'));
}
export function cryptoDispAddCost(cat) {
  cryptoDispAddExpRow(cat ? { type: cat } : null);
  cryptoDispPreview();
  lastAmountFocus('cd-expense-rows', 'cd-exp-amt');
}
export function cryptoRevAddCost(cat) {
  cryptoRevAddExpRow(cat ? { type: cat } : null);
  cryptoRevRenderCostChips();
  lastAmountFocus('cr-expense-rows', 'cr-exp-amt');
}

/* ── Disposal: classification-driven expense reveal + live preview ── */
/* BACKLOG 53 / OI-C1d: the cost list is always on screen — hiding it for an
   investment left the gain being reduced by rows the user could not see. The
   label and the one-line note follow the holding; cryptoDisposalCosts()
   decides what each holding may actually use. */
export function cryptoDispToggleExpenses() {
  const trading = gs('cd-class') === 'trading';
  const lbl = $('cd-expense-label');
  if (lbl) lbl.textContent = trading ? 'Trading costs' : 'Costs of buying and selling';
  const note = $('cd-expense-note');
  if (note) {
    note.innerHTML = trading
      ? noteHtml('info', 'Your trading costs for the year are deductible here.',
          '<strong>Trading costs</strong>Because you held it to trade, the profit is ordinary income and the costs of running that trade are deductible against it (s11(a)) \u2014 exchange and network fees, trading software, market data, your work share of internet, accounting fees, bank charges and interest on money you borrowed to trade.',
          { title: 'Trading costs' })
      /* Eighth Schedule para 20(1)(c): only costs directly incurred in
         acquiring or disposing of the asset form part of base cost; para
         20(2) excludes borrowing costs. Running costs of a trade are not
         base cost at all. */
      : noteHtml('info', 'Only the fees on buying and selling count here.',
          '<strong>Costs of buying and selling</strong>For something you held as an investment, only what you paid to buy or sell it reduces the gain \u2014 the exchange\u2019s trading fee, the network (gas) fee and a withdrawal fee on the sale (Eighth Schedule para 20(1)(c)). Running costs \u2014 trading software, market data, internet, a general accounting fee, bank charges \u2014 and anything you paid to borrow, such as margin fees or interest, are not part of base cost. Enter a cost of the sale itself that is not listed under <em>Other</em>.',
          { title: 'Costs of buying and selling' });
  }
}
export function cryptoDispOnClassChange() { cryptoDispToggleExpenses(); cryptoDispSeedCosts(); cryptoDispPreview(); }

/* Eighth Schedule para 20(1)(c): the costs that form part of base cost are
   those DIRECTLY incurred in acquiring or disposing of the asset —
   remuneration for a broker, agent, consultant, accountant or legal adviser
   acting on the acquisition or disposal; transfer costs; transfer or
   securities transfer tax; advertising to find a buyer or seller; moving and
   installation. Para 20(2) excludes borrowing costs (interest, raising fees)
   and running costs such as repairs, insurance and rates. Para 20(1)(c) also
   requires that the cost was not claimed against income.

   So of the categories this sheet offers, only a fee charged ON the buy or
   sell transaction is base cost: the exchange's trading fee, the network
   (gas) fee that effects the transfer, and a withdrawal fee charged to move
   the asset out on disposal. "Other" stays open because an incidental cost
   may not be listed — the note on the form states the rule. Everything else
   is a running cost of a TRADE (software, market data, internet share, a
   general accounting or tax fee, bank charges, the trading-stock adjustment)
   or a borrowing cost (platform / margin fees, interest), and may be
   deducted against trading income under s11(a) but never added to base cost.

   OI-C1d/BACKLOG 53 (2026-10-09): before this, every category reduced a
   capital gain, because the sheet hid the list for an investment and nobody
   had to decide what belonged in it. A user who entered trading costs and
   then switched the holding to "As an investment" kept all of them against
   the gain. */
export const CRYPTO_DISP_EXP_BASE_COST = ['exchange_fees', 'gas_fees', 'withdrawal_fees', 'other'];

/* T-1 / engine-remediation W13: ONE reader for what a disposal's costs do,
   for the live preview, cryptoTotals() (the engine feed) and both list
   renderers, so the four can never disagree (they previously did:
   cryptoTotals() double-subtracted for trading, the other three never
   subtracted at all for capital). `allowed` is what reduces this disposal;
   `excluded` is what the user entered that this classification cannot use —
   kept and shown, never silently dropped. */
export function cryptoDisposalCosts(expenses, classification) {
  var allowed = 0, excluded = 0;
  (expenses || []).forEach(function (e) {
    var amt = e.amount || 0;
    if (classification === 'capital' && CRYPTO_DISP_EXP_BASE_COST.indexOf(e.type) < 0) excluded += amt;
    else allowed += amt;
  });
  return { allowed: allowed, excluded: excluded, total: allowed + excluded };
}
function calcCryptoDisposalNet(proceeds, costBasis, expenses, classification) {
  return (proceeds || 0) - (costBasis || 0) - cryptoDisposalCosts(expenses, classification).allowed;
}

export function cryptoDispPreview() {
  cryptoDispRenderCostChips();
  const prev = $('crypto-disp-preview'); if (!prev) return;
  const pr = gv('cd-proceeds'), co = gv('cd-cost');
  if (!pr && !co) { prev.innerHTML = ''; return; }
  const cls = gs('cd-class') || 'capital';
  /* Rows as the user has them right now — category and amount — so the
     preview applies the same para 20(1)(c) split as the engine. */
  const rows = [...document.querySelectorAll('#cd-expense-rows > div')].map(r => ({
    type: (r.querySelector('.cd-exp-cat') || {}).value,
    amount: parseFmt((r.querySelector('.cd-exp-amt') || {}).value)
  }));
  const costs = cryptoDisposalCosts(rows, cls);
  const taxNet = calcCryptoDisposalNet(pr, co, rows, cls);
  const sign = taxNet >= 0 ? '+' : '';
  const colour = taxNet >= 0 ? 'var(--ok)' : 'var(--er)';
  let label = '';
  if (cls === 'capital') label = taxNet >= 0 ? 'Capital gain → CGT pool' : 'Capital loss → CGT carry-forward';
  if (cls === 'trading') label = taxNet >= 0 ? 'Trading profit → revenue (marginal rate)' : 'Trading loss → may offset other income';
  /* para 20(1)(c): a cost this holding cannot use is named in the preview, so
     the figure is never quietly short of what the user typed. */
  const notCounted = costs.excluded > 0
    ? '<div style="color:var(--wa);font-size:0.6875rem;margin-top:3px">'
      + fmt(costs.excluded) + ' of costs is not part of base cost \u2014 see the note above.</div>'
    : '';
  prev.innerHTML = '<div class="note info" style="margin-top:4px"><span style="color:' + colour + ';font-weight:600">'
    + sign + 'R ' + Math.abs(Math.round(taxNet)).toLocaleString()
    + '</span>&nbsp;<span style="color:var(--tx3)">' + label + '</span>' + notCounted + '</div>';
}

/* ════════════════════════════════════════════════════════════════
   CRUD MODULES — disposal (wizard) + revenue, via the shared factory.
   No applyType: crypto reaches the engine live through cryptoTotals()
   (calcFullTax reads it directly), so save → refresh → refreshDerived
   recomputes without an appliedValues commit.
   ════════════════════════════════════════════════════════════════ */
export const M_cryptoDisposal = makeCrudModule({
  array: 'cryptoDisposals', entKey: 'income.crypto', modalId: 'modal-crypto-disposal', titleId: 'crypto-disp-modal-title',
  titles: { add: 'Add crypto disposal', edit: 'Edit crypto disposal' },
  fields: [
    { el:'cd-class', key:'classification', kind:'raw', def:'capital' },
    { el:'cd-desc',  key:'desc',           kind:'str' },
    { el:'cd-proceeds', key:'proceeds',    kind:'num' },
    { el:'cd-cost',     key:'costBasis',   kind:'num' },
  ],
  onClear: () => { clearRows('cd-expense-rows'); cryptoDispSeedCosts(); },
  onLoad:  (d) => { loadRows('cd-expense-rows', d.expenses, cryptoDispAddExpRow); if (!(d.expenses || []).length) cryptoDispSeedCosts(); },
  onForm:  () => { cryptoDispToggleExpenses(); cryptoDispPreview(); },
  validate: () => (gv('cd-proceeds') || gv('cd-cost') || (gs('cd-desc')||'').trim()) ? null : { el:'cd-desc', msg:'Enter a description, the proceeds or the cost.' },
  collect: (cur) => ({
    id: cur && cur.id ? cur.id : cryptoGenId('cd'),
    classification: gs('cd-class') || 'capital',
    desc: (gs('cd-desc')||'').trim() || 'Crypto disposal',
    proceeds: gv('cd-proceeds') || 0,
    costBasis: gv('cd-cost') || 0,
    expenses: collectCostRows('cd-expense-rows', 'cd-exp-cat', 'cd-exp-amt', 'cd-exp-note')
  }),
  refresh: () => renderCrypto(),
  confirm: { title: 'Remove Disposal', msg: 'Delete this crypto disposal?' }
});
export function addCryptoDisposal()     { M_cryptoDisposal.add(); }
export function editCryptoDisposal(i)   { M_cryptoDisposal.edit(i); }
export function saveCryptoDisposal()    { M_cryptoDisposal.save(); }
export function removeCryptoDisposal(i) { M_cryptoDisposal.remove(i); }

export const M_cryptoRevenue = makeCrudModule({
  array: 'cryptoRevenue', entKey: 'income.crypto', modalId: 'modal-crypto-revenue', titleId: 'crypto-rev-modal-title',
  titles: { add: 'Add crypto income', edit: 'Edit crypto income' },
  fields: [
    { el:'cr-type',   key:'type',   kind:'raw', def:'staking' },
    { el:'cr-desc',   key:'desc',   kind:'str' },
    { el:'cr-amount', key:'amount', kind:'num' },
  ],
  onClear: () => { clearRows('cr-expense-rows'); cryptoRevSeedCosts(); },
  onLoad:  (r) => { loadRows('cr-expense-rows', r.expenses, cryptoRevAddExpRow); if (!(r.expenses || []).length) cryptoRevSeedCosts(); else cryptoRevRenderCostChips(); },
  validate: () => (gv('cr-amount') || (gs('cr-desc')||'').trim()) ? null : { el:'cr-desc', msg:'Enter a description or an amount.' },
  collect: (cur) => {
    const type = gs('cr-type') || 'other';
    return {
      id: cur && cur.id ? cur.id : cryptoGenId('cr'),
      type,
      desc: (gs('cr-desc')||'').trim() || (CRYPTO_REV_TYPE[type] || 'Crypto income'),
      amount: gv('cr-amount') || 0,
      expenses: collectCostRows('cr-expense-rows', 'cr-exp-cat', 'cr-exp-amt', 'cr-exp-note')
    };
  },
  refresh: () => renderCrypto(),
  confirm: { title: 'Remove Income', msg: 'Delete this crypto income entry?' }
});
export function addCryptoRevenue()     { M_cryptoRevenue.add(); }
export function editCryptoRevenue(i)   { M_cryptoRevenue.edit(i); }
export function saveCryptoRevenue()    { M_cryptoRevenue.save(); }
export function removeCryptoRevenue(i) { M_cryptoRevenue.remove(i); }

/* ── cryptoTotals — public interface (UNCHANGED — engine contract) ── */
export function cryptoTotals() {
  var disposals = APP.cryptoDisposals || [];
  var revenues  = APP.cryptoRevenue   || [];
  var capitalGain = 0, capitalLoss = 0, tradingNet = 0, revenueNet = 0;
  disposals.forEach(function(d) {
    var net = calcCryptoDisposalNet(d.proceeds, d.costBasis, d.expenses, d.classification);
    if (d.classification === 'capital') {
      if (net >= 0) capitalGain += net; else capitalLoss += Math.abs(net);
    } else {
      tradingNet += net;
    }
  });
  revenues.forEach(function(r) {
    var exp = (r.expenses||[]).reduce(function(s,e){ return s+(e.amount||0); }, 0);
    revenueNet += (r.amount||0) - exp;
  });
  return {
    capitalGain: Math.round(capitalGain),
    capitalLoss: Math.round(capitalLoss),
    cgtNet:      Math.round(capitalGain - capitalLoss),
    tradingNet:  Math.round(tradingNet),
    revenueNet:  Math.round(revenueNet),
    netRevenue:  Math.round(tradingNet + revenueNet)
  };
}

/* ════════════════════════════════════════════════════════════════
   RENDER — lists (index-based edit/remove) + tax-routing summary.
   ════════════════════════════════════════════════════════════════ */
export function renderCrypto() {
  renderCryptoDisposalList();
  renderCryptoRevenueList();
  renderCryptoTransactionsList();
  renderCryptoSummary();
}

export function renderCryptoDisposalList() {
  var el = $('crypto-disposal-list'); if(!el) return;
  var items = APP.cryptoDisposals || [];
  if (!items.length) { el.innerHTML=''; return; }
  var h = '<div style="font-size:0.71875rem;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Disposals</div>';
  items.forEach(function(d, i) {
    var costs = cryptoDisposalCosts(d.expenses, d.classification);
    var expTotal = costs.total;
    var taxNet = calcCryptoDisposalNet(d.proceeds, d.costBasis, d.expenses, d.classification);
    var badge = d.classification === 'capital'
      ? '<span style="background:var(--ac);color:#fff;border-radius:4px;padding:2px 7px;font-size:0.65625rem;font-weight:600">CGT</span>'
      : '<span style="background:var(--wa);color:#fff;border-radius:4px;padding:2px 7px;font-size:0.65625rem;font-weight:600">Revenue</span>';
    var netHtml = taxNet >= 0
      ? '<span style="color:var(--ok)">' + fmt(taxNet) + '</span>'
      : '<span style="color:var(--er)">' + fmt(taxNet) + '</span>';
    var expLine = '';
    if ((d.expenses||[]).length) {
      expLine = '<div style="font-size:0.6875rem;color:var(--tx3);margin-top:3px">';
      d.expenses.forEach(function(e){ expLine += esc(CRYPTO_DISP_EXP[e.type]||e.type) + ': ' + fmt(e.amount) + ' &bull; '; });
      expLine = expLine.replace(/\s*&bull;\s*$/, '') + ' (costs ' + fmt(expTotal) + ')'
        /* para 20(1)(c): say which costs the gain could not use, rather than
           leaving the arithmetic unexplained. */
        + (costs.excluded > 0 ? ' \u2014 <span style="color:var(--wa)">' + fmt(costs.excluded) + ' not part of base cost</span>' : '')
        + '</div>';
    }
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 12px;background:var(--bg2);border:1px solid var(--bd);border-radius:7px;margin-bottom:6px;gap:8px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' + badge
      + ' <span style="font-size:0.8125rem;font-weight:500">' + esc(d.desc||'Crypto disposal') + '</span></div>'
      + '<div style="font-size:0.71875rem;color:var(--tx2)">'
      + 'Proceeds: <span class="mono">' + fmt(d.proceeds) + '</span>'
      + ' &nbsp; Cost: <span class="mono">' + fmt(d.costBasis) + '</span>'
      + ' &nbsp; Net: ' + netHtml + '</div>'
      + expLine + '</div>'
      + '<div style="display:flex;gap:4px;flex-shrink:0">'
      + '<button class="btn btn-ghost btn-sm" style="padding:2px 7px" onclick="editCryptoDisposal(' + i + ')" aria-label="Edit disposal"><i class="material-symbols-outlined msi-edit"></i></button>'
      + '<button class="btn btn-ghost btn-sm" style="padding:2px 7px" onclick="removeCryptoDisposal(' + i + ')" aria-label="Remove disposal"><i class="material-symbols-outlined msi-delete"></i></button>'
      + '</div></div>';
  });
  el.innerHTML = h;
}

export function renderCryptoRevenueList() {
  var el = $('crypto-revenue-list'); if(!el) return;
  var items = APP.cryptoRevenue || [];
  if (!items.length) { el.innerHTML=''; return; }
  var h = '<div style="font-size:0.71875rem;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;margin-top:8px">Revenue Income</div>';
  items.forEach(function(r, i) {
    var expTotal = (r.expenses||[]).reduce(function(s,e){ return s+(e.amount||0); }, 0);
    var net = (r.amount||0) - expTotal;
    var expLine = '';
    if ((r.expenses||[]).length) {
      expLine = '<div style="font-size:0.6875rem;color:var(--tx3);margin-top:3px">';
      r.expenses.forEach(function(e){ expLine += esc(CRYPTO_REV_EXP[e.type]||e.type) + ': ' + fmt(e.amount) + ' &bull; '; });
      expLine = expLine.replace(/\s*&bull;\s*$/, '') + ' (expenses ' + fmt(expTotal) + ')</div>';
    }
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 12px;background:var(--bg2);border:1px solid var(--bd);border-radius:7px;margin-bottom:6px;gap:8px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'
      + '<span style="background:var(--au);color:#fff;border-radius:4px;padding:2px 7px;font-size:0.65625rem;font-weight:600">'
      + (CRYPTO_REV_TYPE[r.type]||r.type) + '</span>'
      + ' <span style="font-size:0.8125rem;font-weight:500">' + esc(r.desc||(CRYPTO_REV_TYPE[r.type]||r.type)) + '</span></div>'
      + '<div style="font-size:0.71875rem;color:var(--tx2)">'
      + 'Received: <span class="mono">' + fmt(r.amount) + '</span>'
      + (expTotal ? ' &nbsp; Less expenses: <span class="mono">' + fmt(expTotal) + '</span> &nbsp; Net: <span class="mono" style="color:var(--ok)">' + fmt(net) + '</span>' : '')
      + ' &rarr; marginal rate</div>'
      + expLine + '</div>'
      + '<div style="display:flex;gap:4px;flex-shrink:0">'
      + '<button class="btn btn-ghost btn-sm" style="padding:2px 7px" onclick="editCryptoRevenue(' + i + ')" aria-label="Edit income"><i class="material-symbols-outlined msi-edit"></i></button>'
      + '<button class="btn btn-ghost btn-sm" style="padding:2px 7px" onclick="removeCryptoRevenue(' + i + ')" aria-label="Remove income"><i class="material-symbols-outlined msi-delete"></i></button>'
      + '</div></div>';
  });
  el.innerHTML = h;
}

/* Batch 2: "Crypto transactions" — a combined view of disposals + revenue
   events in one list, per the owner's request. Records carry no date field
   (neither modal collects one), so this is insertion order, not
   chronological — labelled accordingly rather than implying a sort that
   isn't actually happening. Uses the shared calcCryptoDisposalNet() per-item
   formula (T-1) rather than cryptoTotals()'s aggregate, since this list
   needs a value per transaction, not a total. */
export function renderCryptoTransactionsList() {
  var el = $('crypto-transactions-list'); if (!el) return;
  var disposals = (APP.cryptoDisposals || []).map(function(d, i) {
    var expTotal = (d.expenses||[]).reduce(function(s,e){ return s+(e.amount||0); }, 0);
    var taxNet = calcCryptoDisposalNet(d.proceeds, d.costBasis, d.expenses, d.classification);
    return { kind: 'disposal', idx: i, badge: d.classification === 'capital' ? 'CGT' : 'Revenue',
      badgeCol: d.classification === 'capital' ? 'var(--ac)' : 'var(--wa)',
      desc: d.desc || 'Crypto disposal', amt: taxNet, route: d.classification === 'capital' ? 'Capital Gains' : 'Revenue' };
  });
  var revenues = (APP.cryptoRevenue || []).map(function(r, i) {
    var expTotal = (r.expenses||[]).reduce(function(s,e){ return s+(e.amount||0); }, 0);
    var net = (r.amount||0) - expTotal;
    return { kind: 'revenue', idx: i, badge: CRYPTO_REV_TYPE[r.type] || r.type, badgeCol: 'var(--au)',
      desc: r.desc || (CRYPTO_REV_TYPE[r.type] || 'Crypto income'), amt: net, route: 'Revenue' };
  });
  var all = disposals.concat(revenues);
  if (!all.length) { el.innerHTML = ''; return; }
  var h = '<div class="u-note-xs u-mb-8">Every disposal and revenue event in one list, in the order added (records carry no date).</div>';
  h += all.map(function(t) {
    var editFn = t.kind === 'disposal' ? 'editCryptoDisposal' : 'editCryptoRevenue';
    var amtHtml = t.amt >= 0 ? '<span style="color:var(--ok)">' + fmt(t.amt) + '</span>' : '<span style="color:var(--er)">' + fmt(t.amt) + '</span>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--bg2);border:1px solid var(--bd);border-radius:7px;margin-bottom:6px;gap:8px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'
      + '<span style="background:' + t.badgeCol + ';color:#fff;border-radius:4px;padding:2px 7px;font-size:0.65625rem;font-weight:600">' + esc(t.badge) + '</span>'
      + '<span style="font-size:0.8125rem;font-weight:500">' + esc(t.desc) + '</span></div>'
      + '<div style="font-size:0.71875rem;color:var(--tx3)">' + t.route + '</div></div>'
      + '<div style="text-align:right;flex-shrink:0"><div class="mono">' + amtHtml + '</div>'
      + '<button class="btn btn-ghost btn-sm" style="padding:2px 7px;margin-top:2px" onclick="' + editFn + '(' + t.idx + ')" aria-label="Edit"><i class="material-symbols-outlined msi-edit"></i></button></div>'
      + '</div>';
  }).join('');
  el.innerHTML = h;
}

export function renderCryptoSummary() {
  var el = $('crypto-summary'); if(!el) return;
  var hasDisposals = (APP.cryptoDisposals||[]).length > 0;
  var hasRevenue   = (APP.cryptoRevenue||[]).length > 0;
  // v8.27 Focus: crypto hero (always visible, empty state at R0)
  var heroElCr = $('hero-b10crypto');
  if (heroElCr) {
    var _ct = cryptoTotals();
    /* Batch 2: renamed "Taxable crypto income" -> "Net crypto income" per
       the owner's spec. The big number is the ordinary-income (marginal
       rate) portion; the capital portion is shown separately below as its
       own line, explicitly BEFORE the 40% inclusion/annual exclusion (those
       apply at the whole-portfolio level on the Capital Gains page, not
       per-crypto-event), so the two figures are never added together here
       (that would double-count against the CGT aggregate). */
    if (hasDisposals || hasRevenue) {
      var _cCount = (APP.cryptoDisposals||[]).length + (APP.cryptoRevenue||[]).length;
      var _capHtml = '<span class="mono" style="color:' + (_ct.cgtNet<0?'var(--er)':'var(--tx)') + '">' + (_ct.cgtNet<0?'(' + fmt(Math.abs(_ct.cgtNet)) + ')':fmt(_ct.cgtNet)) + '</span>';
      heroElCr.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
        + '<div class="dhero-top"><div class="dhero-lbl">Net crypto income</div>'
        + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + _cCount + (_cCount===1?' event':' events') + '</span></div>'
        + '<div class="dhero-num" data-count="' + (_ct.netRevenue) + '" data-count-key="income-crypto">' + fmt(_ct.netRevenue) + '</div>'
        + '<div class="dhero-break">Included in taxable income (ordinary income, plus the included share of net capital gains after the yearly exclusion)' + heroBreakdownLink('crypto') + '</div>'
        + '<div style="font-size:var(--fs-xs);color:var(--tx3);margin-top:7px;border-top:1px solid var(--bd);padding-top:9px">' + _capHtml + ' net capital crypto income <span style="opacity:.8">(before the inclusion rate and yearly exclusion — see Capital Gains)</span></div>'
        + '</div>';
    } else {
      heroElCr.innerHTML = '<div class="dhero bl u-empty">'
        + '<div class="dhero-top"><div class="dhero-lbl">Net crypto income</div></div>'
        + '<div class="dhero-num" data-count="' + (0) + '" data-count-key="income-crypto">' + fmt(0) + '</div>'
        + '<div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No crypto activity yet — add a disposal or income event below.</div>'
        + '</div>';
    }
  }
  if (!hasDisposals && !hasRevenue) {
    el.innerHTML = '<div class="note info" style="margin-top:4px">'
      + '<i class="material-symbols-outlined msi-info u-mr-6"></i>'
      /* QR9b.4 (WR-7): names the one Add button and the chooser's two answers
         (CAPTURE_KINDS.crypto), not the two buttons that used to be here. */
      + 'No crypto activity added yet. Tap <strong>Add crypto</strong>, then choose <strong>I sold, swapped or spent it</strong> for sales, conversions or gifts, '
      + 'or <strong>I earned it</strong> for mining, staking, DeFi and other receipts.'
      + '</div>';
    return;
  }
  var t = cryptoTotals();
  var h = '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;margin-top:6px">'
    + '<div style="font-weight:600;font-size:0.8125rem;margin-bottom:8px">Summary — Tax Routing</div>';

  if ((APP.cryptoDisposals||[]).length) {
    if (t.capitalGain > 0 || t.capitalLoss > 0) {
      if (t.capitalGain > 0) h += '<div class="sum-line"><span class="lbl">Capital disposals — gains</span><span class="val" style="color:var(--ok)">' + fmt(t.capitalGain) + '</span></div>';
      if (t.capitalLoss > 0) h += '<div class="sum-line"><span class="lbl">Capital disposals — losses (carry-forward)</span><span class="val" style="color:var(--er)">−' + fmt(t.capitalLoss) + '</span></div>';
      h += '<div style="font-size:0.71875rem;color:var(--tx3);padding-left:4px;margin-bottom:6px">Net ' + (t.cgtNet >= 0 ? 'gain ' + fmt(t.cgtNet) : 'loss ' + fmt(Math.abs(t.cgtNet))) + ' → capital gains (the inclusion rate and yearly exclusion apply — see Capital Gains)</div>';
    }
    if (t.tradingNet !== 0) {
      var tc = t.tradingNet >= 0 ? 'var(--ok)' : 'var(--er)';
      h += '<div class="sum-line"><span class="lbl">Trading disposals — net ' + (t.tradingNet >= 0 ? 'profit' : 'loss') + '</span><span class="val" style="color:' + tc + '">' + fmt(t.tradingNet) + '</span></div>';
      if (t.tradingNet < 0) {
        h += noteHtml('warning', 'A trading loss may reduce your other income.', 'A trading loss may contribute to your assessed loss and offset other income (salary, rental, interest) subject to SARS assessed-loss limitation rules. Ring-fencing applies if SARS determines the activity lacks commerciality.', { style: 'margin:4px 0 8px', title: 'Trading loss' });
      } else {
        h += '<div style="font-size:0.71875rem;color:var(--tx3);padding-left:4px;margin-bottom:6px">Trading profit → ordinary income, marginal rate</div>';
      }
    }
  }
  if ((APP.cryptoRevenue||[]).length) {
    h += '<div class="sum-line"><span class="lbl">Revenue income (mining / staking / other, net)</span><span class="val" style="color:var(--ok)">' + fmt(t.revenueNet) + '</span></div>';
    h += '<div style="font-size:0.71875rem;color:var(--tx3);padding-left:4px;margin-bottom:6px">Ordinary income → marginal rate</div>';
  }
  if (t.netRevenue !== 0 || t.cgtNet !== 0) {
    var rc = t.netRevenue >= 0 ? 'var(--ok)' : 'var(--er)';
    h += '<div class="sum-line divider"><span class="lbl"><strong>Total to ordinary income</strong></span><span class="val" style="color:' + rc + '"><strong>' + fmt(t.netRevenue) + '</strong></span></div>';
  }
  h += '</div>';
  el.innerHTML = h;
}
