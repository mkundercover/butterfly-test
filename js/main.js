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
            if (b.x < -14) b.x = 14;
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

// Dimensioni tunnel da wireframe.html
const TUNNEL = {
    width: 7.5, height: 3.3, groundY: 0.5, povZ: 1, rows: 12, cols: 13
};

function spawnButterflies() {
    const swarm = document.getElementById('swarm');
    swarm.setAttribute('position', '0 0 0');

    // Griglia slot Y/Z identica a wireframe.html
    const slots = [];
    for (let r = 0; r < TUNNEL.rows; r++) {
        for (let c = 0; c < TUNNEL.cols; c++) {
            slots.push({
                y: (r / (TUNNEL.rows - 1)) * TUNNEL.height + TUNNEL.groundY,
                z: -((c / (TUNNEL.cols - 1)) * TUNNEL.width + TUNNEL.povZ)
            });
        }
    }
    slots.sort(() => Math.random() - 0.5);

    slots.slice(0, 15).forEach(slot => {
        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('animation-mixer', 'clip: *; loop: repeat; timeScale: 1');
        b.setAttribute('scale', '0.2 0.15 0.2');
        b.setAttribute('rotation', `0 ${90 + Math.round((Math.random() - 0.5) * 30)} 0`);

        // X iniziale casuale: farfalle già distribuite lungo tutto il tunnel
        const startX = -14 + Math.random() * 28;
        b.setAttribute('position', `${startX.toFixed(2)} ${slot.y.toFixed(2)} ${slot.z.toFixed(2)}`);

        swarm.appendChild(b);

        // Registra nel loop di volo nativo
        flyingButterflies.push({
            el:    b,
            x:     startX,
            speed: 2 + Math.random() * 2   // 2–4 m/s
        });
    });
}

function showARError(err, btn) {
    const msg  = err?.message || String(err);
    const text = (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied'))
        ? 'Permesso negato.\nRicarica e consenti fotocamera e movimento.'
        : 'Errore: ' + msg;
    alert(text);
    if (btn) { btn.disabled = false; btn.textContent = 'START AR'; }
}
