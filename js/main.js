// Loop di volo: requestAnimationFrame nativo, funziona su iOS e Android
const flyingButterflies = [];
let rafRunning = false;

function startFlightLoop() {
    if (rafRunning) return;
    rafRunning = true;
    let lastTime = performance.now();

    function loop() {
        const now = performance.now();
        const dt  = Math.min((now - lastTime) / 1000, 0.05); // max 50ms per frame
        lastTime  = now;

        for (let i = 0; i < flyingButterflies.length; i++) {
            const b = flyingButterflies[i];
            b.x -= b.speed * dt;
            if (b.x < -5) b.x = 5;   // range ±5m calibrato per FOV telefono
            if (b.el.object3D) b.el.object3D.position.x = b.x;
        }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

// Pre-controlla WebXR al caricamento (senza gesto utente)
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
        // Android Chrome + ARCore
        try {
            const scene = document.querySelector('a-scene');
            scene.setAttribute('webxr', 'requiredFeatures: local; optionalFeatures: hit-test, local-floor');
            const doEnter = async () => {
                await scene.enterAR();
                document.getElementById('overlay').classList.add('hidden');
                scene.classList.add('ar-active');
                await waitForScene();
                spawnButterflies();
                startFlightLoop();
            };
            scene.hasLoaded ? await doEnter() : scene.addEventListener('loaded', doEnter, { once: true });
        } catch (err) {
            showARError(err, btn);
        }
        return;
    }

    // iOS Safari + tutto il resto
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

        document.getElementById('ar-video').srcObject = stream;
        document.getElementById('ar-video').play().catch(() => {});
        document.getElementById('overlay').classList.add('hidden');
        document.querySelector('a-scene').classList.add('ar-active');

        await waitForScene();
        spawnButterflies();
        startFlightLoop();
    } catch (err) {
        showARError(err, btn);
    }
}

function waitForScene() {
    const scene = document.querySelector('a-scene');
    if (scene.hasLoaded) return Promise.resolve();
    return new Promise(resolve => scene.addEventListener('loaded', resolve, { once: true }));
}

function spawnButterflies() {
    const swarm = document.getElementById('swarm');
    swarm.setAttribute('position', '0 0 0');

    // 20 farfalle distribuite in uno spazio visibile da telefono:
    //   Z: -0.5 → -3m   (vicine, ben visibili a schermo)
    //   Y: 0.3  → 2.2m  (da terra ad altezza testa)
    //   X: ±5m  (entrano/escono dal bordo schermo)
    //   scale: 0.5  (≈ 3× più grandi della versione precedente)
    for (let i = 0; i < 20; i++) {
        const z      = -(0.5 + Math.random() * 2.5);   // -0.5 → -3m
        const y      =   0.3 + Math.random() * 1.9;    //  0.3 → 2.2m
        const startX =  -5   + Math.random() * 10;     // -5   → +5m

        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('animation-mixer', 'clip: *; loop: repeat; timeScale: 1');
        b.setAttribute('scale', '0.5 0.5 0.5');
        b.setAttribute('rotation', `0 ${90 + Math.round((Math.random() - 0.5) * 30)} 0`);
        b.setAttribute('position', `${startX.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
        swarm.appendChild(b);

        flyingButterflies.push({
            el:    b,
            x:     startX,
            speed: 0.8 + Math.random() * 1.2   // 0.8–2 m/s (più lente = più visibili)
        });
    }
}

function showARError(err, btn) {
    const msg  = err?.message || String(err);
    const text = (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied'))
        ? 'Permesso negato.\nRicarica e consenti fotocamera e movimento.'
        : 'Errore: ' + msg;
    alert(text);
    if (btn) { btn.disabled = false; btn.textContent = 'START AR'; }
}
