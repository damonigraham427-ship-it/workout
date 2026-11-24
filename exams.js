const PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
let allExams = [];
let cards = [];
let view = 'categories';
let selCategory = null;
let selChapter = null;

function chapterLabel(ch) {
  return /^\d+$/.test(ch) ? 'Chapter ' + ch : ch;
}

function setView() {
  const clBox = document.getElementById('checklist-box');
  if (clBox) clBox.hidden = view !== 'categories';
  const ptBox = document.getElementById('portal-box');
  if (ptBox) ptBox.hidden = view !== 'categories';
  const trBox = document.getElementById('tracker-box');
  if (trBox) trBox.hidden = view !== 'categories';
  document.getElementById('level-categories').hidden = view !== 'categories';
  document.getElementById('level-chapters').hidden = view !== 'chapters';
  document.getElementById('level-exams').hidden = view !== 'exams';
  const back = document.getElementById('back-btn');
  const crumb = document.getElementById('crumb');
  if (view === 'categories') {
    back.hidden = true;
    crumb.textContent = 'Exams';
  } else if (view === 'chapters') {
    back.hidden = false;
    back.textContent = '\u2190 Exams';
    crumb.textContent = 'Exams / ' + selCategory;
  } else if (selChapter === 'Other') {
    back.hidden = false;
    back.textContent = '\u2190 Exams';
    crumb.textContent = 'Exams / ' + selCategory;
  } else {
    back.hidden = false;
    back.textContent = '\u2190 ' + selCategory;
    crumb.textContent = 'Exams / ' + selCategory + ' / ' + chapterLabel(selChapter);
  }
  renderCatLinks();
}

function renderCatLinks() {
  const el = document.getElementById('cat-links');
  if (!el) return;
  if (view === 'categories' || !selCategory) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '';
  const mk = (href, text) => { const a = document.createElement('a'); a.href = href; a.textContent = text; return a; };
  el.appendChild(mk('notepad.html?category=' + encodeURIComponent(selCategory), selCategory + ' Notepad'));
  el.appendChild(document.createTextNode(' \u00B7 '));
  el.appendChild(mk('quality.html?category=' + encodeURIComponent(selCategory), selCategory + ' Quality review'));
}

function navCard(label, sub, color, onclick) {
  const b = document.createElement('button');
  b.className = 'nav-card';
  b.style.borderTopColor = color;
  b.textContent = label;
  const s = document.createElement('small');
  s.textContent = sub;
  b.appendChild(s);
  b.addEventListener('click', onclick);
  return b;
}

// Meta Retention Exam card count: number sets (60 Minutes + Fraction Bases)
// with a finished attempt at 80% or better. Mirrors the qualify rule in
// retention.js (retModulePassed) — keep the two in sync.
function retQualifyingCount() {
  let hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { /* none */ }
  let n = 0;
  allExams.forEach(e => {
    if (e.category !== '60 Minutes' && e.category !== 'Fraction Bases') return;
    let passed = false;
    Object.keys(hist).forEach(k => {
      if (passed) return;
      if (k === e.file || k.indexOf(e.file + '#') === 0) {
        (hist[k] || []).forEach(a => {
          if (a && a.total > 0 && a.score / a.total >= 0.8) passed = true;
        });
      }
    });
    if (passed) n++;
  });
  return n;
}

function renderCategories() {
  const wrap = document.getElementById('level-categories');
  wrap.innerHTML = '';
  const cats = [];
  allExams.forEach(e => {
    const c = e.category || 'General';
    if (!cats.includes(c)) cats.push(c);
  });
  // Front-page order is fixed by Damoni (Nov 22, 2026): NREMT, 60 Minutes,
  // Workout Elements, Fraction Bases. Unknown subjects follow in list order.
  const ORDER = ['NREMT', '60 Minutes', 'Workout Elements', 'Fraction Bases', 'Vocabulary', 'Signal'];
  cats.sort((x, y) => {
    const ix = ORDER.indexOf(x), iy = ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  cats.forEach((c, i) => {
    if (c === '60 Minutes') {
      // One front-page entry for this series: the tier circle. Its per-exam
      // detail carries the 5 mode links, so the old exam-list card is removed
      // (Damoni's order, Nov 22, 2026 — two 60 Minutes entries was one too many).
      wrap.appendChild(navCard(c, 'its own site \u00B7 tier circle \u00B7 status by 5% tier', PALETTE[i % PALETTE.length], () => {
        // 60 Minutes spawned to its own site (Damoni, Nov 23, 2026); this
        // card is the way into it. The series' data stays in this index so
        // Retention and the portals keep counting it here.
        location.href = 'https://damonigraham427-ship-it.github.io/60-minutes/';
      }));
      return;
    }
    if (c === 'Signal') {
      // Signal spawned to its own site (Damoni's order, Nov 24, 2026),
      // same pattern as the 60 Minutes card: this card is the way into it.
      // One exam per Signal Networking Theory study tab lives there.
      wrap.appendChild(navCard(c, 'its own site \u00B7 one exam per study tab', PALETTE[i % PALETTE.length], () => {
        location.href = 'https://damonigraham427-ship-it.github.io/signal/';
      }));
      return;
    }
    if (c === 'Fraction Bases') {
      // The fraction-based modules of the Hour series, given their own
      // front-page exam (Damoni's order, Nov 22, 2026): same tier circle,
      // its own page.
      wrap.appendChild(navCard(c, 'its own site \u00B7 tier circle \u00B7 status by 5% tier', PALETTE[i % PALETTE.length], () => {
        // Fraction Bases spawned to its own site (Damoni, Nov 24, 2026);
        // this card is the way into it. Its entries stay in this index so
        // Retention and the portals keep counting them here.
        location.href = 'https://damonigraham427-ship-it.github.io/fractions/';
      }));
      return;
    }
    if (c === 'Workout Elements') {
      // One front-page entry for this section: its circle (Damoni's order,
      // Nov 22, 2026 — same pattern as the 60 Minutes tier circle). The
      // circle reads his saved dates/entries; editing stays on the list pages.
      wrap.appendChild(navCard(c, 'its own site \u00B7 body circles \u00B7 plus a running & treadmill section', PALETTE[i % PALETTE.length], () => {
        // Workout Elements spawned to its own site (Damoni, Nov 24, 2026);
        // this card is the way into it.
        location.href = 'https://damonigraham427-ship-it.github.io/workout/';
      }));
      return;
    }
    if (c === 'NREMT') {
      // NREMT spawned to its own site (Damoni, Nov 24, 2026); this card is
      // the way into it. Its entries stay in this index so the portals
      // keep counting them here.
      wrap.appendChild(navCard(c, 'its own site \u00B7 4 chapters', PALETTE[i % PALETTE.length], () => {
        location.href = 'https://damonigraham427-ship-it.github.io/nremt/';
      }));
      return;
    }
    if (c === 'Vocabulary') {
      // Vocabulary spawned to its own site (Damoni, Nov 24, 2026); this
      // card is the way into it.
      wrap.appendChild(navCard(c, 'its own site \u00B7 11 sets', PALETTE[i % PALETTE.length], () => {
        location.href = 'https://damonigraham427-ship-it.github.io/vocabulary/';
      }));
      return;
    }
    const inCat = allExams.filter(e => (e.category || 'General') === c);
    const chs = new Set(inCat.map(e => e.chapter === undefined ? 'Other' : String(e.chapter)));
    const n = chs.size;
    if (n === 1 && chs.has('Other')) {
      wrap.appendChild(navCard(c, inCat.length + (inCat.length === 1 ? ' exam' : ' exams'), PALETTE[i % PALETTE.length], () => {
        selCategory = c;
        selChapter = 'Other';
        cards.forEach(card => {
          card.style.display = (card.dataset.category === selCategory && card.dataset.chapter === selChapter) ? '' : 'none';
        });
        view = 'exams';
        setView();
      }));
    } else {
      wrap.appendChild(navCard(c, n + (n === 1 ? ' chapter' : ' chapters'), PALETTE[i % PALETTE.length], () => {
        selCategory = c;
        renderChapters();
        view = 'chapters';
        setView();
      }));
    }
  });
  // Meta Retention Exam (Damoni, Nov 23, 2026): sits different — its own
  // spot under the subject cards. Random test from sets finished at 80%+.
  // Retention card hidden on this spawned site (number subjects only).
  if (!window.NO_RETENTION) {
    const retN = retQualifyingCount();
    wrap.appendChild(navCard('Meta Retention Exam',
      retN ? 'random test from sets you finished \u00B7 ' + retN + (retN === 1 ? ' set' : ' sets') + ' in the mix'
           : 'random test from sets you finished \u00B7 none yet',
      '#9333ea', () => { location.href = 'retention.html'; }));
  }
  // Deep link (Nov 23, 2026): exams.html?cat=<category>&ch=<chapter> opens
  // that subject's exam list directly — the exam runner's back button
  // points here for subjects without their own page.
  const q = new URLSearchParams(location.search);
  const qCat = q.get('cat'), qCh = q.get('ch');
  if (qCat && allExams.some(e => (e.category || 'General') === qCat)) {
    selCategory = qCat;
    const chs = new Set(allExams.filter(e => (e.category || 'General') === qCat)
      .map(e => e.chapter === undefined ? 'Other' : String(e.chapter)));
    if (qCh !== null && chs.has(qCh)) {
      selChapter = qCh;
      cards.forEach(card => {
        card.style.display = (card.dataset.category === selCategory && card.dataset.chapter === selChapter) ? '' : 'none';
      });
      view = 'exams';
    } else {
      renderChapters();
      view = 'chapters';
    }
    setView();
  }
}

function renderChapters() {
  const wrap = document.getElementById('level-chapters');
  wrap.innerHTML = '';
  const inCat = allExams.filter(e => (e.category || 'General') === selCategory);
  const chs = [];
  inCat.forEach(e => {
    const ch = e.chapter === undefined ? 'Other' : String(e.chapter);
    if (!chs.includes(ch)) chs.push(ch);
  });
  chs.forEach((ch, i) => {
    const n = inCat.filter(e => (e.chapter === undefined ? 'Other' : String(e.chapter)) === ch).length;
    const label = chapterLabel(ch);
    if (selCategory === 'NREMT' && ch !== 'Other') {
      wrap.appendChild(navCard(label, 'topic circle \u00B7 practice by topic', PALETTE[i % PALETTE.length], () => {
        location.href = 'topics.html?ch=' + encodeURIComponent(ch);
      }));
      return;
    }
    wrap.appendChild(navCard(label, n + (n === 1 ? ' exam' : ' exams'), PALETTE[i % PALETTE.length], () => {
      selChapter = ch;
      cards.forEach(card => {
        card.style.display = (card.dataset.category === selCategory && card.dataset.chapter === selChapter) ? '' : 'none';
      });
      view = 'exams';
      setView();
    }));
  });
}

function buildCards() {
  const wrap = document.getElementById('exam-cards');
  allExams.forEach((e, i) => {
    const n = i + 1;
    const color = PALETTE[(n - 1) % PALETTE.length];
    const parts = e.title.split('—');
    const cat = parts.length > 1 ? parts[0].trim() : 'Exam';
    const name = parts.length > 1 ? parts.slice(1).join('—').trim() : e.title;

    const card = document.createElement('section');
    card.className = 'exam-card' + (e.placeholder ? ' placeholder' : '');
    card.style.borderTopColor = color;
    card.id = 'exam-' + n;
    card.dataset.category = e.category || 'General';
    card.dataset.chapter = e.chapter === undefined ? 'Other' : String(e.chapter);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = color;
    badge.textContent = 'EXAM ' + n;
    card.appendChild(badge);

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = cat;
    card.appendChild(chip);

    const h = document.createElement('h2');
    h.textContent = name;
    card.appendChild(h);

    if (e.note) {
      const p = document.createElement('p');
      p.textContent = e.note;
      card.appendChild(p);
    }

    if (e.ladder) {
      const la = document.createElement('a');
      la.className = 'start-btn';
      la.href = 'ladder.html?ladder=' + encodeURIComponent(e.file);
      la.textContent = 'Open list';
      card.appendChild(la);
    } else if (e.notes) {
      const na = document.createElement('a');
      na.className = 'start-btn';
      na.href = 'notes.html?notes=' + encodeURIComponent(e.file);
      na.textContent = 'Open list';
      card.appendChild(na);
    } else if (e.placeholder) {
      const s = document.createElement('span');
      s.className = 'not-built';
      s.textContent = 'Not built yet';
      card.appendChild(s);
    } else {
if (e.draw) {
        const m10 = document.createElement('a');
        m10.className = 'start-btn alt';
        m10.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=meta10';
        m10.textContent = 'Meta 10% exam';
        card.appendChild(m10);
        try {
          const prog5 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const mp10 = prog5[e.file + '#meta10'];
          if (mp10 && mp10.idx !== undefined && mp10.total) {
            const mpp10 = document.createElement('p');
            mpp10.className = 'history';
            mpp10.textContent = 'Meta 10 in progress \u2014 question ' + (mp10.idx + 1) + ' of ' + mp10.total;
            card.appendChild(mpp10);
          }
        } catch (err) { /* no saved meta10 progress */ }
      }

      if (e.draw) {
        const mt = document.createElement('a');
        mt.className = 'start-btn alt';
        mt.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=meta';
        mt.textContent = 'Meta exam';
        card.appendChild(mt);
        try {
          const prog4 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const mp = prog4[e.file + '#meta'];
          if (mp && mp.idx !== undefined && mp.total) {
            const mpp = document.createElement('p');
            mpp.className = 'history';
            mpp.textContent = 'Meta in progress \u2014 question ' + (mp.idx + 1) + ' of ' + mp.total;
            card.appendChild(mpp);
          }
        } catch (err) { /* no saved meta progress */ }
      }

      if (e.redundancy) {
        const r = document.createElement('a');
        r.className = 'start-btn alt';
        r.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=redundancy';
        r.textContent = 'Redundancy exam';
        card.appendChild(r);
        try {
          const prog2 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const rp = prog2[e.file + '#redundancy'];
          if (rp && rp.idx !== undefined && rp.total) {
            const rpp = document.createElement('p');
            rpp.className = 'history';
            rpp.textContent = 'Redundancy in progress \u2014 question ' + (rp.idx + 1) + ' of ' + rp.total;
            card.appendChild(rpp);
          }
        } catch (err) { /* no saved redundancy progress */ }
      }

if (e.draw) {
        const cv = document.createElement('a');
        cv.className = 'start-btn alt';
        cv.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=coverage';
        cv.textContent = 'Coverage exam';
        card.appendChild(cv);
        try {
          const prog3 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const cp = prog3[e.file + '#coverage'];
          if (cp && cp.idx !== undefined && cp.total) {
            const cpp = document.createElement('p');
            cpp.className = 'history';
            cpp.textContent = 'Coverage in progress \u2014 question ' + (cp.idx + 1) + ' of ' + cp.total;
            card.appendChild(cpp);
          }
        } catch (err) { /* no saved coverage progress */ }
      }

            const a = document.createElement('a');
      a.className = 'start-btn';
      a.href = 'exam.html?exam=' + encodeURIComponent(e.file);
      a.textContent = 'Start exam';
      card.appendChild(a);

            try {
        const prog = JSON.parse(localStorage.getItem('examProgress') || '{}');
        const p = prog[e.file];
        if (p && p.idx !== undefined && p.total) {
          const pp = document.createElement('p');
          pp.className = 'history';
          pp.textContent = 'In progress — question ' + (p.idx + 1) + ' of ' + p.total;
          card.appendChild(pp);
        }
      } catch (err) { /* no saved progress */ }

      try {
        const hist = JSON.parse(localStorage.getItem('examHistory') || '{}');
        const attempts = hist[e.file];
        if (Array.isArray(attempts) && attempts.length) {
          const last = attempts[0];
          const d = new Date(last.ts);
          const hp = document.createElement('p');
          hp.className = 'history';
          hp.textContent = 'Last attempt: ' + last.score + '/' + last.total + ' · ' + last.missed.length + ' missed' +
            (last.flagged && last.flagged.length ? ' · ' + last.flagged.length + ' flagged' : '') + ' · ' +
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          card.appendChild(hp);
        }
      } catch (err) { /* no saved history */ }
    }

    wrap.appendChild(card);
    cards.push(card);
  });
}

fetch('index.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(data => {
    allExams = data.exams || [];
    if (!allExams.length) {
      document.getElementById('empty').hidden = false;
      document.getElementById('level-exams').hidden = false;
      return;
    }
    buildCards();
    renderCategories();
    // If the ?cat= deep link applied, renderCategories already set the
    // view — don't reset it to the top-level list (fix, Nov 23, 2026).
    if (!new URLSearchParams(location.search).get('cat')) view = 'categories';
    setView();
  });

document.getElementById('back-btn').addEventListener('click', () => {
  if (view === 'exams') { view = selChapter === 'Other' ? 'categories' : 'chapters'; }
  else if (view === 'chapters') { view = 'categories'; }
  setView();
  window.scrollTo({ top: 0 });
});

// ---- Front-page checklist notepad (Damoni, Nov 22, 2026) ----
// Notes he puts down underneath the subject list; each note is checkable.
// Stored in localStorage 'frontChecklist' as [{text, done}]; syncs through
// sync.js (EXACT_KEYS). Additive only — no existing key is touched.
const clKey = 'frontChecklist';
let clItems = [];
try { clItems = JSON.parse(localStorage.getItem(clKey) || '[]') || []; } catch (e) { clItems = []; }
if (!Array.isArray(clItems)) clItems = [];
function clSave() { try { localStorage.setItem(clKey, JSON.stringify(clItems)); } catch (e) { /* storage unavailable */ } }
function clRender() {
  const list = document.getElementById('cl-list');
  if (!list) return;
  list.innerHTML = '';
  clItems.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = 'cl-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!it.done;
    cb.addEventListener('change', () => { it.done = cb.checked; clSave(); clRender(); });
    li.appendChild(cb);
    const sp = document.createElement('span');
    sp.className = 'cl-text' + (it.done ? ' cl-done' : '');
    sp.textContent = it.text;
    li.appendChild(sp);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-del';
    del.textContent = '\u2715';
    del.addEventListener('click', () => { clItems.splice(i, 1); clSave(); clRender(); });
    li.appendChild(del);
    list.appendChild(li);
  });
  document.getElementById('cl-empty').hidden = clItems.length > 0;
}
function clAdd() {
  const input = document.getElementById('cl-input');
  const text = input.value.trim();
  if (!text) return;
  clItems.push({ text: text, done: false });
  input.value = '';
  clSave();
  clRender();
  input.focus();
}
const clBtn = document.getElementById('cl-add-btn');
if (clBtn) clBtn.addEventListener('click', clAdd);
const clInput = document.getElementById('cl-input');
if (clInput) clInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') clAdd(); });
clRender();
