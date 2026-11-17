/* Tally – personal finance manager. Vanilla JS; data lives in localStorage. */
'use strict';
(() => {
  /* ===== Config ===== */
  const STORAGE_KEY = 'tally.v1';
  const CATS = [
    { id: 'rent', name: 'Rent & housing', group: 'need', color: '#264653' },
    { id: 'food', name: 'Food & groceries', group: 'need', color: '#2A9D8F' },
    { id: 'transport', name: 'Transport', group: 'need', color: '#E9C46A' },
    { id: 'bills', name: 'Bills & recharge', group: 'need', color: '#F4A261' },
    { id: 'education', name: 'Education', group: 'need', color: '#6C8EAD' },
    { id: 'health', name: 'Health', group: 'need', color: '#B5838D' },
    { id: 'fun', name: 'Eating out & fun', group: 'want', color: '#E76F51' },
    { id: 'shopping', name: 'Shopping', group: 'want', color: '#8E6BBF' },
    { id: 'other', name: 'Other', group: 'want', color: '#9AA5B1' },
    { id: 'savings', name: 'Savings & investing', group: 'save', color: '#3A86FF' },
  ];
  const GROUP_LABEL = { need: 'Need', want: 'Want', save: 'Savings' };
  const PRESETS = {
    salary: { rent: 25, food: 12, transport: 6, bills: 7, education: 2, health: 3, fun: 10, shopping: 8, other: 7, savings: 20 },
    income: { rent: 25, food: 12, transport: 6, bills: 7, education: 2, health: 3, fun: 10, shopping: 8, other: 7, savings: 20 },
    pocket: { rent: 0, food: 30, transport: 15, bills: 5, education: 10, health: 2, fun: 18, shopping: 8, other: 2, savings: 10 },
  };
  const INCOME_LABEL = { salary: 'Monthly salary', income: 'Monthly income', pocket: 'Monthly pocket money' };
  const INCOME_FIELD = { salary: 'Monthly salary (after tax)', income: 'Monthly income', pocket: 'Monthly pocket money' };
  const CURRENCIES = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  const CAT_TIPS = {
    rent: 'Housing is slow to change, so balance it by trimming wants this month.',
    food: 'Plan meals for the week and cook in batches. Delivery fees add up fast.',
    transport: 'Combine trips and look at passes or shared rides.',
    bills: 'Check for unused subscriptions and cheaper plans.',
    education: 'Look for free or second-hand material before paying.',
    health: 'Check whether insurance or a campus clinic can cover part of this.',
    fun: 'Set a weekly cap and pay from a separate wallet so you can see it run down.',
    shopping: 'Wait 24 hours before any non-essential purchase.',
    other: 'Review what is in Other and move repeat items into a proper category.',
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== Helpers ===== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const r2 = n => Math.round(n * 100) / 100;
  const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthOf = d => toDateStr(d).slice(0, 7);
  const ym = m => m.split('-').map(Number);
  const daysIn = m => { const [y, mo] = ym(m); return new Date(y, mo, 0).getDate(); };
  const shiftMonth = (m, n) => { const [y, mo] = ym(m); return monthOf(new Date(y, mo - 1 + n, 1)); };
  const monthLabel = m => { const [y, mo] = ym(m); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
  const catOf = id => CATS.find(c => c.id === id) || CATS[8];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /** Tiny DOM builder: h('div', {class:'x', onclick:fn}, child, ...) – uses textContent, so user text is never parsed as HTML. */
  function h(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().filter(c => c != null && c !== false).forEach(c => e.append(c));
    return e;
  }

  let nf = null;
  function fmt(n) {
    const cur = state.profile ? state.profile.currency : 'INR';
    if (!nf || nf.cur !== cur) nf = { cur, f: new Intl.NumberFormat(CURRENCIES[cur], { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }) };
    return nf.f.format(n);
  }

  /* ===== State & storage ===== */
  const blank = () => ({ profile: null, budgets: {}, expenses: [] });
  const validExpense = e => e && typeof e.id === 'string' && typeof e.desc === 'string' && Number.isFinite(e.amount) && e.amount > 0 &&
    CATS.some(c => c.id === e.cat) && /^\d{4}-\d{2}-\d{2}$/.test(e.date);

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || typeof raw !== 'object') return blank();
      const s = blank();
      const p = raw.profile;
      if (p && PRESETS[p.type] && p.income > 0 && CURRENCIES[p.currency]) s.profile = { type: p.type, income: Number(p.income), currency: p.currency };
      CATS.forEach(c => {
        const v = Number(raw.budgets && raw.budgets[c.id]);
        s.budgets[c.id] = Number.isFinite(v) && v >= 0 && v <= 100 ? v : 0;
      });
      if (Array.isArray(raw.expenses)) s.expenses = raw.expenses.filter(validExpense);
      return s;
    } catch { return blank(); }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('Could not save. Browser storage is full or blocked.'); }
  }

  let state = load();
  let viewMonth = monthOf(new Date());
  let currentView = 'overview';
  let editingId = null;

  /* ===== Calculations ===== */
  function summary(m) {
    const list = state.expenses.filter(e => e.date.startsWith(m));
    const byCat = Object.fromEntries(CATS.map(c => [c.id, 0]));
    list.forEach(e => { byCat[e.cat] += e.amount; });
    CATS.forEach(c => { byCat[c.id] = r2(byCat[c.id]); });
    const saved = byCat.savings;
    const spent = r2(list.reduce((t, e) => t + e.amount, 0) - saved);
    const income = state.profile.income;
    return { list, byCat, saved, spent, income, out: r2(spent + saved), left: r2(income - spent - saved) };
  }
  function monthPhase(m) {
    const now = new Date(), cur = monthOf(now), days = daysIn(m);
    if (m < cur) return { phase: 'past', day: days, days };
    if (m > cur) return { phase: 'future', day: 0, days };
    return { phase: 'current', day: now.getDate(), days };
  }
  const groupPct = g => CATS.filter(c => c.group === g).reduce((t, c) => t + (state.budgets[c.id] || 0), 0);

  /* ===== Advice engine ===== */
  function buildAdvice(m) {
    const s = summary(m), p = state.profile, ph = monthPhase(m), B = state.budgets;
    const income = s.income, tips = [];
    const add = (level, title, text) => tips.push({ level, title, text });
    const limitOf = c => income * (B[c.id] || 0) / 100;
    const pocket = p.type === 'pocket';

    if (!s.list.length) {
      add('tip', 'Start with your first expense', `${pocket ? 'Your pocket money' : 'Your income'} works out to about ${fmt(income / ph.days)} a day. Log what you spend to see your breakdown and get advice.`);
      add('tip', 'Your budget split', `${groupPct('need')}% needs, ${groupPct('want')}% wants and ${groupPct('save')}% savings. You can change this under Budgets.`);
      return tips;
    }

    if (s.out > income) add('alert', 'You are over your income', `You have logged ${fmt(s.out - income)} more than your ${INCOME_LABEL[p.type].toLowerCase()} of ${fmt(income)}. Pause non-essential spending for the rest of the month.`);

    const over = CATS.filter(c => c.group !== 'save' && B[c.id] > 0 && s.byCat[c.id] > limitOf(c))
      .map(c => ({ c, limit: limitOf(c), extra: r2(s.byCat[c.id] - limitOf(c)) })).sort((a, b) => b.extra - a.extra);
    over.slice(0, 3).forEach(o => add(o.extra > o.limit * .2 ? 'alert' : 'warn', `${o.c.name} is over budget`,
      `${fmt(s.byCat[o.c.id])} spent against a budget of ${fmt(o.limit)}, which is ${fmt(o.extra)} over. ${CAT_TIPS[o.c.id]}`));
    if (over.length > 3) add('warn', `${over.length - 3} more categories are over budget`, 'Open Budgets to see each category against its limit.');

    if (ph.phase === 'current') {
      const near = CATS.filter(c => c.group !== 'save' && B[c.id] > 0 && !over.some(o => o.c === c) && s.byCat[c.id] >= limitOf(c) * .85);
      if (near.length) add('warn', 'Close to the limit', near.map(c => `${c.name} (${Math.round(s.byCat[c.id] / limitOf(c) * 100)}%)`).join(', ') + ' have used most of their budget.');
    }

    const unbudgeted = CATS.filter(c => c.group !== 'save' && !B[c.id] && s.byCat[c.id] > 0);
    if (unbudgeted.length) add('tip', 'Spending without a budget', `${unbudgeted.map(c => c.name).join(', ')} ${unbudgeted.length > 1 ? 'have' : 'has'} no budget set. Give ${unbudgeted.length > 1 ? 'them' : 'it'} a share under Budgets.`);

    const needs = CATS.filter(c => c.group === 'need').reduce((t, c) => t + s.byCat[c.id], 0);
    const wants = CATS.filter(c => c.group === 'want').reduce((t, c) => t + s.byCat[c.id], 0);
    if (!pocket && needs / income > .5) add('warn', `Needs take ${Math.round(needs / income * 100)}% of income`, 'A common guide is 50% for needs. Look at rent, bills and transport for savings you can lock in.');
    if (wants / income > (pocket ? .35 : .3)) add('warn', `Wants take ${Math.round(wants / income * 100)}% of income`, `A comfortable ceiling is about ${pocket ? 35 : 30}%. Choose one want to cut back this month.`);

    const target = B.savings || 0, goal = income * target / 100;
    if (target > 0) {
      if (s.saved >= goal) add('good', 'Savings goal met', `You have put ${fmt(s.saved)} away, which reaches your goal of ${fmt(goal)}.`);
      else if (ph.phase === 'past' || (ph.phase === 'current' && ph.day >= 20)) add('warn', 'Savings are behind', `You have saved ${fmt(s.saved)} of ${fmt(goal)}. ${ph.phase === 'past' ? 'Move the gap to savings first thing next month.' : `Move ${fmt(goal - s.saved)} to savings before the month ends.`}`);
      else add('tip', 'Pay yourself first', `Aim to set aside ${fmt(goal)} this month. Log it under Savings as soon as you move it so it is not spent.`);
    } else add('tip', 'Add a savings target', 'Even 5% of income builds the habit. Set one under Budgets.');

    if (ph.phase === 'current' && ph.day >= 3) {
      const spendable = income - goal, projected = s.spent / ph.day * ph.days, remaining = spendable - s.spent, daysLeft = ph.days - ph.day + 1;
      if (projected > spendable) add('warn', 'Your pace is too fast', `At this rate you will spend about ${fmt(projected)} by month-end, ${fmt(projected - spendable)} above your limit of ${fmt(spendable)}. ${remaining > 0 ? `Keep it to ${fmt(remaining / daysLeft)} a day from now.` : 'Your limit is already used, so stick to essentials.'}`);
      else add('good', 'On track this month', `You are heading for about ${fmt(projected)} of a ${fmt(spendable)} limit. You can spend around ${fmt(Math.max(0, remaining) / daysLeft)} a day.`);
    }

    if (!over.length && !unbudgeted.length) add('good', 'Every category is within budget', 'Nothing has gone past its limit this month.');

    if (s.spent > 0) {
      const top = CATS.filter(c => c.group !== 'save').sort((a, b) => s.byCat[b.id] - s.byCat[a.id])[0];
      add('tip', `${top.name} is your biggest expense`, `It makes up ${Math.round(s.byCat[top.id] / s.spent * 100)}% of what you spent, at ${fmt(s.byCat[top.id])}.`);
    }
    if (pocket) add('tip', 'Try a weekly cash limit', `Your pocket money is about ${fmt(income / ph.days)} a day. Giving yourself a weekly amount makes it easier to stop early.`);
    else if (s.spent > 0 && ph.phase !== 'future') add('tip', 'Build an emergency fund', `Aim for 3 to 6 months of expenses, roughly ${fmt(s.spent * 3)} to ${fmt(s.spent * 6)} at this month's level.`);

    const order = { alert: 0, warn: 1, tip: 2, good: 3 };
    return tips.sort((a, b) => order[a.level] - order[b.level]).slice(0, 8);
  }

  /* ===== Pie chart (canvas) ===== */
  const canvas = $('#pie'), ctx = canvas.getContext('2d');
  let slices = [], chartTotal = 0, hover = -1, progress = 1, lastSig = '', animId = 0;
  const GAP = 0.025;

  function drawPie() {
    const w = canvas.clientWidth;
    if (!w) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = canvas.height = Math.round(w * dpr); }
    ctx.setTransform(canvas.width / w, 0, 0, canvas.width / w, 0, 0);
    ctx.clearRect(0, 0, w, w);
    const c = w / 2, R = w * .36, lw = w * .16;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.lineWidth = lw; ctx.strokeStyle = cssVar('--track'); ctx.stroke();

    const limit = -Math.PI / 2 + progress * Math.PI * 2, gap = slices.length > 1 ? GAP : 0;
    slices.forEach((s, i) => {
      const a0 = s.a0 + gap / 2, a1 = Math.min(s.a1 - gap / 2, limit);
      if (a1 <= a0) return;
      ctx.beginPath(); ctx.arc(c, c, R, a0, a1);
      ctx.lineWidth = i === hover ? lw + w * .035 : lw;
      ctx.strokeStyle = s.cat.color; ctx.stroke();
    });

    // Centre label
    const f = "'Bricolage Grotesque', system-ui, sans-serif", hv = slices[hover];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = cssVar('--muted'); ctx.font = `500 ${w * .042}px ${f}`;
    ctx.fillText(hv ? hv.cat.name : (chartTotal ? 'Money out' : 'No spending yet'), c, c - w * .075);
    if (chartTotal) {
      ctx.fillStyle = cssVar('--ink'); ctx.font = `700 ${w * .085}px ${f}`;
      ctx.fillText(fmt(hv ? hv.value : chartTotal), c, c + w * .01);
      if (hv) { ctx.fillStyle = cssVar('--muted'); ctx.font = `500 ${w * .042}px ${f}`; ctx.fillText(`${Math.round(hv.value / chartTotal * 100)}% of total`, c, c + w * .09); }
    }
  }
  function animatePie() {
    cancelAnimationFrame(animId);
    if (reduceMotion) { progress = 1; drawPie(); return; }
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / 800);
      progress = 1 - Math.pow(1 - k, 3);
      drawPie();
      if (k < 1) animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
  }
  function pickSlice(ev) {
    const r = canvas.getBoundingClientRect(), w = r.width;
    const x = ev.clientX - r.left - w / 2, y = ev.clientY - r.top - r.height / 2, d = Math.hypot(x, y);
    const R = w * .36, lw = w * .16;
    if (d < R - lw / 2 - 4 || d > R + lw / 2 + w * .035) return -1;
    let a = Math.atan2(y, x);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    return slices.findIndex(s => a >= s.a0 && a < s.a1);
  }
  function setHover(i) {
    if (i === hover) return;
    hover = i;
    drawPie();
    $$('#legend button').forEach((b, j) => b.classList.toggle('active', j === i));
    canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
  }
  canvas.addEventListener('pointermove', e => setHover(pickSlice(e)));
  canvas.addEventListener('pointerdown', e => setHover(pickSlice(e)));
  canvas.addEventListener('pointerleave', () => setHover(-1));
  canvas.addEventListener('click', e => { const i = pickSlice(e); if (i >= 0) openCategory(slices[i].cat.id); });
  window.addEventListener('resize', () => { if (currentView === 'overview') drawPie(); });

  /* ===== Rendering ===== */
  function renderOverview() {
    const s = summary(viewMonth), p = state.profile;
    $('#heroTitle').textContent = monthLabel(viewMonth);
    $('#heroSub').textContent = `Based on your ${INCOME_LABEL[p.type].toLowerCase()} of ${fmt(p.income)}`;
    $('#lgIncome').textContent = fmt(s.income);
    $('#lgSpent').textContent = fmt(s.spent);
    $('#lgSaved').textContent = fmt(s.saved);
    $('#lgLeftLabel').textContent = s.left < 0 ? 'Over income by' : 'Left to spend';
    $('#lgLeft').textContent = fmt(Math.abs(s.left));
    $('#lgLeft').classList.toggle('neg', s.left < 0);

    const used = s.out / s.income, fill = $('#meterFill');
    fill.style.width = Math.min(100, used * 100) + '%';
    fill.className = 'meter-fill' + (used > 1 ? ' over' : used > .85 ? ' warn' : '');
    $('#meterText').textContent = `${fmt(s.out)} of ${fmt(s.income)} used (${Math.round(used * 100)}%)`;

    slices = CATS.map(c => ({ cat: c, value: s.byCat[c.id] })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    chartTotal = r2(slices.reduce((t, x) => t + x.value, 0));
    let a = -Math.PI / 2;
    slices.forEach(x => { x.a0 = a; a += x.value / chartTotal * Math.PI * 2; x.a1 = a; });
    hover = -1;
    canvas.setAttribute('aria-label', slices.length
      ? 'Expense breakdown: ' + slices.map(x => `${x.cat.name} ${Math.round(x.value / chartTotal * 100)}%`).join(', ')
      : 'No expenses logged for this month');

    const legend = $('#legend');
    legend.replaceChildren(...slices.map((x, i) => h('li', {},
      h('button', { type: 'button', title: `View ${x.cat.name} expenses`, onclick: () => openCategory(x.cat.id), onmouseenter: () => setHover(i), onmouseleave: () => setHover(-1), onfocus: () => setHover(i), onblur: () => setHover(-1) },
        h('span', { class: 'sw', style: `background:${x.cat.color}` }),
        h('span', { text: x.cat.name }),
        h('span', { class: 'amt', text: fmt(x.value) }),
        h('span', { class: 'pc', text: Math.round(x.value / chartTotal * 100) + '%' })))));
    $('#legendEmpty').hidden = slices.length > 0;

    $('#adviceList').replaceChildren(...buildAdvice(viewMonth).map(t => h('li', { class: t.level },
      h('strong', {}, h('span', { class: 'sr', text: { alert: 'Alert: ', warn: 'Warning: ', tip: 'Tip: ', good: 'Good: ' }[t.level] }), t.title),
      h('p', { text: t.text }))));

    const sig = viewMonth + JSON.stringify(slices.map(x => x.value));
    if (sig !== lastSig) { lastSig = sig; animatePie(); } else { progress = 1; drawPie(); }
  }

  function filteredExpenses() {
    const q = $('#search').value.trim().toLowerCase(), cat = $('#filterCat').value;
    return state.expenses
      .filter(e => e.date.startsWith(viewMonth) && (!cat || e.cat === cat) && (!q || e.desc.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }
  function renderTx() {
    const list = filteredExpenses(), filtering = $('#search').value.trim() || $('#filterCat').value;
    const total = r2(list.reduce((t, e) => t + e.amount, 0));
    $('#txSummary').textContent = list.length ? `${list.length} expense${list.length > 1 ? 's' : ''} in ${monthLabel(viewMonth)}, totalling ${fmt(total)}` : '';
    $('#txEmpty').hidden = list.length > 0;
    $('#txEmpty').textContent = filtering ? 'No expenses match your search or filter.' : `No expenses in ${monthLabel(viewMonth)} yet. Use Add expense to log one.`;
    $('#txList').replaceChildren(...list.map(e => {
      const c = catOf(e.cat), [, mo, d] = e.date.split('-').map(Number);
      return h('li', {},
        h('div', { class: 'tx-date' }, h('b', { text: String(d) }), h('span', { text: new Date(2000, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' }) })),
        h('div', { class: 'tx-main' }, h('b', { text: e.desc }), h('span', { class: 'chip' }, h('i', { style: `background:${c.color}` }), c.name)),
        h('div', { class: 'tx-amt', text: fmt(e.amount) }),
        h('div', { class: 'tx-act' },
          h('button', { class: 'link-btn', type: 'button', 'aria-label': `Edit ${e.desc}`, text: 'Edit', onclick: () => openExpense(e) }),
          h('button', { class: 'link-btn del', type: 'button', 'aria-label': `Delete ${e.desc}`, text: 'Delete', onclick: () => deleteExpense(e.id) })));
    }));
  }

  function renderBudgets() {
    const s = summary(viewMonth);
    $('#budgetRows').replaceChildren(...CATS.map(c => h('div', { class: 'b-row', 'data-cat': c.id },
      h('label', { class: 'b-name', for: 'b-' + c.id }, h('i', { style: `background:${c.color}` }), c.name, h('small', { text: GROUP_LABEL[c.group] })),
      h('div', { class: 'b-input' }, h('input', { id: 'b-' + c.id, type: 'number', min: 0, max: 100, step: 0.5, inputmode: 'decimal', value: state.budgets[c.id] || 0 }), '%'),
      h('div', {}, h('div', { class: 'b-info' }), h('div', { class: 'bar' }, h('span'))))));
    updateBudgetRows(s);
  }
  function readBudgetInputs() {
    const out = {};
    CATS.forEach(c => { const v = parseFloat($('#b-' + c.id).value); out[c.id] = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0; });
    return out;
  }
  function updateBudgetRows(s = summary(viewMonth)) {
    const vals = readBudgetInputs(), total = r2(Object.values(vals).reduce((t, v) => t + v, 0));
    CATS.forEach(c => {
      const row = $(`.b-row[data-cat="${c.id}"]`), limit = s.income * vals[c.id] / 100, used = s.byCat[c.id];
      $('.b-info', row).textContent = c.group === 'save'
        ? `${fmt(used)} saved of ${fmt(limit)} goal` : `${fmt(used)} spent of ${fmt(limit)}`;
      const bar = $('.bar span', row);
      bar.style.width = (limit > 0 ? Math.min(100, used / limit * 100) : used > 0 ? 100 : 0) + '%';
      bar.classList.toggle('over', c.group !== 'save' && used > limit);
    });
    const pt = $('#pctTotal');
    pt.textContent = total > 100 ? `Total ${total}% is over 100%.` : `${total}% allocated, ${r2(100 - total)}% unassigned.`;
    pt.classList.toggle('bad', total > 100);
  }

  function renderSettings() {
    const p = state.profile;
    $('#settingsList').replaceChildren(...[
      ['Income type', INCOME_LABEL[p.type]], ['Amount per month', fmt(p.income)], ['Currency', p.currency], ['Expenses logged', String(state.expenses.length)],
    ].map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))));
  }

  function render() {
    if (!state.profile) return;
    $('#monthLabel').textContent = monthLabel(viewMonth);
    $('#thisMonth').hidden = viewMonth === monthOf(new Date());
    ({ overview: renderOverview, transactions: renderTx, budgets: renderBudgets, settings: renderSettings })[currentView]();
  }

  /* ===== Routing ===== */
  const VIEWS = ['overview', 'transactions', 'budgets', 'settings'];
  function route() {
    const v = location.hash.slice(1);
    currentView = VIEWS.includes(v) ? v : 'overview';
    $$('.view').forEach(s => { s.hidden = s.dataset.view !== currentView; });
    $$('.nav a').forEach(a => {
      const on = a.dataset.view === currentView;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (currentView === 'overview') lastSig = '';
    render();
    window.scrollTo(0, 0);
  }
  function openCategory(id) {
    $('#filterCat').value = id; $('#search').value = '';
    location.hash = '#transactions';
  }

  /* ===== Toast & confirm ===== */
  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast');
    t.replaceChildren(...[h('span', { text: msg }), action && h('button', { class: 'toast-act', type: 'button', text: action.label, onclick: () => { action.fn(); t.classList.remove('show'); } })].filter(Boolean));
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 3200);
  }
  function confirmBox(title, text, okLabel) {
    return new Promise(resolve => {
      const d = $('#confirmDialog');
      $('#confTitle').textContent = title; $('#confText').textContent = text; $('#confOk').textContent = okLabel;
      d.returnValue = 'no';
      d.addEventListener('close', () => resolve(d.returnValue === 'yes'), { once: true });
      d.showModal();
    });
  }

  /* ===== Expense dialog ===== */
  function openExpense(exp) {
    const f = $('#expenseForm');
    editingId = exp ? exp.id : null;
    f.reset();
    $('#expTitle').textContent = exp ? 'Edit expense' : 'Add expense';
    $('#expError').textContent = '';
    const today = toDateStr(new Date());
    f.desc.value = exp ? exp.desc : '';
    f.amount.value = exp ? exp.amount : '';
    f.cat.value = exp ? exp.cat : 'food';
    f.date.value = exp ? exp.date : (viewMonth === today.slice(0, 7) ? today : viewMonth + '-01');
    $('#expenseDialog').showModal();
    f.desc.focus();
  }
  function submitExpense(ev) {
    ev.preventDefault();
    const f = ev.target, err = $('#expError');
    const desc = f.desc.value.trim(), amount = r2(parseFloat(f.amount.value)), date = f.date.value;
    if (!desc) return fail(err, 'Enter what the expense was for.', f.desc);
    if (!Number.isFinite(amount) || amount <= 0) return fail(err, 'Enter an amount greater than zero.', f.amount);
    if (amount > 1e9) return fail(err, 'That amount is too large.', f.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date))) return fail(err, 'Pick a valid date.', f.date);
    const rec = { id: editingId || uid(), desc, amount, cat: f.cat.value, date };
    if (editingId) state.expenses = state.expenses.map(e => e.id === editingId ? rec : e); else state.expenses.push(rec);
    save();
    viewMonth = date.slice(0, 7);
    $('#expenseDialog').close();
    if (currentView === 'settings') location.hash = '#overview'; else render();
    toast(editingId ? 'Expense updated' : 'Expense added');
  }
  function fail(el, msg, field) { el.textContent = msg; field.focus(); }
  function deleteExpense(id) {
    const i = state.expenses.findIndex(e => e.id === id);
    if (i < 0) return;
    const [removed] = state.expenses.splice(i, 1);
    save(); render();
    toast('Expense deleted', { label: 'Undo', fn: () => { state.expenses.push(removed); save(); render(); } });
  }

  /* ===== Setup dialog ===== */
  function openSetup() {
    const f = $('#setupForm'), p = state.profile;
    f.reset();
    f.type.value = p ? p.type : 'salary';
    f.income.value = p ? p.income : '';
    f.currency.value = p ? p.currency : 'INR';
    $('#incomeLabel').textContent = INCOME_FIELD[f.type.value];
    $('#setupCancel').hidden = !p;
    $('#setupError').textContent = '';
    $('#setupTitle').textContent = p ? 'Edit income details' : 'Set up your budget';
    $('#setupDialog').showModal();
    f.income.focus();
  }
  function submitSetup(ev) {
    ev.preventDefault();
    const f = ev.target, income = r2(parseFloat(f.income.value));
    if (!Number.isFinite(income) || income <= 0) return fail($('#setupError'), 'Enter an amount greater than zero.', f.income);
    if (income > 1e9) return fail($('#setupError'), 'That amount is too large.', f.income);
    const first = !state.profile, typeChanged = !first && state.profile.type !== f.type.value;
    state.profile = { type: f.type.value, income, currency: f.currency.value };
    if (first || typeChanged) state.budgets = { ...PRESETS[f.type.value] };
    save();
    $('#setupDialog').close();
    render();
    toast(first || typeChanged ? 'Budgets set to the recommended split. Adjust them under Budgets.' : 'Income details saved');
  }

  /* ===== Export & reset ===== */
  function exportCsv() {
    if (!state.expenses.length) return toast('No expenses to export yet.');
    const esc = v => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [['Date', 'Description', 'Category', 'Amount']].concat(
      state.expenses.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, e.desc, catOf(e.cat).name, e.amount.toFixed(2)]));
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `tally-expenses-${toDateStr(new Date())}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function clearAll() {
    if (!await confirmBox('Delete all data?', 'This removes your income details, budgets and every expense from this browser. It cannot be undone.', 'Delete everything')) return;
    state = blank(); nf = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    location.hash = '#overview';
    openSetup();
  }

  /* ===== Init ===== */
  function init() {
    const catOptions = CATS.map(c => h('option', { value: c.id, text: c.name }));
    $('#expenseForm').cat.replaceChildren(...catOptions);
    $('#filterCat').replaceChildren(h('option', { value: '', text: 'All categories' }), ...CATS.map(c => h('option', { value: c.id, text: c.name })));

    $('#addBtn').addEventListener('click', () => state.profile ? openExpense() : openSetup());
    $('#prevMonth').addEventListener('click', () => { viewMonth = shiftMonth(viewMonth, -1); render(); });
    $('#nextMonth').addEventListener('click', () => { viewMonth = shiftMonth(viewMonth, 1); render(); });
    $('#thisMonth').addEventListener('click', () => { viewMonth = monthOf(new Date()); render(); });
    $('#search').addEventListener('input', renderTx);
    $('#filterCat').addEventListener('change', renderTx);
    $('#exportBtn').addEventListener('click', exportCsv);
    $('#exportBtn2').addEventListener('click', exportCsv);
    $('#editProfile').addEventListener('click', openSetup);
    $('#clearBtn').addEventListener('click', clearAll);

    $('#expenseForm').addEventListener('submit', submitExpense);
    $('#expCancel').addEventListener('click', () => $('#expenseDialog').close());
    $('#setupForm').addEventListener('submit', submitSetup);
    $('#setupCancel').addEventListener('click', () => $('#setupDialog').close());
    $$('#setupForm input[name="type"]').forEach(r => r.addEventListener('change', () => { $('#incomeLabel').textContent = INCOME_FIELD[r.value]; }));
    $('#setupDialog').addEventListener('cancel', e => { if (!state.profile) e.preventDefault(); }); // setup is required first time
    $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d && (d.id !== 'setupDialog' || state.profile)) d.close(); }));

    $('#budgetForm').addEventListener('input', () => updateBudgetRows());
    $('#resetBudgets').addEventListener('click', () => {
      CATS.forEach(c => { $('#b-' + c.id).value = PRESETS[state.profile.type][c.id]; });
      updateBudgetRows();
      toast('Recommended split loaded. Save budgets to keep it.');
    });
    $('#budgetForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const vals = readBudgetInputs(), total = r2(Object.values(vals).reduce((t, v) => t + v, 0));
      if (total > 100) return toast(`Budgets add up to ${total}%. Bring them to 100% or less.`);
      state.budgets = vals; save(); toast('Budgets saved');
    });

    window.addEventListener('hashchange', route);
    route();
    if (!state.profile) openSetup();
  }
  init();
})();
