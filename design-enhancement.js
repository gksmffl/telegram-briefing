/* Design-only runtime refinements for the globe view.
 * Loaded after app.js; no briefing data, refresh, or navigation behavior is changed.
 */
(() => {
  'use strict';

  const NATURAL_EARTH_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
  let naturalEarthRings = [];
  let naturalEarthReady = false;

  const CLOUD_PATCHES = [
    { lat: 43, lon: -145, w: .16, h: .045, rot: -.25, a: .09 },
    { lat: 18, lon: -116, w: .12, h: .035, rot: .12, a: .08 },
    { lat: 4, lon: -48, w: .18, h: .038, rot: -.10, a: .075 },
    { lat: 50, lon: -8, w: .14, h: .04, rot: .20, a: .07 },
    { lat: 7, lon: 18, w: .16, h: .038, rot: -.16, a: .07 },
    { lat: -18, lon: 36, w: .12, h: .032, rot: .25, a: .065 },
    { lat: 28, lon: 73, w: .15, h: .035, rot: -.18, a: .07 },
    { lat: 8, lon: 112, w: .18, h: .04, rot: .13, a: .08 },
    { lat: 39, lon: 150, w: .14, h: .036, rot: -.20, a: .08 },
    { lat: -34, lon: 146, w: .13, h: .034, rot: .18, a: .065 },
  ];

  function decodeArc(topology, arcIndex) {
    const reverse = arcIndex < 0;
    const source = topology.arcs[reverse ? ~arcIndex : arcIndex] || [];
    const transform = topology.transform;
    let x = 0;
    let y = 0;

    const points = source.map(([dx, dy]) => {
      x += dx;
      y += dy;
      if (!transform) return [x, y];
      return [
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ];
    });

    return reverse ? points.reverse() : points;
  }

  function stitchRing(topology, arcIndexes) {
    const ring = [];
    arcIndexes.forEach((arcIndex, index) => {
      const points = decodeArc(topology, arcIndex);
      if (index > 0 && points.length) points.shift();
      ring.push(...points);
    });
    return ring;
  }

  function collectExteriorRings(topology) {
    const countries = topology.objects && topology.objects.countries;
    if (!countries || !Array.isArray(countries.geometries)) return [];

    const rings = [];
    countries.geometries.forEach((geometry) => {
      if (geometry.type === 'Polygon') {
        const exterior = geometry.arcs && geometry.arcs[0];
        if (Array.isArray(exterior)) rings.push(stitchRing(topology, exterior));
        return;
      }

      if (geometry.type === 'MultiPolygon') {
        (geometry.arcs || []).forEach((polygon) => {
          const exterior = polygon && polygon[0];
          if (Array.isArray(exterior)) rings.push(stitchRing(topology, exterior));
        });
      }
    });

    return rings.filter((ring) => ring.length >= 3);
  }

  async function loadNaturalEarthMap() {
    try {
      const response = await fetch(NATURAL_EARTH_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Natural Earth map request failed: ' + response.status);
      const topology = await response.json();
      const rings = collectExteriorRings(topology);
      if (!rings.length) throw new Error('Natural Earth map contained no renderable rings.');
      naturalEarthRings = rings;
      naturalEarthReady = true;
      document.documentElement.classList.add('natural-earth-ready');
    } catch (error) {
      // The original hand-authored LAND geometry remains a full offline fallback.
      console.warn('[design-enhancement] Natural Earth fallback in use.', error);
    }
  }

  const originalBuildPins = buildPins;

  buildPins = function enhancedBuildPins() {
    originalBuildPins();

    REGIONS.forEach((rg) => {
      const pin = document.getElementById('pin-' + rg.id);
      if (!pin || pin.querySelector('.pin-en')) return;

      const name = pin.querySelector('.pin-name');
      const en = document.createElement('span');
      en.className = 'pin-en';
      en.textContent = rg.en;
      if (name && name.nextSibling) pin.insertBefore(en, name.nextSibling);
      else pin.appendChild(en);
    });
  };

  function globeLandGradient() {
    const g = globe.ctx;
    const gradient = g.createLinearGradient(
      globe.cx - globe.r * .75,
      globe.cy - globe.r * .75,
      globe.cx + globe.r * .7,
      globe.cy + globe.r * .7,
    );
    gradient.addColorStop(0, '#9ab792');
    gradient.addColorStop(.24, '#708f70');
    gradient.addColorStop(.52, '#7d8661');
    gradient.addColorStop(.72, '#596d59');
    gradient.addColorStop(1, '#35483f');
    return gradient;
  }

  function drawProjectedRun(points, fillStyle, strokeStyle, lineWidth) {
    if (points.length < 3) return;
    const g = globe.ctx;
    g.beginPath();
    g.moveTo(points[0].sx, points[0].sy);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].sx, points[i].sy);
    g.closePath();
    g.fillStyle = fillStyle;
    g.fill();
    g.strokeStyle = strokeStyle;
    g.lineWidth = lineWidth;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }

  function drawNaturalEarthRing(ring, fillStyle) {
    let run = [];

    const flush = () => {
      drawProjectedRun(run, fillStyle, 'rgba(220, 235, 218, .18)', .55);
      run = [];
    };

    ring.forEach(([lon, lat]) => {
      const point = project(lat, lon);
      if (point.front) run.push(point);
      else flush();
    });
    flush();
  }

  function drawNaturalEarthLand() {
    const g = globe.ctx;
    const fill = globeLandGradient();
    g.save();
    g.beginPath();
    g.arc(globe.cx, globe.cy, globe.r, 0, Math.PI * 2);
    g.clip();
    naturalEarthRings.forEach((ring) => drawNaturalEarthRing(ring, fill));
    g.restore();
  }

  // Offline fallback: keep the original polygons but soften their edges.
  drawLand = function enhancedFallbackLand(land) {
    const g = globe.ctx;
    const tone = LAND_TONE[land.tone] || LAND_TONE.temperate;
    const closed = land.pts.concat([land.pts[0]]);
    let run = [];

    const flush = () => {
      if (run.length > 2) {
        drawProjectedRun(run, tone.fill, tone.line, .8);
      }
      run = [];
    };

    closed.forEach(([lon, lat]) => {
      const point = project(lat, lon);
      if (point.front) run.push(point);
      else flush();
    });
    flush();
  };

  function drawOceanTexture() {
    const g = globe.ctx;
    const { cx, cy, r } = globe;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();

    const sheen = g.createRadialGradient(
      cx - r * .4,
      cy - r * .46,
      r * .03,
      cx - r * .28,
      cy - r * .34,
      r * .72,
    );
    sheen.addColorStop(0, 'rgba(164, 216, 255, .16)');
    sheen.addColorStop(.3, 'rgba(89, 167, 222, .06)');
    sheen.addColorStop(1, 'rgba(30, 90, 155, 0)');
    g.fillStyle = sheen;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);

    g.strokeStyle = 'rgba(139, 205, 242, .035)';
    g.lineWidth = .7;
    for (let y = -0.55; y <= .55; y += .18) {
      g.beginPath();
      g.ellipse(cx - r * .08, cy + r * y, r * .65, r * .055, -.05, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawCloudLayer() {
    const g = globe.ctx;
    const { cx, cy, r } = globe;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r * .995, 0, Math.PI * 2);
    g.clip();

    CLOUD_PATCHES.forEach((cloud) => {
      const p = project(cloud.lat, cloud.lon);
      if (!p.front) return;

      g.save();
      g.translate(p.sx, p.sy);
      g.rotate(cloud.rot);
      const width = r * cloud.w;
      const height = r * cloud.h;

      for (let i = -1; i <= 1; i += 1) {
        g.beginPath();
        g.ellipse(i * width * .22, i * height * .12, width * .52, height, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(244, 249, 255, ' + (cloud.a * (1 - Math.abs(i) * .18)) + ')';
        g.fill();
      }
      g.restore();
    });

    g.restore();
  }

  function drawSurfaceLighting() {
    const g = globe.ctx;
    const { cx, cy, r } = globe;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();

    const daylight = g.createRadialGradient(
      cx - r * .44,
      cy - r * .48,
      r * .04,
      cx - r * .18,
      cy - r * .2,
      r * 1.02,
    );
    daylight.addColorStop(0, 'rgba(255, 255, 242, .14)');
    daylight.addColorStop(.35, 'rgba(174, 214, 244, .055)');
    daylight.addColorStop(.7, 'rgba(34, 62, 91, .02)');
    daylight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalCompositeOperation = 'screen';
    g.fillStyle = daylight;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);

    g.globalCompositeOperation = 'source-over';
    const limb = g.createRadialGradient(
      cx - r * .3,
      cy - r * .34,
      r * .18,
      cx + r * .08,
      cy + r * .1,
      r * 1.12,
    );
    limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
    limb.addColorStop(.5, 'rgba(2, 8, 18, .04)');
    limb.addColorStop(.78, 'rgba(1, 6, 16, .26)');
    limb.addColorStop(.94, 'rgba(0, 4, 12, .58)');
    limb.addColorStop(1, 'rgba(0, 3, 10, .76)');
    g.fillStyle = limb;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);

    const nightSide = g.createLinearGradient(cx - r * .65, cy - r * .75, cx + r * .85, cy + r * .72);
    nightSide.addColorStop(0, 'rgba(8, 19, 38, 0)');
    nightSide.addColorStop(.52, 'rgba(5, 13, 29, .02)');
    nightSide.addColorStop(.76, 'rgba(1, 7, 19, .14)');
    nightSide.addColorStop(1, 'rgba(0, 3, 12, .38)');
    g.fillStyle = nightSide;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
  }

  drawGlobe = function realisticDrawGlobe() {
    const g = globe.ctx;
    const { cx, cy, r } = globe;
    g.clearRect(0, 0, globe.w, globe.h);

    // Atmospheric halo outside the sphere.
    const halo = g.createRadialGradient(cx, cy, r * .91, cx, cy, r * 1.24);
    halo.addColorStop(0, 'rgba(114, 188, 255, .2)');
    halo.addColorStop(.22, 'rgba(90, 151, 234, .12)');
    halo.addColorStop(.55, 'rgba(69, 111, 204, .045)');
    halo.addColorStop(1, 'rgba(32, 65, 143, 0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(cx, cy, r * 1.24, 0, Math.PI * 2);
    g.fill();

    // Deep ocean with the light source offset toward the upper-left.
    const sea = g.createRadialGradient(cx - r * .38, cy - r * .43, r * .04, cx, cy, r * 1.04);
    sea.addColorStop(0, '#397ab5');
    sea.addColorStop(.3, '#235d94');
    sea.addColorStop(.58, '#174574');
    sea.addColorStop(.82, '#0e305a');
    sea.addColorStop(1, '#071a37');
    g.fillStyle = sea;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();

    drawOceanTexture();

    if (naturalEarthReady) drawNaturalEarthLand();
    else LAND.forEach(drawLand);

    drawPolarCap();

    // Keep the dashboard grid, but make it faint enough not to flatten the globe.
    g.strokeStyle = 'rgba(205, 230, 250, .085)';
    g.lineWidth = .55;
    for (let lat = -60; lat <= 60; lat += 30) drawParallel(lat);
    for (let lon = 0; lon < 360; lon += 30) drawMeridian(lon);

    drawCloudLayer();
    drawSurfaceLighting();

    // Bright atmospheric rim on the sun-facing edge.
    const rim = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rim.addColorStop(0, 'rgba(195, 231, 255, .64)');
    rim.addColorStop(.35, 'rgba(130, 199, 246, .35)');
    rim.addColorStop(.72, 'rgba(79, 135, 210, .14)');
    rim.addColorStop(1, 'rgba(46, 86, 163, .08)');
    g.strokeStyle = rim;
    g.lineWidth = 1.25;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = 'rgba(158, 211, 255, .13)';
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(cx, cy, r + 1.6, Math.PI * .72, Math.PI * 1.72);
    g.stroke();

    drawLink();
    drawPins();
  };

  drawPins = function enhancedDrawPins() {
    const g = globe.ctx;
    const t = Date.now() / 1000;

    REGIONS.forEach((rg) => {
      const p = project(rg.lat, rg.lon);
      const node = document.getElementById('pin-' + rg.id);
      if (!node) return;
      syncRegionList(rg.id, p.front);

      if (!p.front) {
        node.classList.add('is-back');
        node.style.left = '-999px';
        return;
      }

      node.classList.remove('is-back');
      node.style.left = p.sx + 'px';
      node.style.top = p.sy + 'px';

      const on = state.region === rg.id;
      const pulse = (Math.sin(t * 2 + rg.lon) + 1) / 2;
      const core = on ? '#ffd166' : '#b5ebff';

      const glow = g.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 20 + pulse * 8);
      glow.addColorStop(0, on ? 'rgba(255, 209, 102, .38)' : 'rgba(143, 220, 255, .34)');
      glow.addColorStop(.42, on ? 'rgba(255, 209, 102, .13)' : 'rgba(143, 220, 255, .11)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(p.sx, p.sy, 20 + pulse * 8, 0, Math.PI * 2);
      g.fill();

      g.beginPath();
      g.arc(p.sx, p.sy, on ? 5.4 : 4.8, 0, Math.PI * 2);
      g.fillStyle = core;
      g.shadowColor = core;
      g.shadowBlur = on ? 15 : 11;
      g.fill();
      g.shadowBlur = 0;

      g.beginPath();
      g.arc(p.sx, p.sy, 10 + pulse * 8, 0, Math.PI * 2);
      g.strokeStyle = on
        ? 'rgba(255, 209, 102, ' + (0.56 - pulse * .38) + ')'
        : 'rgba(143, 220, 255, ' + (0.5 - pulse * .34) + ')';
      g.lineWidth = 1.4;
      g.stroke();
    });
  };

  loadNaturalEarthMap();
})();
