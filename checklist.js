// Workout Checklist (Damoni, Nov 23, 2026): one main page tied to all the
// workout circles. For every ladder group it shows the NEXT step that has
// no date yet; the step advances ONLY when its sets value reaches 5x5,
// which records the date and pops the following step up in its place.
// For note lists it shows a quick-log row that appends to
// the list. Writes go to the SAME localStorage keys the ladder and notes
// pages use (ladderDates:<file>, workoutNotes:<file>), so the circles,
// the list pages and this checklist always agree, and sync carries them.
const CK_SECTIONS = [
  { name: 'Upper Body', regions: ['upper'] },
  { name: 'Abdomen', regions: ['abdomen'] },
  { name: 'Lower Body', regions: ['lower'] },
  { name: 'Running & Treadmill', regions: ['running', 'vest', 'incline'] },
  { name: 'General lists', regions: ['general'] }
];

function ckParse(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
  catch (err) { return fallback; }
}
function ckSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* storage unavailable */ }
}
function ckShort(title) {
  return String(title || '').replace(/^Upper Body \u2014 /, '').replace(/^Lower Body \u2014 /, '')
    .replace(/^Abdomen \u2014 /, '').replace(/^Running \u2014 /, '')
    .replace(/^Weight Vest Run \u2014 /, '').replace(/^Incline Treadmill \u2014 /, '');
}
function ckToday() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// The next undated step of one ladder group, using ladder.js's exact merge:
// seeded steps first, then his added steps; a step is done when
// ladderDates:<file> holds "group|step".
function ckNextStep(entry, group) {
  const dates = ckParse('ladderDates:' + entry.file, {});
  const added = ckParse('ladderAdded:' + entry.file, {});
  const steps = (group.steps || []).concat(added[group.name] || []);
  for (const s of steps) {
    if (!dates[group.name + '|' + s]) return s;
  }
  return null;
}

function ckLadderRow(entry, group, host) {
  const row = document.createElement('div');
  row.className = 'ck-row';

  const main = document.createElement('div');
  main.className = 'ck-main';
  const label = document.createElement('span');
  label.className = 'ck-label';
  // Under the current goal: this step's own sets log — the date its
  // sets value was logged and the value, e.g. "2026-11-23 · Sets: 2.5"
  // (Damoni, Nov 23, 2026; replaces the old "Last done:" line).
  const last = document.createElement('span');
  last.className = 'ck-last';
  main.appendChild(label);
  main.appendChild(last);
  // Sets-completed selector beside the weight goal (Damoni, Nov 23, 2026,
  // replacing the attempt check boxes): most ladders are 5x5, so the box
  // lists half-step counts 0.5..5, then a final "5x5". Stored per step in
  // ladderSets:<file> as "group|step" -> {v, d}: v = the sets value
  // (number, or "5x5" for the final state), d = the date that value was
  // logged. Older plain-number values still read fine (v = the number,
  // no date). Same key, no companion key, sync prefix unchanged.
  // Completion rule (Damoni, Nov 23, 2026): a step completes ONLY
  // at 5x5 — selecting it records today's date in ladderDates:<file> and
  // pops the next step up. Plain 5 (and
  // anything below) is progress only; the step stays current.
  const setsWrap = document.createElement('span');
  setsWrap.className = 'ck-sets-wrap';
  const setsLabel = document.createElement('span');
  setsLabel.className = 'ck-sets-label';
  setsLabel.textContent = 'sets';
  setsWrap.appendChild(setsLabel);
  const setsSel = document.createElement('select');
  setsSel.className = 'ck-sets';
  ['', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5x5'].forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v === '' ? '\u2014' : v;
    setsSel.appendChild(o);
  });
  setsSel.addEventListener('change', () => {
    const step = ckNextStep(entry, group);
    if (!step) return;
    const key = group.name + '|' + step;
    const all = ckParse('ladderSets:' + entry.file, {});
    if (setsSel.value === '5x5') {
      all[key] = { v: '5x5', d: ckToday() };
      ckSave('ladderSets:' + entry.file, all);
      completeStep(ckToday());
      return;
    }
    if (setsSel.value) all[key] = { v: parseFloat(setsSel.value), d: ckToday() }; else delete all[key];
    ckSave('ladderSets:' + entry.file, all);
    paintSets(step);
  });
  setsWrap.appendChild(setsSel);
  function paintSets(step) {
    const all = ckParse('ladderSets:' + entry.file, {});
    const raw = all[group.name + '|' + step];
    const v = raw && typeof raw === 'object' ? raw.v : raw;
    const d = raw && typeof raw === 'object' ? raw.d : null;
    setsSel.value = v ? String(v) : '';
    last.textContent = v ? ((d ? d + ' \u00B7 ' : '') + 'Sets: ' + v) : 'Sets: \u2014';
  }
  function show(step, animate) {
    label.textContent = ckShort(entry.title) + ' \u2014 ' + group.name + ' \u00B7 ' + step;
    paintSets(step);
    setsSel.disabled = false;
    if (animate) { row.classList.remove('ck-in'); void row.offsetWidth; row.classList.add('ck-in'); }
  }

  // The ONLY completion path (Damoni, Nov 23, 2026): the step's sets
  // value reaching 5x5. There is no date entry and no Done button on a
  // ladder row anymore — date entry alone never advances a step.
  // Selecting 5x5 records today's date in ladderDates:<file>, then pops
  // the next undated step up as the current row, or removes the row
  // when the group is finished. Steps already dated under the old rule
  // stay done (ckNextStep still reads ladderDates: as before).
  function completeStep(dateStr) {
    const step = ckNextStep(entry, group);
    if (!step || !dateStr) return;
    const dates = ckParse('ladderDates:' + entry.file, {});
    dates[group.name + '|' + step] = dateStr;
    ckSave('ladderDates:' + entry.file, dates);
    setsSel.disabled = true;
    row.classList.add('ck-done');
    setTimeout(() => {
      row.classList.remove('ck-done');
      const next = ckNextStep(entry, group);
      if (next) { show(next, true); return; }
      row.classList.add('ck-out');
      setTimeout(() => {
        row.remove();
        if (!host.querySelector('.ck-row')) {
          const p = document.createElement('p');
          p.className = 'ck-caught';
          p.textContent = 'All caught up here \u2713';
          host.appendChild(p);
        }
      }, 420);
    }, 650);
  }

  row.appendChild(main);
  row.appendChild(setsWrap);
  show(ckNextStep(entry, group), false);
  return row;
}

function ckNotesRow(entry, seeded) {
  const row = document.createElement('div');
  row.className = 'ck-row';
  const label = document.createElement('span');
  label.className = 'ck-label';
  label.textContent = ckShort(entry.title);
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Log an entry\u2026';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ck-btn';
  btn.textContent = 'Add';
  function add() {
    const text = inp.value.trim();
    if (!text) return;
    const key = 'workoutNotes:' + entry.file;
    const stored = ckParse(key, null);
    const list = Array.isArray(stored) ? stored.slice() : (seeded || []).slice();
    if (Array.isArray(stored)) (seeded || []).forEach(b => { if (list.indexOf(b) === -1) list.push(b); });
    list.push(text);
    ckSave(key, list);
    inp.value = '';
    btn.textContent = 'Logged \u2713';
    setTimeout(() => { btn.textContent = 'Add'; }, 1200);
  }
  btn.addEventListener('click', add);
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') add(); });
  row.appendChild(label);
  row.appendChild(inp);
  row.appendChild(btn);
  return row;
}

async function ckInit() {
  const host = document.getElementById('ck-host');
  const idx = await (await fetch('index.json', { cache: 'no-store' })).json();
  const entries = (idx.exams || []).filter(e => e.category === 'Workout Elements');
  const data = {};
  await Promise.all(entries.map(async e => {
    try { data[e.file] = await (await fetch(e.file, { cache: 'no-store' })).json(); }
    catch (err) { data[e.file] = null; }
  }));
  host.innerHTML = '';
  CK_SECTIONS.forEach(sec => {
    const inSec = entries.filter(e => sec.regions.indexOf(e.region || 'general') !== -1);
    if (!inSec.length) return;
    const h = document.createElement('h2');
    h.className = 'ck-sec';
    h.textContent = sec.name;
    host.appendChild(h);
    const list = document.createElement('div');
    host.appendChild(list);
    let rows = 0;
    inSec.forEach(e => {
      const d = data[e.file];
      if (e.ladder && d && Array.isArray(d.groups)) {
        d.groups.forEach(g => {
          if (ckNextStep(e, g)) { list.appendChild(ckLadderRow(e, g, list)); rows++; }
        });
      } else if (e.notes) {
        list.appendChild(ckNotesRow(e, (d && d.notes) || []));
        rows++;
      }
    });
    if (!rows) {
      const p = document.createElement('p');
      p.className = 'ck-caught';
      p.textContent = 'All caught up here \u2713';
      list.appendChild(p);
    }
  });
}

ckInit();
