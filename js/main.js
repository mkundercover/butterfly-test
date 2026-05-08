// Pre-controlla WebXR al caricamento della pagina (senza bisogno di gesto utente)
// così sul click non serve fare await prima di getUserMedia (fondamentale su iOS Safari)
let webxrARSupported = false;
if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar')
        .then(ok => { webxrARSupported = ok; })
        .catch(() => {});
}

async function startCamera() {
    const video = document.getElementById('ar-video');
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
    });
    video.srcObject = stream;
    // Non attendere 'playing': su alcuni browser non scatta se il video è muted/nascosto
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

function showError(msg) {
    // Usa alert come fallback garantito, poi mostra anche il toast
    console.error('[AR] ' + msg);
    const div = document.createElement('div');
    div.style.cssText = [
        'position:fixed', 'bottom:40px', 'left:50%',
        'transform:translateX(-50%)', 'background:rgba(200,0,0,0.9)',
        'color:#fff', 'padding:14px 24px', 'border-radius:10px',
        'font-size:15px', 'z-index:99999', 'max-width:85%',
        'text-align:center', 'font-family:sans-serif', 'box-shadow:0 4px 20px rgba(0,0,0,0.5)'
    ].join(';');
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 6000);
}

window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Avvio...';

        try {
            if (webxrARSupported) {
                // --- Android Chrome + ARCore: WebXR nativo (SLAM, zero drift) ---
                const scene = document.querySelector('a-scene');
                scene.setAttribute('webxr', 'requiredFeatures: local; optionalFeatures: hit-test, local-floor');

                const enterAR = async () => {
                    await scene.enterAR();
                    document.getElementById('overlay').classList.add('hidden');
                    scene.classList.add('ar-active');
                    spawnButterflies();
                };

                if (scene.hasLoaded) {
                    await enterAR();
                } else {
                    scene.addEventListener('loaded', enterAR, { once: true });
                }

            } else {
                // --- iOS Safari + tutto il resto: camera passthrough + DeviceOrientation ---
                // getUserMedia DEVE essere la prima chiamata async per mantenere
                // il contesto del gesto utente su iOS Safari
                await startCamera();
                await requestOrientationPermission();
                document.getElementById('overlay').classList.add('hidden');
                document.querySelector('a-scene').classList.add('ar-active');
                spawnButterflies();
            }

        } catch (err) {
            const msg = err?.message || String(err);
            showError(msg.includes('Permission') || msg.includes('NotAllowed')
                ? 'Permesso fotocamera negato. Ricarica la pagina e consenti l\'accesso.'
                : 'Errore: ' + msg);
            btn.disabled = false;
            btn.textContent = 'START AR';
        }
    });
});
