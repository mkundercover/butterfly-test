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

    try {
        if (webxrARSupported) {
            // Android Chrome + ARCore: WebXR nativo
            const scene = document.querySelector('a-scene');
            scene.setAttribute('webxr', 'requiredFeatures: local; optionalFeatures: hit-test, local-floor');
            const enterAR = async () => {
                await scene.enterAR();
                document.getElementById('overlay').classList.add('hidden');
                scene.classList.add('ar-active');
                spawnButterflies();
            };
            scene.hasLoaded ? await enterAR() : scene.addEventListener('loaded', enterAR, { once: true });

        } else {
            // iOS Safari + tutti gli altri: camera passthrough + DeviceOrientation
            // getUserMedia deve essere il primo await (user gesture context iOS)
            await startCamera();
            await requestOrientationPermission();
            document.getElementById('overlay').classList.add('hidden');
            document.querySelector('a-scene').classList.add('ar-active');
            spawnButterflies();
        }

    } catch (err) {
        const msg = err?.message || String(err);
        const friendlyMsg = (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied'))
            ? 'Permesso fotocamera negato.\nRicarica la pagina e consenti l\'accesso alla fotocamera.'
            : 'Errore: ' + msg;
        alert(friendlyMsg);
        btn.disabled = false;
        btn.textContent = 'START AR';
    }
}

async function startCamera() {
    const video = document.getElementById('ar-video');
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
    });
    video.srcObject = stream;
    video.play().catch(() => {});
}

async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') throw new Error('Permesso orientamento negato');
    }
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
