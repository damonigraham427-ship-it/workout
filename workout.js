// Workout Elements landing (Nov 23, 2026): the section split at Damoni's
// order — Upper Body, Abdomen, Lower Body, each with its own circle
// (workout-topics.html?body=<region>), plus the Running circle. Every list
// lives inside one of those sections (Nov 26, 2026: Static List and
// Reference Weight moved inside the body sections; Pump Circumference
// removed; no General lists remain).
const WO_PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
// Body circles first; the Running circle sits in its own separate
// section on the landing (Damoni, Nov 23, 2026). Weight Vest Run and
// Incline Treadmill are entries inside Running, not their own circles
// (Damoni, Nov 26, 2026).
const WO_REGIONS = [
  { key: 'upper', name: 'Upper Body' },
  { key: 'abdomen', name: 'Abdomen' },
  { key: 'lower', name: 'Lower Body' }
];
const WO_CARDIO = [
  { key: 'running', name: 'Running' }
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
    fill('wo-circles', WO_REGIONS, 0);
    fill('wo-cardio', WO_CARDIO, 3);
  })
  .catch(() => {
    document.getElementById('wo-circles').textContent = 'Could not load the list.';
  });
