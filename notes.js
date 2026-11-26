const params = new URLSearchParams(location.search);
const file = params.get('notes');
const storeKey = 'workoutNotes:' + file;
// Progress sub-entries (Damoni, Nov 26, 2026): each note entry can hold
// dated progress entries under it. New key — the existing keys
// (workoutNotes:, ladderDates:, ladderAdded:, ladderSets:) are untouched.
// Shape: { "<entry text>": [ {d: "YYYY-MM-DD", t: "progress note"}, ... ] }
// kept in date order.
const progKey = 'noteProgress:' + file;
let notes = [];
let progress = {};
const openSet = new Set();
// In-place editing (Damoni, Nov 26, 2026): one edit at a time —
// editEntry = the note text being renamed; editProg = {entry, j} for a
// dated progress entry being edited.
let editEntry = null;
let editProg = null;

function save() {
  try { localStorage.setItem(storeKey, JSON.stringify(notes)); } catch (err) { /* storage unavailable */ }
}

function saveProgress() {
  try { localStorage.setItem(progKey, JSON.stringify(progress)); } catch (err) { /* storage unavailable */ }
}

function fmtDate(iso) {
  const p = String(iso || '').split('-');
  if (p.length !== 3) return iso || '';
  return Number(p[1]) + '/' + Number(p[2]) + '/' + p[0];
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function render() {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';
  notes.forEach((text, i) => {
    const li = document.createElement('li');
    if (editEntry === text) {
      li.appendChild(buildEntryEditor(text, i));
      list.appendChild(li);
      return;
    }
    li.textContent = text;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-del';
    del.textContent = '\u2715';
    del.addEventListener('click', () => {
      notes.splice(i, 1);
      // Deleting an entry takes its progress entries with it.
      if (progress[text]) { delete progress[text]; saveProgress(); }
      openSet.delete(text);
      save();
      render();
    });
    li.appendChild(del);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'prog-toggle';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => { editEntry = text; editProg = null; render(); });
    li.appendChild(edit);
    const entries = Array.isArray(progress[text]) ? progress[text] : [];
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'prog-toggle';
    const open = openSet.has(text);
    toggle.textContent = 'Progress (' + entries.length + ') ' + (open ? '\u25B2' : '\u25BC');
    toggle.addEventListener('click', () => {
      if (openSet.has(text)) openSet.delete(text); else openSet.add(text);
      render();
    });
    li.appendChild(toggle);
    if (open) li.appendChild(buildProgressBox(text, entries));
    list.appendChild(li);
  });
  document.getElementById('no-notes').hidden = notes.length > 0;
}

// Rename an entry: the new name takes over the entry's slot and ALL its
// attached data — its progress entries move to the new key, nothing is
// orphaned or lost.
function renameEntry(oldText, newText, i) {
  newText = (newText || '').trim();
  if (!newText || newText === oldText) { editEntry = null; render(); return; }
  if (notes.indexOf(newText) !== -1) {
    alert('Another entry already has that name.');
    return;
  }
  notes[i] = newText;
  if (progress[oldText]) {
    const moved = progress[oldText];
    delete progress[oldText];
    progress[newText] = (progress[newText] || []).concat(moved);
    progress[newText].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    saveProgress();
  }
  if (openSet.has(oldText)) { openSet.delete(oldText); openSet.add(newText); }
  editEntry = null;
  save();
  render();
}

function buildEntryEditor(text, i) {
  const span = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = text;
  input.size = 32;
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => renameEntry(text, input.value, i));
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => { editEntry = null; render(); });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') renameEntry(text, input.value, i); });
  span.appendChild(input);
  span.appendChild(saveBtn);
  span.appendChild(cancel);
  return span;
}

function buildProgressBox(text, entries) {
  const box = document.createElement('div');
  box.className = 'prog-box';
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'prog-empty';
    p.textContent = 'No progress logged yet.';
    box.appendChild(p);
  }
  const ul = document.createElement('ul');
  ul.className = 'prog-list';
  entries.forEach((en, j) => {
    const li = document.createElement('li');
    if (editProg && editProg.entry === text && editProg.j === j) {
      const dateIn = document.createElement('input');
      dateIn.type = 'date';
      dateIn.className = 'prog-date';
      dateIn.value = en.d || todayISO();
      const textIn = document.createElement('input');
      textIn.type = 'text';
      textIn.className = 'prog-text';
      textIn.value = en.t;
      textIn.size = 28;
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        const t = textIn.value.trim();
        if (!t) return;
        progress[text][j] = { d: dateIn.value || en.d, t };
        progress[text].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
        editProg = null;
        saveProgress();
        render();
      });
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => { editProg = null; render(); });
      textIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') saveBtn.click(); });
      li.appendChild(dateIn);
      li.appendChild(textIn);
      li.appendChild(saveBtn);
      li.appendChild(cancel);
      ul.appendChild(li);
      return;
    }
    const when = document.createElement('strong');
    when.textContent = fmtDate(en.d);
    li.appendChild(when);
    li.appendChild(document.createTextNode(' — ' + en.t));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-del';
    del.textContent = '\u2715';
    del.addEventListener('click', () => {
      progress[text].splice(j, 1);
      saveProgress();
      render();
    });
    li.appendChild(del);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'prog-toggle';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => { editProg = { entry: text, j }; editEntry = null; render(); });
    li.appendChild(edit);
    ul.appendChild(li);
  });
  box.appendChild(ul);
  const row = document.createElement('p');
  row.className = 'prog-add';
  const dateIn = document.createElement('input');
  dateIn.type = 'date';
  dateIn.className = 'prog-date';
  dateIn.value = todayISO();
  const textIn = document.createElement('input');
  textIn.type = 'text';
  textIn.className = 'prog-text';
  textIn.placeholder = 'Progress note';
  textIn.size = 28;
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Add progress';
  const doAdd = () => {
    const t = textIn.value.trim();
    if (!t) return;
    if (!Array.isArray(progress[text])) progress[text] = [];
    progress[text].push({ d: dateIn.value || todayISO(), t });
    progress[text].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    saveProgress();
    render();
  };
  add.addEventListener('click', doAdd);
  textIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doAdd(); });
  row.appendChild(dateIn);
  row.appendChild(textIn);
  row.appendChild(add);
  box.appendChild(row);
  return box;
}

function addNote() {
  const input = document.getElementById('note-input');
  const text = input.value.trim();
  if (!text) return;
  notes.push(text);
  input.value = '';
  save();
  render();
  input.focus();
}

document.getElementById('add-btn').addEventListener('click', addNote);
document.getElementById('note-input').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') addNote();
});

if (!file) {
  document.getElementById('notes-title').textContent = 'Notes';
  document.getElementById('no-notes').hidden = false;
} else {
  try {
    const storedProg = JSON.parse(localStorage.getItem(progKey) || 'null');
    if (storedProg && typeof storedProg === 'object' && !Array.isArray(storedProg)) progress = storedProg;
  } catch (err) { progress = {}; }
  Promise.all([
    fetch('index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    fetch(file, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([index, data]) => {
    if (index && Array.isArray(index.exams)) {
      const entry = index.exams.find(e => e.file === file);
      if (entry && entry.title) document.getElementById('notes-title').textContent = entry.title;
      if (entry) {
        const backHref = entry.region && entry.region !== 'general' ? 'workout-topics.html?body=' + entry.region : 'workout.html';
        document.querySelectorAll('.back-to-list').forEach(a => { a.href = backHref; });
      }
    }
    // Moved lists (e.g. Static List moved from General into Upper Body —
    // Damoni, Nov 26, 2026): the data file names the old file under
    // "movedFrom"; adopt its saved entries and progress under the new
    // key so nothing is lost. The old keys are left in place as a backup.
    if (data && data.movedFrom) {
      try {
        const oldNotes = localStorage.getItem('workoutNotes:' + data.movedFrom);
        if (oldNotes !== null && localStorage.getItem(storeKey) === null) {
          localStorage.setItem(storeKey, oldNotes);
        }
        const oldProg = JSON.parse(localStorage.getItem('noteProgress:' + data.movedFrom) || 'null');
        if (oldProg && typeof oldProg === 'object' && !Array.isArray(oldProg)) {
          let changed = false;
          Object.keys(oldProg).forEach(function (k) {
            if (Array.isArray(oldProg[k]) && oldProg[k].length) {
              progress[k] = (progress[k] || []).concat(oldProg[k]);
              progress[k].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
              changed = true;
            }
          });
          if (changed) saveProgress();
        }
      } catch (err) { /* carry-over is best-effort; the old keys remain */ }
    }
    // Progress key renames (data file's "progressRenames"): progress logged
    // under an old entry name moves to the current name — merged, deduped
    // (same date + same text counts once), date-sorted. Nothing is lost.
    if (data && data.progressRenames && typeof data.progressRenames === 'object') {
      let changed = false;
      Object.keys(data.progressRenames).forEach(function (oldKey) {
        const newKey = data.progressRenames[oldKey];
        if (!Array.isArray(progress[oldKey])) return;
        const seen = {};
        const merged = [];
        (progress[newKey] || []).concat(progress[oldKey]).forEach(function (en) {
          const sig = en.d + '\n' + en.t;
          if (seen[sig]) return;
          seen[sig] = 1;
          merged.push(en);
        });
        merged.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
        progress[newKey] = merged;
        delete progress[oldKey];
        changed = true;
      });
      if (changed) saveProgress();
    }
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (err) { stored = null; }
    if (Array.isArray(stored)) {
      notes = stored;
      if (data && Array.isArray(data.notes)) {
        data.notes.forEach(function (n) { if (notes.indexOf(n) === -1) notes.push(n); });
        save();
      }
    } else if (data && Array.isArray(data.notes)) {
      notes = data.notes.slice();
    }
    // Retired entries (e.g. a category name that sat inside its own list,
    // "Pectorals" in Chest — Damoni, Nov 26, 2026): the data file names
    // them under "retired"; drop them from the stored list too and save,
    // so the fix reaches lists already saved on a device.
    if (data && Array.isArray(data.retired) && data.retired.length) {
      const before = notes.length;
      notes = notes.filter(function (n) { return data.retired.indexOf(n) === -1; });
      if (notes.length !== before) save();
    }
    render();
  });
}
