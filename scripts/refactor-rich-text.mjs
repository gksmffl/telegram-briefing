import fs from 'node:fs';

function refactor(path, transform) {
  const source = fs.readFileSync(path, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`${path}: refactor made no changes`);
  if (/\.innerHTML\s*=/.test(next)) throw new Error(`${path}: innerHTML assignment remains after refactor`);
  fs.writeFileSync(path, next);
}

const helperAnchor = `function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}`;

function addRenderer(source, path) {
  if (!source.includes(helperAnchor)) throw new Error(`${path}: helper anchor not found`);
  return source.replace(helperAnchor, `${helperAnchor}\n\nconst renderRichText = window.BRIEFING_SAFE_RENDER.renderRichText;`);
}

refactor('app.js', (input) => {
  let source = addRenderer(input, 'app.js');
  source = source.replace(/line\.innerHTML = text;[^\n]*/g, 'renderRichText(line, text);');
  source = source.replace(/li\.innerHTML = text;[^\n]*/g, 'renderRichText(li, text);');
  source = source.replace(/op\.innerHTML = it\.opinion;/g, 'renderRichText(op, it.opinion);');
  return source;
});

refactor('v1-map/app.js', (input) => {
  let source = addRenderer(input, 'v1-map/app.js');
  source = source.replace(/li\.innerHTML = text;[^\n]*/g, 'renderRichText(li, text);');
  source = source.replace(
    `  svg.innerHTML = '<path class="link" d="' + d + '" />';`,
    `  svg.replaceChildren();\n  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n  path.setAttribute('class', 'link');\n  path.setAttribute('d', d);\n  svg.appendChild(path);`,
  );
  return source;
});

console.log('Explicit rich-text renderer applied; no innerHTML assignments remain.');
