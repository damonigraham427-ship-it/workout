// Completion Dates portal (Damoni, Nov 23, 2026): on the main page, pick a
// subject and its tests list out with the date each was first finished —
// a lasting record, modeled on the workout ladder dates. Read-only: it
// reads localStorage 'examHistory' (run key -> attempts [{ts, score,
// total, ...}]); a test counts as finished when an attempt exists under
// the exam file's own key, and the date shown is the EARLIEST attempt ts
// under that key (the first finish, like a ladder date). Renders into
// <section id="portal-box">; needs index.json like the other pages.
(function () {
  var box = document.getElementById('portal-box');
  if (!box) return;

  var SUBJECTS = ['NREMT', '60 Minutes', 'Fraction Bases', 'Vocabulary'];
  var RETENTION = 'Meta Retention';
  var RETENTION_KEY = 'meta-retention';
  var allExams = [];
  var selected = null;

  function loadHist() {
    try {
      var h = JSON.parse(localStorage.getItem('examHistory') || '{}');
      return (h && typeof h === 'object') ? h : {};
    } catch (e) { return {}; }
  }

  function firstFinish(hist, key) {
    var atts = hist[key];
    if (!Array.isArray(atts) || !atts.length) return null;
    var min = null;
    for (var i = 0; i < atts.length; i++) {
      var a = atts[i];
      // Attempts store ts as an ISO string (exam.js/retention.js) — accept
      // numeric ms too (fix, Nov 23, 2026: numeric-only check hid every
      // real finished test).
      var t = a ? (typeof a.ts === 'number' ? a.ts : (typeof a.ts === 'string' ? Date.parse(a.ts) : NaN)) : NaN;
      if (isFinite(t)) {
        if (min === null || t < min) min = t;
      }
    }
    return min;
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function shortTitle(e) {
    var t = e.title || e.file || '';
    var pre = (e.category || '') + ' \u2014 ';
    if (e.category && t.indexOf(pre) === 0) return t.slice(pre.length);
    var i = t.indexOf('\u2014');
    return i >= 0 ? t.slice(i + 1).trim() : t;
  }

  function chapterLabel(ch) {
    return /^\d+$/.test(ch) ? 'Chapter ' + ch : ch;
  }

  function rowsFor(entries, hist) {
    return entries.map(function (e) {
      return { name: shortTitle(e), ts: firstFinish(hist, e.file) };
    });
  }

  // Groups for one subject: [{head|null, rows:[{name, ts}]}]
  function groupsFor(cat, hist) {
    if (cat === RETENTION) {
      return [{ head: null, rows: [{ name: 'Meta Retention Exam', ts: firstFinish(hist, RETENTION_KEY) }] }];
    }
    var entries = allExams.filter(function (e) { return (e.category || 'General') === cat; });
    if (cat === 'NREMT') {
      var order = [], byCh = {};
      entries.forEach(function (e) {
        var ch = e.chapter === undefined ? 'Other' : String(e.chapter);
        if (!byCh[ch]) { byCh[ch] = []; order.push(ch); }
        byCh[ch].push(e);
      });
      if (order.every(function (ch) { return /^\d+$/.test(ch); })) {
        order.sort(function (a, b) { return (+a) - (+b); });
      }
      return order.map(function (ch) {
        return { head: chapterLabel(ch), rows: rowsFor(byCh[ch], hist) };
      });
    }
    if (cat === 'Fraction Bases') {
      var pct = entries.filter(function (e) { return e.pie !== 2; });
      var rec = entries.filter(function (e) { return e.pie === 2; });
      var gs = [];
      if (pct.length) gs.push({ head: 'Percentages', rows: rowsFor(pct, hist) });
      if (rec.length) gs.push({ head: 'Reciprocals \u2014 1/x', rows: rowsFor(rec, hist) });
      return gs;
    }
    return [{ head: null, rows: rowsFor(entries, hist) }];
  }

  function countsFor(cat, hist) {
    var gs = groupsFor(cat, hist), done = 0, total = 0;
    gs.forEach(function (g) {
      g.rows.forEach(function (r) { total++; if (r.ts !== null) done++; });
    });
    return { done: done, total: total };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function render() {
    var hist = loadHist();
    box.innerHTML = '';
    box.appendChild(el('h2', 'cl-title', 'Completion Dates'));

    var btnRow = el('div');
    SUBJECTS.concat([RETENTION]).forEach(function (cat) {
      var b = el('button', 'np-chip' + (selected === cat ? ' np-chip-on' : ''), cat);
      b.type = 'button';
      b.addEventListener('click', function () {
        selected = (selected === cat) ? null : cat;
        render();
      });
      btnRow.appendChild(b);
    });
    box.appendChild(btnRow);

    var list = el('div');
    if (!selected) {
      list.appendChild(el('p', 'cl-empty', 'Pick a subject to see when you finished each test.'));
      box.appendChild(list);
      return;
    }
    var c = countsFor(selected, hist);
    list.appendChild(el('p', 'history', c.done + ' of ' + c.total + ' finished'));
    groupsFor(selected, hist).forEach(function (g) {
      if (g.head) list.appendChild(el('h3', 'check-ch', g.head));
      g.rows.forEach(function (r) {
        var row = el('div', 'ladder-row');
        row.appendChild(el('span', null, r.name));
        if (r.ts !== null) {
          var d = el('span', null, fmtDate(r.ts));
          d.style.color = '#15803d';
          d.style.fontWeight = '600';
          row.appendChild(d);
        } else {
          row.appendChild(el('span', 'check-dash', '\u2014'));
        }
        list.appendChild(row);
      });
    });
    box.appendChild(list);
  }

  render();

  fetch('index.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allExams = data.exams || [];
      render();
    })
    .catch(function () {
      // No index: subject lists stay empty, Meta Retention still works.
      render();
    });
})();
