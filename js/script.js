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
let trackingIsNormal = false;
const DEBUG = new URLSearchParams(location.search).has('debug');

// Track realityready and tracking status
window.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('realityready', () => { realityReadyFired = true; });
    
    // Listen for tracking status changes
    scene.addEventListener('xartracking', (event) => {
      if (event.detail.status === 'NORMAL') {
        trackingIsNormal = true;
        const statusIcon = document.querySelector('.scan-animation');
        if (statusIcon) statusIcon.style.background = '#00ff00'; // Green = ready
      } else {
        trackingIsNormal = false;
        const statusIcon = document.querySelector('.scan-animation');
        if (statusIcon) statusIcon.style.background = '#fe5000'; // Orange = searching
      }
    });
  }
});

// ... (HUD code remains the same) ...

function proceed() {
  document.getElementById('status-msg').classList.add('hidden');
  const calibMsg = document.getElementById('calibration-msg');
  calibMsg.classList.remove('hidden');

  const activate = () => {
    if (experienceActivated) return;
    
    // Safety: don't activate if tracking isn't at least decent, unless forced by tap
    if (!trackingIsNormal && !realityReadyFired) {
      console.log('Waiting for stable tracking...');
      return;
    }

    experienceActivated = true;
    window.removeEventListener('deviceorientation', tiltHandler);
    
    // Change UI to "Locking..." state
    calibMsg.innerHTML = '<h2>SINCRO IN CORSO...</h2><p>Resta immobile un istante</p>';
    
    // Wait for the sensors to stabilize (Crucial to prevent the 20deg drift)
    setTimeout(() => {
      document.getElementById('overlay').classList.add('hidden');
      
      // Perform the one-time alignment
      realignSwarm(false);
      
      const swarm = document.querySelector('#swarm');
      if (DEBUG) addDebugWireframe(swarm);
      createSwarm(swarm);
      
      console.log('AR Tunnel Locked and Loaded');
    }, 800);
  };

  // Trigger 1: tap anywhere
  calibMsg.addEventListener('click', activate);

  // Trigger 2: tilt phone to vertical
  const tiltHandler = (e) => {
    if (e.beta !== null && Math.abs(e.beta) > 70 && trackingIsNormal) activate();
  };
  window.addEventListener('deviceorientation', tiltHandler);

  // Trigger 3: automatic fallback ONLY if tracking is solid
  const checkReady = setInterval(() => {
    if (trackingIsNormal && realityReadyFired && experienceActivated === false) {
      // Optional: could auto-activate here, but let's wait for tilt or tap for better UX
    }
  }, 500);
  
  // Hard fallback to ensure user isn't stuck
  setTimeout(() => { clearInterval(checkReady); activate(); }, 15000);
}

// ──  Alignment  ────────────────────────────────────────────────────
function realignSwarm(updateHud) {
  const swarm   = document.querySelector('#swarm');
  const sceneEl = document.querySelector('a-scene');
  if (!swarm || !sceneEl) return;

  const threeCam = sceneEl.camera;
  if (!threeCam) return;
  
  threeCam.updateMatrixWorld(true);

  // Get stable world position and orientation
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  threeCam.matrixWorld.decompose(pos, q, scale);

  // Direction vector (looking forward)
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  fwd.y = 0; 
  fwd.normalize();

  // Robust Yaw calculation
  let yawDeg = THREE.MathUtils.radToDeg(Math.atan2(fwd.x, -fwd.z));

  // Anchor the swarm EXACTLY where the user is, but on the floor (Y=0)
  // This ensures you are at the center of the edge.
  swarm.setAttribute('position', `${pos.x} 0 ${pos.z}`);
  swarm.setAttribute('rotation', `0 ${yawDeg} 0`);
  
  // Force the swarm to be a top-level world object
  swarm.object3D.updateMatrixWorld(true);

  const hud = document.getElementById('debug-hud');
  if (hud) {
    hud.innerHTML = `<b>v6-LOCKED</b> · pos=(${pos.x.toFixed(2)},${pos.z.toFixed(2)}) yaw=${yawDeg.toFixed(1)}°`;
  }
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
