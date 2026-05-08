window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.addEventListener('click', async () => {
            console.log("Richiesta permessi...");
            // Richiesta permessi esplicita
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const response = await DeviceOrientationEvent.requestPermission();
                    if (response !== 'granted') {
                        alert("Permessi negati. AR non funzionante.");
                        return;
                    }
                } catch(e) { console.error(e); }
            }
            
            document.getElementById('status-msg').classList.add('hidden');
            document.getElementById('calibration-msg').classList.remove('hidden');
        });
    }
    
    // Auto-init swarm su tap di calibrazione
    const calib = document.getElementById('calibration-msg');
    if (calib) {
        calib.addEventListener('click', () => {
            document.getElementById('overlay').classList.add('hidden');
            const swarm = document.getElementById('swarm');
            swarm.setAttribute('position', '0 0 -1.5');
            for(let i=0; i<10; i++) {
                const b = document.createElement('a-entity');
                b.setAttribute('gltf-model', '#butterflyModel');
                b.setAttribute('position', `${Math.random()*2-1} ${Math.random()+1} ${Math.random()*-2}`);
                b.setAttribute('scale', '0.2 0.2 0.2');
                swarm.appendChild(b);
            }
        }, {once: true});
    }
});
