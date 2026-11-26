// Sync layer — Firebase (Google sign-in + Firestore).
// localStorage stays the working copy (offline, place-keeping unchanged).
// When signed in: pull the cloud copy, merge it with this device's data,
// push the merged result back, and keep pushing as data changes.
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyBzbTvEvQqGYWPMu8EPQr4SPk_rWZhvsEA",
    authDomain: "exams-sync.firebaseapp.com",
    projectId: "exams-sync",
    storageBucket: "exams-sync.firebasestorage.app",
    messagingSenderId: "534075148283",
    appId: "1:534075148283:web:8d7d1110bbd561dcc0ed5e"
  };

  var EXACT_KEYS = ['examHistory', 'examProgress', 'notepadNotes', 'notepadCleared', 'qualityNotes', 'qualityCleared', 'researchNotes', 'backdoorLog', 'frontChecklist'];
  var PREFIXES = ['workoutNotes:', 'ladderDates:', 'ladderAdded:', 'ladderSets:', 'noteProgress:'];
  // Removed lists (Pump Circumference — Damoni, Nov 26, 2026): their stored
  // entries are purged on every device and deleted from the cloud copy.
  var PURGE_KEYS = ['workoutNotes:workout-pump-circumference.json', 'noteProgress:workout-pump-circumference.json', 'workoutNotes:workout-static-list.json', 'noteProgress:workout-static-list.json', 'workoutNotes:upperbody-static-list.json', 'noteProgress:upperbody-static-list.json', 'workoutNotes:lowerbody-static-list.json', 'noteProgress:lowerbody-static-list.json', 'workoutNotes:abdomen-static-list.json', 'noteProgress:abdomen-static-list.json'];

  // ---- sync bar UI ----
  var bar = document.createElement('div');
  bar.className = 'sync-bar';
  bar.innerHTML = '<span id="sync-status">Sync: loading…</span><button type="button" id="sync-btn" hidden></button>' + (/^\/exams\//.test(location.pathname) ? '' : '<a href="https://damonigraham427-ship-it.github.io/exams/" style="margin-left:10px;font-weight:700">\u2302 Main portal</a>');
  document.body.insertBefore(bar, document.body.firstChild);
  var statusEl = document.getElementById('sync-status');
  var btn = document.getElementById('sync-btn');
  function setStatus(t) { statusEl.textContent = t; }
  function syncedText() { return 'Synced \u2713' + (userEmail ? ' \u00B7 ' + userEmail : ''); }
  function canon(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
  }

  var SDK = [
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
  ];
  function loadSdk(i, done) {
    if (i >= SDK.length) return done();
    var s = document.createElement('script');
    s.src = SDK[i];
    s.onload = function () { loadSdk(i + 1, done); };
    s.onerror = function () { setStatus('Sync unavailable (offline)'); };
    document.head.appendChild(s);
  }

  var auth = null, db = null, uid = null, applying = false, pushTimer = null, userEmail = '';
  var origSet = localStorage.setItem.bind(localStorage);
  PURGE_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });

  function isSyncKey(k) {
    if (PURGE_KEYS.indexOf(k) !== -1) return false;
    if (EXACT_KEYS.indexOf(k) !== -1) return true;
    return PREFIXES.some(function (p) { return k.indexOf(p) === 0; });
  }
  function collectState() {
    var st = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!isSyncKey(k)) continue;
      try { st[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { st[k] = localStorage.getItem(k); }
    }
    return st;
  }
  function mergeHistory(local, remote) {
    var out = {};
    var keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var byTs = {};
      (local && local[k] || []).forEach(function (a) { byTs[a.ts] = a; });
      (remote && remote[k] || []).forEach(function (a) { if (!byTs[a.ts]) byTs[a.ts] = a; });
      out[k] = Object.keys(byTs).map(function (t) { return byTs[t]; })
        .sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).slice(0, 20);
    });
    return out;
  }
  function mergeProgress(local, remote) {
    var out = {};
    Object.keys(remote || {}).forEach(function (k) { out[k] = remote[k]; });
    Object.keys(local || {}).forEach(function (k) {
      if (!out[k] || (local[k].ts || 0) >= (out[k].ts || 0)) out[k] = local[k];
    });
    return out;
  }
  function mergeCleared(local, remote) {
    var out = {};
    Object.keys(remote || {}).forEach(function (k) { out[k] = remote[k]; });
    Object.keys(local || {}).forEach(function (k) {
      var L = local[k], R = out[k];
      if (!R) { out[k] = L; return; }
      if ((L.ts || '') > (R.ts || '')) out[k] = L;
      else if (L.ts === R.ts) {
        var qs = (R.questions || []).slice();
        (L.questions || []).forEach(function (q) { if (qs.indexOf(q) === -1) qs.push(q); });
        out[k] = { ts: R.ts, questions: qs };
      }
    });
    return out;
  }
  function mergeGeneric(local, remote) { // local wins on conflict, remote fills gaps
    // Empty-array guard (Nov 23, 2026): an empty array never beats a
    // non-empty one — a device that never used a feature must not wipe
    // another device's list when states merge.
    if (Array.isArray(local) && Array.isArray(remote)) {
      if (!local.length && remote.length) return remote;
      if (!remote.length && local.length) return local;
    }
    var out = {};
    Object.keys(remote || {}).forEach(function (k) { out[k] = remote[k]; });
    Object.keys(local || {}).forEach(function (k) { out[k] = local[k]; });
    return out;
  }
  function mergeLog(L, R) { // backdoorLog: union by ts, oldest first, cap 200
    var seen = {}, out = [];
    (R || []).concat(L || []).forEach(function (x) {
      if (x && x.ts && !seen[x.ts]) { seen[x.ts] = 1; out.push(x); }
    });
    out.sort(function (a, b) { return a.ts - b.ts; });
    return out.slice(-200);
  }
  function mergeChecklist(L, R) { // frontChecklist: union by text; done on either side wins
    var byText = {}, out = [];
    function add(item, other) {
      if (!item || typeof item.text !== 'string') return;
      var ex = byText[item.text];
      if (ex) { if (item.done || (other && other.done)) ex.done = true; return; }
      var rec = { text: item.text, done: !!(item.done || (other && other.done)) };
      byText[item.text] = rec;
      out.push(rec);
    }
    var rByText = {};
    (Array.isArray(R) ? R : []).forEach(function (x) { if (x && typeof x.text === 'string') rByText[x.text] = x; });
    (Array.isArray(L) ? L : []).forEach(function (x) { add(x, rByText[x && x.text]); });
    (Array.isArray(R) ? R : []).forEach(function (x) { add(x, null); });
    return out;
  }
  function mergeState(local, remote) {
    var out = {};
    var keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var L = local ? local[k] : undefined, R = remote ? remote[k] : undefined;
      if (L === undefined) { out[k] = R; return; }
      if (R === undefined) { out[k] = L; return; }
      if (k === 'examHistory') out[k] = mergeHistory(L, R);
      else if (k === 'examProgress') out[k] = mergeProgress(L, R);
      else if (k === 'notepadCleared' || k === 'qualityCleared') out[k] = mergeCleared(L, R);
      else if (k === 'backdoorLog') out[k] = mergeLog(L, R);
      else if (k === 'frontChecklist') out[k] = mergeChecklist(L, R);
      else out[k] = mergeGeneric(L, R);
    });
    return out;
  }
  function applyState(st) {
    applying = true;
    Object.keys(st).forEach(function (k) { origSet(k, JSON.stringify(st[k])); });
    applying = false;
  }
  function pushNow() {
    return db.collection('users').doc(uid).set({ state: collectState(), updatedAt: Date.now() }, { merge: true });
  }
  function push() {
    if (!uid || applying) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      setStatus('Sync: saving…');
      pushNow()
        .then(function () { setStatus(syncedText()); })
        .catch(function () { setStatus('Sync: save failed, will retry'); });
    }, 1200);
  }
  localStorage.setItem = function (k, v) {
    origSet(k, v);
    if (isSyncKey(k)) push();
  };

  // Outbox: pages call examSync.sendReport(report) to send the user a
  // snapshot (marked questions + their comments) to the 'outbox' array on
  // their cloud doc. Edison's inbox check reads and discusses them.
  window.examSync = {
    sendReport: function (report) {
      return new Promise(function (resolve, reject) {
        var tries = 0;
        (function wait() {
          if (db && uid) {
            db.collection('users').doc(uid)
              .set({ outbox: firebase.firestore.FieldValue.arrayUnion(report) }, { merge: true })
              .then(function () {
                // Ping: a tiny public-readable flag (timestamp + page only,
                // no content) that Edison's watcher checks about once a
                // minute. The report itself stays owner-only in the outbox.
                return db.collection('inbox_pings').doc(uid)
                  .set({ ts: Date.now(), page: report.page, reportId: report.id }, { merge: true });
              })
              .then(resolve).catch(reject);
          } else if (tries++ < 40) { setTimeout(wait, 250); }
          else { reject(new Error('not-signed-in')); }
        })();
      });
    }
  };
  window.addEventListener('pagehide', function () {
    if (!uid) return;
    clearTimeout(pushTimer);
    try { db.collection('users').doc(uid).set({ state: collectState(), updatedAt: Date.now() }, { merge: true }); } catch (e) {}
  });

  loadSdk(0, function () {
    try {
      firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) { setStatus('Sync unavailable'); return; }
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        uid = null;
        setStatus('Sync: off — your data is on this device only');
        btn.hidden = false; btn.textContent = 'Sign in to sync';
        btn.onclick = function () {
          var prov = new firebase.auth.GoogleAuthProvider();
          auth.signInWithPopup(prov).catch(function () { auth.signInWithRedirect(prov); });
        };
        return;
      }
      uid = user.uid;
      setStatus('Sync: loading your data…');
      btn.hidden = false; btn.textContent = 'Sign out';
      btn.onclick = function () { auth.signOut(); };
      db.collection('users').doc(uid).get().then(function (snap) {
        var remote = snap.exists ? (snap.data().state || {}) : {};
        PURGE_KEYS.forEach(function (k) { delete remote[k]; });
        try {
          var delArgs = [];
          PURGE_KEYS.forEach(function (k) { delArgs.push(new firebase.firestore.FieldPath('state', k), firebase.firestore.FieldValue.delete()); });
          if (delArgs.length) db.collection('users').doc(uid).update.apply(db.collection('users').doc(uid), delArgs).catch(function () {});
        } catch (e) {}
        var local = collectState();
        var merged = mergeState(local, remote);
        // Firestore does not preserve map key order, so compare canonically:
        // only real content differences count, never key order alone.
        var changed = canon(merged) !== canon(local);
        userEmail = user.email || '';
        if (!changed) { setStatus(syncedText()); push(); return; }
        applyState(merged);
        // Upload the merged state back so the cloud copy converges. No page
        // reload: the merged data is in storage and every page the user
        // opens next reads it fresh.
        setStatus('Sync: syncing…');
        pushNow().then(function () { setStatus(syncedText()); })
          .catch(function () { setStatus('Sync: save failed, will retry'); });
      }).catch(function () { setStatus('Sync: could not load cloud data'); });
    });
  });
})();
