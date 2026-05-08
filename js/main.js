window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            document.getElementById('overlay').classList.add('hidden');
            const swarm = document.getElementById('swarm');
            
            // Creazione farfalle
            for(let i=0; i<20; i++) {
                const b = document.createElement('a-entity');
                b.setAttribute('gltf-model', '#butterflyModel');
                // Posizionamento relativo alla camera AR
                b.setAttribute('position', `${Math.random()*4-2} ${Math.random()*2+1} ${Math.random()*-3}`);
                b.setAttribute('scale', '0.2 0.2 0.2');
                swarm.appendChild(b);
            }
        });
    }
});
