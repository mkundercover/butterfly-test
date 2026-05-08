// Pre-controlla WebXR appena la pagina carica
let webxrARSupported = false;
if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar')
        .then(ok => { webxrARSupported = ok; })
        .catch(() => {});
}

// Funzione globale chiamata direttamente da onclick sul bottone
async function startAR() {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = 'Avvio...';

    if (webxrARSupported) {
        // --- Android Chrome + ARCore: WebXR nativo ---
        try {
            const scene = document.querySelector('a-scene');
            scene.setAttribute('webxr', 'requiredFeatures: local; optionalFeatures: hit-test, local-floor');
            const doEnter = async () => {
                await scene.enterAR();
                document.getElementById('overlay').classList.add('hidden');
                scene.classList.add('ar-active');
                spawnButterflies();
            };
            scene.hasLoaded ? await doEnter() : scene.addEventListener('loaded', doEnter, { once: true });
        } catch (err) {
            showARError(err, btn);
        }
        return;
    }

    // --- iOS Safari + tutto il resto: camera passthrough + DeviceOrientation ---
    // CRITICO: entrambe le chiamate che richiedono "user gesture" su iOS
    // devono essere avviate QUI, nella parte sincrona (prima di qualsiasi await).
    // Dopo un await il contesto del gesto utente è perso e iOS blocca la richiesta.

    const orientationPromise =
        (typeof DeviceOrientationEvent !== 'undefined' &&
         typeof DeviceOrientationEvent.requestPermission === 'function')
            ? DeviceOrientationEvent.requestPermission()
            : Promise.resolve('granted');

    if (!navigator.mediaDevices) {
        alert('Fotocamera non disponibile.\nLa pagina deve essere servita via HTTPS.');
        btn.disabled = false;
        btn.textContent = 'START AR';
        return;
    }

    const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
    });

    try {
        const [orientResult, stream] = await Promise.all([orientationPromise, cameraPromise]);

        if (orientResult !== 'granted') throw new Error('Permesso orientamento negato');

        const video = document.getElementById('ar-video');
        video.srcObject = stream;
        video.play().catch(() => {});

        document.getElementById('overlay').classList.add('hidden');
        document.querySelector('a-scene').classList.add('ar-active');
        spawnButterflies();

    } catch (err) {
        showARError(err, btn);
    }
}

function showARError(err, btn) {
    const msg = err?.message || String(err);
    const text = (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied'))
        ? 'Permesso negato.\nRicarica la pagina e consenti fotocamera e movimento.'
        : 'Errore: ' + msg;
    alert(text);
    if (btn) { btn.disabled = false; btn.textContent = 'START AR'; }
}

function spawnButterflies() {
    const swarm = document.getElementById('swarm');
    for (let i = 0; i < 15; i++) {
        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('animation-mixer', 'clip: Flying; loop: repeat');
        const x = (Math.random() * 4 - 2).toFixed(2);
        const y = (Math.random() * 2 + 0.5).toFixed(2);
        const z = (Math.random() * -3).toFixed(2);
        b.setAttribute('position', `${x} ${y} ${z}`);
        b.setAttribute('scale', '0.2 0.2 0.2');
        swarm.appendChild(b);
    }
}
