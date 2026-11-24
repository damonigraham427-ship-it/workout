// Workout Elements landing (Nov 23, 2026): the section split 3 ways at
// Damoni's order — Upper Body, Abdomen, Lower Body, each with its own
// circle (workout-topics.html?body=<region>). Lists that belong to no body
// region (region 'general': Static List, Pump Circumference) stay here as
// direct links to their list pages.
const WO_PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
// Body circles first; the running and treadmill circles sit in their own
// separate section on the landing (Damoni, Nov 23, 2026).
const WO_REGIONS = [
  { key: 'upper', name: 'Upper Body' },
  { key: 'abdomen', name: 'Abdomen' },
  { key: 'lower', name: 'Lower Body' }
];
const WO_CARDIO = [
  { key: 'running', name: 'Running' },
  { key: 'vest', name: 'Weight Vest Run' },
  { key: 'incline', name: 'Incline Treadmill' }
];

function woCard(label, sub, color, onclick) {
  const b = document.createElement('button');
  b.className = 'nav-card';
  b.style.borderTopColor = color;
  b.textContent = label;
  const s = document.createElement('small');
  s.textContent = sub;
  b.appendChild(s);
  b.addEventListener('click', onclick);
  return b;
}

fetch('index.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(idx => {
    const entries = (idx.exams || []).filter(e => e.category === 'Workout Elements');
    const fill = (elId, regions, off) => {
      const host = document.getElementById(elId);
      regions.forEach((rg, i2) => {
        const n = entries.filter(e => e.region === rg.key).length;
        host.appendChild(woCard(rg.name, 'circle · ' + n + (n === 1 ? ' list' : ' lists'), WO_PALETTE[(i2 + off) % WO_PALETTE.length], () => {
          location.href = 'workout-topics.html?body=' + rg.key;
        }));
      });
    };
    const top = document.getElementById('wo-top');
    if (top) top.appendChild(woCard('Next-up Checklist', 'every category\u2019s next step \u00B7 date it, the next pops up', '#16a34a', () => {
      location.href = 'checklist.html';
    }));
    fill('wo-circles', WO_REGIONS, 0);
    fill('wo-cardio', WO_CARDIO, 3);
    const general = document.getElementById('wo-general');
    entries.filter(e => e.region === 'general').forEach((e, i) => {
      const label = e.title.replace(/^Workout Elements — /, '');
      general.appendChild(woCard(label, e.ladder ? 'ladder · open list' : 'notes · open list', WO_PALETTE[(i + 3) % WO_PALETTE.length], () => {
        location.href = e.ladder ? 'ladder.html?ladder=' + e.file : 'notes.html?notes=' + e.file;
      }));
    });
  })
  .catch(() => {
    document.getElementById('wo-circles').textContent = 'Could not load the list.';
  });
