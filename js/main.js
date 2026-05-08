let webxrARSupported = false;
if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar')
        .then(ok => { webxrARSupported = ok; })
        .catch(() => {});
}

async function startAR() {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = 'Avvio...';

    if (webxrARSupported) {
        // --- Android Chrome + ARCore ---
        try {
            const scene = document.querySelector('a-scene');
            scene.setAttribute('webxr', 'requiredFeatures: local; optionalFeatures: hit-test, local-floor');
            const doEnter = async () => {
                await scene.enterAR();
                document.getElementById('overlay').classList.add('hidden');
                scene.classList.add('ar-active');
                await waitForScene();
                spawnButterflies(false);
            };
            scene.hasLoaded ? await doEnter() : scene.addEventListener('loaded', doEnter, { once: true });
        } catch (err) {
            showARError(err, btn);
        }
        return;
    }

    // --- iOS Safari + tutto il resto ---
    // requestPermission e getUserMedia devono partire PRIMA del primo await (user gesture iOS)
    const orientPromise =
        (typeof DeviceOrientationEvent !== 'undefined' &&
         typeof DeviceOrientationEvent.requestPermission === 'function')
            ? DeviceOrientationEvent.requestPermission()
            : Promise.resolve('granted');

    if (!navigator.mediaDevices) {
        alert('Fotocamera non disponibile.\nLa pagina richiede HTTPS.');
        btn.disabled = false; btn.textContent = 'START AR';
        return;
    }

    const camPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
    });

    try {
        const [orientResult, stream] = await Promise.all([orientPromise, camPromise]);
        if (orientResult !== 'granted') throw new Error('Permesso orientamento negato');

        const video = document.getElementById('ar-video');
        video.srcObject = stream;
        video.play().catch(() => {});

        document.getElementById('overlay').classList.add('hidden');
        document.querySelector('a-scene').classList.add('ar-active');

        await waitForScene();
        // surroundMode=true: farfalle in cerchio 360° → utente è già nel mezzo
        spawnButterflies(true);
    } catch (err) {
        showARError(err, btn);
    }
}

function waitForScene() {
    const scene = document.querySelector('a-scene');
    if (scene.hasLoaded) return Promise.resolve();
    return new Promise(resolve => scene.addEventListener('loaded', resolve, { once: true }));
}

function spawnButterflies(surroundMode) {
    const swarm = document.getElementById('swarm');
    swarm.setAttribute('position', surroundMode ? '0 0 0' : '0 0 -1.5');

    for (let i = 0; i < 15; i++) {
        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        // clip:* esegue tutte le animazioni del GLB, indipendentemente dal nome
        b.setAttribute('animation-mixer', 'clip: *; loop: repeat; timeScale: 1');
        b.setAttribute('scale', '0.2 0.2 0.2');
        b.setAttribute('rotation', `0 ${Math.round(Math.random() * 360)} 0`);

        let x, y, z;
        if (surroundMode) {
            // Distribuzione cilindrica 360°: utente al centro, farfalle tutto intorno
            const angle = Math.random() * Math.PI * 2;
            const dist  = 0.8 + Math.random() * 1.7;   // 0.8 – 2.5 m di distanza
            x = (Math.cos(angle) * dist).toFixed(2);
            z = (Math.sin(angle) * dist).toFixed(2);
            y = (0.5 + Math.random() * 1.8).toFixed(2); // 0.5 – 2.3 m di altezza
        } else {
            // WebXR Android: di fronte all'utente
            x = (Math.random() * 4 - 2).toFixed(2);
            y = (Math.random() * 2 + 0.5).toFixed(2);
            z = (Math.random() * -3 - 0.5).toFixed(2);
        }

        b.setAttribute('position', `${x} ${y} ${z}`);

        // Galleggiamento verticale casuale per ogni farfalla
        const dur    = 2000 + Math.round(Math.random() * 2000);
        const yHigh  = (parseFloat(y) + 0.2 + Math.random() * 0.2).toFixed(2);
        b.setAttribute('animation__float',
            `property: position; from: ${x} ${y} ${z}; to: ${x} ${yHigh} ${z}; ` +
            `dur: ${dur}; dir: alternate; loop: true; easing: easeInOutSine`);

        swarm.appendChild(b);
    }
}

function showARError(err, btn) {
    const msg  = err?.message || String(err);
    const text = (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied'))
        ? 'Permesso negato.\nRicarica la pagina e consenti fotocamera e movimento.'
        : 'Errore: ' + msg;
    alert(text);
    if (btn) { btn.disabled = false; btn.textContent = 'START AR'; }
}
