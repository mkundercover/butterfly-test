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
            if (b.x < -14) b.x = 14;   // tunnel reale: 28m (±14m)
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

    // Griglia tunnel reale da wireframe.html — dimensioni invariate
    const tunnelW = 7.5, tunnelH = 3.3, groundY = 0.5, povZ = 1;
    const rows = 12, cols = 13;
    const slots = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            slots.push({
                y: (r / (rows - 1)) * tunnelH + groundY,          // 0.5 → 3.8m
                z: -((c / (cols - 1)) * tunnelW + povZ)            // -1 → -8.5m
            });
        }
    }
    slots.sort(() => Math.random() - 0.5);

    slots.slice(0, 20).forEach(slot => {
        const startX = -14 + Math.random() * 28;   // distribuite lungo i 28m reali

        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('animation-mixer', 'clip: *; loop: repeat; timeScale: 1');
        // scala 0.6: a 4m di distanza media appaiono ~10° su schermo (chiaramente visibili)
        b.setAttribute('scale', '0.6 0.6 0.6');
        b.setAttribute('rotation', `0 ${90 + Math.round((Math.random() - 0.5) * 30)} 0`);
        b.setAttribute('position', `${startX.toFixed(2)} ${slot.y.toFixed(2)} ${slot.z.toFixed(2)}`);
        swarm.appendChild(b);

        flyingButterflies.push({
            el:    b,
            x:     startX,
            speed: 1.5 + Math.random() * 2   // 1.5–3.5 m/s
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
