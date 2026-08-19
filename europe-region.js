(() => {
  'use strict';

  // app.js declares REGIONS in the shared classic-script global lexical scope.
  // Add Europe before DOMContentLoaded so buildPins()/init() see it naturally.
  if (typeof REGIONS === 'undefined') return;
  if (REGIONS.some((region) => region.id === 'eu')) return;

  REGIONS.push({
    id: 'eu',
    name: '유럽',
    en: 'EUROPE',
    lat: 50.5,
    lon: 10,
  });
})();
