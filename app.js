import { TASKS, analyze } from './tasks.js';

// ---------- setup ----------
const params = new URLSearchParams(location.search);
const task = TASKS[params.get('task')] || TASKS.scene;
const DEBUG = params.get('debug') === '1';
const t0 = performance.now();
const KEY = `plig-${task.id}`;

// Session state survives a reload in the same tab (sessionStorage), but not a
// new tab, so the next participant on the same machine starts clean.
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
const log = (saved && Array.isArray(saved.log)) ? saved.log : [];
const event = (type, data = {}) => {
  log.push({ t: Math.round(performance.now() - t0) + (saved ? saved.elapsed || 0 : 0), type, ...data });
  persist();
};
function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      code: editor ? editor.getValue() : (saved ? saved.code : null),
      log,
      elapsed: Math.round(performance.now() - t0) + (saved ? saved.elapsed || 0 : 0)
    }));
  } catch (e) { /* storage unavailable: keep going in memory */ }
}
event(saved ? 'reload' : 'load', { task: task.id, ua: navigator.userAgent });
window.__plig = { log, task };   // read-only handle for the proctor / pilots (console: __plig.log)

document.getElementById('variant-name').textContent = `· ${task.name}`;
document.getElementById('task-title').textContent = `Task: ${task.name}`;
document.getElementById('task-intro').textContent = task.intro;

const stagesEl = document.getElementById('stages');
const stageState = {};
for (const s of task.stages) {
  const li = document.createElement('li');
  li.className = 'stage' + (s.stretch ? ' stretch' : '');
  li.id = `stage-${s.id}`;
  li.dataset.section = s.section;
  li.innerHTML = `<span class="mark" aria-hidden="true"></span><div><div class="title">${s.title}</div><p class="text">${s.text}</p>${DEBUG ? '<p class="why"></p>' : ''}</div>`;
  stagesEl.appendChild(li);
  stageState[s.id] = false;
}

// ---------- tabs ----------
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab.dataset.tab}`));
    event('tab', { tab: tab.dataset.tab });
  });
}

// ---------- editor (Monaco from cdnjs, textarea fallback) ----------
let editor = null;       // { getValue, setValue }
let stash = null;
const editorEl = document.getElementById('editor');
const initialCode = (saved && typeof saved.code === 'string') ? saved.code : task.starter;

function makeFallback(value) {
  const ta = document.createElement('textarea');
  ta.className = 'editor-fallback';
  ta.spellcheck = false;
  ta.value = value;
  editorEl.appendChild(ta);
  ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });
  return { getValue: () => ta.value, setValue: v => { ta.value = v; } };
}

function initEditor() {
  return new Promise(resolve => {
    if (typeof window.require !== 'function') { resolve(makeFallback(initialCode)); return; }
    window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' } });
    const timer = setTimeout(() => { if (!editor) resolve(makeFallback(initialCode)); }, 8000);
    window.require(['vs/editor/editor.main'], () => {
      clearTimeout(timer);
      const m = window.monaco.editor.create(editorEl, {
        value: initialCode,
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        tabSize: 2,
        insertSpaces: true,
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        hover: { enabled: false }
      });
      m.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, () => run());
      resolve({ getValue: () => m.getValue(), setValue: v => m.setValue(v) });
    }, () => { clearTimeout(timer); resolve(makeFallback(initialCode)); });
  });
}

// ---------- sandbox: a Web Worker with an OffscreenCanvas ----------
// Each Run builds a worker from the student's code. The worker draws to an
// OffscreenCanvas, records every ctx call, and posts back the call log, the
// pixels, and an ImageBitmap that the page paints onto the visible canvas.
// A worker can be terminated instantly, so an infinite loop costs 4 seconds
// and nothing else.
const view = document.getElementById('view');
const viewCtx = view.getContext('2d');
const outputEl = document.getElementById('output');
let worker = null;
let runCount = log.reduce((m, e) => Math.max(m, e.runId || 0), 0);   // keep ids unique across a reload
const RUN_TIMEOUT = 4000;

const SPY_METHODS = ['fillRect', 'strokeRect', 'clearRect', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'ellipse',
  'fill', 'stroke', 'fillText', 'strokeText', 'save', 'restore', 'translate', 'rotate', 'scale', 'quadraticCurveTo', 'bezierCurveTo', 'setLineDash'];

function buildWorkerSource(code, runId) {
  let prefix = `var __calls = [], __errors = [], __logs = [];
var __canvas = new OffscreenCanvas(400, 300);
var __ctx = __canvas.getContext('2d');
var document = { getElementById: function () { return __canvas; }, querySelector: function () { return __canvas; } };
var window = self;
(function () {
  var names = ${JSON.stringify(SPY_METHODS)};
  names.forEach(function (name) {
    var orig = __ctx[name];
    if (typeof orig !== 'function') return;
    __ctx[name] = function () {
      var args = Array.prototype.slice.call(arguments);
      __calls.push({ name: name, args: args, fillStyle: __ctx.fillStyle, strokeStyle: __ctx.strokeStyle, lineWidth: __ctx.lineWidth });
      return orig.apply(__ctx, arguments);
    };
  });
  ['log', 'warn', 'error', 'info'].forEach(function (k) {
    console[k] = function () {
      __logs.push({ level: k, text: Array.prototype.map.call(arguments, function (a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); } }).join(' ') });
    };
  });
})();
var __OFFSET = __OFFSET_VALUE__;
self.onerror = function (msg, src, line, col) {
  __errors.push({ message: String(msg).replace(/^Uncaught /, ''), line: line ? line - __OFFSET : null, col: col || null });
  return true;
};
function __finish() {
  var pixels = null, bitmap = null;
  try { pixels = __ctx.getImageData(0, 0, 400, 300).data; } catch (e) {}
  try { bitmap = __canvas.transferToImageBitmap(); } catch (e) {}
  self.postMessage({ type: 'run-result', runId: ${runId}, calls: __calls, errors: __errors, logs: __logs, pixels: pixels, bitmap: bitmap }, bitmap ? [bitmap] : []);
}
setTimeout(__finish, 0);   // runs after the student's script finishes or throws
`;
  const offset = prefix.split('\n').length - 1;   // student line 1 is script line offset + 1
  prefix = prefix.replace('__OFFSET_VALUE__', String(offset));
  return { src: prefix + code + '\n', offset };
}

function stopWorker() {
  if (worker) { worker.w.terminate(); URL.revokeObjectURL(worker.url); clearTimeout(worker.timer); worker = null; }
}

function run() {
  if (!editor) return;
  const code = editor.getValue();
  const id = ++runCount;
  event('run', { runId: id, code });
  stopWorker();
  const { src, offset } = buildWorkerSource(code, id);
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const w = new Worker(url);
  const timer = setTimeout(() => {
    if (!worker || worker.w !== w) return;
    stopWorker();
    finishRun(id, { errors: [{ message: 'The code did not finish (an infinite loop?). Check for a loop that never ends.' }], logs: [], calls: [], pixels: null, bitmap: null, timeout: true });
  }, RUN_TIMEOUT);
  worker = { w, url, timer, id };
  w.onmessage = ev => {
    if (!worker || worker.w !== w || !ev.data || ev.data.runId !== id) return;
    stopWorker();
    finishRun(id, ev.data);
  };
  w.onerror = ev => {                 // syntax errors: the worker script never compiled
    if (!worker || worker.w !== w) return;
    ev.preventDefault();
    stopWorker();
    finishRun(id, { errors: [{ message: String(ev.message || 'Error').replace(/^Uncaught /, ''), line: ev.lineno ? ev.lineno - offset : null, col: ev.colno || null }], logs: [], calls: [], pixels: null, bitmap: null });
  };
}

function finishRun(id, result) {
  window.__plig.last = { runId: id, calls: result.calls, errors: result.errors, pixels: result.pixels };
  viewCtx.clearRect(0, 0, view.width, view.height);
  if (result.bitmap) { viewCtx.drawImage(result.bitmap, 0, 0); result.bitmap.close?.(); }
  showOutput(result);
  let stages = null;
  if (result.errors.length) clearStages(result.timeout ? 'run did not finish' : 'run errored');
  else stages = checkStages(result);
  event(result.timeout ? 'run-timeout' : 'run-result', { runId: id, errors: result.errors, calls: result.calls.length, stages });
}

function showOutput({ errors, logs }) {
  outputEl.innerHTML = '';
  if (!errors.length && !logs.length) {
    outputEl.innerHTML = '<div class="output-empty muted">No errors.</div>';
    return;
  }
  for (const e of errors) {
    const d = document.createElement('div');
    d.className = 'line err';
    d.textContent = (e.line ? `Line ${e.line}: ` : '') + e.message;
    outputEl.appendChild(d);
  }
  for (const l of logs) {
    const d = document.createElement('div');
    d.className = 'line' + (l.level === 'error' ? ' err' : l.level === 'warn' ? ' warn' : '');
    d.textContent = l.text;
    outputEl.appendChild(d);
  }
}

function checkStages(result) {
  const a = analyze(result);
  const summary = {};
  for (const s of task.stages) {
    let r;
    try { r = s.check(a); } catch (err) { r = { pass: false, why: 'checker error: ' + err.message, notes: [] }; }
    const li = document.getElementById(`stage-${s.id}`);
    li.classList.toggle('pass', !!r.pass);
    if (DEBUG) li.querySelector('.why').textContent = r.pass ? 'pass' + (r.notes?.length ? ' · ' + r.notes.join(', ') : '') : r.why;
    if (stageState[s.id] !== !!r.pass) {
      stageState[s.id] = !!r.pass;
      event('stage', { stage: s.id, pass: !!r.pass, why: r.why || '', notes: r.notes || [] });
    }
    summary[s.id] = { pass: !!r.pass, why: r.why || '', notes: r.notes || [] };
  }
  return summary;
}

function clearStages(why) {
  for (const s of task.stages) {
    const li = document.getElementById(`stage-${s.id}`);
    li.classList.remove('pass');
    if (DEBUG) li.querySelector('.why').textContent = why;
    if (stageState[s.id]) { stageState[s.id] = false; event('stage', { stage: s.id, pass: false, why }); }
  }
}

// ---------- buttons ----------
document.getElementById('btn-run').addEventListener('click', run);

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!editor) return;
  editor.setValue(task.starter);
  document.getElementById('btn-restore').hidden = true;
  stash = null;
  event('reset');
  run();
});

document.getElementById('btn-restore').addEventListener('click', () => {
  if (!editor || stash === null) return;
  editor.setValue(stash);
  stash = null;
  document.getElementById('btn-restore').hidden = true;
  event('restore');
  run();
});

for (const btn of document.querySelectorAll('.example .try')) {
  btn.addEventListener('click', () => {
    if (!editor) return;
    const code = btn.parentElement.querySelector('code').textContent;
    const section = btn.closest('section')?.id || '';
    const current = editor.getValue();
    if (current !== task.starter) { stash = current; document.getElementById('btn-restore').hidden = false; }
    editor.setValue(task.starter + '\n' + code + '\n');
    event('tryit', { section });
    run();
  });
}

document.getElementById('btn-log').addEventListener('click', () => {
  persist();
  const blob = new Blob([JSON.stringify({ task: task.id, exported: new Date().toISOString(), code: editor ? editor.getValue() : null, events: log }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `session-${task.id}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

window.addEventListener('beforeunload', persist);

// ---------- go ----------
initEditor().then(e => { editor = e; run(); });
