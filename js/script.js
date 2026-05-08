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
        if (statusIcon) statusIcon.style.background = '#00ff00'; // Green = calibrated
      } else {
        trackingIsNormal = false;
        const statusIcon = document.querySelector('.scan-animation');
        if (statusIcon) statusIcon.style.background = '#fe5000'; // Orange = calibrating
      }
    });
  }
});

// HUD debug
if (DEBUG) {
  window.addEventListener('DOMContentLoaded', () => {
    const hud = document.createElement('div');
    hud.id = 'debug-hud';
    hud.style.cssText = 'position:fixed;top:10px;left:10px;z-index:9999;background:rgba(0,0,0,0.85);color:#00ff00;padding:8px 12px;font:12px monospace;border:1px solid #00ff00;border-radius:4px;pointer-events:none';
    hud.innerHTML = '<b>DEBUG V8</b> · in attesa';
    document.body.appendChild(hud);
  });
}

// ──  Start flow  ───────────────────────────────────────────────────
function startExperience() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(response => {
      if (response === 'granted') { proceed(); }
      else { proceed(); }
    }).catch(() => proceed());
  } else {
    proceed();
  }
}

function proceed() {
  document.getElementById('status-msg').classList.add('hidden');
  const calibMsg = document.getElementById('calibration-msg');
  calibMsg.classList.remove('hidden');

  const activate = (forced = false) => {
    if (experienceActivated) return;
    
    // We strictly wait for NORMAL tracking to ensure scale (meters) is correct
    if (!forced && !trackingIsNormal) {
      console.log('Waiting for NORMAL tracking status...');
      return;
    }

    experienceActivated = true;
    window.removeEventListener('deviceorientation', tiltHandler);
    
    calibMsg.innerHTML = '<h2>ANCORAGGIO...</h2><p>Resta immobile, sto fissando il tunnel a terra</p>';
    
    // 1. RECENTER: This is the magic. It makes your current position 0,0,0 and your yaw 0.
    if (window.XR8) {
      window.XR8.XrController.recenter();
    }

    // 2. WAIT: Let the SLAM engine settle after recenter
    setTimeout(() => {
      document.getElementById('overlay').classList.add('hidden');
      
      const swarm = document.querySelector('#swarm');
      
      // 3. POSITION: Since we recentered, 0 0 0 is exactly where you are standing.
      swarm.setAttribute('position', '0 0 0');
      swarm.setAttribute('rotation', '0 0 0');
      
      if (DEBUG) addDebugWireframe(swarm);
      createSwarm(swarm);
      
      console.log('AR World Anchored at 0,0,0');
    }, 1000);
  };

  // Tap forces activation even if tracking isn't "perfect"
  calibMsg.addEventListener('click', () => activate(true));

  // Vertical tilt activates ONLY if tracking is stable (for best quality)
  const tiltHandler = (e) => {
    if (e.beta !== null && Math.abs(e.beta) > 75 && trackingIsNormal) activate(false);
  };
  window.addEventListener('deviceorientation', tiltHandler);

  // Auto-activate if perfect tracking is found and user is already vertical
  const checkReady = setInterval(() => {
    if (trackingIsNormal && experienceActivated === false) {
      // We could auto-activate here, but better let the user decide with tilt or tap
    }
  }, 500);
  
  setTimeout(() => { clearInterval(checkReady); activate(true); }, 20000);
}

// ──  Swarm logic  ──────────────────────────────────────────────────
function createSwarm(swarmContainer) {
  const numButterflies = 90;
  
  // MEASUREMENTS (Metres)
  const tunnelLength = 22;   // 11m left, 11m right
  const zNear        = 0.5;  // Starts 0.5m in front of you
  const zFar         = 5.5;  // Ends 5.5m in front of you (5m deep)
  const heightBase   = 2.2;  // Height of flight
  const heightJitter = 0.6;  

  const numZSlots = 10;
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
      // If first spawn, distribute them along the length
      const currentSpawnX = isFirstSpawn ? (Math.random() * tunnelLength - startX) : startX;
      
      const moveDuration  = Math.random() * 5000 + 12000;
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
        easing: 'linear'
      });
    };

    butterfly.addEventListener('animationcomplete__move', () => resetButterfly(butterfly, false));
    swarmContainer.appendChild(butterfly);
    resetButterfly(butterfly, true);
  }
}

// ──  Debug wireframe overlay  ──────────────────────────────────────
function addDebugWireframe(swarmContainer) {
  const tunnelLength = 22;
  const zNear = 0.5;
  const zFar = 5.5;
  const heightBase = 2.2;
  const heightJitter = 0.6;
  
  const depth = zFar - zNear;
  const centerZ = -(zNear + depth/2);

  const group = document.createElement('a-entity');
  
  // Floor guide (18x4.3 terrace reference)
  const floor = document.createElement('a-plane');
  floor.setAttribute('position', `0 0.05 ${centerZ}`);
  floor.setAttribute('rotation', '-90 0 0');
  floor.setAttribute('width', tunnelLength);
  floor.setAttribute('height', depth);
  floor.setAttribute('material', 'color: #00aaff; wireframe: true; opacity: 0.5');
  group.appendChild(floor);

  // User position marker
  const marker = document.createElement('a-cylinder');
  marker.setAttribute('radius', '0.3');
  marker.setAttribute('height', '0.1');
  marker.setAttribute('color', '#ff0000');
  group.appendChild(marker);

  swarmContainer.appendChild(group);
}
