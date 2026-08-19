/* Constrained rich-text renderer for Phase 1.
 *
 * Existing prototype data uses innerHTML only to emphasize fragments with <b>.
 * Before any LLM-generated content is introduced, block every other HTML tag and
 * attribute at the DOM sink. SVG rendering is intentionally excluded.
 */
(() => {
  'use strict';

  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descriptor || typeof descriptor.set !== 'function' || typeof descriptor.get !== 'function') return;

  const nativeGet = descriptor.get;
  const nativeSet = descriptor.set;

  function boldOnly(value) {
    return String(value ?? '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/gi, '<b>')
      .replace(/&lt;\/b&gt;/gi, '</b>');
  }

  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: nativeGet,
    set(value) {
      // The map view builds SVG paths with innerHTML; keep that rendering path intact.
      if (this.namespaceURI === 'http://www.w3.org/2000/svg') {
        nativeSet.call(this, value);
        return;
      }
      nativeSet.call(this, boldOnly(value));
    },
  });

  window.BRIEFING_SAFE_RENDER = Object.freeze({ boldOnly });
})();
