// Verifica se il browser supporta WebXR immersive-ar (Android Chrome con ARCore)
async function supportsWebXRAR() {
    if (!navigator.xr) return false;
    try {
        return await navigator.xr.isSessionSupported('immersive-ar');
    } catch {
        return false;
    }
}

// Avvia il feed della fotocamera posteriore (iOS + Android)
async function startCamera() {
    const video = document.getElementById('ar-video');
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
    });
    video.srcObject = stream;
    await new Promise(resolve => {
        video.addEventListener('playing', resolve, { once: true });
    });
}

// Richiede il permesso DeviceOrientation su iOS 13+
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
        b.setAttribute('position', `${(Math.random() * 4 - 2).toFixed(2)} ${(Math.random() * 2 + 0.5).toFixed(2)} ${(Math.random() * -3).toFixed(2)}`);
        b.setAttribute('scale', '0.2 0.2 0.2');
        swarm.appendChild(b);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Avvio...';

        try {
            const hasWebXR = await supportsWebXRAR();

            if (hasWebXR) {
                // Android Chrome con ARCore: WebXR nativo, SLAM, nessun drift
                const scene = document.querySelector('a-scene');
                scene.setAttribute('webxr', 'requiredFeatures: local; optionalFeatures: hit-test, local-floor');

                const onLoaded = async () => {
                    try {
                        await scene.enterAR();
                        document.getElementById('overlay').classList.add('hidden');
                        spawnButterflies();
                    } catch (err) {
                        showError('AR non disponibile: ' + (err.message || err));
                        btn.disabled = false;
                        btn.textContent = 'START AR';
                    }
                };

                if (scene.hasLoaded) {
                    onLoaded();
                } else {
                    scene.addEventListener('loaded', onLoaded, { once: true });
                }
            } else {
                // iOS Safari e tutti gli altri: camera passthrough + DeviceOrientation
                await startCamera();
                await requestOrientationPermission();
                document.getElementById('overlay').classList.add('hidden');
                spawnButterflies();
            }
        } catch (err) {
            showError(err.message || String(err));
            btn.disabled = false;
            btn.textContent = 'START AR';
        }
    });
});

function showError(msg) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;max-width:80%;text-align:center;';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}
