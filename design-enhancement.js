/* Design-only runtime refinements for the globe view.
 * Loaded after app.js; no data, refresh, or navigation behavior is changed.
 */
(() => {
  'use strict';

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

  // Keep the current geography, but render coastlines with a softer, layered edge
  // so the simplified polygons read less like flat vector shapes.
  drawLand = function enhancedDrawLand(land) {
    const g = globe.ctx;
    const tone = LAND_TONE[land.tone] || LAND_TONE.temperate;
    const closed = land.pts.concat([land.pts[0]]);
    let run = [];

    const drawRun = () => {
      if (run.length <= 2) { run = []; return; }

      g.save();
      g.beginPath();
      g.moveTo(run[0].sx, run[0].sy);

      for (let i = 1; i < run.length - 1; i += 1) {
        const current = run[i];
        const next = run[i + 1];
        const mx = (current.sx + next.sx) / 2;
        const my = (current.sy + next.sy) / 2;
        g.quadraticCurveTo(current.sx, current.sy, mx, my);
      }

      const last = run[run.length - 1];
      g.lineTo(last.sx, last.sy);
      g.closePath();

      const landGlow = g.createLinearGradient(
        globe.cx - globe.r * .55,
        globe.cy - globe.r * .7,
        globe.cx + globe.r * .6,
        globe.cy + globe.r * .65,
      );
      landGlow.addColorStop(0, tone.line);
      landGlow.addColorStop(.2, tone.fill);
      landGlow.addColorStop(.75, tone.fill);
      landGlow.addColorStop(1, 'rgba(29, 45, 40, .72)');
      g.fillStyle = landGlow;
      g.fill();

      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(214, 234, 213, .28)';
      g.lineWidth = 1.05;
      g.stroke();

      g.strokeStyle = 'rgba(5, 17, 25, .24)';
      g.lineWidth = 2.5;
      g.globalCompositeOperation = 'multiply';
      g.stroke();
      g.restore();

      run = [];
    };

    closed.forEach(([lon, lat]) => {
      const p = project(lat, lon);
      if (p.front) run.push(p);
      else drawRun();
    });
    drawRun();
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
      const core = on ? '#ffd166' : '#a9e7ff';

      const glow = g.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 18 + pulse * 7);
      glow.addColorStop(0, on ? 'rgba(255, 209, 102, .34)' : 'rgba(143, 220, 255, .34)');
      glow.addColorStop(.42, on ? 'rgba(255, 209, 102, .12)' : 'rgba(143, 220, 255, .12)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(p.sx, p.sy, 18 + pulse * 7, 0, Math.PI * 2);
      g.fill();

      g.beginPath();
      g.arc(p.sx, p.sy, on ? 5.2 : 4.6, 0, Math.PI * 2);
      g.fillStyle = core;
      g.shadowColor = core;
      g.shadowBlur = on ? 14 : 10;
      g.fill();
      g.shadowBlur = 0;

      g.beginPath();
      g.arc(p.sx, p.sy, 9 + pulse * 8, 0, Math.PI * 2);
      g.strokeStyle = on
        ? 'rgba(255, 209, 102, ' + (0.56 - pulse * .38) + ')'
        : 'rgba(143, 220, 255, ' + (0.5 - pulse * .34) + ')';
      g.lineWidth = 1.35;
      g.stroke();
    });
  };
})();
