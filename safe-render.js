/* Explicit constrained rich-text renderer.
 *
 * Briefing copy may use <b>...</b> for emphasis. Everything else is rendered as
 * literal text. Call renderRichText(element, value) at the specific DOM sink.
 */
(() => {
  'use strict';

  function tokenizeBold(value) {
    const text = String(value ?? '');
    const tokens = [];
    const re = /<\/?b>/gi;
    let index = 0;
    let bold = false;
    let match = re.exec(text);

    while (match) {
      if (match.index > index) tokens.push({ text: text.slice(index, match.index), bold });
      bold = match[0][1] !== '/';
      index = re.lastIndex;
      match = re.exec(text);
    }
    if (index < text.length) tokens.push({ text: text.slice(index), bold });
    return tokens;
  }

  function renderRichText(element, value) {
    if (!element || typeof element.replaceChildren !== 'function') {
      throw new TypeError('renderRichText requires a DOM Element');
    }

    const fragment = document.createDocumentFragment();
    tokenizeBold(value).forEach((token) => {
      if (!token.text) return;
      if (token.bold) {
        const strong = document.createElement('b');
        strong.textContent = token.text;
        fragment.appendChild(strong);
      } else {
        fragment.appendChild(document.createTextNode(token.text));
      }
    });
    element.replaceChildren(fragment);
    return element;
  }

  window.BRIEFING_SAFE_RENDER = Object.freeze({
    tokenizeBold,
    renderRichText,
  });
})();
