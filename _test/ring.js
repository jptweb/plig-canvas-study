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
    return label + ' => ' + stages + (firstFail ? ' | ' + firstFail.id.replace('stage-', '') + ': ' + firstFail.querySelector('.why').textContent.slice(0, 95) : '');
  }
  const bg = `ctx.fillStyle = "lightblue";\nctx.fillRect(0, 0, 400, 300);\n`;
  const disc = `ctx.fillStyle = "crimson";\nctx.beginPath();\nctx.arc(200, 150, 100, 0, Math.PI * 2, false);\n`;
  const ring = disc + `ctx.arc(200, 150, 70, 0, Math.PI * 2, true);\nctx.fill();\n`;
  const ring2 = `ctx.fillStyle = "navy";\nctx.beginPath();\nctx.arc(200, 150, 60, 0, Math.PI * 2, false);\nctx.arc(200, 150, 40, 0, Math.PI * 2, true);\nctx.fill();\n`;
  const dot = `ctx.fillStyle = "gold";\nctx.beginPath();\nctx.arc(200, 150, 20, 0, Math.PI * 2);\nctx.fill();\n`;
  const cross = `ctx.strokeStyle = "black";\nctx.lineWidth = 3;\nctx.beginPath();\nctx.moveTo(0, 150);\nctx.lineTo(400, 150);\nctx.moveTo(200, 0);\nctx.lineTo(200, 300);\nctx.stroke();\n`;
  const r = [];
  r.push(await runCode('1 FULL', bg + ring + ring2 + dot + cross));
  r.push('  ring notes: ' + JSON.stringify(log.filter(e => e.type === 'stage' && e.stage === 'ring').map(e => e.notes)));
  r.push(await runCode('2 WHITE BG', `ctx.fillStyle = "white";\nctx.fillRect(0, 0, 400, 300);\n`));
  r.push(await runCode('3 DISC ONLY', bg + disc + `ctx.fill();\n`));
  r.push(await runCode('4 RING SAME DIR', bg + disc + `ctx.arc(200, 150, 70, 0, Math.PI * 2);\nctx.fill();\n`));
  r.push(await runCode('5 RING BY COVER', bg + disc + `ctx.fill();\nctx.fillStyle = "lightblue";\nctx.beginPath();\nctx.arc(200, 150, 70, 0, Math.PI * 2);\nctx.fill();\n`));
  r.push('  ring notes now: ' + JSON.stringify(log.filter(e => e.type === 'stage' && e.stage === 'ring').slice(-1).map(e => e.notes)));
  r.push(await runCode('6 INNER ALONE', bg + disc + `ctx.fill();\nctx.beginPath();\nctx.arc(200, 150, 70, 0, Math.PI * 2, true);\nctx.fill();\n`));
  r.push(await runCode('7 RING2 NO BEGINPATH', bg + ring + ring2.replace('ctx.beginPath();\n', '') + dot));
  r.push(await runCode('8 RING2 SAME COLOR', bg + ring + ring2.replace('ctx.fillStyle = "navy";\n', '') + dot));
  r.push(await runCode('9 CROSS THIN', bg + ring + ring2 + dot + cross.replace('lineWidth = 3', 'lineWidth = 1')));
  r.push(await runCode('10 FULL', bg + ring + ring2 + dot + cross));
  return r.join('\n');
}
