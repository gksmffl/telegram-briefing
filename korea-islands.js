/* Korean island overlays for the globe.
 *
 * The base LAND geometry is deliberately low-resolution, so small islands can
 * disappear at normal dashboard scale. Jeju follows its approximate geographic
 * outline. Dokdo keeps its real geographic anchor but uses a small minimum
 * screen-space size so the two main islets remain visible.
 */
(() => {
  'use strict';

  const JEJU = [
    [126.10, 33.30],
    [126.22, 33.18],
    [126.46, 33.11],
    [126.72, 33.20],
    [126.91, 33.33],
    [126.82, 33.45],
    [126.58, 33.56],
    [126.32, 33.52],
    [126.15, 33.42],
  ];

  const DOKDO = {
    west: { lat: 37.2417, lon: 131.8656 },
    east: { lat: 37.2392, lon: 131.8697 },
  };

  function drawJeju() {
    if (typeof globe === 'undefined' || typeof project !== 'function') return;

    const points = JEJU.map(([lon, lat]) => project(lat, lon));
    if (!points.some((point) => point.front)) return;

    const visible = points.filter((point) => point.front);
    if (visible.length < 3) return;

    const g = globe.ctx;
    const tone = (typeof LAND_TONE !== 'undefined' && LAND_TONE.temperate)
      ? LAND_TONE.temperate
      : { fill: 'rgba(104, 138, 92, .82)', line: 'rgba(150, 186, 132, .5)' };

    g.save();
    g.beginPath();
    g.arc(globe.cx, globe.cy, globe.r, 0, Math.PI * 2);
    g.clip();

    g.beginPath();
    g.moveTo(visible[0].sx, visible[0].sy);
    for (let i = 1; i < visible.length; i += 1) g.lineTo(visible[i].sx, visible[i].sy);
    g.closePath();
    g.fillStyle = tone.fill;
    g.strokeStyle = tone.line;
    g.lineWidth = Math.max(0.8, globe.r / 380);
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawDokdoIslet(point, radius) {
    if (!point.front) return;
    const g = globe.ctx;
    const tone = (typeof LAND_TONE !== 'undefined' && LAND_TONE.temperate)
      ? LAND_TONE.temperate
      : { fill: 'rgba(104, 138, 92, .82)', line: 'rgba(150, 186, 132, .5)' };

    g.beginPath();
    g.ellipse(point.sx, point.sy, radius * 0.78, radius, -0.35, 0, Math.PI * 2);
    g.fillStyle = tone.fill;
    g.strokeStyle = tone.line;
    g.lineWidth = 0.7;
    g.fill();
    g.stroke();
  }

  function drawDokdo() {
    if (typeof globe === 'undefined' || typeof project !== 'function') return;

    const west = project(DOKDO.west.lat, DOKDO.west.lon);
    const east = project(DOKDO.east.lat, DOKDO.east.lon);
    if (!west.front && !east.front) return;

    // Real-world Dokdo is far below one pixel at this dashboard scale. Keep the
    // true anchor while guaranteeing a subtle, visible two-islet silhouette.
    const radius = Math.max(1.25, Math.min(2.1, globe.r * 0.0052));

    const g = globe.ctx;
    g.save();
    g.beginPath();
    g.arc(globe.cx, globe.cy, globe.r, 0, Math.PI * 2);
    g.clip();

    // The actual projected separation is sub-pixel, so add a tiny visual offset
    // along the local east-west axis while preserving the geographic midpoint.
    if (west.front && east.front) {
      const midX = (west.sx + east.sx) / 2;
      const midY = (west.sy + east.sy) / 2;
      drawDokdoIslet({ sx: midX - radius * 0.72, sy: midY + radius * 0.15, front: true }, radius * 0.9);
      drawDokdoIslet({ sx: midX + radius * 0.72, sy: midY - radius * 0.15, front: true }, radius * 0.72);
    } else {
      drawDokdoIslet(west.front ? west : east, radius);
    }

    g.restore();
  }

  function drawKoreanIslands() {
    drawJeju();
    drawDokdo();
  }

  // drawGlobe renders LAND immediately before drawPolarCap. Hooking that boundary
  // keeps these overlays above the coarse land polygons but below grid/shading/pins.
  if (typeof drawPolarCap === 'function') {
    const nativeDrawPolarCap = drawPolarCap;
    drawPolarCap = function drawPolarCapWithKoreanIslands(...args) {
      drawKoreanIslands();
      return nativeDrawPolarCap.apply(this, args);
    };
  }

  if (typeof window !== 'undefined') {
    window.BRIEFING_KOREAN_ISLANDS = Object.freeze({
      jeju: Object.freeze(JEJU.map((point) => Object.freeze([...point]))),
      dokdo: Object.freeze({
        west: Object.freeze({ ...DOKDO.west }),
        east: Object.freeze({ ...DOKDO.east }),
      }),
    });
  }
})();
