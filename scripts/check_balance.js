const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/app/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

function analyze(text) {
  const stack = [];
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const opening = Object.keys(pairs);
  const closing = Object.values(pairs);

  let line = 1;
  let col = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    col++;
    if (ch === '\n') { line++; col = 0; inLineComment = false; }
    const prev = text[i-1];

    if (inLineComment) continue;
    if (inBlockComment) {
      if (prev === '*' && ch === '/') inBlockComment = false;
      continue;
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (prev === '/' && ch === '/') { inLineComment = true; continue; }
      if (prev === '/' && ch === '*') { inBlockComment = true; continue; }
    }

    // No comment-state guard needed here: the continues above already
    // skip every character inside a line or block comment.
    if (!inDouble && !inTemplate && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && !inTemplate && ch === '"') { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && ch === '`') { inTemplate = !inTemplate; continue; }

    if (inSingle || inDouble || inTemplate) continue;

    if (opening.includes(ch)) {
      stack.push({ char: ch, line, col, index: i });
    } else if (closing.includes(ch)) {
      const expectedOpen = opening[closing.indexOf(ch)];
      const last = stack[stack.length-1];
      if (!last || last.char !== expectedOpen) {
        return { ok: false, message: `Unmatched closing '${ch}' at line ${line}, col ${col}. Expected matching '${pairs[last ? last.char : '?']}'.`, line, col, index: i };
      }
      stack.pop();
    }
  }
  if (stack.length > 0) {
    const details = stack.map(s => ({ char: s.char, line: s.line, col: s.col, index: s.index }));
    return { ok: false, message: `Unclosed opening(s) detected: ${details.map(d=>d.char).join(', ')}`, details, line: stack[stack.length-1].line, col: stack[stack.length-1].col, index: stack[stack.length-1].index };
  }
  return { ok: true };
}

const result = analyze(content);
if (!result.ok) {
  console.log(JSON.stringify(result, null, 2));
  if (result.details && Array.isArray(result.details)) {
    result.details.forEach(d => {
      const start = Math.max(0, d.index - 120);
      const end = Math.min(content.length, d.index + 120);
      const ctx = content.slice(start, end);
      const beforeLines = content.slice(0, d.index).split('\n');
      const lineNum = beforeLines.length;
      console.log(`\nContext for unclosed '${d.char}' near line ${d.line}, col ${d.col} (approx global index ${d.index}):\n`);
      console.log(ctx);
    });
  } else {
    const start = Math.max(0, result.index - 80);
    const end = Math.min(content.length, result.index + 80);
    const context = content.slice(start, end);
    const beforeLines = content.slice(0, result.index).split('\n');
    const lineNum = beforeLines.length;
    console.log('\nContext around error (approx lines ' + Math.max(1, lineNum - 3) + '-' + (lineNum + 3) + '):\n');
    console.log(context);
  }
} else {
  console.log(JSON.stringify(result, null, 2));
}
