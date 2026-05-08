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

    const btn = document.createElement('button');
    btn.textContent = '↻ RIALLINEA';
    btn.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999;background:#fe5000;color:#fff;border:none;padding:14px 28px;font:bold 16px ui-monospace,monospace;border-radius:8px;cursor:pointer';
    btn.onclick = () => realignSwarm(true);
    document.body.appendChild(btn);
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
  const calibMsg = document.getElementById('calibration-msg');
  calibMsg.classList.remove('hidden');

  const scene = document.querySelector('a-scene');

  const activate = () => {
    if (experienceActivated) return;
    experienceActivated = true;
    window.removeEventListener('deviceorientation', tiltHandler);
    document.getElementById('overlay').classList.add('hidden');
    realignSwarm(false);
    const swarm = document.querySelector('#swarm');
    if (DEBUG) addDebugWireframe(swarm);
    createSwarm(swarm);
  };

  // Trigger 1: tap anywhere on the calibration screen
  calibMsg.addEventListener('click', activate, { once: true });

  // Trigger 2: tilt phone to vertical (beta > 65°) — matches old AR.js "lift" gesture
  const tiltHandler = (e) => {
    if (e.beta !== null && Math.abs(e.beta) > 65) activate();
  };
  window.addEventListener('deviceorientation', tiltHandler);

  // Trigger 3: realityready may already have fired before START was clicked
  if (realityReadyFired) { activate(); return; }
  scene.addEventListener('realityready', activate);

  // Trigger 4: fallback after 4s
  setTimeout(activate, 4000);
}

// ──  Alignment  ────────────────────────────────────────────────────
// Rotates the swarm container so its X axis (butterfly flight path)
// aligns with the camera's current left-right direction. This maps the
// 18m flight axis to the physical terrace length regardless of the
// SLAM world orientation at initialization.
function realignSwarm(updateHud) {
  const swarm   = document.querySelector('#swarm');
  const sceneEl = document.querySelector('a-scene');
  if (!swarm || !sceneEl) return;

  // sceneEl.camera is the actual THREE.PerspectiveCamera that 8thwall
  // updates for rendering — more reliable than camera.object3D which
  // may not be updated by 8thwall's pipeline in world-tracking mode.
  const threeCam = sceneEl.camera;
  if (!threeCam) return;
  threeCam.updateMatrixWorld(true);

  // True horizontal yaw from the rendering camera's world quaternion.
  const q   = new THREE.Quaternion();
  threeCam.getWorldQuaternion(q);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  fwd.y = 0;
  if (fwd.lengthSq() < 0.001) return;
  fwd.normalize();
  const yawDeg = THREE.MathUtils.radToDeg(Math.atan2(fwd.x, -fwd.z));

  // World position of the actual rendering camera.
  const pos = new THREE.Vector3();
  threeCam.getWorldPosition(pos);

  swarm.setAttribute('position', `${pos.x} 0 ${pos.z}`);
  swarm.setAttribute('rotation', `0 ${yawDeg} 0`);

  const hud = document.getElementById('debug-hud');
  if (hud) hud.innerHTML =
    `<b>v4</b> · pos=(${pos.x.toFixed(1)},${pos.z.toFixed(1)}) yaw=${yawDeg.toFixed(1)}°`;
}

// ──  Swarm logic  ──────────────────────────────────────────────────
function createSwarm(swarmContainer) {
  const numButterflies = 90;

  // Physical space: 18m × 4.30m terrace.
  // User stands at QR code — centre of the 18m edge, outside the terrace.
  // Butterflies fill the rectangle in front: ±9m on X, 0.5m–4m on Z.
  const tunnelLength = 22;   // 22m: overflows 17.40m terrace by ~2m each side
  const zNear        = 0.0;  // start right at user's position
  const zFar         = 5.0;  // 5m in front: overflows 4.30m terrace
  const heightBase   = 2.5;  // metres above ground
  const heightJitter = 0.5;  // ±0.5m natural variation

  const numZSlots = 10; // depth lanes across 5m

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
function addDebugWireframe(swarmContainer) {
  // Mirror the exact constants from createSwarm
  const tunnelLength = 22;   // X: ±11m
  const zNear        = 0.0;
  const zFar         = 5.0;  // Z: 0–5m
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

  // ── Anchor marker: red sphere at swarm origin ─────────────────────
  const anchor = document.createElement('a-sphere');
  anchor.setAttribute('position', '0 0.1 0');
  anchor.setAttribute('radius', '0.25');
  anchor.setAttribute('color', '#ff0000');
  anchor.setAttribute('material', 'emissive: #ff0000; emissiveIntensity: 1');
  group.appendChild(anchor);

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

  swarmContainer.appendChild(group);

  const hud = document.getElementById('debug-hud');
  if (hud) hud.innerHTML = `<b>DEBUG</b> · box 18×4.30m · farfalle ${heightBase}m · Z ${zNear}–${zFar}m`;
}
