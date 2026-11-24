const params = new URLSearchParams(location.search);
const file = params.get('notes');
const storeKey = 'workoutNotes:' + file;
let notes = [];

function save() {
  try { localStorage.setItem(storeKey, JSON.stringify(notes)); } catch (err) { /* storage unavailable */ }
}

function render() {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';
  notes.forEach((text, i) => {
    const li = document.createElement('li');
    li.textContent = text;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-del';
    del.textContent = '\u2715';
    del.addEventListener('click', () => {
      notes.splice(i, 1);
      save();
      render();
    });
    li.appendChild(del);
    list.appendChild(li);
  });
  document.getElementById('no-notes').hidden = notes.length > 0;
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
    render();
  });
}
