const params = new URLSearchParams(location.search);
const file = params.get('exam');
const wantMode = params.get('mode');
const topicParam = params.get('topic');
const tierParam = params.get('tier');
// This exam's own Notepad / Quality pads
document.querySelectorAll('a[href="notepad.html"]').forEach(function (a) { a.href = 'notepad.html?exam=' + encodeURIComponent(file); });
document.querySelectorAll('a[href="quality.html"]').forEach(function (a) { a.href = 'quality.html?exam=' + encodeURIComponent(file); });
let storageKey = file;
let isRedund = false;
let isCoverage = false;
let isMeta = false;
let isMeta10 = false;
let exam, examTitle = file, idx = 0, score = 0;
const answers = [];
let lastMissed = [];
let lastFlagged = [];
let lastQuality = [];
const flagged = new Set();
const quality = new Set();
let entry = null;
let runOrder = null;
// Time tracker: ACTIVE time only (changed Nov 24, 2026). 'secs' banks
// active seconds: the clock runs only while the page is in front AND the
// user has interacted within the last 2 minutes. Switching away pauses it
// at once; 2 idle minutes pause it until the next tap or key. Every
// progress save carries the accumulated 'secs' so far; a finished attempt
// records the total.
let bankedSecs = 0;
let activeSecs = 0;
let lastTick = Date.now();
let lastInteract = Date.now();
let inFront = true;
function activeTick() {
  const now = Date.now();
  if (inFront && !document.hidden && now - lastInteract < 120000) {
    activeSecs += (now - lastTick) / 1000;
  }
  lastTick = now;
}
function resetSegment() {
  activeSecs = 0;
  lastTick = Date.now();
  lastInteract = Date.now();
}
setInterval(activeTick, 1000);
['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) {
  document.addEventListener(ev, function () { lastInteract = Date.now(); }, { passive: true });
});
document.addEventListener('visibilitychange', function () { if (!document.hidden) lastInteract = Date.now(); activeTick(); });
window.addEventListener('blur', function () { activeTick(); inFront = false; });
window.addEventListener('focus', function () { inFront = true; lastInteract = Date.now(); lastTick = Date.now(); });
function elapsedSecs() { activeTick(); return Math.round(bankedSecs + activeSecs); }

function buildMetaQuestions(pool) {
  const N = pool.length;
  const bands = [];
  for (let b = 0; b < 20; b++) bands.push([Math.floor(b * N / 20), Math.floor((b + 1) * N / 20)]);
  const tier = b => (b * 5 + 1) + '\u2013' + ((b + 1) * 5) + '%';
  const ans = i => pool[i].choices[pool[i].answer];
  const isFrac = /as a (percentage|decimal)/.test(pool[0].question);
  function neighbors(b) {
    const out = [];
    [b - 1, b + 1, b - 2, b + 2, b - 3, b + 3, b - 4, b + 4].forEach(x => { if (x >= 0 && x < 20 && !out.includes(x)) out.push(x); });
    return out.slice(0, 3);
  }
  function place(list, seed) {
    const pos = ((seed * 7 + 3) % 4 + 4) % 4;
    const arr = list.slice(1);
    arr.splice(pos, 0, list[0]);
    return { choices: arr, answer: pos };
  }
  function fracOf(i) { const m = pool[i].question.match(/(\d+)\/(\d+)/); return m ? [m[1], m[2]] : null; }
  function pctAnswerOf(k, den) {
    for (let i = 0; i < N; i++) {
      if (pool[i].question === 'What is ' + k + '/' + den + ' as a percentage?') return ans(i);
    }
    return '';
  }
  function rangeStr(b) {
    const lo = bands[b][0], hi = bands[b][1];
    if (isFrac) {
      const f1 = fracOf(lo), f2 = fracOf(hi - 1);
      return f1[0] === f2[0] ? f1[0] + '/' + f1[1] : f1[0] + '/' + f1[1] + ' \u2013 ' + f2[0] + '/' + f2[1];
    }
    const a = ans(lo), c = ans(hi - 1);
    return a === c ? a : a + ' \u2013 ' + c;
  }
  const out = [];
  for (let b = 0; b < 20; b++) {
    const lo = bands[b][0], hi = bands[b][1];
    const nb = neighbors(b);
    if (b % 2 === 0) {
      const p = place([rangeStr(b)].concat(nb.map(rangeStr)), b);
      let expl;
      if (isFrac) {
        const f1 = fracOf(lo), f2 = fracOf(hi - 1);
        expl = 'The ' + tier(b) + ' tier runs from ' + f1[0] + '/' + f1[1] + ' (' + pctAnswerOf(f1[0], f1[1]) + ') to ' + f2[0] + '/' + f2[1] + ' (' + pctAnswerOf(f2[0], f2[1]) + ').';
      } else {
        expl = 'The ' + tier(b) + ' tier runs from "' + pool[lo].question + '" (' + ans(lo) + ') to "' + pool[hi - 1].question + '" (' + ans(hi - 1) + ').';
      }
      out.push({ question: (isFrac ? 'Which fractions sit in the ' : 'Which answer range falls in the ') + tier(b) + ' tier?',
                 choices: p.choices, answer: p.answer, explanation: expl, source: 'Meta \u2014 tiers' });
    } else {
      const m = lo + Math.floor((hi - lo) / 2);
      const p = place([tier(b)].concat(nb.map(tier)), b);
      let qtext, expl;
      if (isFrac) {
        const f = fracOf(m);
        qtext = f[0] + '/' + f[1] + ' (' + pctAnswerOf(f[0], f[1]) + ') falls in which tier?';
        expl = f[0] + '/' + f[1] + ' is entry ' + (m + 1) + ' of ' + N + ', inside the ' + tier(b) + ' tier.';
      } else {
        qtext = ans(m) + ' is an answer in which tier?';
        expl = ans(m) + ' answers "' + pool[m].question + '" \u2014 entry ' + (m + 1) + ' of ' + N + ', inside the ' + tier(b) + ' tier.';
      }
      out.push({ question: qtext, choices: p.choices, answer: p.answer, explanation: expl, source: 'Meta \u2014 tiers' });
    }
  }
  return out;
}

function buildBlockQuestions(pool) {
  const N = pool.length;
  const blocks = [];
  for (let k = 0; k < 10; k++) blocks.push([Math.floor(k * N / 10), Math.floor((k + 1) * N / 10)]);
  const label = k => (k * 10 + 1) + '\u2013' + ((k + 1) * 10) + '%';
  const ans = i => pool[i].choices[pool[i].answer];
  const isFrac = /as a (percentage|decimal)/.test(pool[0].question);
  function neighbors(k) {
    const out = [];
    [k - 1, k + 1, k - 2, k + 2, k - 3, k + 3].forEach(x => { if (x >= 0 && x < 10 && !out.includes(x)) out.push(x); });
    return out.slice(0, 3);
  }
  function place(list, seed) {
    const pos = ((seed * 7 + 3) % 4 + 4) % 4;
    const arr = list.slice(1);
    arr.splice(pos, 0, list[0]);
    return { choices: arr, answer: pos };
  }
  function fracOf(i) { const m = pool[i].question.match(/(\d+)\/(\d+)/); return m ? [m[1], m[2]] : null; }
  function pctAnswerOf(k, den) {
    for (let i = 0; i < N; i++) {
      if (pool[i].question === 'What is ' + k + '/' + den + ' as a percentage?') return ans(i);
    }
    return '';
  }
  function rangeStr(k) {
    const lo = blocks[k][0], hi = blocks[k][1];
    if (isFrac) {
      const f1 = fracOf(lo), f2 = fracOf(hi - 1);
      return f1[0] === f2[0] ? f1[0] + '/' + f1[1] : f1[0] + '/' + f1[1] + ' \u2013 ' + f2[0] + '/' + f2[1];
    }
    const a = ans(lo), c = ans(hi - 1);
    return a === c ? a : a + ' \u2013 ' + c;
  }
  const out = [];
  for (let k = 0; k < 10; k++) {
    const lo = blocks[k][0], hi = blocks[k][1];
    const nb = neighbors(k);
    if (k % 2 === 0) {
      const p = place([rangeStr(k)].concat(nb.map(rangeStr)), k);
      let expl;
      if (isFrac) {
        const f1 = fracOf(lo), f2 = fracOf(hi - 1);
        expl = 'The ' + label(k) + ' block runs from ' + f1[0] + '/' + f1[1] + ' (' + pctAnswerOf(f1[0], f1[1]) + ') to ' + f2[0] + '/' + f2[1] + ' (' + pctAnswerOf(f2[0], f2[1]) + ').';
      } else {
        expl = 'The ' + label(k) + ' block runs from "' + pool[lo].question + '" (' + ans(lo) + ') to "' + pool[hi - 1].question + '" (' + ans(hi - 1) + ').';
      }
      out.push({ question: (isFrac ? 'Which fractions sit in the ' : 'Which answer range falls in the ') + label(k) + ' block?',
                 choices: p.choices, answer: p.answer, explanation: expl, source: 'Meta 10 \u2014 blocks' });
    } else {
      const m = lo + Math.floor((hi - lo) / 2);
      const p = place([label(k)].concat(nb.map(label)), k);
      let qtext, expl;
      if (isFrac) {
        const f = fracOf(m);
        qtext = f[0] + '/' + f[1] + ' (' + pctAnswerOf(f[0], f[1]) + ') falls in which 10% block?';
        expl = f[0] + '/' + f[1] + ' is entry ' + (m + 1) + ' of ' + N + ', inside the ' + label(k) + ' block.';
      } else {
        qtext = ans(m) + ' is an answer in which 10% block?';
        expl = ans(m) + ' answers "' + pool[m].question + '" \u2014 entry ' + (m + 1) + ' of ' + N + ', inside the ' + label(k) + ' block.';
      }
      out.push({ question: qtext, choices: p.choices, answer: p.answer, explanation: expl, source: 'Meta 10 \u2014 blocks' });
    }
  }
  return out;
}

function shuffleIdx(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

Promise.all([
  fetch('index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
  fetch(file, { cache: 'no-store' }).then(r => r.json())
]).then(([idxData, data]) => {
  entry = ((idxData && idxData.exams) || []).find(e => e.file === file) || null;
  if (entry) examTitle = entry.title;
  // Back links return to this exam's own subject page, not the top-level
  // list (Damoni, Nov 23, 2026): NREMT -> its chapter circle, the number
  // series -> their circle pages, anything else -> its subject exam list.
  if (entry) {
    let back = 'exams.html';
    if (entry.category === 'NREMT') back = 'topics.html?ch=' + encodeURIComponent(entry.chapter);
    else if (entry.category === '60 Minutes') back = 'hour-topics.html';
    else if (entry.category === 'Fraction Bases') back = 'fraction-topics.html';
    else back = 'exams.html?cat=' + encodeURIComponent(entry.category || 'General') +
      (entry.chapter !== undefined ? '&ch=' + encodeURIComponent(entry.chapter) : '');
    document.querySelectorAll('a[href="exams.html"]').forEach(a => { a.href = back; });
  }
  document.getElementById('exam-title').textContent = examTitle;
  exam = data;
  if (data.title) { examTitle = data.title; document.getElementById('exam-title').textContent = examTitle; }
  const pool = data.questions;
  const isTopic = !!(topicParam && pool.some(q => q.topic === topicParam));
  if (isTopic) {
    storageKey = file + '#topic:' + topicParam;
    examTitle = examTitle + ' \u2014 Topic: ' + topicParam;
    document.getElementById('exam-title').textContent = examTitle;
  }
  // Hour series tier run: &tier=<0-19> runs every question in that 5% tier
  // of the pool (same bands as Meta/Coverage), keyed file#tier:<b> like
  // topic runs are keyed file#topic:<name>.
  const tierB = (tierParam !== null && /^\d+$/.test(tierParam) && +tierParam < 20 && entry && entry.draw) ? +tierParam : -1;
  const isTier = tierB >= 0 && !isTopic;
  if (isTier) {
    storageKey = file + '#tier:' + tierB;
    examTitle = examTitle + ' \u2014 Tier ' + (tierB * 5 + 1) + '\u2013' + ((tierB + 1) * 5) + '%';
    document.getElementById('exam-title').textContent = examTitle;
  }
  isRedund = !!(wantMode === 'redundancy' && entry && Array.isArray(entry.redundancy) && entry.redundancy.length);
  isCoverage = !!(wantMode === 'coverage' && entry && entry.draw);
  isMeta = !!(wantMode === 'meta' && entry && entry.draw);
  isMeta10 = !!(wantMode === 'meta10' && entry && entry.draw);
  if (isMeta10) {
    storageKey = file + '#meta10';
    examTitle = examTitle + ' \u2014 Meta 10';
    document.getElementById('exam-title').textContent = examTitle;
  } else if (isMeta) {
    storageKey = file + '#meta';
    examTitle = examTitle + ' \u2014 Meta';
    document.getElementById('exam-title').textContent = examTitle;
  } else if (isRedund) {
    storageKey = file + '#redundancy';
    examTitle = examTitle + ' \u2014 Redundancy';
    document.getElementById('exam-title').textContent = examTitle;
  } else if (isCoverage) {
    storageKey = file + '#coverage';
    examTitle = examTitle + ' \u2014 Coverage';
    document.getElementById('exam-title').textContent = examTitle;
  }
  try {
    const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
    const p = all[storageKey];
    if (isTopic) {
      const tqs = pool.filter(q => q.topic === topicParam);
      exam = Object.assign({}, data, { questions: tqs });
      if (p && p.total === tqs.length && p.idx < tqs.length) {
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
      }
    } else if (isTier) {
      const lo = Math.floor(tierB * pool.length / 20);
      const hi = Math.floor((tierB + 1) * pool.length / 20);
      const tqs = pool.slice(lo, hi);
      exam = Object.assign({}, data, { questions: tqs });
      if (p && p.total === tqs.length && p.idx < tqs.length) {
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
      }
    } else if (isMeta10) {
      const blockQs = buildBlockQuestions(pool);
      let restored = false;
      if (p && Array.isArray(p.order) && p.order.length === blockQs.length && p.total === blockQs.length &&
          p.order.every(i => i >= 0 && i < blockQs.length) && p.idx < blockQs.length) {
        runOrder = p.order;
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
        restored = true;
      }
      if (!restored) runOrder = shuffleIdx(blockQs.length);
      exam = Object.assign({}, data, { questions: runOrder.map(i => blockQs[i]) });
    } else if (isMeta) {
      const metaQs = buildMetaQuestions(pool);
      let restored = false;
      if (p && Array.isArray(p.order) && p.order.length === metaQs.length && p.total === metaQs.length &&
          p.order.every(i => i >= 0 && i < metaQs.length) && p.idx < metaQs.length) {
        runOrder = p.order;
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
        restored = true;
      }
      if (!restored) runOrder = shuffleIdx(metaQs.length);
      exam = Object.assign({}, data, { questions: runOrder.map(i => metaQs[i]) });
    } else if (isRedund) {
      const picks = entry.redundancy.filter(i => i >= 0 && i < pool.length);
      const drawN = picks.length;
      let restored = false;
      if (p && Array.isArray(p.order) && p.order.length === drawN && p.total === drawN &&
          p.order.every(i => picks.indexOf(i) !== -1) && p.idx < drawN) {
        runOrder = p.order;
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
        restored = true;
      }
      if (!restored) runOrder = shuffleIdx(drawN).map(i => picks[i]);
      exam = Object.assign({}, data, { questions: runOrder.map(i => pool[i]) });
    } else if (isCoverage) {
      const drawN = Math.min(20, pool.length);
      let restored = false;
      if (p && Array.isArray(p.order) && p.order.length === drawN && p.total === drawN &&
          p.order.every(i => i >= 0 && i < pool.length) && p.idx < drawN) {
        runOrder = p.order;
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
        restored = true;
      }
      if (!restored) {
        const picks = [];
        for (let b = 0; b < drawN; b++) {
          const lo = Math.floor(b * pool.length / drawN);
          const hi = Math.floor((b + 1) * pool.length / drawN);
          picks.push(lo + Math.floor(Math.random() * Math.max(1, hi - lo)));
        }
        runOrder = shuffleIdx(picks.length).map(i => picks[i]);
      }
      exam = Object.assign({}, data, { questions: runOrder.map(i => pool[i]) });
    } else if (entry && entry.draw) {
      const drawN = Math.min(entry.draw, pool.length);
      let restored = false;
      if (p && Array.isArray(p.order) && p.order.length === drawN && p.total === drawN &&
          p.order.every(i => i >= 0 && i < pool.length) && p.idx < drawN) {
        runOrder = p.order;
        idx = p.idx; score = p.score || 0;
        bankedSecs = p.secs || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        (p.quality || []).forEach(i => quality.add(i));
        restored = true;
      }
      if (!restored) runOrder = shuffleIdx(pool.length).slice(0, drawN);
      exam = Object.assign({}, data, { questions: runOrder.map(i => pool[i]) });
    } else if (p && p.total === pool.length && p.idx < pool.length) {
      idx = p.idx; score = p.score || 0;
      bankedSecs = p.secs || 0;
      (p.answers || []).forEach((a, i) => { answers[i] = a; });
      (p.flagged || []).forEach(i => flagged.add(i));
      (p.quality || []).forEach(i => quality.add(i));
    }
  } catch (e) { /* no saved progress */ }
  resetSegment();
  show();
  renderAnswered();
});

function refreshFlagBtn() {
  const btn = document.getElementById('flag-btn');
  const on = flagged.has(idx);
  btn.textContent = on ? '\u2605 Flagged: needs more work' : '\u2606 Needs more work';
  btn.classList.toggle('flagged-on', on);
}

function refreshQualityBtn() {
  const btn = document.getElementById('quality-btn');
  const on = quality.has(idx);
  btn.textContent = on ? '\u2691 In quality review' : '\u2691 Quality review';
  btn.classList.toggle('quality-on', on);
}

const PKEY = 'examProgress';
// Live marks: snapshots of flagged / quality / missed-so-far questions,
// saved on every progress save so the Notepad / Quality pads can show them
// mid-run — Damoni may stop a test early to comment, then come back.
// (Pads used to read only finished attempts from examHistory.)
function buildLive() {
  function snap(i, extra) {
    const q = exam.questions[i];
    const o = { n: i + 1, question: q.question, source: q.source || '', correct: q.choices[q.answer], explanation: q.explanation || '' };
    if (extra) Object.assign(o, extra);
    return o;
  }
  function marked(set) {
    return [...set].sort((a, b) => a - b).map(i => snap(i, { result: answers[i] === exam.questions[i].answer ? 'answered correctly' : 'answered incorrectly' }));
  }
  const missedQs = [];
  exam.questions.forEach((q, i) => {
    if (answers[i] !== undefined && answers[i] !== q.answer) missedQs.push(snap(i, { your: q.choices[answers[i]] }));
  });
  return { title: examTitle, flaggedQs: marked(flagged), qualityQs: marked(quality), missedQs: missedQs };
}
function saveProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
    const rec = { idx: idx, answers: answers, flagged: [...flagged], quality: [...quality], score: score, total: exam.questions.length, ts: Date.now(), secs: elapsedSecs(), live: buildLive() };
    if (runOrder) rec.order = runOrder;
    all[storageKey] = rec;
    localStorage.setItem(PKEY, JSON.stringify(all));
  } catch (e) { /* storage unavailable */ }
}
function clearProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
    delete all[storageKey];
    localStorage.setItem(PKEY, JSON.stringify(all));
  } catch (e) { /* storage unavailable */ }
}
function renderAnswered() {
  const q = exam.questions[idx];
  const picked = answers[idx];
  if (picked === undefined) return;
  document.querySelectorAll('button.choice').forEach((b, i) => {
    b.disabled = true;
    if (i === picked) b.className += picked === q.answer ? ' correct' : ' wrong';
  });
  document.getElementById('feedback').textContent =
    (picked === q.answer ? 'Correct. ' : 'Wrong. Answer: ' + q.choices[q.answer] + '. ') + (q.explanation || '');
  document.getElementById('next-btn').hidden = false;
}

function show() {
  const q = exam.questions[idx];
  document.getElementById('progress').textContent = 'Question ' + (idx + 1) + ' of ' + exam.questions.length;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('source-line').textContent = q.source ? 'Deck: ' + q.source : '';
  const tb = document.getElementById('topic-bar');
  if (tb) {
    if (q.topic) { tb.hidden = false; tb.textContent = 'Topic: ' + q.topic + (entry && entry.chapter ? ' \u00B7 Chapter ' + entry.chapter : ''); }
    else tb.hidden = true;
  }
  document.getElementById('feedback').textContent = '';
  document.getElementById('next-btn').hidden = true;
  document.getElementById('back-btn').hidden = idx === 0;
  refreshFlagBtn();
  refreshQualityBtn();
  const qp = document.getElementById('quality-panel');
  if (qp) qp.hidden = true;
  const box = document.getElementById('choices');
  box.innerHTML = '';
  q.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = c;
    b.onclick = () => pick(i, b);
    box.appendChild(b);
  });
}

function pick(i, btn) {
  const q = exam.questions[idx];
  answers[idx] = i;
  document.querySelectorAll('button.choice').forEach(b => b.disabled = true);
  const right = i === q.answer;
  if (right) score++;
  btn.className += right ? ' correct' : ' wrong';
  document.getElementById('feedback').textContent =
    (right ? 'Correct. ' : 'Wrong. Answer: ' + q.choices[q.answer] + '. ') + (q.explanation || '');
  document.getElementById('next-btn').hidden = false;
  saveProgress();
}

function finish() {
  clearProgress();
  document.getElementById('question-box').hidden = true;
  document.getElementById('progress').textContent = '';
  document.getElementById('result-box').hidden = false;
  document.getElementById('score').textContent = 'Score: ' + score + ' of ' + exam.questions.length;

  lastMissed = [];
  exam.questions.forEach((q, i) => {
    if (answers[i] !== q.answer) {
      lastMissed.push({
        n: i + 1,
        question: q.question,
        source: q.source || '',
        your: answers[i] === undefined ? '(no answer)' : q.choices[answers[i]],
        correct: q.choices[q.answer],
        explanation: q.explanation || ''
      });
    }
  });

  const list = document.getElementById('missed-list');
  list.innerHTML = '';
  lastMissed.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.question + ' — Your answer: ' + m.your + ' · Correct: ' + m.correct + (m.source ? ' · Deck: ' + m.source : '') + (m.explanation ? ' · ' + m.explanation : '');
    list.appendChild(li);
  });
  document.getElementById('no-missed').hidden = lastMissed.length !== 0;

  lastFlagged = [...flagged].sort((a, b) => a - b).map(i => {
    const q = exam.questions[i];
    return {
      n: i + 1,
      question: q.question,
      source: q.source || '',
      correct: q.choices[q.answer],
      explanation: q.explanation || '',
      result: answers[i] === q.answer ? 'answered correctly' : 'answered incorrectly'
    };
  });
  // Damoni's rule (Nov 22, 2026): on a FINISHED test, only missed questions
  // need review \u2014 a flagged question answered correctly is not listed here.
  // The saved attempt record keeps the full flagged list; this is display only.
  const reviewFlagged = lastFlagged.filter(m => m.result === 'answered incorrectly');
  const flist = document.getElementById('flagged-list');
  flist.innerHTML = '';
  reviewFlagged.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.question + ' — Correct: ' + m.correct + ' · You ' + m.result + (m.source ? ' · Deck: ' + m.source : '') + (m.explanation ? ' · ' + m.explanation : '');
    flist.appendChild(li);
  });
  document.getElementById('no-flagged').hidden = reviewFlagged.length !== 0;

  lastQuality = [...quality].sort((a, b) => a - b).map(i => {
    const q = exam.questions[i];
    return {
      n: i + 1,
      question: q.question,
      source: q.source || '',
      correct: q.choices[q.answer],
      explanation: q.explanation || '',
      result: answers[i] === q.answer ? 'answered correctly' : 'answered incorrectly'
    };
  });
  const qlist = document.getElementById('quality-list');
  qlist.innerHTML = '';
  lastQuality.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.question + ' — Correct: ' + m.correct + ' · You ' + m.result + (m.source ? ' · Deck: ' + m.source : '') + (m.explanation ? ' · ' + m.explanation : '');
    qlist.appendChild(li);
  });
  document.getElementById('no-quality').hidden = lastQuality.length !== 0;

  try {
    const all = JSON.parse(localStorage.getItem('examHistory') || '{}');
    if (!Array.isArray(all[storageKey])) all[storageKey] = [];
    // STAGED hour-fix: store the full asked set so draw-mode attempts
    // (Hour series: Start/Coverage draw 20 of up to 365) can be mapped back
    // to tiers/topics exactly. Without it, only missed/marked questions are
    // recoverable from history. Harmless for NREMT full-set runs.
    all[storageKey].unshift({ ts: new Date().toISOString(), title: examTitle, score: score, total: exam.questions.length, secs: elapsedSecs(), missed: lastMissed, flagged: lastFlagged, quality: lastQuality, asked: exam.questions.map(function (q) { return q.question; }) });
    all[storageKey] = all[storageKey].slice(0, 20);
    localStorage.setItem('examHistory', JSON.stringify(all));
  } catch (e) { /* storage unavailable; results still shown on screen */ }
}

document.getElementById('flag-btn').onclick = () => {
  if (flagged.has(idx)) flagged.delete(idx); else flagged.add(idx);
  refreshFlagBtn();
  refreshQualityBtn();
  saveProgress();
};
document.getElementById('quality-btn').onclick = () => { openQualityPanel(); };

// Inline quality review (Damoni, Nov 25, 2026): the Quality review button
// opens the form right here in the exam \u2014 no trip to the Quality page,
// no losing his place in the run. The comment saves to the same
// qualityNotes key the Quality page uses, and Send reports through the
// same examSync.sendReport path, so the ping to Edison works exactly as
// before. The Quality page itself is unchanged and still shows everything
// marked, finished or in progress.
function qualityNotesAll() {
  try { return JSON.parse(localStorage.getItem('qualityNotes') || '{}'); } catch (e) { return {}; }
}
function qualityNoteKey() { return storageKey + '||' + exam.questions[idx].question; }
function saveQualityComment() {
  const ta = document.getElementById('quality-comment');
  if (!ta) return;
  const notes = qualityNotesAll();
  notes[qualityNoteKey()] = ta.value;
  try { localStorage.setItem('qualityNotes', JSON.stringify(notes)); } catch (e) { /* storage unavailable */ }
}
function openQualityPanel() {
  if (!quality.has(idx)) { quality.add(idx); refreshQualityBtn(); saveProgress(); }
  document.getElementById('quality-q').textContent = exam.questions[idx].question;
  document.getElementById('quality-comment').value = qualityNotesAll()[qualityNoteKey()] || '';
  document.getElementById('quality-status').textContent = '';
  document.getElementById('quality-panel').hidden = false;
}
document.getElementById('quality-comment').addEventListener('change', saveQualityComment);
document.getElementById('quality-close').onclick = () => { saveQualityComment(); document.getElementById('quality-panel').hidden = true; };
document.getElementById('quality-unmark').onclick = () => {
  saveQualityComment();
  quality.delete(idx);
  refreshQualityBtn();
  saveProgress();
  document.getElementById('quality-panel').hidden = true;
};
document.getElementById('quality-send').onclick = () => {
  saveQualityComment();
  const status = document.getElementById('quality-status');
  const btn = document.getElementById('quality-send');
  const notes = qualityNotesAll();
  const items = buildLive().qualityQs.map(function (m) {
    return { n: m.n, question: m.question, correct: m.correct, explanation: m.explanation || '', comment: notes[storageKey + '||' + m.question] || '', result: m.result || '' };
  });
  if (!items.length) { status.textContent = 'Nothing to send yet.'; return; }
  const report = { id: 'r' + Date.now(), ts: new Date().toISOString(), page: 'quality', groups: [{ title: examTitle + ' \u2014 in progress', items: items }] };
  btn.disabled = true;
  status.textContent = 'Sending\u2026';
  const wait = setInterval(function () {
    if (window.examSync) {
      clearInterval(wait);
      window.examSync.sendReport(report).then(function () {
        status.textContent = 'Sent \u2713 \u2014 Edison will message you to discuss.';
        btn.disabled = false;
      }).catch(function () {
        status.textContent = 'Could not send \u2014 sign in to sync first (blue bar at the top), then try again.';
        btn.disabled = false;
      });
    }
  }, 200);
  setTimeout(function () { clearInterval(wait); if (btn.disabled) { status.textContent = 'Could not send \u2014 sign in to sync first (blue bar at the top), then try again.'; btn.disabled = false; } }, 12000);
};
document.getElementById('next-btn').onclick = () => {
  idx++;
  if (idx < exam.questions.length) { show(); renderAnswered(); saveProgress(); return; }
  finish();
};
document.getElementById('back-btn').onclick = () => {
  if (idx === 0) return;
  idx--;
  show();
  renderAnswered();
  saveProgress();
};
document.getElementById('retry-btn').onclick = () => { clearProgress(); location.reload(); };
