window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.addEventListener('click', async () => {
            console.log("Tentativo avvio AR nativo...");
            try {
                if (navigator.xr) {
                    const session = await navigator.xr.requestSession('immersive-ar', {
                        requiredFeatures: ['hit-test', 'local-floor']
                    });
                    const scene = document.querySelector('a-scene');
                    scene.renderer.xr.setSession(session);
                    document.getElementById('overlay').classList.add('hidden');
                    createSwarm(document.getElementById('swarm'));
                } else {
                    alert("AR non supportata su questo browser.");
                }
            } catch (err) {
                console.error("Errore sessione AR:", err);
                alert("Errore avvio AR: " + err.message);
            }
        });
    }
});

function createSwarm(swarmContainer) {
    for(let i=0; i<10; i++) {
        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('position', `${Math.random()*2-1} ${Math.random()+1} ${Math.random()*-2}`);
        b.setAttribute('scale', '0.2 0.2 0.2');
        swarmContainer.appendChild(b);
    }
}
