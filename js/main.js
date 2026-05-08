window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            document.getElementById('status-msg').classList.add('hidden');
            document.getElementById('calibration-msg').classList.remove('hidden');
            
            // Avvio sessione AR nativa
            const scene = document.querySelector('a-scene');
            scene.setAttribute('webxr', 'requiredFeatures: hit-test, local-floor');
            
            setupHitTest();
        });
    }
});

function setupHitTest() {
    const scene = document.querySelector('a-scene');
    const swarm = document.getElementById('swarm');
    
    // Posizionamento al primo tocco sul suolo rilevato
    scene.addEventListener('click', (evt) => {
        // Logica WebXR nativa per hit-test
        const reticle = document.createElement('a-entity');
        reticle.setAttribute('ar-hit-test', {targetEntity: '#swarm'});
        scene.appendChild(reticle);
        
        document.getElementById('overlay').classList.add('hidden');
        createSwarm(swarm);
    }, {once: true});
}

function createSwarm(swarmContainer) {
    for(let i=0; i<20; i++) {
        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('position', `${Math.random()*4-2} ${Math.random()*2+1} ${Math.random()*-3}`);
        b.setAttribute('scale', '0.2 0.2 0.2');
        swarmContainer.appendChild(b);
    }
}
