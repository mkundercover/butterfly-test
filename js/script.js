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

  const tunnelLength = 28;
  const tunnelWidth = 7.5;
  const tunnelHeight = 3.3;
  const groundOffset = 0.5;
  const povDistance = 1;

  const rows = 12;
  const cols = 13;

  let grid = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid.push({
        y: (r / (rows - 1)) * tunnelHeight + groundOffset,
        z: -((c / (cols - 1)) * tunnelWidth + povDistance)
      });
    }
  }
  grid.sort(() => Math.random() - 0.5);

  for (let i = 0; i < numButterflies; i++) {
    let butterfly = document.createElement('a-entity');
    const slot = grid[i % grid.length];

    butterfly.setAttribute('gltf-model', '#butterflyModel');
    butterfly.setAttribute('animation-mixer', 'clip: Flying');
    butterfly.setAttribute('scale', '0.2 0.15 0.2');
    butterfly.setAttribute('butterfly-color', 'color: #ce0058');

    const resetButterfly = (el, isFirstSpawn = false) => {
      const startX = tunnelLength / 2;
      const endX = -(tunnelLength / 2);
      const currentSpawnX = isFirstSpawn ? (Math.random() * tunnelLength - startX) : startX;
      const moveDuration = Math.random() * 4000 + 10000;
      const distanceRatio = isFirstSpawn ? Math.abs(currentSpawnX - endX) / tunnelLength : 1;
      const currentDuration = moveDuration * distanceRatio;

      el.setAttribute('position', `${currentSpawnX} ${slot.y} ${slot.z}`);
      el.setAttribute('rotation', '0 -90 0');

      el.setAttribute('animation__move', {
        property: 'position',
        to: `${endX} ${slot.y} ${slot.z}`,
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

    butterfly.addEventListener('animationcomplete__move', () => {
      resetButterfly(butterfly, false);
    });

    swarmContainer.appendChild(butterfly);
    resetButterfly(butterfly, true);
  }
}

// ──  Debug wireframe overlay (?debug in URL)  ──────────────────────
function addDebugWireframe(scene) {
  const tunnelLength = 28;
  const tunnelWidth = 7.5;
  const tunnelHeight = 3.3;
  const groundOffset = 0.5;
  const povDistance = 1;
  const rows = 12, cols = 13;

  const group = document.createElement('a-entity');
  group.id = 'debug-wireframe';

  const box = document.createElement('a-box');
  box.setAttribute('position', `0 ${(groundOffset + tunnelHeight + groundOffset) / 2} ${-(povDistance + tunnelWidth / 2)}`);
  box.setAttribute('width', tunnelLength);
  box.setAttribute('height', tunnelHeight);
  box.setAttribute('depth', tunnelWidth);
  box.setAttribute('material', 'color: #fe5000; wireframe: true; opacity: 1');
  group.appendChild(box);

  ['x:1 0 0:#ff0000', 'y:0 1 0:#00ff00', 'z:0 0 -1:#0066ff'].forEach(s => {
    const [, dir, color] = s.split(':');
    const [dx, dy, dz] = dir.split(' ').map(Number);
    const line = document.createElement('a-entity');
    line.setAttribute('line', `start: 0 0 0; end: ${dx * 2} ${dy * 2} ${dz * 2}; color: ${color}`);
    group.appendChild(line);
  });

  const start = document.createElement('a-cone');
  start.setAttribute('position', `14 2 -4.75`);
  start.setAttribute('rotation', '0 0 -90');
  start.setAttribute('radius-bottom', '0.3');
  start.setAttribute('radius-top', '0');
  start.setAttribute('height', '0.8');
  start.setAttribute('color', '#00ff00');
  group.appendChild(start);

  const end = document.createElement('a-cone');
  end.setAttribute('position', `-14 2 -4.75`);
  end.setAttribute('rotation', '0 0 90');
  end.setAttribute('radius-bottom', '0.3');
  end.setAttribute('radius-top', '0');
  end.setAttribute('height', '0.8');
  end.setAttribute('color', '#ff5500');
  group.appendChild(end);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const y = (r / (rows - 1)) * tunnelHeight + groundOffset;
      const z = -((c / (cols - 1)) * tunnelWidth + povDistance);
      const dot = document.createElement('a-sphere');
      dot.setAttribute('position', `0 ${y} ${z}`);
      dot.setAttribute('radius', '0.05');
      dot.setAttribute('color', '#888');
      dot.setAttribute('material', 'opacity: 0.5; emissive: #444; emissiveIntensity: 0.5');
      group.appendChild(dot);
    }
  }

  scene.appendChild(group);

  const hud = document.getElementById('debug-hud');
  if (hud) hud.innerHTML = '<b>DEBUG ON</b> · tunnel 28×7.5×3.3 · X rosso · Y verde · -Z blu (8thwall SLAM)';
}
