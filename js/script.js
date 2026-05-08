// ── Componente colore ──────────────────────────────────
AFRAME.registerComponent('butterfly-color', {
  schema: { color: { type: 'color', default: '#ce0058' } },
  init: function () { this.el.addEventListener('model-loaded', () => this.applyColor()); },
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

// ── Avvio Esperienza (Bind sicuro) ──────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log("Avvio richiesto...");
            // iOS 13+ permission request
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission().then(response => {
                    if (response === 'granted') showCalibration();
                    else alert("Permesso sensori negato.");
                }).catch(console.error);
            } else {
                showCalibration();
            }
        });
    }
});

function showCalibration() {
    document.getElementById('status-msg').classList.add('hidden');
    const calibMsg = document.getElementById('calibration-msg');
    calibMsg.classList.remove('hidden');
    
    // Tap forza l'avvio
    calibMsg.addEventListener('click', activate, {once: true});
}

function activate() {
    document.getElementById('overlay').classList.add('hidden');
    const swarm = document.getElementById('swarm');
    
    // Posizionamento forzato 1.5m davanti
    swarm.setAttribute('position', '0 0 -1.5');
    swarm.object3D.matrixAutoUpdate = false;
    
    // Creazione farfalle
    createSwarm(swarm);
    console.log("Esperienza avviata");
}

// ── Creazione Farfalle ──────────────────────────────────
function createSwarm(swarmContainer) {
  const numButterflies = 20;
  for (let i = 0; i < numButterflies; i++) {
    const butterfly = document.createElement('a-entity');
    butterfly.setAttribute('gltf-model', '#butterflyModel');
    butterfly.setAttribute('position', `${Math.random()*4-2} ${Math.random()*2+1} ${Math.random()*-3}`);
    butterfly.setAttribute('scale', '0.2 0.2 0.2');
    swarmContainer.appendChild(butterfly);
  }
}
