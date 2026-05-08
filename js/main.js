window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            const scene = document.querySelector('a-scene');
            // Entra in modalità WebXR AR nativa
            scene.enterAR();
            
            document.getElementById('overlay').classList.add('hidden');
            const swarm = document.getElementById('swarm');
            
            // Creazione farfalle
            for(let i=0; i<15; i++) {
                const b = document.createElement('a-entity');
                b.setAttribute('gltf-model', '#butterflyModel');
                b.setAttribute('animation-mixer', 'clip: Flying');
                b.setAttribute('position', `${Math.random()*4-2} ${Math.random()*2+0.5} ${Math.random()*-3}`);
                b.setAttribute('scale', '0.2 0.2 0.2');
                swarm.appendChild(b);
            }
        });
    }
});
