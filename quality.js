// Quality review page — questions the student marked with the Quality review
// button, from the latest finished attempt per exam (examHistory.quality),
// each with a comment box. Mirrors the Notepad page's storage pattern.
(function () {
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }
  var notes = {};
  try { notes = JSON.parse(localStorage.getItem('qualityNotes') || '{}'); } catch (e) { notes = {}; }
  var cleared = {};
  try { cleared = JSON.parse(localStorage.getItem('qualityCleared') || '{}'); } catch (e) { cleared = {}; }

  // Per-exam scoping: ?exam=<file> shows only that exam's pad (its full-set
  // attempt plus its topic runs). No param: a picker of exams that have entries.
  var examParam = new URLSearchParams(location.search).get('exam');
  // STAGED hour-fix: see notepad.js — strip any '#mode' suffix, not only '#topic:'.
  function baseOf(key) { return key.split('#')[0]; }
  var picker = {}; // base file -> {title, count}
  function notePicker(examKey, title, count) {
    var b = baseOf(examKey);
    var p = picker[b] || (picker[b] = { title: '', count: 0 });
    if (examKey === b && title) p.title = title;
    if (!p.title && title) p.title = title.replace(/ \u2014 (Topic: .*|Tier .*|Meta 10|Meta|Redundancy|Coverage)$/, '');
    p.count += count;
  }


  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function saveNotes() { try { localStorage.setItem('qualityNotes', JSON.stringify(notes)); } catch (e) {} }
  function saveCleared() { try { localStorage.setItem('qualityCleared', JSON.stringify(cleared)); } catch (e) {} }

  // Per exam key, newest source wins: finished attempt (examHistory) or,
  // when newer, the in-progress run's live marks (examProgress.live) — so a
  // quality-marked question shows here mid-run, before the test is finished.
  var groupByKey = {};
  Object.keys(hist).forEach(function (examKey) {
    var attempts = hist[examKey];
    if (!Array.isArray(attempts) || !attempts.length) return;
    if (examParam && baseOf(examKey) !== examParam) return;
    var latest = attempts[0];
    var gone = (cleared[examKey] && cleared[examKey].ts === latest.ts) ? cleared[examKey].questions : [];
    var entries = (latest.quality || [])
      .filter(function (m) { return gone.indexOf(m.question) === -1; })
      .sort(function (a, b) { return (a.n || 0) - (b.n || 0); })
      .map(function (m) {
        return { examKey: examKey, ts: latest.ts, n: m.n, question: m.question, source: m.source || '', correct: m.correct, explanation: m.explanation || '', result: m.result || '' };
      });
    if (entries.length) groupByKey[examKey] = { title: latest.title || examKey, entries: entries, tsMs: Date.parse(latest.ts || '') || 0 };
  });
  var prog = {};
  try { prog = JSON.parse(localStorage.getItem('examProgress') || '{}'); } catch (e) { prog = {}; }
  Object.keys(prog).forEach(function (examKey) {
    var rec = prog[examKey];
    if (!rec || !rec.live) return;
    if (examParam && baseOf(examKey) !== examParam) return;
    var tsMs = rec.ts || 0;
    if (groupByKey[examKey] && groupByKey[examKey].tsMs >= tsMs) return;
    var tsIso = new Date(tsMs).toISOString();
    var entries = (rec.live.qualityQs || [])
      .sort(function (a, b) { return (a.n || 0) - (b.n || 0); })
      .map(function (m) {
        return { examKey: examKey, ts: tsIso, live: true, n: m.n, question: m.question, source: m.source || '', correct: m.correct, explanation: m.explanation || '', result: m.result || '' };
      });
    if (entries.length) groupByKey[examKey] = { title: (rec.live.title || examKey) + ' \u2014 in progress', entries: entries, tsMs: tsMs };
  });
  var groups = Object.keys(groupByKey).map(function (k) { return groupByKey[k]; });
  groups.forEach(function (g) { notePicker(g.entries[0].examKey, g.title, g.entries.length); });
  groups.sort(function (a, b) { return a.title < b.title ? -1 : 1; });

  if (!examParam) {
    // Picker: each exam has its own pad \u2014 link into it, nothing aggregated here.
    // ?category=<name> filters the picker to one subject (the entry point from
    // inside that subject); no param keeps the all-subjects picker.
    var categoryParam = new URLSearchParams(location.search).get('category');
    var sb = document.getElementById('send-btn'); if (sb) sb.parentElement.hidden = true;
    var fl = document.querySelector('.np-filters'); if (fl) fl.hidden = true;
    document.getElementById('qr-empty').hidden = true;
    var renderPicker = function (bases) {
      var tot = 0; bases.forEach(function (b) { tot += picker[b].count; });
      var h1p = document.querySelector('h1');
      if (categoryParam && h1p) h1p.textContent = 'Quality review \u2014 ' + categoryParam;
      document.getElementById('qr-counts').textContent = tot
        ? (categoryParam ? categoryParam + ' \u2014 pick an exam:' : 'Each exam has its own quality review. Pick an exam:')
        : 'Nothing here yet. Flag a question while you answer, or finish an exam, and it shows up in that exam\'s pad.';
      document.getElementById('quality').innerHTML =
        (categoryParam ? '<p><a href="quality.html">All subjects</a></p>' : '') +
        bases.map(function (b) {
          return '<p><a href="quality.html?exam=' + encodeURIComponent(b) + '">' + esc(picker[b].title || b) + '</a> \u2014 ' + picker[b].count + ' questions</p>';
        }).join('');
    };
    var allBases = Object.keys(picker).sort();
    if (!categoryParam) { renderPicker(allBases); return; }
    fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
      var inCat = {};
      (idx.exams || []).forEach(function (e) { if ((e.category || 'General') === categoryParam) inCat[e.file] = true; });
      renderPicker(allBases.filter(function (b) { return inCat[b]; }));
    }).catch(function () { renderPicker(allBases); });
    return;
  }
  var h1 = document.querySelector('h1');
  var pTitle = (picker[examParam] && picker[examParam].title) || examParam;
  if (h1) h1.textContent = 'Quality review \u2014 ' + pTitle;
  if (h1 && !(picker[examParam] && picker[examParam].title)) {
    // No attempts yet for this exam: take the pretty title from the registry.
    fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
      var e = (idx.exams || []).filter(function (x) { return x.file === examParam; })[0];
      if (e && e.title) h1.textContent = 'Quality review \u2014 ' + e.title;
    }).catch(function () {});
  }
  var countsEl = document.getElementById('qr-counts');
  var allLink = document.createElement('a');
  allLink.href = 'quality.html'; allLink.textContent = 'All exams';
  countsEl.parentElement.insertBefore(allLink, countsEl);


  var total = 0;
  groups.forEach(function (g) { total += g.entries.length; });
  document.getElementById('qr-counts').textContent = total + ' questions marked for quality review';
  document.getElementById('qr-empty').hidden = total !== 0;

  var box = document.getElementById('quality');
  groups.forEach(function (g) {
    var h = document.createElement('h2');
    h.textContent = g.title;
    box.appendChild(h);
    g.entries.forEach(function (e) {
      var card = document.createElement('section');
      card.className = 'note-card';
      var meta = '';
      if (e.correct) meta = 'Correct: ' + esc(e.correct) + (e.result ? ' · You ' + esc(e.result) : '');
      card.innerHTML =
        '<p class="np-tags">&#9873; Quality review' + (e.source ? ' · Deck: ' + esc(e.source) : '') + '</p>' +
        '<p class="np-q">' + esc(e.question) + '</p>' +
        (meta ? '<p class="np-meta">' + meta + '</p>' : '') +
        (e.explanation ? '<p class="np-meta">' + esc(e.explanation) + '</p>' : '');
      var ta = document.createElement('textarea');
      ta.className = 'note-area';
      ta.rows = 2;
      ta.placeholder = 'My comment on this question…';
      var nk = e.examKey + '||' + e.question;
      ta.value = notes[nk] || '';
      ta.addEventListener('change', function () { notes[nk] = ta.value; saveNotes(); });
      card.appendChild(ta);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'np-remove';
      rm.textContent = 'Done — remove';
      rm.addEventListener('click', function () {
        if (e.live) {
          try {
            var pr = JSON.parse(localStorage.getItem('examProgress') || '{}');
            var rc = pr[e.examKey];
            if (rc && rc.live) {
              rc.live.qualityQs = (rc.live.qualityQs || []).filter(function (m) { return m.question !== e.question; });
              localStorage.setItem('examProgress', JSON.stringify(pr));
            }
          } catch (err) {}
          card.remove();
          return;
        }
        if (!cleared[e.examKey] || cleared[e.examKey].ts !== e.ts) cleared[e.examKey] = { ts: e.ts, questions: [] };
        cleared[e.examKey].questions.push(e.question);
        saveCleared();
        card.remove();
      });
      card.appendChild(rm);
      box.appendChild(card);
    });
  });

  // Send to Edison: snapshot of everything on this page + my comments.
  var sendBtn = document.getElementById('send-btn');
  var sendStatus = document.getElementById('send-status');
  if (sendBtn) sendBtn.onclick = function () {
    var reportGroups = [];
    groups.forEach(function (g) {
      var items = [];
      g.entries.forEach(function (e) {
        var item = { n: e.n, question: e.question, correct: e.correct, explanation: e.explanation || '', comment: notes[e.examKey + '||' + e.question] || '' };
        item.result = e.result || '';
        items.push(item);
      });
      if (items.length) reportGroups.push({ title: g.title, items: items });
    });
    if (!reportGroups.length) { sendStatus.textContent = 'Nothing to send yet.'; return; }
    var report = { id: 'r' + Date.now(), ts: new Date().toISOString(), page: 'quality', groups: reportGroups };
    sendBtn.disabled = true;
    sendStatus.textContent = 'Sending\u2026';
    var wait = setInterval(function () {
      if (window.examSync) {
        clearInterval(wait);
        window.examSync.sendReport(report).then(function () {
          sendStatus.textContent = 'Sent \u2713 \u2014 Edison will message you to discuss.';
          sendBtn.disabled = false;
        }).catch(function () {
          sendStatus.textContent = 'Could not send \u2014 sign in to sync first (blue bar at the top), then try again.';
          sendBtn.disabled = false;
        });
      }
    }, 200);
    setTimeout(function () { clearInterval(wait); if (sendBtn.disabled) { sendStatus.textContent = 'Could not send \u2014 sign in to sync first (blue bar at the top), then try again.'; sendBtn.disabled = false; } }, 12000);
  };
})();
