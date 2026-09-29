import { CATEGORIES, parseSpends, toISODate } from './parser.js';
import { store } from './store.js';

const $ = (sel) => document.querySelector(sel);
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));
const catOf = (id) => CATEGORIES.find((c) => c.id === (CAT_IDS.has(id) ? id : 'other'));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const state = { kind: 'month', offset: 0, category: null, lastAdded: [] };

/* ---------- formatting ---------- */

const fmtCache = new Map();
const whole = (n) => money(Math.round(n));
function money(n) {
  const { currency } = store.settings();
  const cents = !Number.isInteger(Math.round(n * 100) / 100);
  const key = `${currency}|${cents}`;
  if (!fmtCache.has(key)) {
    fmtCache.set(
      key,
      new Intl.NumberFormat(navigator.language, {
        style: 'currency',
        currency,
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
      }),
    );
  }
  return fmtCache.get(key).format(n);
}

function currencySymbol() {
  const parts = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: store.settings().currency }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? '';
}

const parseDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dayMs = 86400000;
const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtDay = (d, opts) => d.toLocaleDateString(navigator.language, opts);

function dayLabel(d) {
  const diff = Math.round((today() - d) / dayMs);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = d.getFullYear() === today().getFullYear();
  return fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/* ---------- periods ---------- */

function getPeriod(kind, offset) {
  const t = today();
  let start;
  let end;
  if (kind === 'week') {
    start = addDays(t, -((t.getDay() + 6) % 7) + offset * 7);
    end = addDays(start, 7);
  } else if (kind === 'month') {
    start = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    end = new Date(t.getFullYear(), t.getMonth() + offset + 1, 1);
  } else {
    start = new Date(t.getFullYear() + offset, 0, 1);
    end = new Date(t.getFullYear() + offset + 1, 0, 1);
  }
  return { kind, offset, start, end };
}

function periodLabel(p) {
  const { kind, offset, start, end } = p;
  if (kind === 'week') {
    if (offset === 0) return 'This week';
    if (offset === -1) return 'Last week';
    const last = addDays(end, -1);
    const a = fmtDay(start, { day: 'numeric', month: 'short' });
    const b = fmtDay(last, { day: 'numeric', month: 'short' });
    return `${a} – ${b}`;
  }
  if (kind === 'month') {
    const sameYear = start.getFullYear() === today().getFullYear();
    return fmtDay(start, { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  }
  return String(start.getFullYear());
}

const inRange = (s, from, to) => {
  const d = parseDate(s.date);
  return d >= from && d < to;
};

function buckets(p, spends) {
  const t = today();
  if (p.kind === 'year') {
    return Array.from({ length: 12 }, (_, m) => {
      const from = new Date(p.start.getFullYear(), m, 1);
      const to = new Date(p.start.getFullYear(), m + 1, 1);
      return {
        from,
        label: fmtDay(from, { month: 'narrow' }),
        full: fmtDay(from, { month: 'long', year: 'numeric' }),
        future: from > t,
        current: t >= from && t < to,
        total: sum(spends.filter((s) => inRange(s, from, to))),
      };
    });
  }
  const n = Math.round((p.end - p.start) / dayMs);
  return Array.from({ length: n }, (_, i) => {
    const from = addDays(p.start, i);
    const iso = toISODate(from);
    return {
      from,
      label: p.kind === 'week' ? fmtDay(from, { weekday: 'narrow' }) : String(i + 1),
      full: fmtDay(from, { weekday: 'short', day: 'numeric', month: 'short' }),
      future: from > t,
      current: +from === +t,
      total: sum(spends.filter((s) => s.date === iso)),
    };
  });
}

const sum = (list) => list.reduce((a, s) => a + s.amount, 0);

/* ---------- render ---------- */

function render() {
  const all = store.all();
  const p = getPeriod(state.kind, state.offset);
  const spends = all.filter((s) => inRange(s, p.start, p.end));
  const total = sum(spends);
  const nouns = { week: 'week', month: 'month', year: 'year' };

  document.querySelectorAll('.segmented button').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.kind === state.kind));
  });
  $('#period-label').textContent = periodLabel(p);
  $('#next').disabled = state.offset >= 0;
  $('#total').textContent = money(total);

  // compare with the same stretch of the previous period
  const prev = getPeriod(state.kind, state.offset - 1);
  let prevEnd = prev.end;
  if (state.offset === 0) {
    const elapsed = Math.round((today() - p.start) / dayMs) + 1;
    prevEnd = new Date(Math.min(+addDays(prev.start, elapsed), +prev.end));
  }
  const prevTotal = sum(all.filter((s) => inRange(s, prev.start, prevEnd)));
  const cmp = state.offset === 0 ? `same point last ${nouns[state.kind]}` : `the ${nouns[state.kind]} before`;
  let delta = '';
  if (prevTotal > 0 && total > 0) {
    const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
    delta = pct === 0 ? `Same as ${cmp}` : `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs ${cmp}`;
  } else if (prevTotal > 0) {
    delta = `${money(prevTotal)} by ${cmp}`;
  } else if (total > 0) {
    delta = `${spends.length} ${spends.length === 1 ? 'spend' : 'spends'}`;
  }
  $('#delta').textContent = delta;

  renderBudget(p, total);

  const empty = all.length === 0;
  $('#empty').hidden = !empty;
  document.querySelector('.hero').hidden = empty;
  $('#dash').hidden = empty;
  if (empty) return;

  // category totals, largest first; colours follow the category, never the rank
  const byCat = CATEGORIES.map((c) => ({ ...c, total: sum(spends.filter((s) => catOf(s.category).id === c.id)) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  if (state.category && !byCat.some((c) => c.id === state.category)) state.category = null;

  renderInsights(p, spends, total, byCat);
  renderBreakdown(byCat, total);
  renderTrend(p, spends);
  renderList(spends);
}

function renderBudget(p, total) {
  const { budget } = store.settings();
  const show = p.kind === 'month' && budget > 0;
  $('#budget').hidden = !show;
  if (!show) return;
  const ratio = total / budget;
  $('#budget-fill').style.width = `${Math.min(ratio, 1) * 100}%`;
  $('#budget').classList.toggle('over', ratio > 1);
  $('#budget-text').textContent =
    ratio > 1
      ? `Over budget by ${money(total - budget)}`
      : `${Math.round(ratio * 100)}% of ${money(budget)} · ${money(budget - total)} left`;
}

function renderInsights(p, spends, total, byCat) {
  const lines = [];
  if (!spends.length) {
    lines.push(`Nothing logged for ${periodLabel(p).toLowerCase().startsWith('this') ? 'this period' : periodLabel(p)} yet.`);
  } else {
    const top = byCat[0];
    const share = Math.round((top.total / total) * 100);
    if (byCat.length > 1) lines.push(`<b>${esc(top.name)}</b> is ${share}% of your spending.`);
    else lines.push(`All of it went to <b>${esc(top.name)}</b>.`);

    const t = today();
    const isCurrent = state.offset === 0;
    if (p.kind === 'year') {
      const months = isCurrent ? t.getMonth() + 1 : 12;
      lines.push(`About <b>${whole(total / months)}</b> a month.`);
    } else {
      const days = isCurrent ? Math.round((t - p.start) / dayMs) + 1 : Math.round((p.end - p.start) / dayMs);
      lines.push(`About <b>${whole(total / days)}</b> a day.`);
      const { budget } = store.settings();
      if (p.kind === 'month' && isCurrent && budget > 0 && days >= 3) {
        const length = Math.round((p.end - p.start) / dayMs);
        const projected = (total / days) * length;
        lines.push(
          projected > budget
            ? `At this pace you'll reach <b>${whole(projected)}</b>, ${whole(projected - budget)} over budget.`
            : `On pace for <b>${whole(projected)}</b>, within budget.`,
        );
      }
    }
    if (lines.length < 3 && spends.length > 2) {
      const big = spends.reduce((a, b) => (b.amount > a.amount ? b : a));
      lines.push(`Biggest: <b>${money(big.amount)}</b> at ${esc(big.title)}, ${dayLabel(parseDate(big.date)).toLowerCase()}.`);
    }
  }
  $('#insights').innerHTML = lines.map((l) => `<li>${l}</li>`).join('');
}

function renderBreakdown(byCat, total) {
  const stack = $('#stack');
  stack.innerHTML = byCat
    .map(
      (c) =>
        `<span class="seg${state.category && state.category !== c.id ? ' dim' : ''}" data-cat="${c.id}" style="flex-grow:${c.total};--c:var(--cat-${c.id})"></span>`,
    )
    .join('');
  stack.hidden = !byCat.length;
  stack.setAttribute('aria-label', byCat.map((c) => `${c.name} ${Math.round((c.total / total) * 100)}%`).join(', '));
  stack.querySelectorAll('.seg').forEach((el) => {
    const c = byCat.find((x) => x.id === el.dataset.cat);
    const show = () => showTooltip(el, money(c.total), `${c.name} · ${Math.round((c.total / total) * 100)}%`, `var(--cat-${c.id})`);
    el.addEventListener('pointerenter', show);
    el.addEventListener('pointerleave', hideTooltip);
  });

  $('#cats').innerHTML = byCat.length
    ? byCat
        .map(
          (c) => `
      <li><button class="cat${state.category === c.id ? ' on' : ''}${state.category && state.category !== c.id ? ' dim' : ''}" data-cat="${c.id}" aria-pressed="${state.category === c.id}">
        <span class="dot" style="--c:var(--cat-${c.id})"></span>
        <span class="cat-name">${esc(c.name)}</span>
        <span class="cat-pct">${Math.round((c.total / total) * 100)}%</span>
        <span class="cat-amt">${money(c.total)}</span>
      </button></li>`,
        )
        .join('')
    : `<li class="muted">No spends in this period.</li>`;
}

function renderTrend(p, spends) {
  const el = $('#trend');
  const data = buckets(p, spends);
  $('#trend-title').textContent = p.kind === 'year' ? 'Month by month' : 'Day by day';
  const W = Math.max(el.clientWidth, 240);
  const H = 132;
  const top = 18;
  const base = H - 22;
  const n = data.length;
  const gap = n > 20 ? 2 : 6;
  const bw = (W - gap * (n - 1)) / n;
  const max = Math.max(...data.map((d) => d.total), 1);
  const past = data.filter((d) => !d.future);
  const avg = past.length ? sum(past.map((d) => ({ amount: d.total }))) / past.length : 0;
  const y = (v) => base - (v / max) * (base - top);
  const r = Math.min(3, bw / 2);
  const tickEvery = n > 20 ? 7 : 1;

  let bars = '';
  let ticks = '';
  data.forEach((d, i) => {
    const x = i * (bw + gap);
    const cls = `bar${d.current ? ' now' : ''}`;
    if (d.total > 0) {
      const h = Math.max(base - y(d.total), 3);
      bars += `<path class="${cls}" data-i="${i}" d="M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z"/>`;
    } else if (!d.future) {
      bars += `<rect class="stub" x="${x}" y="${base - 2}" width="${bw}" height="2" rx="1"/>`;
    }
    if (i % tickEvery === 0 || n <= 12) {
      ticks += `<text class="tick${d.current ? ' now' : ''}" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    }
  });
  const avgLine =
    avg > 0
      ? `<line class="avg" x1="0" x2="${W}" y1="${y(avg)}" y2="${y(avg)}"/>`
      : '';

  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <line class="baseline" x1="0" x2="${W}" y1="${base + 0.5}" y2="${base + 0.5}"/>
    ${avgLine}${bars}${ticks}
    ${avg > 0 ? `<text class="avg-label" x="0" y="${y(avg) - 5}">avg ${esc(whole(avg))}</text>` : ''}
    <rect class="hit" x="0" y="0" width="${W}" height="${H}"/>
  </svg>
  <table class="sr-only"><caption>${p.kind === 'year' ? 'Spending per month' : 'Spending per day'}</caption>
    ${past.map((d) => `<tr><th>${esc(d.full)}</th><td>${esc(money(d.total))}</td></tr>`).join('')}
  </table>`;

  const svg = el.querySelector('svg');
  const select = (i) => {
    if (i == null) {
      svg.classList.remove('hovering');
      hideTooltip();
      return;
    }
    svg.classList.add('hovering');
    svg.querySelectorAll('.bar').forEach((b) => b.classList.toggle('hl', +b.dataset.i === i));
    const d = data[i];
    const x = i * (bw + gap) + bw / 2;
    const rect = svg.getBoundingClientRect();
    showTooltipAt(rect.left + x, rect.top + (d.total ? y(d.total) : base), d.future ? '—' : money(d.total), d.full);
    el.dataset.sel = i;
  };
  const indexAt = (ev) => {
    const rect = svg.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - rect.left) / rect.width) * n)));
  };
  svg.addEventListener('pointermove', (ev) => select(indexAt(ev)));
  svg.addEventListener('pointerdown', (ev) => select(indexAt(ev)));
  svg.addEventListener('pointerleave', () => select(null));
  el.onkeydown = (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const cur = el.dataset.sel ? +el.dataset.sel : data.findIndex((d) => d.current);
    select(Math.max(0, Math.min(n - 1, (cur < 0 ? 0 : cur) + (ev.key === 'ArrowRight' ? 1 : -1))));
  };
  el.onblur = () => select(null);
}

function renderList(spends) {
  const filtered = state.category ? spends.filter((s) => catOf(s.category).id === state.category) : spends;
  const sorted = [...filtered].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  $('#list-title').textContent = state.category ? catOf(state.category).name : 'Spends';
  $('#clear-filter').hidden = !state.category;

  const groups = new Map();
  for (const s of sorted) {
    if (!groups.has(s.date)) groups.set(s.date, []);
    groups.get(s.date).push(s);
  }
  const html = [...groups]
    .map(
      ([date, items]) => `
    <div class="day">
      <div class="day-head"><span>${esc(dayLabel(parseDate(date)))}</span><span>${esc(money(sum(items)))}</span></div>
      <ul>${items
        .map(
          (s) => `
        <li><button class="spend" data-id="${esc(s.id)}">
          <span class="dot" style="--c:var(--cat-${catOf(s.category).id})"></span>
          <span class="spend-main"><span class="spend-title">${esc(s.title)}</span>
          <span class="spend-sub">${esc(catOf(s.category).name)}${s.note ? ` · ${esc(s.note)}` : ''}</span></span>
          <span class="spend-amt">${esc(money(s.amount))}</span>
        </button></li>`,
        )
        .join('')}</ul>
    </div>`,
    )
    .join('');
  $('#list').innerHTML = html || `<p class="muted pad">Nothing here yet.</p>`;
}

/* ---------- tooltip ---------- */

const tip = $('#tooltip');
function showTooltipAt(x, y, value, label, color) {
  tip.replaceChildren();
  const v = document.createElement('strong');
  v.textContent = value;
  const l = document.createElement('span');
  if (color) {
    const key = document.createElement('i');
    key.style.background = color;
    l.append(key);
  }
  l.append(document.createTextNode(label));
  tip.append(v, l);
  tip.hidden = false;
  const w = tip.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2));
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(8, y - tip.offsetHeight - 10)}px`;
}
function showTooltip(el, value, label, color) {
  const r = el.getBoundingClientRect();
  showTooltipAt(r.left + r.width / 2, r.top, value, label, color);
}
function hideTooltip() {
  tip.hidden = true;
}
window.addEventListener('scroll', hideTooltip, { passive: true });

/* ---------- toast ---------- */

let toastTimer;
function toast(text, action, onAction) {
  $('#toast-text').textContent = text;
  const btn = $('#toast-action');
  btn.hidden = !action;
  btn.textContent = action || '';
  btn.onclick = () => {
    hideToast();
    onAction?.();
  };
  const el = $('#toast');
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}
function hideToast() {
  const el = $('#toast');
  el.classList.remove('show');
  setTimeout(() => {
    if (!el.classList.contains('show')) el.hidden = true;
  }, 250);
}

/* ---------- adding spends ---------- */

function addFromText(text) {
  const parsed = parseSpends(text);
  if (!parsed.length) {
    toast(`No amount in “${text.trim()}”`, 'Edit', () => openType(text));
    return false;
  }
  const created = store.add(parsed.map((s) => ({ ...s, heard: text.trim() })));
  state.lastAdded = created;
  const p = getPeriod(state.kind, state.offset);
  if (created.some((s) => !inRange(s, p.start, p.end))) state.offset = 0;
  render();
  const msg =
    created.length === 1
      ? `${money(created[0].amount)} · ${created[0].title} · ${catOf(created[0].category).name}`
      : `Added ${created.length} spends · ${money(sum(created))}`;
  toast(msg, 'Undo', () => {
    store.remove(created.map((s) => s.id));
    render();
  });
  flash(created.map((s) => s.id));
  return true;
}

function flash(ids) {
  requestAnimationFrame(() => {
    ids.forEach((id) => document.querySelector(`.spend[data-id="${CSS.escape(id)}"]`)?.classList.add('new'));
  });
}

/* ---------- voice ---------- */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let heard = '';

function setListening(on) {
  document.body.classList.toggle('listening', on);
  $('#mic').setAttribute('aria-label', on ? 'Stop listening' : 'Tell me what you spent');
  $('#live').hidden = !on && !heard;
}

function startListening() {
  if (!SR) {
    openType();
    toast('Voice isn’t supported in this browser. Type it instead.');
    return;
  }
  heard = '';
  $('#live-text').textContent = 'Try “350 on dinner at Social”';
  $('#live-text').classList.add('placeholder');
  rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    heard = Array.from(e.results, (r) => r[0].transcript).join(' ');
    $('#live-text').textContent = heard;
    $('#live-text').classList.remove('placeholder');
  };
  rec.onerror = (e) => {
    const msgs = {
      'not-allowed': 'Microphone access is off. Allow it in your browser settings.',
      'service-not-allowed': 'Voice isn’t available here. Type it instead.',
      'no-speech': 'Didn’t catch that. Try again?',
      network: 'Voice needs a connection. Type it instead.',
      'audio-capture': 'No microphone found.',
    };
    if (e.error !== 'aborted') toast(msgs[e.error] || 'Voice didn’t work. Try again.', e.error === 'no-speech' ? null : 'Type', openType);
    heard = '';
  };
  rec.onend = () => {
    const text = heard;
    heard = '';
    rec = null;
    setListening(false);
    $('#live').hidden = true;
    if (text.trim()) addFromText(text);
  };
  try {
    rec.start();
    navigator.vibrate?.(8);
    setListening(true);
  } catch {
    rec = null;
  }
}

function stopListening() {
  rec?.stop();
}

$('#mic').addEventListener('click', () => (rec ? stopListening() : startListening()));

/* ---------- sheets ---------- */

function openSheet(dlg) {
  dlg.returnValue = '';
  dlg.showModal();
}
// tap outside a sheet to dismiss; buttons marked data-close dismiss with their value
document.querySelectorAll('dialog.sheet').forEach((dlg) => {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close('cancel');
    const closer = e.target.closest('[data-close]');
    if (closer) dlg.close(closer.dataset.close);
  });
});

function openType(prefill = '') {
  const dlg = $('#type-sheet');
  $('#type-input').value = prefill;
  openSheet(dlg);
  $('#type-input').focus();
}
$('#type-btn').addEventListener('click', () => openType());
$('#type-sheet').addEventListener('close', () => {
  if ($('#type-sheet').returnValue === 'add') {
    const text = $('#type-input').value;
    if (text.trim()) addFromText(text);
  }
});

let editing = null;
function openEdit(id) {
  const s = store.all().find((x) => x.id === id);
  if (!s) return;
  editing = s;
  const f = $('#edit-form');
  f.amount.value = s.amount;
  f.title.value = s.title;
  f.note.value = s.note || '';
  f.date.value = s.date;
  f.date.max = toISODate(today());
  $('#edit-currency').textContent = currencySymbol();
  $('#edit-cats').innerHTML =
    '<legend>Category</legend>' +
    CATEGORIES.map(
      (c) => `<label class="chip"><input type="radio" name="category" value="${c.id}"${catOf(s.category).id === c.id ? ' checked' : ''}/>
        <span><span class="dot" style="--c:var(--cat-${c.id})"></span>${esc(c.name)}</span></label>`,
    ).join('');
  $('#edit-heard').textContent = s.heard ? `Heard: “${s.heard}”` : '';
  openSheet($('#edit-sheet'));
}
$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('.spend');
  if (b) openEdit(b.dataset.id);
});
$('#edit-sheet').addEventListener('close', () => {
  const action = $('#edit-sheet').returnValue;
  const f = $('#edit-form');
  const s = editing;
  editing = null;
  if (!s) return;
  if (action === 'save') {
    const amount = parseFloat(f.amount.value);
    store.update(s.id, {
      amount: amount > 0 ? Math.round(amount * 100) / 100 : s.amount,
      title: f.title.value.trim() || s.title,
      note: f.note.value.trim(),
      date: f.date.value || s.date,
      category: f.category.value || s.category,
    });
    render();
  } else if (action === 'delete') {
    store.remove(s.id);
    render();
    toast(`Deleted ${s.title}`, 'Undo', () => {
      store.restore([s]);
      render();
    });
  }
});

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'HKD', 'NZD', 'ZAR', 'BRL', 'MXN', 'IDR', 'MYR', 'PHP', 'THB', 'PKR', 'BDT', 'LKR', 'NPR', 'SAR', 'SEK', 'NOK', 'DKK'];
function openSettings() {
  const f = $('#settings-form');
  const { currency, budget } = store.settings();
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([navigator.language], { type: 'currency' }) : null;
  const list = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];
  $('#currency-select').innerHTML = list
    .map((c) => `<option value="${c}"${c === currency ? ' selected' : ''}>${c}${names ? ` · ${esc(names.of(c))}` : ''}</option>`)
    .join('');
  f.budget.value = budget || '';
  openSheet($('#settings-sheet'));
}
$('#settings-btn').addEventListener('click', openSettings);
$('#settings-sheet').addEventListener('close', () => {
  const f = $('#settings-form');
  store.saveSettings({ currency: f.currency.value, budget: Math.max(0, parseFloat(f.budget.value) || 0) });
  fmtCache.clear();
  render();
});

$('#export-btn').addEventListener('click', () => {
  const rows = [['date', 'amount', 'currency', 'title', 'category', 'note', 'heard']];
  const { currency } = store.settings();
  [...store.all()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((s) => rows.push([s.date, s.amount, currency, s.title, catOf(s.category).name, s.note || '', s.heard || '']));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `spends-${toISODate(new Date())}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#wipe-btn').addEventListener('click', () => {
  if (!confirm('Erase every spend on this device? This can’t be undone.')) return;
  store.clear();
  $('#settings-sheet').close('save');
});

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('#install-btn').hidden = false;
});
$('#install-btn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#install-btn').hidden = true;
});

/* ---------- navigation ---------- */

document.querySelectorAll('.segmented button').forEach((b) =>
  b.addEventListener('click', () => {
    state.kind = b.dataset.kind;
    state.offset = 0;
    render();
  }),
);
$('#prev').addEventListener('click', () => {
  state.offset -= 1;
  render();
});
$('#next').addEventListener('click', () => {
  if (state.offset < 0) state.offset += 1;
  render();
});
$('#cats').addEventListener('click', (e) => {
  const b = e.target.closest('.cat');
  if (!b) return;
  state.category = state.category === b.dataset.cat ? null : b.dataset.cat;
  render();
});
$('#clear-filter').addEventListener('click', () => {
  state.category = null;
  render();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 120);
});
// refresh "today" when the app comes back after midnight
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && render());

render();

// home-screen shortcut: "Add a spend"
if (new URLSearchParams(location.search).get('add') === 'voice') {
  history.replaceState(null, '', location.pathname);
  startListening();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
