// Workout Elements circle — slice = one list (ladder or notes), same
// interaction and layout as topics.js (NREMT circle) / hour-topics.js.
// Inherent features preserved exactly: this page only READS the saved data —
// ladderDates:<file> (dates he enters per step), ladderAdded:<file> (his own
// entries), workoutNotes:<file> (his edited bullets) — with the same merge
// rules as ladder.js / notes.js. Editing stays on ladder.html / notes.html.
// Ladder % = share of steps (seeded + his added) that carry a date.
(function () {
  var PALETTE = ['#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#475569', '#9333ea', '#b45309', '#0e7490', '#15803d'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tint(hex, f) { var n = parseInt(hex.slice(1), 16); var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  function wedge(cx, cy, r, a0, a1) { if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2 - 0.0001; var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0); var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); var large = (a1 - a0) > Math.PI ? 1 : 0; return 'M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z'; }
  function shortTitle(e) { var t = e.title || e.file; var pre = (e.category || '') + ' \u2014 '; if (t.indexOf(pre) === 0) t = t.slice(pre.length); ['Upper Body \u2014 ', 'Lower Body \u2014 ', 'Abdomen \u2014 '].forEach(function (pre2) { if (t.indexOf(pre2) === 0) t = t.slice(pre2.length); }); return t; }
  function ls(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }

  fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
    var body = new URLSearchParams(location.search).get('body');
    if (['upper', 'abdomen', 'lower', 'running'].indexOf(body) === -1) { location.replace('workout.html'); return; }
    var regionName = { upper: 'Upper Body', abdomen: 'Abdomen', lower: 'Lower Body', running: 'Running' }[body];
    document.title = 'Workout Elements \u2014 ' + regionName;
    var h1 = document.getElementById('tp-title');
    if (h1) h1.textContent = 'Workout Elements \u2014 ' + regionName;
    var entries = (idx.exams || []).filter(function (e) { return e.category === 'Workout Elements' && e.region === body; });
    return Promise.all(entries.map(function (e) {
      return fetch(e.file, { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (d) { return { entry: e, data: d || {} }; })
        .catch(function () { return { entry: e, data: {} }; });
    }));
  }).then(function (groups) {
    groups.forEach(function (g, gi) {
      g.color = PALETTE[gi % PALETTE.length];
      g.name = shortTitle(g.entry);
      g.section = g.entry.chapter || '';
      var f = g.entry.file;
      if (g.entry.ladder) {
        g.kind = 'ladder';
        var dates = ls('ladderDates:' + f) || {};
        var added = ls('ladderAdded:' + f) || {};
        g.rows = []; // {group, text, date}
        (g.data.groups || []).forEach(function (gr) {
          var steps = (gr.steps || []).map(function (s) { return { text: s, own: false }; })
            .concat((added[gr.name] || []).map(function (s) { return { text: s, own: true }; }));
          steps.forEach(function (st) {
            g.rows.push({ group: gr.name, text: st.text, own: st.own, date: dates[gr.name + '|' + st.text] || '' });
          });
        });
        g.total = g.rows.length;
        g.dated = g.rows.filter(function (r) { return !!r.date; }).length;
        g.pct = g.total ? Math.round(100 * g.dated / g.total) : 0;
      } else {
        g.kind = 'notes';
        var stored = ls('workoutNotes:' + f);
        var items;
        if (Array.isArray(stored)) {
          items = stored.slice();
          (g.data.notes || []).forEach(function (n) { if (items.indexOf(n) === -1) items.push(n); });
        } else items = (g.data.notes || []).slice();
        g.rows = items.map(function (t) { return { text: t }; });
        g.total = g.rows.length;
        g.dated = 0;
        g.pct = null;
      }
    });

    // Slice weight: item count, but never zero — an empty list (e.g. Static
    // List before he adds to it) still gets a thin slice so it stays
    // reachable from the circle.
    groups.forEach(function (g) { g.w = Math.max(g.total, 1); });
    var totalItems = groups.reduce(function (s, g) { return s + g.w; }, 0);
    var totalSteps = groups.reduce(function (s, g) { return s + (g.kind === 'ladder' ? g.total : 0); }, 0);
    var totalDated = groups.reduce(function (s, g) { return s + (g.kind === 'ladder' ? g.dated : 0); }, 0);

    // UP NEXT: first ladder (index order) that still has steps without dates.
    var up = null;
    groups.forEach(function (g) { if (!up && g.kind === 'ladder' && g.dated < g.total) up = g; });
    var upEl = document.getElementById('tp-upnext');
    if (up) {
      upEl.hidden = false;
      upEl.innerHTML = 'UP NEXT: <strong>' + esc(up.name) + '</strong> \u00B7 ' + (up.total - up.dated) + ' steps without dates' +
        ' <a class="tp-practice" href="ladder.html?ladder=' + encodeURIComponent(up.entry.file) + '">Open list</a>';
    }

    var svg = document.getElementById('tp-pie');
    var CX = 210, CY = 210, R = 198, a = -Math.PI / 2, parts = [];
    groups.forEach(function (g, gi) {
      var span = totalItems ? (Math.PI * 2) * (g.w / totalItems) : 0;
      var cur = a;
      if (g.kind === 'ladder' && g.total) {
        var bands = [[g.dated, g.color], [g.total - g.dated, tint(g.color, 0.82)]];
        bands.forEach(function (bd) {
          if (!bd[0]) return;
          var sub = span * (bd[0] / g.total);
          parts.push('<path d="' + wedge(CX, CY, R, cur, cur + sub) + '" fill="' + bd[1] + '" stroke="#fff" stroke-width="2" data-group="' + gi + '"><title>' + esc(g.name) + '</title></path>');
          cur += sub;
        });
      } else {
        parts.push('<path d="' + wedge(CX, CY, R, cur, cur + span) + '" fill="' + tint(g.color, g.kind === 'ladder' ? 0.82 : 0.45) + '" stroke="#fff" stroke-width="2" data-group="' + gi + '"><title>' + esc(g.name) + '</title></path>');
      }
      a += span;
    });
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="80" fill="#fff" stroke="#cbd5e1" stroke-width="2" id="tp-center-bg"></circle>');
    parts.push('<text id="tp-center-num" x="' + CX + '" y="' + (CY - 2) + '" text-anchor="middle" font-size="40" font-weight="700" fill="#0f172a"></text>');
    parts.push('<text id="tp-center-lab" x="' + CX + '" y="' + (CY + 24) + '" text-anchor="middle" font-size="14" fill="#475569"></text>');
    svg.innerHTML = parts.join('');

    var preview = -1, locked = -1;
    function active() { return preview >= 0 ? preview : locked; }
    function openHref(g) { return g.kind === 'ladder' ? 'ladder.html?ladder=' + encodeURIComponent(g.entry.file) : 'notes.html?notes=' + encodeURIComponent(g.entry.file); }
    function drawCenter() {
      var num = document.getElementById('tp-center-num'), lab = document.getElementById('tp-center-lab'), gi = active();
      if (gi >= 0) {
        var g = groups[gi];
        num.setAttribute('fill', g.color);
        if (g.kind === 'ladder') { num.textContent = g.pct + '%'; lab.textContent = g.name; }
        else { num.textContent = g.total; lab.textContent = g.name + ' \u00B7 items'; }
        return;
      }
      num.setAttribute('fill', '#0f172a');
      num.textContent = totalDated + '/' + totalSteps;
      lab.textContent = 'steps dated';
    }
    function renderDetail() {
      var box = document.getElementById('tp-detail'), gi = active();
      if (gi < 0) {
        box.innerHTML = '<p class="tp-detail-head">Whole section</p>' +
          '<p class="tp-detail-counts"><span style="color:#15803d">Dated ' + totalDated + '</span> \u00B7 <span style="color:#2563eb">Undated ' + (totalSteps - totalDated) + '</span> of ' + totalSteps + ' ladder steps \u00B7 ' + groups.length + ' lists</p>' +
          '<p class="tp-detail-hint">Move around the circle \u2014 only the list you touch shows its entries.</p>';
        return;
      }
      var g = groups[gi];
      var html = '<p class="tp-detail-head"><span class="tp-chip-color" style="background:' + g.color + '"></span> ' + esc(g.name) +
        (g.section && g.section !== g.name ? ' <span class="tp-topic-meta">' + esc(g.section) + '</span>' : '') +
        (locked >= 0 ? ' <button type="button" class="tp-reset" id="tp-reset">Whole section</button>' : '') + '</p>';
      if (g.kind === 'ladder') {
        html += '<p class="tp-detail-counts"><span style="color:' + g.color + ';font-weight:700">' + g.pct + '% dated</span> \u00B7 ' + g.dated + ' dated \u00B7 ' + (g.total - g.dated) + ' without a date</p>';
      } else {
        html += '<p class="tp-detail-counts">' + g.total + (g.total === 1 ? ' item' : ' items') + ' \u00B7 note list</p>';
      }
      html += '<p class="tp-detail-counts"><a class="tp-practice" href="' + openHref(g) + '">Open list \u2014 ' + (g.kind === 'ladder' ? 'enter dates there' : 'edit there') + '</a></p>';
      if (g.kind === 'ladder') {
        var curGroup = null;
        g.rows.forEach(function (r) {
          if (r.group !== curGroup) { curGroup = r.group; html += '<p class="tp-detail-group" style="color:' + g.color + '">' + esc(curGroup) + '</p>'; }
          html += '<div class="tp-topic-row"><span class="tp-topic-name">' + esc(r.text) + (r.own ? ' \u00B7 yours' : '') + '</span><span class="tp-topic-meta">' + (r.date ? esc(r.date) : 'no date') + '</span></div>';
        });
        if (!g.rows.length) html += '<p class="tp-detail-hint">No entries yet.</p>';
      } else {
        g.rows.forEach(function (r) {
          html += '<div class="tp-topic-row"><span class="tp-topic-name">' + esc(r.text) + '</span></div>';
        });
        if (!g.rows.length) html += '<p class="tp-detail-hint">No entries yet.</p>';
      }
      box.innerHTML = html;
      var rb = document.getElementById('tp-reset');
      if (rb) rb.addEventListener('click', function () { locked = -1; preview = -1; draw(); });
    }
    function draw() {
      var gi = active();
      svg.querySelectorAll('path[data-group]').forEach(function (p) { p.style.opacity = (gi < 0 || +p.getAttribute('data-group') === gi) ? '1' : '0.3'; });
      drawCenter(); renderDetail();
    }
    function sliceFromEvent(ev) { var t = ev.target; if (t && t.getAttribute && t.getAttribute('data-group') !== null) return +t.getAttribute('data-group'); return -2; }
    svg.addEventListener('pointermove', function (ev) { var gi = sliceFromEvent(ev); if (gi >= 0 && gi !== preview) { preview = gi; draw(); } });
    svg.addEventListener('pointerleave', function () { if (preview >= 0) { preview = -1; draw(); } });
    svg.addEventListener('click', function (ev) {
      if (ev.target.id === 'tp-center-bg' || ev.target.id === 'tp-center-num' || ev.target.id === 'tp-center-lab') { if (active() >= 0) { locked = -1; preview = -1; draw(); } return; }
      var gi = sliceFromEvent(ev);
      if (gi >= 0) { locked = (locked === gi) ? -1 : gi; preview = -1; draw(); }
    });
    draw();
  }).catch(function () { document.getElementById('tp-note').textContent = 'Could not load the exam list.'; });
})();
