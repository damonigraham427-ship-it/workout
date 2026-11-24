// Time Tracker (Damoni, Nov 23, 2026): a running record of time spent
// inside tests. Read-only: it reads localStorage 'examHistory' and keeps
// only attempts that carry a numeric 'secs' (recorded by exam.js /
// retention.js since the tracker shipped; older attempts have none and
// are ignored). Each timed attempt is a session: date, test, run kind,
// duration. Totals roll up by day / week (Monday-start) / month /
// calendar quarter / calendar half-year / year, all subjects combined;
// the year view filters by subject or shows all combined. Renders into
// <section id="tracker-box">; needs index.json like the other pages.
(function () {
  var box = document.getElementById('tracker-box');
  if (!box) return;

  var CAT_ORDER = ['NREMT', '60 Minutes', 'Fraction Bases', 'Vocabulary'];
  var RETENTION = 'Meta Retention';
  var RETENTION_KEY = 'meta-retention';
  var ALL = 'All combined';
  var LOG_CAP = 100;
  var byFile = {};   // file -> index entry
  var selected = ALL;

  function loadHist() {
    try {
      var h = JSON.parse(localStorage.getItem('examHistory') || '{}');
      return (h && typeof h === 'object') ? h : {};
    } catch (e) { return {}; }
  }

  // Attempts store ts as an ISO string (exam.js) — accept numbers too.
  function tsMs(a) {
    if (!a) return null;
    if (typeof a.ts === 'number' && isFinite(a.ts)) return a.ts;
    var t = Date.parse(a.ts);
    return isNaN(t) ? null : t;
  }

  function kindLabel(suffix) {
    if (!suffix) return 'Start';
    if (suffix === '#meta') return 'Meta';
    if (suffix === '#meta10') return 'Meta 10%';
    if (suffix === '#redundancy') return 'Redundancy';
    if (suffix === '#coverage') return 'Coverage';
    if (suffix.indexOf('#topic:') === 0) return 'Topic: ' + suffix.slice('#topic:'.length);
    if (suffix.indexOf('#tier:') === 0) {
      var n = parseInt(suffix.slice('#tier:'.length), 10);
      if (isFinite(n)) return 'Tier ' + (n * 5 + 1) + '-' + ((n + 1) * 5) + '%';
    }
    return suffix.slice(1);
  }

  function shortTitle(e) {
    var t = e.title || e.file || '';
    var pre = (e.category || '') + ' \u2014 ';
    if (e.category && t.indexOf(pre) === 0) return t.slice(pre.length);
    var i = t.indexOf('\u2014');
    return i >= 0 ? t.slice(i + 1).trim() : t;
  }

  // Flatten examHistory into timed sessions, newest first.
  function sessions(hist) {
    var out = [];
    Object.keys(hist).forEach(function (key) {
      var atts = hist[key];
      if (!Array.isArray(atts)) return;
      var title, category, kind;
      if (key === RETENTION_KEY) {
        title = 'Meta Retention Exam';
        category = RETENTION;
        kind = kindLabel('');
      } else {
        var h = key.indexOf('#');
        var file = h >= 0 ? key.slice(0, h) : key;
        var e = byFile[file];
        if (!e) return; // not in the index — cannot resolve title/subject
        title = shortTitle(e);
        category = e.category || 'General';
        kind = kindLabel(h >= 0 ? key.slice(h) : '');
      }
      atts.forEach(function (a) {
        if (!a || typeof a.secs !== 'number' || !isFinite(a.secs) || a.secs < 0) return;
        var t = tsMs(a);
        if (t === null) return;
        out.push({ ts: t, title: title, category: category, kind: kind, secs: a.secs });
      });
    });
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out;
  }

  function fmtDur(s) {
    s = Math.round(s);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    var hh = Math.floor(m / 60), rm = m % 60;
    return hh + 'h ' + (rm < 10 ? '0' : '') + rm + 'm';
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // [label, startMs, endMs) in local time.
  function periods(now) {
    var d = new Date(now);
    var y = d.getFullYear(), mo = d.getMonth();
    var dayStart = new Date(y, mo, d.getDate()).getTime();
    var dow = (d.getDay() + 6) % 7; // Monday = 0
    return [
      ['Today', dayStart, dayStart + 86400000],
      ['This week', dayStart - dow * 86400000, dayStart - dow * 86400000 + 7 * 86400000],
      ['This month', new Date(y, mo, 1).getTime(), new Date(y, mo + 1, 1).getTime()],
      ['This quarter', new Date(y, Math.floor(mo / 3) * 3, 1).getTime(), new Date(y, Math.floor(mo / 3) * 3 + 3, 1).getTime()],
      ['Last 6 months', new Date(y, mo < 6 ? 0 : 6, 1).getTime(), new Date(y, mo < 6 ? 6 : 12, 1).getTime()],
      ['This year', new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime()]
    ];
  }

  function sumBetween(list, start, end) {
    var s = 0;
    list.forEach(function (x) { if (x.ts >= start && x.ts < end) s += x.secs; });
    return s;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function row(leftText, rightText) {
    var r = el('div', 'ladder-row');
    r.appendChild(el('span', null, leftText));
    var v = el('span', null, rightText);
    v.style.fontWeight = '600';
    r.appendChild(v);
    return r;
  }

  function render() {
    var hist = loadHist();
    var all = sessions(hist);
    box.innerHTML = '';
    box.appendChild(el('h2', 'cl-title', 'Time Tracker'));

    if (!all.length) {
      box.appendChild(el('p', 'cl-empty', 'No timed sessions yet. Finish a test and it will log here with its time.'));
      return;
    }

    var ps = periods(Date.now());
    box.appendChild(el('h3', 'check-ch', 'Totals'));
    ps.forEach(function (p) {
      box.appendChild(row(p[0], fmtDur(sumBetween(all, p[1], p[2]))));
    });

    // Year section: subject chips + that subject's year total + its log.
    var yearStart = ps[5][1], yearEnd = ps[5][2];
    box.appendChild(el('h3', 'check-ch', 'This year'));
    var cats = CAT_ORDER.filter(function (c) {
      return Object.keys(byFile).some(function (f) { return (byFile[f].category || 'General') === c; });
    });
    Object.keys(byFile).forEach(function (f) {
      var c = byFile[f].category || 'General';
      if (CAT_ORDER.indexOf(c) === -1 && cats.indexOf(c) === -1) cats.push(c);
    });
    // Workout Elements has no timed tests (its lists never run in the exam
    // runner), so it gets no chip — its total could only ever read 0s.
    cats = cats.filter(function (c) { return c !== 'Workout Elements'; });
    var chips = [ALL].concat(cats, [RETENTION]);
    if (chips.indexOf(selected) === -1) selected = ALL;
    var chipRow = el('div');
    chips.forEach(function (c) {
      var b = el('button', 'np-chip' + (selected === c ? ' np-chip-on' : ''), c);
      b.type = 'button';
      b.addEventListener('click', function () { selected = c; render(); });
      chipRow.appendChild(b);
    });
    box.appendChild(chipRow);

    var yearAll = all.filter(function (x) { return x.ts >= yearStart && x.ts < yearEnd; });
    var yearSel = selected === ALL ? yearAll : yearAll.filter(function (x) { return x.category === selected; });
    var yTotal = 0;
    yearSel.forEach(function (x) { yTotal += x.secs; });
    box.appendChild(row(selected === ALL ? 'All subjects' : selected, fmtDur(yTotal)));

    if (!yearSel.length) {
      box.appendChild(el('p', 'cl-empty', 'No timed sessions this year.'));
      return;
    }
    yearSel.slice(0, LOG_CAP).forEach(function (x) {
      box.appendChild(row(fmtDate(x.ts) + ' \u00B7 ' + x.title + ' \u00B7 ' + x.kind, fmtDur(x.secs)));
    });
    if (yearSel.length > LOG_CAP) {
      box.appendChild(el('p', 'cl-empty', 'Showing the latest ' + LOG_CAP + ' of ' + yearSel.length + ' sessions this year.'));
    }
  }

  render();

  fetch('index.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      (data.exams || []).forEach(function (e) { if (e && e.file) byFile[e.file] = e; });
      render();
    })
    .catch(function () {
      // No index: only Meta Retention sessions can be resolved.
      render();
    });
})();
