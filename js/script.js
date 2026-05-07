// ──  Custom component: wing color  ──────────────────────────────────
AFRAME.registerComponent('butterfly-color', {
  schema: { color: { type: 'color', default: '#ce0058' } },
  init: function () { this.el.addEventListener('model-loaded', () => this.applyColor()); },
  update: function () { this.applyColor(); },
  applyColor: function () {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh) return;
    const newColor = new THREE.Color(this.data.color);
    newColor.convertSRGBToLinear();
    mesh.traverse((node) => {
      if (node.isMesh && node.material && node.material.name === 'Wings') {
        node.material.color.copy(newColor);
        node.material.emissive.copy(newColor);
        node.material.emissiveIntensity = 15;
      }
    });
  }
});

// ──  State  ────────────────────────────────────────────────────────
let experienceActivated = false;
let realityReadyFired = false;
const DEBUG = new URLSearchParams(location.search).has('debug');

// Track realityready early in case it fires before the user clicks START
window.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('realityready', () => { realityReadyFired = true; });
  }
});

// HUD debug visibile SUBITO al load
if (DEBUG) {
  window.addEventListener('DOMContentLoaded', () => {
    const hud = document.createElement('div');
    hud.id = 'debug-hud';
    hud.style.cssText = 'position:fixed;top:10px;left:10px;z-index:9999;background:rgba(0,0,0,0.85);color:#fe5000;padding:8px 12px;font:12px ui-monospace,monospace;border:1px solid #fe5000;border-radius:4px;pointer-events:none';
    hud.innerHTML = '<b>DEBUG ON</b> · attendi START';
    document.body.appendChild(hud);
  });
}

// ──  Start flow  ───────────────────────────────────────────────────
function startExperience() {
  // iOS 13+ requires explicit permission request for DeviceOrientation
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(response => {
      if (response === 'granted') { proceed(); }
    }).catch(console.error);
  } else {
    proceed();
  }
}

function proceed() {
  document.getElementById('status-msg').classList.add('hidden');
  document.getElementById('calibration-msg').classList.remove('hidden');

  const scene = document.querySelector('a-scene');

  const activate = () => {
    if (experienceActivated) return;
    experienceActivated = true;
    document.getElementById('overlay').classList.add('hidden');
    if (DEBUG) addDebugWireframe(scene);
    createSwarm(document.querySelector('#swarm'));
  };

  // realityready may already have fired before START was clicked
  if (realityReadyFired) {
    activate();
    return;
  }

  scene.addEventListener('realityready', activate);

  // Fallback: if realityready doesn't fire within 8s, activate anyway
  setTimeout(activate, 8000);
}

// ──  Swarm logic (unchanged from original)  ────────────────────────
function createSwarm(swarmContainer) {
  const numButterflies = 90;

  // Physical space: 18m × 4.30m terrace.
  // User stands at QR code — centre of the 18m edge, outside the terrace.
  // Butterflies fill the rectangle in front: ±9m on X, 0.5m–4m on Z.
  const tunnelLength = 18;
  const zNear        = 0.5;  // 0.5m from user (just inside the terrace edge)
  const zFar         = 4.0;  // 4m in front (terrace is 4.30m deep, 0.3m margin)
  const heightBase   = 2.5;  // metres above ground
  const heightJitter = 0.5;  // ±0.5m natural variation

  const numZSlots = 10; // depth lanes across 3.5m

  const zSlots = Array.from({length: numZSlots}, (_, c) =>
    -(zNear + (c / (numZSlots - 1)) * (zFar - zNear))
  );

  for (let i = 0; i < numButterflies; i++) {
    const butterfly = document.createElement('a-entity');
    const z = zSlots[i % numZSlots];
    const y = heightBase + (Math.random() * 2 - 1) * heightJitter;

    butterfly.setAttribute('gltf-model', '#butterflyModel');
    butterfly.setAttribute('animation-mixer', 'clip: Flying');
    butterfly.setAttribute('scale', '0.2 0.15 0.2');
    butterfly.setAttribute('butterfly-color', 'color: #ce0058');

    const resetButterfly = (el, isFirstSpawn = false) => {
      const startX = tunnelLength / 2;
      const endX   = -(tunnelLength / 2);
      const currentSpawnX = isFirstSpawn ? (Math.random() * tunnelLength - startX) : startX;
      const moveDuration  = Math.random() * 4000 + 10000;
      const distanceRatio = isFirstSpawn ? Math.abs(currentSpawnX - endX) / tunnelLength : 1;
      const currentDuration = moveDuration * distanceRatio;

      el.setAttribute('position', `${currentSpawnX} ${y} ${z}`);
      el.setAttribute('rotation', '0 -90 0');

      el.setAttribute('animation__move', {
        property: 'position',
        to: `${endX} ${y} ${z}`,
        dur: currentDuration,
        easing: 'linear'
      });

      el.setAttribute('animation__color', {
        property: 'butterfly-color.color',
        from: '#ce0058',
        to: '#fe5000',
        dur: currentDuration * 0.5,
        easing: 'linear',
        loop: false
      });
    };

    butterfly.addEventListener('animationcomplete__move', () => resetButterfly(butterfly, false));
    swarmContainer.appendChild(butterfly);
    resetButterfly(butterfly, true);
  }
}

// ──  Debug wireframe overlay (?debug in URL)  ──────────────────────
function addDebugWireframe(scene) {
  // Mirror the exact constants from createSwarm
  const tunnelLength = 18;   // X: ±9m
  const zNear        = 0.5;
  const zFar         = 4.0;  // Z: 0.5m–4m
  const heightBase   = 2.5;
  const heightJitter = 0.5;
  const numZSlots    = 10;

  const depthSpan = zFar - zNear;                      // 3.5m
  const centerZ   = -(zNear + depthSpan / 2);          // -2.25m
  const centerY   = heightBase;                         // above SLAM ground (Y=0)
  const boxHeight = heightJitter * 2;                   // 1m band

  const group = document.createElement('a-entity');
  group.id = 'debug-wireframe';

  // ── Flight volume box ──────────────────────────────────────────────
  const box = document.createElement('a-box');
  box.setAttribute('position', `0 ${centerY} ${centerZ}`);
  box.setAttribute('width',  tunnelLength);
  box.setAttribute('height', boxHeight);
  box.setAttribute('depth',  depthSpan);
  box.setAttribute('material', 'color: #fe5000; wireframe: true; opacity: 1');
  group.appendChild(box);

  // ── Ground footprint (physical terrace outline) ────────────────────
  const groundZ = -(zNear + depthSpan / 2);
  const floor = document.createElement('a-box');
  floor.setAttribute('position', `0 0.01 ${groundZ}`);
  floor.setAttribute('width',  tunnelLength);
  floor.setAttribute('height', 0.02);
  floor.setAttribute('depth',  depthSpan);
  floor.setAttribute('material', 'color: #00aaff; wireframe: true; opacity: 1');
  group.appendChild(floor);

  // ── Axis arrows ────────────────────────────────────────────────────
  ['x:1 0 0:#ff0000', 'y:0 1 0:#00ff00', 'z:0 0 -1:#0066ff'].forEach(s => {
    const [, dir, color] = s.split(':');
    const [dx, dy, dz] = dir.split(' ').map(Number);
    const line = document.createElement('a-entity');
    line.setAttribute('line', `start: 0 0 0; end: ${dx * 3} ${dy * 3} ${dz * 3}; color: ${color}`);
    group.appendChild(line);
  });

  // ── Entry/exit cones ───────────────────────────────────────────────
  const start = document.createElement('a-cone');
  start.setAttribute('position', `${tunnelLength / 2} ${centerY} ${centerZ}`);
  start.setAttribute('rotation', '0 0 -90');
  start.setAttribute('radius-bottom', '0.3');
  start.setAttribute('radius-top', '0');
  start.setAttribute('height', '0.6');
  start.setAttribute('color', '#00ff00');
  group.appendChild(start);

  const end = document.createElement('a-cone');
  end.setAttribute('position', `${-(tunnelLength / 2)} ${centerY} ${centerZ}`);
  end.setAttribute('rotation', '0 0 90');
  end.setAttribute('radius-bottom', '0.3');
  end.setAttribute('radius-top', '0');
  end.setAttribute('height', '0.6');
  end.setAttribute('color', '#ff5500');
  group.appendChild(end);

  // ── Z-slot depth markers ───────────────────────────────────────────
  for (let c = 0; c < numZSlots; c++) {
    const z = -(zNear + (c / (numZSlots - 1)) * depthSpan);
    const dot = document.createElement('a-sphere');
    dot.setAttribute('position', `0 ${centerY} ${z}`);
    dot.setAttribute('radius', '0.06');
    dot.setAttribute('color', '#888');
    dot.setAttribute('material', 'opacity: 0.7; emissive: #444; emissiveIntensity: 0.5');
    group.appendChild(dot);
  }

  scene.appendChild(group);

  const hud = document.getElementById('debug-hud');
  if (hud) hud.innerHTML = `<b>DEBUG</b> · box 18×4.30m · farfalle ${heightBase}m · Z ${zNear}–${zFar}m`;
}
