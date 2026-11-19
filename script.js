(function () {
  // Fixed "now" so every run (and every screenshot) shows the same numbers: Tuesday 22:40.
  const NOW = { dow: 1, min: 22 * 60 + 40 };
  const DAY = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const WD = [0, 1, 2, 3, 4], WE = [5, 6], ALL = [0, 1, 2, 3, 4, 5, 6];
  const PRESETS = [['Один раз', []], ['Будні', WD], ['Вихідні', WE], ['Щодня', ALL]];

  const pad = n => String(n).padStart(2, '0');
  const fmt = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  function daysText(d) {
    if (!d.length) return 'Одноразово';
    if (same(d, WD)) return 'По буднях (Пн–Пт)';
    if (same(d, WE)) return 'У вихідні (Сб–Нд)';
    if (same(d, ALL)) return 'Щодня';
    return d.map(i => DAY[i]).join(', ');
  }
  function untilMin(min, days) {
    let best = Infinity;
    for (let k = 0; k <= 7; k++) {
      const dow = (NOW.dow + k) % 7;
      if (days.length && !days.includes(dow)) continue;
      const diff = k * 1440 + min - NOW.min;
      if (diff > 0) best = Math.min(best, diff);
    }
    return best;
  }
  const hm = u => Math.floor(u / 60) + ' год ' + (u % 60) + ' хв';
  const untilText = (min, days) => 'через ' + hm(untilMin(min, days));

  const baseAlarms = () => [
    { id: 'a1', min: 6 * 60 + 45, days: [5, 6], on: false, label: 'Пробіжка' },
    { id: 'a2', min: 9 * 60, days: [], on: true, label: 'Зустріч з куратором' }
  ];
  let seq = 0;
  function addAlarm(list, min, days) {
    const a = { id: 'n' + (++seq), min, days: days.slice(), on: true, label: 'Будильник' };
    list.push(a); list.sort((x, y) => x.min - y.min);
    return a.id;
  }

  const S = {};
  function reset(v) {
    if (v === 1) S[1] = { digits: [], auto: false, days: [], screen: 'edit', alarms: baseAlarms(), newId: null };
    if (v === 2) S[2] = { min: 8 * 60, days: [], screen: 'edit', dragging: false, alarms: baseAlarms(), newId: null };
    if (v === 3) S[3] = { step: 1, h: null, m: null, days: null, more: false, alarms: baseAlarms(), newId: null };
  }
  [1, 2, 3].forEach(reset);

  let V = 1, MARK = null, SHOT = false;
  const $screen = document.getElementById('screen');
  const $marks = document.getElementById('marks');

  function listScreen(st, msg) {
    return '<div class="body"><div class="big-title">Будильник</div><div class="alarms">' + st.alarms.map(a =>
      '<div class="alarm' + (a.on ? '' : ' off') + (a.id === st.newId ? ' new' : '') + '">' +
      '<div class="t num">' + fmt(a.min) + '</div>' +
      '<div class="meta"><b>' + a.label + (a.id === st.newId ? '<span class="badge">новий</span>' : '') + '</b>' + daysText(a.days) + '</div>' +
      '<button class="switch" role="switch" aria-checked="' + a.on + '" aria-label="Увімкнути ' + fmt(a.min) + '" data-act="toggle" data-id="' + a.id + '"></button>' +
      '</div>').join('') + '</div></div>' +
      (msg ? '<div class="toast"><span class="ic">✓</span><span>' + msg + '</span></div>' : '') +
      '<button class="fab" data-act="again" aria-label="Новий будильник">+</button>';
  }
  const bar = title => '<div class="bar"><button class="x" data-act="cancel" aria-label="Скасувати">✕</button><h2>' + title + '</h2><span class="sp"></span></div>';
  const presets = (days, hick) => '<div class="seg"' + (hick ? ' data-hick' : '') + '>' + PRESETS.map((p, i) => '<button data-act="preset" data-i="' + i + '" aria-pressed="' + same(days, p[1]) + '">' + p[0] + '</button>').join('') + '</div>';
  const dayRow = days => '<div class="days">' + DAY.map((d, i) => '<button data-act="day" data-i="' + i + '" aria-pressed="' + days.includes(i) + '">' + d + '</button>').join('') + '</div>';

  // ---------------- Variant 1: numeric keypad ----------------
  // Digits fill HH:MM from the left; a first digit 3–9 becomes 0X automatically. Impossible keys are disabled.
  function allowed(dg) {
    const n = dg.length;
    if (n === 0) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (n === 1) return dg[0] === 2 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (n === 2) return [0, 1, 2, 3, 4, 5];
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // n === 3, or a complete time: the next digit starts a new entry
  }
  const v1min = st => st.digits.length === 4 ? (st.digits[0] * 10 + st.digits[1]) * 60 + st.digits[2] * 10 + st.digits[3] : null;
  function renderV1() {
    const st = S[1];
    if (st.screen === 'list') { $screen.innerHTML = listScreen(st, fmt(st.saved) + ' · ' + daysText(st.days) + ' — задзвонить ' + untilText(st.saved, st.days)); return; }
    const dg = st.digits, ok = allowed(dg), min = v1min(st);
    const cells = [0, 1, 2, 3].map(i => i < dg.length ? '<span>' + dg[i] + '</span>' : '<span class="' + (i === dg.length ? 'cur' : 'ph') + '">_</span>');
    const sub = min !== null ? 'Задзвонить <b>' + untilText(min, st.days) + '</b>' : dg.length ? 'Введіть хвилини' : 'Наберіть час: 7 3 0 → 07:30';
    const key = k => '<button data-act="key" data-k="' + k + '"' + (ok.includes(k) ? '' : ' disabled') + '>' + k + '</button>';
    $screen.innerHTML = bar('Новий будильник') +
      '<div class="body">' +
      '<div class="disp"><div class="big num">' + cells[0] + cells[1] + ':' + cells[2] + cells[3] + '</div><div class="sub">' + sub + '</div></div>' +
      '<div class="thumb">' + presets(st.days) +
      '<div class="pad" data-fitts data-hick>' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key).join('') +
      '<button class="fn" data-act="del" aria-label="Стерти"' + (dg.length ? '' : ' disabled') + '>⌫</button>' + key(0) + '<span class="blank"></span></div>' +
      '</div></div>' +
      '<div class="foot"><button class="primary" data-act="save1"' + (min === null ? ' disabled' : '') + ' data-fitts>Зберегти</button></div>';
  }
  function pressKey(k) {
    const st = S[1];
    if (st.digits.length === 4) { st.digits = []; st.auto = false; }
    if (!allowed(st.digits).includes(k)) return;
    if (st.digits.length === 0 && k >= 3) { st.digits = [0, k]; st.auto = true; } else st.digits.push(k);
  }

  // ---------------- Variant 2: sleep ring ----------------
  const R = 104, C = 132, SNAP = 15;
  const pt = (min, r) => { const a = min / 1440 * 2 * Math.PI; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
  function renderV2() {
    const st = S[2];
    if (st.screen === 'list') { $screen.innerHTML = listScreen(st, fmt(st.min) + ' · ' + daysText(st.days) + ' — задзвонить ' + untilText(st.min, st.days)); return; }
    const span = (st.min - NOW.min + 1440) % 1440;
    const sleep = Math.max(0, span - 15);
    const [x0, y0] = pt(NOW.min, R), [x1, y1] = pt(st.min, R);
    let ticks = '', lbls = '';
    for (let h = 0; h < 24; h++) { const [a, b] = pt(h * 60, R - 22), [c, d] = pt(h * 60, R - (h % 6 ? 26 : 30)); ticks += '<line class="ring-tick" x1="' + a + '" y1="' + b + '" x2="' + c + '" y2="' + d + '"/>'; }
    [0, 6, 12, 18].forEach(h => { const [a, b] = pt(h * 60, R - 42); lbls += '<text class="ring-lbl" x="' + a + '" y="' + b + '">' + pad(h) + '</text>'; });
    const [mx, my] = pt(NOW.min, R);
    $screen.innerHTML = bar('Новий будильник') +
      '<div class="body">' +
      '<div class="readout"><div class="big num">' + fmt(st.min) + '</div><div class="sub">Сон <b>' + hm(sleep) + '</b> · ≈ ' + (sleep / 90).toFixed(1).replace('.', ',') + ' циклу по 90 хв</div></div>' +
      '<div class="ringwrap" id="ring"><svg viewBox="0 0 264 264" aria-hidden="true">' +
      '<circle class="ring-track" cx="' + C + '" cy="' + C + '" r="' + R + '"/>' + ticks + lbls +
      '<path class="ring-arc" d="M' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 ' + (span > 720 ? 1 : 0) + ' 1 ' + x1 + ' ' + y1 + '"/>' +
      '<circle class="ring-now" cx="' + mx + '" cy="' + my + '" r="11"/><text x="' + mx + '" y="' + (my + 1) + '" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#fff">☾</text>' +
      '<circle class="ring-handle' + (st.dragging ? ' drag' : '') + '" id="handle" cx="' + x1 + '" cy="' + y1 + '" r="22" data-fitts/>' +
      '<text x="' + x1 + '" y="' + (y1 + 1) + '" text-anchor="middle" dominant-baseline="middle" font-size="18" style="fill:var(--accent)" pointer-events="none">☀</text>' +
      '</svg><div class="ring-center"><div><span>Підйом</span><b>' + fmt(st.min) + '</b><span>ляжете о 22:40</span></div></div>' +
      (st.dragging ? '<svg class="cursor" viewBox="0 0 26 30" style="left:' + (x1 + 6) + 'px;top:' + (y1 + 6) + 'px"><path d="M8 3c1.4 0 2.5 1.1 2.5 2.5V14l1-.2V11c0-1.4 1.1-2.4 2.4-2.4s2.4 1 2.4 2.4v2.4l1 .1v-1.1c0-1.3 1-2.3 2.3-2.3s2.3 1 2.3 2.3v8.3c0 4.6-3.5 8.3-8.1 8.3h-1.6c-2.6 0-5-1.3-6.4-3.4L1.9 18.7c-.8-1.2-.4-2.8.9-3.5 1-.5 2.2-.3 3 .5l.7.8V5.5C6.5 4.1 6.6 3 8 3z" fill="#fff" stroke="#17202b" stroke-width="1.6"/></svg>' : '') +
      '</div>' +
      '<div class="fine"><button data-act="fine" data-d="-5">−5 хв</button><button data-act="fine" data-d="5">+5 хв</button></div>' +
      presets(st.days, true) + dayRow(st.days) +
      '</div>' +
      '<div class="foot"><button class="primary" data-act="save2" data-fitts>Зберегти</button></div>';
    bindRing();
  }
  function bindRing() {
    const ring = document.getElementById('ring'), st = S[2];
    const setFrom = e => {
      const r = ring.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      let a = Math.atan2(dx, -dy); if (a < 0) a += 2 * Math.PI;
      st.min = (Math.round(a / (2 * Math.PI) * 1440 / SNAP) * SNAP) % 1440;
    };
    ring.addEventListener('pointerdown', e => {
      const r = ring.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 264);
      if (d < R - 30 || d > R + 30) return; // only the ring band and the handle react
      e.preventDefault(); st.dragging = true; setFrom(e); renderV2();
      const move = ev => { setFrom(ev); renderV2(); };
      const up = () => { st.dragging = false; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); renderV2(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
  }

  // ---------------- Variant 3: big-button wizard ----------------
  const GROUPS = [['Ніч', 0], ['Ранок', 6], ['День', 12], ['Вечір', 18]];
  const REPEATS = [['Лише один раз', 'задзвонить завтра й вимкнеться', []], ['По буднях', 'понеділок – п’ятниця', WD], ['У вихідні', 'субота й неділя', WE], ['Щодня', 'усі сім днів', ALL]];
  function renderV3() {
    const st = S[3];
    if (st.step === 5) { $screen.innerHTML = listScreen(st, 'Будильник збережено: ' + fmt(st.h * 60 + st.m) + ' · ' + daysText(st.days)); return; }
    const wbar = '<div class="wbar"><button class="back" data-act="back"' + (st.step === 1 ? ' disabled' : '') + '>← Назад</button>' +
      '<div class="prog">Крок ' + st.step + ' з 4<div class="dots">' + [1, 2, 3, 4].map(i => '<i class="' + (i <= st.step ? 'on' : '') + '"></i>').join('') + '</div></div></div>';
    let html = '';
    if (st.step === 1) {
      html = '<div class="body v3"><p class="q">О котрій годині вас розбудити?</p>' +
        '<div data-hick style="display:flex;flex-direction:column;gap:12px">' +
        GROUPS.map(g => '<div class="hgroup' + (g[0] === 'Ранок' ? ' morning' : '') + '"><span class="gl">' + g[0] + '</span><div class="hgrid">' +
          [0, 1, 2, 3, 4, 5].map(k => { const h = g[1] + k; return '<button data-act="h" data-h="' + h + '" aria-pressed="' + (st.h === h) + '">' + pad(h) + '</button>'; }).join('') +
          '</div></div>').join('') + '</div></div>';
    } else if (st.step === 2) {
      const mins = st.more ? [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] : [0, 15, 30, 45];
      html = '<div class="body v3"><p class="q">Скільки хвилин?</p><div class="sofar"><b>' + pad(st.h) + '</b> : __</div>' +
        '<div class="mgrid' + (st.more ? ' more' : '') + '">' + mins.map(m => '<button data-act="m" data-m="' + m + '" aria-pressed="' + (st.m === m) + '">:' + pad(m) + '</button>').join('') + '</div>' +
        (st.more ? '' : '<button class="link" data-act="more">Інші хвилини (кожні 5 хв) →</button>') + '</div>';
    } else if (st.step === 3) {
      html = '<div class="body v3"><p class="q">Коли повторювати?</p><div class="sofar"><b>' + pad(st.h) + ' : ' + pad(st.m) + '</b></div>' +
        '<div class="opts" data-hick>' + REPEATS.map((r, i) => '<button class="opt" data-act="rep" data-i="' + i + '" aria-pressed="' + (!!st.days && same(st.days, r[2])) + '"><b>' + r[0] + '</b><span>' + r[1] + '</span></button>').join('') + '</div></div>';
    } else {
      const min = st.h * 60 + st.m;
      html = '<div class="body v3"><p class="q">Перевірте та збережіть</p>' +
        '<div class="summary"><div class="big num">' + fmt(min) + '</div><div class="rep">' + daysText(st.days) + '</div><div class="in">Задзвонить ' + untilText(min, st.days) + '</div></div>' +
        '<div style="flex:1"></div></div><div class="foot"><button class="save-xl" data-act="save3" data-fitts>✓ Зберегти будильник</button></div>';
    }
    $screen.innerHTML = wbar + html;
  }

  const RENDER = { 1: renderV1, 2: renderV2, 3: renderV3 };

  $screen.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const act = b.dataset.act, st = S[V];
    const keep = () => { const a = st.alarms; reset(V); S[V].alarms = a; };
    switch (act) {
      case 'toggle': { const a = st.alarms.find(x => x.id === b.dataset.id); a.on = !a.on; break; }
      case 'again': case 'cancel': keep(); break;
      case 'preset': st.days = PRESETS[+b.dataset.i][1].slice(); break;
      case 'day': { const i = +b.dataset.i; st.days = st.days.includes(i) ? st.days.filter(x => x !== i) : [...st.days, i].sort(); break; }
      case 'key': pressKey(+b.dataset.k); break;
      case 'del': if (st.auto && st.digits.length === 2) { st.digits = []; st.auto = false; } else st.digits.pop(); break;
      case 'save1': { const m = v1min(st); if (m === null) return; st.saved = m; st.newId = addAlarm(st.alarms, m, st.days); st.screen = 'list'; break; }
      case 'fine': st.min = (st.min + +b.dataset.d + 1440) % 1440; break;
      case 'save2': st.newId = addAlarm(st.alarms, st.min, st.days); st.screen = 'list'; break;
      case 'h': st.h = +b.dataset.h; st.step = 2; break;
      case 'm': st.m = +b.dataset.m; st.step = 3; break;
      case 'more': st.more = true; break;
      case 'rep': st.days = REPEATS[+b.dataset.i][2].slice(); st.step = 4; break;
      case 'back': if (st.step > 1) st.step--; break;
      case 'save3': st.newId = addAlarm(st.alarms, st.h * 60 + st.m, st.days); st.step = 5; break;
    }
    draw();
  });

  function drawMarks() {
    $marks.innerHTML = '';
    if (!MARK) return;
    const host = document.getElementById('phone').getBoundingClientRect();
    const bw = 10; // phone border width
    const label = MARK === 'fitts' ? 'Закон Фітса' : 'Закон Хіка';
    $screen.querySelectorAll('[data-' + MARK + ']').forEach(el => {
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      box.className = 'mbox' + (r.width < 80 ? ' small' : '');
      box.style.left = (r.left - host.left - bw - 6) + 'px'; box.style.top = (r.top - host.top - bw - 6) + 'px';
      box.style.width = (r.width + 12) + 'px'; box.style.height = (r.height + 12) + 'px';
      box.innerHTML = '<span class="mtag">' + label + '</span>';
      $marks.appendChild(box);
    });
  }

  function draw() {
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(+t.dataset.v === V)));
    RENDER[V]();
    requestAnimationFrame(drawMarks);
  }
  document.getElementById('tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    V = +t.dataset.v; MARK = null;
    try { history.replaceState(null, '', '#v' + V); } catch (_) { location.hash = 'v' + V; }
    draw();
  });

  // Hash: #v2, #v2-s3, #v2-s3-fitts, #shot-v2-s3-hick — opens a variant at a given user step (used for the report screenshots).
  function applyStep(v, s) {
    reset(v);
    const st = S[v];
    if (v === 1) {
      if (s >= 2) pressKey(7);
      if (s >= 3) { pressKey(3); pressKey(0); }
      if (s >= 4) st.days = WD.slice();
      if (s >= 5) { st.saved = v1min(st); st.newId = addAlarm(st.alarms, st.saved, st.days); st.screen = 'list'; }
    }
    if (v === 2) {
      if (s >= 2) st.min = 7 * 60 + 30;
      if (s === 2) st.dragging = true;
      if (s >= 3) st.days = WD.slice();
      if (s >= 4) { st.newId = addAlarm(st.alarms, st.min, st.days); st.screen = 'list'; }
    }
    if (v === 3) {
      if (s >= 2) st.h = 7;
      if (s >= 3) st.m = 30;
      if (s >= 4) st.days = WD.slice();
      if (s >= 5) st.newId = addAlarm(st.alarms, 7 * 60 + 30, WD);
      st.step = Math.min(s, 5);
    }
  }
  function fromHash() {
    const parts = (location.hash || '').replace('#', '').split('-');
    SHOT = parts.includes('shot');
    document.body.classList.toggle('shot', SHOT);
    const v = parts.find(p => /^v[123]$/.test(p)); if (v) V = +v[1];
    const s = parts.find(p => /^s\d$/.test(p));
    if (s) applyStep(V, +s[1]);
    MARK = parts.includes('fitts') ? 'fitts' : parts.includes('hick') ? 'hick' : null;
    draw();
  }
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('resize', () => requestAnimationFrame(drawMarks));
  fromHash();
})();
