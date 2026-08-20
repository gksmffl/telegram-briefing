/* Design-only runtime refinements for the globe view.
 * Loaded after app.js; no data, refresh, or navigation behavior is changed.
 */
(() => {
  'use strict';

  // Small secondary land masses make the silhouette read closer to a real globe
  // without changing the main data/interaction model.
  LAND.push(
    { tone: 'temperate', pts: [[-8, 50], [-6, 55], [-4, 59], [-1, 58], [1, 53], [-2, 50]] },
    { tone: 'temperate', pts: [[-10, 52], [-9, 55], [-7, 56], [-6, 53], [-8, 51]] },
    { tone: 'temperate', pts: [[8, 44], [10, 47], [13, 47], [15, 43], [18, 40], [16, 38], [13, 41]] },
    { tone: 'desert', pts: [[67, 24], [73, 31], [79, 30], [82, 26], [86, 22], [82, 15], [78, 8], [75, 9], [72, 18]] },
    { tone: 'tropical', pts: [[94, 20], [99, 18], [103, 12], [107, 10], [108, 5], [104, 1], [100, 5], [98, 11]] },
    { tone: 'tropical', pts: [[95, 5], [101, 5], [106, 1], [112, -3], [118, -4], [116, -8], [108, -7], [101, -4]] },
    { tone: 'tropical', pts: [[119, 1], [124, 1], [127, -3], [125, -6], [120, -4]] },
    { tone: 'tropical', pts: [[47, -13], [50, -16], [50, -24], [47, -25], [45, -20]] },
    { tone: 'temperate', pts: [[166, -34], [173, -36], [176, -40], [173, -42], [168, -39]] },
    { tone: 'temperate', pts: [[166, -43], [171, -44], [174, -47], [170, -48], [167, -46]] },
    { tone: 'temperate', pts: [[-84, 10], [-82, 13], [-80, 10], [-78, 8], [-79, 6], [-82, 7]] },
    { tone: 'temperate', pts: [[-73, 20], [-69, 22], [-65, 20], [-68, 18], [-72, 18]] }
  );

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
