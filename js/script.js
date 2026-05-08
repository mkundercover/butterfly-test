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
const DEBUG = true; // Forziamo debug per vedere cosa succede

// Funzione per aggiornare lo stato visivo della calibrazione
function updateTrackingUI(status) {
  const statusIcon = document.querySelector('.scan-animation');
  const calibText = document.querySelector('#calibration-msg p');
  
  if (!statusIcon) return;

  if (status === 'NORMAL') {
    trackingIsNormal = true;
    statusIcon.style.background = '#00ff00';
    statusIcon.style.boxShadow = '0 0 20px #00ff00';
    if (calibText) calibText.innerHTML = "<b>SISTEMA CALIBRATO!</b><br>Alza il telefono o tocca per iniziare.";
  } else {
    trackingIsNormal = false;
    statusIcon.style.background = '#fe5000';
    statusIcon.style.boxShadow = '0 0 15px #fe5000';
    if (calibText && !experienceActivated) calibText.innerText = "Muovi il telefono per mappare il pavimento...";
  }
}

// Global listeners per 8th Wall
window.addEventListener('realityready', () => { realityReadyFired = true; });
window.addEventListener('xartracking', (event) => {
  updateTrackingUI(event.detail.status);
});

// Fallback per diversi tipi di eventi status
window.addEventListener('xrstatus', (event) => {
  if (event.detail.status === 'requesting' || event.detail.status === 'initializing') {
    updateTrackingUI('SEARCHING');
  }
});

// ──  Start flow  ───────────────────────────────────────────────────
function startExperience() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(response => {
      proceed();
    }).catch(() => proceed());
  } else {
    proceed();
  }
}

function proceed() {
  document.getElementById('status-msg').classList.add('hidden');
  const calibMsg = document.getElementById('calibration-msg');
  calibMsg.classList.remove('hidden');

  const activate = () => {
    if (experienceActivated) return;
    experienceActivated = true;
    window.removeEventListener('deviceorientation', tiltHandler);

    calibMsg.innerHTML = '<h2>ANCORATO</h2>';

    const swarm = document.querySelector('#swarm');
    const hitTest = window.XR8.XrController.hitTest(0, 0);

    if (hitTest.length > 0) {
      const {position, rotation} = hitTest[0];
      swarm.object3D.position.set(position.x, position.y, position.z);
      swarm.object3D.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    } else {
      swarm.setAttribute('position', '0 0 -2');
    }

    // Stop matrix updates immediately
    swarm.object3D.matrixAutoUpdate = false;
    swarm.object3D.updateMatrix();

    document.getElementById('overlay').classList.add('hidden');
    createSwarm(swarm);
    console.log('AR Tunnel hard-locked');
  };
  };
  // Tap attiva sempre (anche se non è verde, per non bloccare l'utente)
  calibMsg.addEventListener('click', activate);

  // Tilt attiva solo se il tracking è buono (per garantire qualità)
  const tiltHandler = (e) => {
    if (e.beta !== null && Math.abs(e.beta) > 75 && trackingIsNormal) activate();
  };
  window.addEventListener('deviceorientation', tiltHandler);

  // Fallback estremo dopo 20s
  setTimeout(() => { if (!experienceActivated) activate(); }, 20000);
}

// ──  Swarm logic  ──────────────────────────────────────────────────
function createSwarm(swarmContainer) {
  const numButterflies = 90;
  const tunnelLength = 22;   
  const zNear        = 0.5;  
  const zFar         = 5.5;  
  const heightBase   = 2.2;  
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
    };

    butterfly.addEventListener('animationcomplete__move', () => resetButterfly(butterfly, false));
    swarmContainer.appendChild(butterfly);
    resetButterfly(butterfly, true);
  }
}

// ──  Debug wireframe  ──────────────────────────────────────────────
function addDebugWireframe(swarmContainer) {
  const group = document.createElement('a-entity');
  
  // Piano terra azzurro (mostra dove il sistema crede sia il pavimento)
  const floor = document.createElement('a-plane');
  floor.setAttribute('rotation', '-90 0 0');
  floor.setAttribute('width', '22');
  floor.setAttribute('height', '5');
  floor.setAttribute('position', '0 0.02 -3');
  floor.setAttribute('material', 'color: #00aaff; wireframe: true; opacity: 0.5');
  group.appendChild(floor);

  // Punto di origine (dove eri tu al momento dello start)
  const origin = document.createElement('a-cylinder');
  origin.setAttribute('radius', '0.2');
  origin.setAttribute('height', '0.1');
  origin.setAttribute('color', '#ff0000');
  group.appendChild(origin);

  swarmContainer.appendChild(group);
}
