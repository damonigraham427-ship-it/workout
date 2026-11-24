// Back door — Edison's inspection page (not linked from the site).
// Shows, per chapter / set / topic, the status the Topics circle computes and
// the exact attempt that decided it. Also appends a dated snapshot line to
// localStorage 'backdoorLog' on every open; that key syncs to the cloud, so
// Edison can watch the numbers change over time from his side too.
(function () {
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }
  var out = document.getElementById('bd-out');
  var logEl = document.getElementById('bd-log');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function cls(st) { return st === 'Mastered' ? 'bd-m' : st === 'Learning' ? 'bd-l' : 'bd-r'; }
  function when(ts) {
    var d = new Date(ts);
    return isNaN(d) ? '?' : d.toLocaleString();
  }

  // Same evidence rule as topics.js: per topic, newest of (latest full-set
  // attempt, latest topic run) decides.
  function evidence(file, questions) {
    var byTopicQ = {};
    questions.forEach(function (q) {
      if (!q.topic) return;
      (byTopicQ[q.topic] || (byTopicQ[q.topic] = [])).push(q);
    });
    var out = {};
    function consider(topic, attempt, runQuestions, source) {
      if (!attempt) return;
      var missed = {};
      (attempt.missed || []).forEach(function (m) { missed[m.question] = true; });
      var n = 0, correct = 0;
      runQuestions.forEach(function (q) { n++; if (!missed[q.question]) correct++; });
      if (!n) return;
      var ts = Date.parse(attempt.ts || '') || 0;
      if (!out[topic] || ts >= out[topic].ts) {
        out[topic] = { n: n, correct: correct, ts: ts, source: source };
      }
    }
    Object.keys(byTopicQ).forEach(function (topic) {
      var setA = (hist[file] || [])[0] || null;
      consider(topic, setA, byTopicQ[topic], 'full set run');
      var topicA = (hist[file + '#topic:' + topic] || [])[0] || null;
      consider(topic, topicA, byTopicQ[topic], 'topic run');
    });
    return out;
  }

  fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
    var entries = (idx.exams || []).filter(function (e) { return e.category === 'NREMT' && !/macro/.test(e.file); });
    // STAGED hour-fix: also load the Hour series so its statuses are visible here.
    var hourEntries = (idx.exams || []).filter(function (e) { return (e.category === '60 Minutes' || e.category === 'Fraction Bases') && e.pie !== 2; }); // pie:2 = recip exams: Start-only, tracked on the fraction page, not in tiers
    function load(e) {
      return fetch(e.file, { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (d) { return { entry: e, questions: d.questions || [] }; })
        .catch(function () { return { entry: e, questions: [] }; });
    }
    return Promise.all([Promise.all(entries.map(load)), Promise.all(hourEntries.map(load))])
      .then(function (both) { return { groups: both[0], hourGroups: both[1] }; });
  }).then(function (bundle) {
    var groups = bundle.groups;
    var hourGroups = bundle.hourGroups;
    var html = '';
    var snap = {}; // chapter -> {mastered, total}
    var byCh = {};
    groups.forEach(function (g) { (byCh[g.entry.chapter] || (byCh[g.entry.chapter] = [])).push(g); });
    Object.keys(byCh).sort().forEach(function (ch) {
      html += '<p class="bd-sec">Chapter ' + esc(ch) + '</p>';
      var chM = 0, chT = 0;
      byCh[ch].forEach(function (g) {
        var isTb = /textbook/.test(g.entry.file);
        if (isTb) {
          var tb = (hist[g.entry.file] || [])[0];
          var pct = (tb && tb.total) ? Math.round(100 * (tb.score || 0) / tb.total) : 0;
          html += '<div class="bd-line"><b>' + esc(g.entry.title) + '</b> — ' +
            (tb ? pct + '% (last run ' + tb.score + '/' + tb.total + ', ' + when(tb.ts) + ')' : 'not attempted') + '</div>';
          return;
        }
        var ev = evidence(g.entry.file, g.questions);
        var topics = {};
        g.questions.forEach(function (q) { if (q.topic) topics[q.topic] = (topics[q.topic] || 0) + 1; });
        var names = Object.keys(topics);
        var mastered = 0;
        var lines = names.map(function (name) {
          var e = ev[name];
          var st = !e ? 'Ready to Learn' : (e.correct / e.n) >= 0.8 ? 'Mastered' : 'Learning';
          if (st === 'Mastered') mastered++;
          return '<div class="bd-line">' + esc(name) + ' — <span class="' + cls(st) + '">' + st + '</span>' +
            (e ? ' <span class="bd-dim">(' + e.correct + '/' + e.n + ' from ' + e.source + ', ' + when(e.ts) + ')</span>'
               : ' <span class="bd-dim">(no attempt)</span>') + '</div>';
        }).join('');
        var pct = names.length ? Math.round(100 * mastered / names.length) : 0;
        html += '<div class="bd-line"><b>' + esc(g.entry.title) + '</b> — ' + pct + '% mastered (' + mastered + '/' + names.length + ' topics)</div>' + lines;
        chM += mastered; chT += names.length;
      });
      snap[ch] = { mastered: chM, total: chT };
    });

    // STAGED hour-fix: Hour series section. Tier logic is inlined here
    // (backdoor.html does not load hour-tiers.js); it mirrors hour-tiers.js:
    // per tier, newest eligible attempt (Start / #coverage / #redundancy)
    // decides; Meta / Meta 10 are synthetic and reported as mode lines only.
    html += '<p class="bd-sec">60 Minutes \u00B7 Fraction Bases</p>';
    var hourM = 0, hourT = 0;
    hourGroups.forEach(function (g) {
      var st = (typeof HourTiers !== 'undefined')
        ? HourTiers.hourStatus(hist, g.entry.file, g.questions)
        : null;
      var modes = ['#meta10|Meta 10%', '#meta|Meta', '#redundancy|Redundancy', '#coverage|Coverage', '|Start'];
      var lines = modes.map(function (spec) {
        var a = (hist[g.entry.file + spec.split('|')[0]] || [])[0];
        return spec.split('|')[1] + ': ' + (a ? (a.score || 0) + '/' + (a.total || 0) + ', ' + when(a.ts) : 'not attempted');
      }).join(' \u00B7 ');
      if (st) {
        html += '<div class="bd-line"><b>' + esc(g.entry.title) + '</b> \u2014 ' + st.pct + '% tiers mastered (' + st.mastered + '/20)</div>';
        html += '<div class="bd-line bd-dim">' + esc(lines) + '</div>';
        hourM += st.mastered; hourT += 20;
      } else {
        html += '<div class="bd-line"><b>' + esc(g.entry.title) + '</b> \u2014 tier status unavailable (hour-tiers.js not loaded)</div>';
        html += '<div class="bd-line bd-dim">' + esc(lines) + '</div>';
      }
    });
    if (hourT) snap['Hour'] = { mastered: hourM, total: hourT };

    // Raw attempts, newest first across all keys
    var all = [];
    Object.keys(hist).forEach(function (k) {
      (hist[k] || []).forEach(function (a) { all.push({ key: k, a: a }); });
    });
    all.sort(function (x, y) { return (Date.parse(y.a.ts || '') || 0) - (Date.parse(x.a.ts || '') || 0); });
    html += '<p class="bd-sec">Raw attempts (' + all.length + ')</p>';
    html += all.slice(0, 60).map(function (r) {
      return '<div class="bd-line">' + esc(when(r.a.ts)) + ' — ' + esc(r.a.title || r.key) + ' — ' + (r.a.score || 0) + '/' + (r.a.total || 0) + '</div>';
    }).join('') || '<div class="bd-line bd-dim">None yet</div>';
    out.innerHTML = html;

    // Snapshot log: one line per open, capped; syncs via sync.js ('backdoorLog').
    var log = [];
    try { log = JSON.parse(localStorage.getItem('backdoorLog') || '[]'); } catch (e) { log = []; }
    var parts = Object.keys(snap).sort().map(function (ch) {
      return (ch === 'Hour' ? 'Hour tiers' : 'Ch' + ch) + ' ' + snap[ch].mastered + '/' + snap[ch].total;
    }).join(' · ');
    var line = new Date().toLocaleString() + ' — ' + (parts || 'no topics');
    if (!log.length || log[log.length - 1].line !== line) {
      log.push({ ts: Date.now(), line: line });
      if (log.length > 200) log = log.slice(log.length - 200);
      try { localStorage.setItem('backdoorLog', JSON.stringify(log)); } catch (e) { /* full/blocked */ }
      if (window.examSync && window.examSync.pushNow) window.examSync.pushNow();
    }
    logEl.textContent = log.slice().reverse().map(function (x) { return x.line; }).join('\n') || 'No snapshots yet.';
  }).catch(function () {
    out.textContent = 'Could not load the exam list.';
  });
})();
