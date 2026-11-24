const params = new URLSearchParams(location.search);
const file = params.get('ladder');
const datesKey = 'ladderDates:' + file;
const addedKey = 'ladderAdded:' + file;
let dates = {};
let added = {};
try { dates = JSON.parse(localStorage.getItem(datesKey) || '{}') || {}; } catch (err) { dates = {}; }
try { added = JSON.parse(localStorage.getItem(addedKey) || '{}') || {}; } catch (err) { added = {}; }

function saveDates() {
  try { localStorage.setItem(datesKey, JSON.stringify(dates)); } catch (err) { /* storage unavailable */ }
}
function saveAdded() {
  try { localStorage.setItem(addedKey, JSON.stringify(added)); } catch (err) { /* storage unavailable */ }
}

let fileData = null;

function stepsFor(group) {
  const base = (group.steps || []).map(s => ({ text: s, own: false }));
  const extra = (added[group.name] || []).map(s => ({ text: s, own: true }));
  return base.concat(extra);
}

function render() {
  const wrap = document.getElementById('ladder-groups');
  wrap.innerHTML = '';
  ((fileData && fileData.groups) || []).forEach(g => {
    const h = document.createElement('h2');
    h.className = 'ladder-group';
    h.textContent = g.name;
    wrap.appendChild(h);

    const steps = stepsFor(g);
    const ul = document.createElement('ul');
    ul.className = 'ladder-steps';
    if (!steps.length) {
      const li = document.createElement('li');
      li.className = 'ladder-empty';
      li.textContent = 'No entries yet.';
      ul.appendChild(li);
    }
    steps.forEach(step => {
      const key = g.name + '|' + step.text;
      const li = document.createElement('li');
      li.className = 'ladder-row';
      const label = document.createElement('span');
      label.className = 'ladder-step';
      label.textContent = step.text;
      li.appendChild(label);
      const input = document.createElement('input');
      input.type = 'date';
      input.className = 'ladder-date';
      input.value = dates[key] || '';
      input.addEventListener('change', () => {
        if (input.value) dates[key] = input.value; else delete dates[key];
        saveDates();
      });
      li.appendChild(input);
      if (step.own) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'note-del';
        del.textContent = '\u2715';
        del.addEventListener('click', () => {
          added[g.name] = (added[g.name] || []).filter(s => s !== step.text);
          delete dates[key];
          saveAdded();
          saveDates();
          render();
        });
        li.appendChild(del);
      }
      ul.appendChild(li);
    });
    wrap.appendChild(ul);

    const p = document.createElement('p');
    p.className = 'ladder-add';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'Add an entry';
    inp.size = 32;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Add';
    const doAdd = () => {
      const text = inp.value.trim();
      if (!text) return;
      if (!added[g.name]) added[g.name] = [];
      added[g.name].push(text);
      saveAdded();
      render();
    };
    btn.addEventListener('click', doAdd);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') doAdd(); });
    p.appendChild(inp);
    p.appendChild(btn);
    wrap.appendChild(p);
  });
}

if (!file) {
  document.getElementById('ladder-title').textContent = 'Ladder';
} else {
  Promise.all([
    fetch('index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    fetch(file, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([index, data]) => {
    if (index && Array.isArray(index.exams)) {
      const entry = index.exams.find(e => e.file === file);
      if (entry && entry.title) document.getElementById('ladder-title').textContent = entry.title;
      if (entry) {
        const backHref = entry.region && entry.region !== 'general' ? 'workout-topics.html?body=' + entry.region : 'workout.html';
        document.querySelectorAll('.back-to-list').forEach(a => { a.href = backHref; });
      }
    }
    fileData = data;
    render();
  });
}
