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
  const cameraHeight = 1.6; // meters, typical user eye height

  const numButterflies = 90;

  // Tunnel: 28m along X axis (butterflies fly right→left past the user).
  // Depth (Z): butterflies spread 0.5m–3m in front — close enough to see well.
  // Height: 2m above SLAM origin (y=0 ≈ ground in 8thwall), ±0.4m natural jitter.
  const tunnelLength = 28;
  const zNear        = 0.5;  // closest butterflies 0.5m in front
  const zFar         = 8.0;  // farthest butterflies 8m in front (expanded volume)
  const heightBase   = 3.5;  // metres above ground (raised flight altitude)
  const heightJitter = 0.6;  // ±0.6m natural variation

  const numZSlots = 13; // depth lanes

  const zSlots = Array.from({length: numZSlots}, (_, c) =>
    -(zNear + (c / (numZSlots - 1)) * (zFar - zNear))
  );

  for (let i = 0; i < numButterflies; i++) {
    const butterfly = document.createElement('a-entity');
    const z = zSlots[i % numZSlots];
    const y = (heightBase + (Math.random() * 2 - 1) * heightJitter) - cameraHeight;

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
  const tunnelLength = 28;
  const tunnelWidth  = 7.5;
  const povDistance  = 1;
  const cameraHeight = 1.6;
  const heightBase   = 2.0;
  const numZSlots    = 13;

  const centerY = heightBase - cameraHeight;           // 0.4m above SLAM origin
  const centerZ = -(povDistance + tunnelWidth / 2);    // -4.75m

  const group = document.createElement('a-entity');
  group.id = 'debug-wireframe';

  // Wireframe box showing the butterfly volume
  const box = document.createElement('a-box');
  box.setAttribute('position', `0 ${centerY} ${centerZ}`);
  box.setAttribute('width', tunnelLength);  // X: 28m flight path
  box.setAttribute('height', 0.8);          // Y: ±0.4m jitter band
  box.setAttribute('depth', tunnelWidth);   // Z: 7.5m depth spread
  box.setAttribute('material', 'color: #fe5000; wireframe: true; opacity: 1');
  group.appendChild(box);

  ['x:1 0 0:#ff0000', 'y:0 1 0:#00ff00', 'z:0 0 -1:#0066ff'].forEach(s => {
    const [, dir, color] = s.split(':');
    const [dx, dy, dz] = dir.split(' ').map(Number);
    const line = document.createElement('a-entity');
    line.setAttribute('line', `start: 0 0 0; end: ${dx * 2} ${dy * 2} ${dz * 2}; color: ${color}`);
    group.appendChild(line);
  });

  // Green cone = butterflies enter from right (+X), orange = exit left (-X)
  const start = document.createElement('a-cone');
  start.setAttribute('position', `${tunnelLength / 2} ${centerY} ${centerZ}`);
  start.setAttribute('rotation', '0 0 -90');
  start.setAttribute('radius-bottom', '0.3');
  start.setAttribute('radius-top', '0');
  start.setAttribute('height', '0.8');
  start.setAttribute('color', '#00ff00');
  group.appendChild(start);

  const end = document.createElement('a-cone');
  end.setAttribute('position', `${-(tunnelLength / 2)} ${centerY} ${centerZ}`);
  end.setAttribute('rotation', '0 0 90');
  end.setAttribute('radius-bottom', '0.3');
  end.setAttribute('radius-top', '0');
  end.setAttribute('height', '0.8');
  end.setAttribute('color', '#ff5500');
  group.appendChild(end);

  // Dots at each Z slot depth
  for (let c = 0; c < numZSlots; c++) {
    const z = -((c / (numZSlots - 1)) * tunnelWidth + povDistance);
    const dot = document.createElement('a-sphere');
    dot.setAttribute('position', `0 ${centerY} ${z}`);
    dot.setAttribute('radius', '0.07');
    dot.setAttribute('color', '#888');
    dot.setAttribute('material', 'opacity: 0.6; emissive: #444; emissiveIntensity: 0.5');
    group.appendChild(dot);
  }

  scene.appendChild(group);

  const hud = document.getElementById('debug-hud');
  if (hud) hud.innerHTML = `<b>DEBUG ON</b> · farfalle a ${heightBase}m suolo · volo ±X 28m · profondità Z 7.5m`;
}
