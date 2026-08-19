import fs from 'node:fs';

function refactor(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`${path}: missing expected snippet: ${from.slice(0, 80)}`);
    source = source.replace(from, to);
  }
  if (/\.innerHTML\s*=/.test(source)) {
    throw new Error(`${path}: innerHTML assignment remains after refactor`);
  }
  fs.writeFileSync(path, source);
}

const helperAnchor = `function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}`;

const helperWithRenderer = `${helperAnchor}\n\nconst renderRichText = window.BRIEFING_SAFE_RENDER.renderRichText;`;

refactor('app.js', [
  [helperAnchor, helperWithRenderer],
  [`        line.innerHTML = text;      // 강조 태그만 든 고정 문자열`, `        renderRichText(line, text);`],
  [`    li.innerHTML = text;          // 강조 태그만 든 고정 문자열`, `    renderRichText(li, text);`],
  [`    li.innerHTML = text;\n    notes.appendChild(li);`, `    renderRichText(li, text);\n    notes.appendChild(li);`],
  [`  const op = frag.querySelector('.dt-opinion');\n  op.innerHTML = it.opinion;`, `  const op = frag.querySelector('.dt-opinion');\n  renderRichText(op, it.opinion);`],
]);

refactor('v1-map/app.js', [
  [helperAnchor, helperWithRenderer],
  [`        li.innerHTML = text;     // 강조 태그만 든 고정 문자열`, `        renderRichText(li, text);`],
  [`  svg.innerHTML = '<path class="link" d="' + d + '" />';`, `  svg.replaceChildren();\n  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n  path.setAttribute('class', 'link');\n  path.setAttribute('d', d);\n  svg.appendChild(path);`],
  [`      li.innerHTML = text;\n      ul.appendChild(li);`, `      renderRichText(li, text);\n      ul.appendChild(li);`],
  [`    li.innerHTML = text;\n    facts.appendChild(li);`, `    renderRichText(li, text);\n    facts.appendChild(li);`],
  [`    li.innerHTML = text;\n    notes.appendChild(li);`, `    renderRichText(li, text);\n    notes.appendChild(li);`],
]);

console.log('Explicit rich-text renderer applied; no innerHTML assignments remain.');
