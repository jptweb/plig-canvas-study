const wait = ms => new Promise(r => setTimeout(r, ms));
export async function run(w) {
  for (let i = 0; i < 40 && !(w.monaco && w.monaco.editor.getModels().length && w.__plig); i++) await wait(250);
  const model = w.monaco.editor.getModels()[0];
  const starter = w.__plig.task.starter;
  const log = w.__plig.log;
  async function runCode(label, code) {
    const n = log.length;
    model.setValue(starter + code);
    w.document.getElementById('btn-run').click();
    const runId = log.slice(n).find(e => e.type === 'run').runId;
    const t = performance.now();
    while (!log.slice(n).some(e => (e.type === 'run-result' || e.type === 'run-timeout') && e.runId === runId)) { if (performance.now() - t > 8000) break; await wait(30); }
    const lis = [...w.document.querySelectorAll('.stage')];
    const stages = lis.map(li => (li.classList.contains('pass') ? 'P' : 'f')).join('');
    const firstFail = lis.find(li => !li.classList.contains('pass'));
    const out = w.document.getElementById('output').innerText.replace(/\n/g, ' | ').slice(0, 70);
    return label + ' => ' + stages + (firstFail ? ' | ' + firstFail.id.replace('stage-', '') + ': ' + firstFail.querySelector('.why').textContent.slice(0, 80) : '') + ' | out: ' + out;
  }
  const full = `ctx.fillStyle = "seagreen";
ctx.fillRect(0, 200, 400, 100);
ctx.fillStyle = "peru";
ctx.fillRect(80, 100, 140, 100);
ctx.fillStyle = "firebrick";
ctx.beginPath();
ctx.moveTo(70, 100);
ctx.lineTo(230, 100);
ctx.lineTo(150, 40);
ctx.closePath();
ctx.fill();
ctx.fillStyle = "gold";
ctx.beginPath();
ctx.arc(340, 60, 30, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = "saddlebrown";
ctx.fillRect(130, 140, 40, 60);
ctx.strokeStyle = "black";
ctx.lineWidth = 3;
ctx.strokeRect(90, 115, 30, 30);
`;
  const r = [];
  r.push(await runCode('1 FULL', full));
  r.push(await runCode('2 GROUND TOP', `ctx.fillStyle = "seagreen";\nctx.fillRect(0, 0, 400, 100);\n`));
  r.push(await runCode('3 SAME-COLOR HOUSE', `ctx.fillStyle = "seagreen";\nctx.fillRect(0, 200, 400, 100);\nctx.fillRect(80, 100, 140, 100);\n`));
  r.push(await runCode('4 NO BEGINPATH SUN', full.replace('ctx.fillStyle = "gold";\nctx.beginPath();', 'ctx.fillStyle = "gold";')));
  r.push(await runCode('5 SUN 360', full.replace('Math.PI * 2', '360')));
  r.push('  sun notes: ' + JSON.stringify(log.filter(e => e.type === 'stage' && e.stage === 'sun').slice(-1).map(e => e.notes)));
  r.push(await runCode('6 ROOF NO FILL', full.replace('ctx.closePath();\nctx.fill();', 'ctx.closePath();')));
  r.push(await runCode('7 SYNTAX (code line 2)', `ctx.fillStyle = "seagreen";\nctx.fillRect(0, 200, 400, 100;\n`));
  r.push(await runCode('8 RUNTIME (code line 1)', `ctx.fillRec(0, 200, 400, 100);\n`));
  r.push(await runCode('9 LOOP', `while (true) {}\n`));
  r.push(await runCode('10 FULL AFTER LOOP', full));
  r.push(await runCode('11 CONSOLE', `console.log("hello", 42);\n`));
  return r.join('\n');
}
