// Componente A-Frame: volo delle farfalle lungo X (destra → sinistra nel tunnel)
// Registrato prima che A-Frame inizializzi la scena
AFRAME.registerComponent('butterfly-fly', {
    schema: {
        y:     { type: 'number', default: 1.5 },
        z:     { type: 'number', default: -3 },
        speed: { type: 'number', default: 3 }   // m/s
    },
    init: function () {
        // Posizione X iniziale casuale: farfalle distribuite lungo tutto il tunnel
        this.x = -14 + Math.random() * 28;
        this.el.object3D.position.set(this.x, this.data.y, this.data.z);
    },
    tick: function (time, delta) {
        this.x -= this.data.speed * (delta / 1000); // vola verso sinistra (-X)
        if (this.x < -14) this.x = 14;             // riparte dall'estremo destro
        this.el.object3D.position.x = this.x;
    }
});

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
            };
            scene.hasLoaded ? await doEnter() : scene.addEventListener('loaded', doEnter, { once: true });
        } catch (err) {
            showARError(err, btn);
        }
        return;
    }

    // iOS Safari + tutto il resto: camera passthrough + DeviceOrientation
    // requestPermission e getUserMedia partono PRIMA del primo await (user gesture iOS)
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
        spawnButterflies();
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
    xStart:  14,    // farfalle partono da destra
    xEnd:   -14,    // arrivano a sinistra
    width:   7.5,   // profondità Z del tunnel
    height:  3.3,   // altezza Y del tunnel
    groundY: 0.5,   // offset Y dal suolo
    povZ:    1,     // distanza minima Z dallo spettatore
    rows:    12,
    cols:    13
};

function spawnButterflies() {
    const swarm = document.getElementById('swarm');
    swarm.setAttribute('position', '0 0 0');

    // Genera la griglia di slot Y/Z identica a wireframe.html
    const slots = [];
    for (let r = 0; r < TUNNEL.rows; r++) {
        for (let c = 0; c < TUNNEL.cols; c++) {
            slots.push({
                y: (r / (TUNNEL.rows - 1)) * TUNNEL.height + TUNNEL.groundY,
                z: -((c / (TUNNEL.cols - 1)) * TUNNEL.width + TUNNEL.povZ)
            });
        }
    }
    // Mescola e prendi 15 slot casuali
    slots.sort(() => Math.random() - 0.5);

    slots.slice(0, 15).forEach(slot => {
        const b = document.createElement('a-entity');
        b.setAttribute('gltf-model', '#butterflyModel');
        b.setAttribute('animation-mixer', 'clip: *; loop: repeat; timeScale: 1');
        b.setAttribute('scale', '0.2 0.15 0.2');
        // Orientamento di volo: ruota di 90° Y per far guardare le farfalle verso -X
        b.setAttribute('rotation', `0 ${90 + Math.round((Math.random() - 0.5) * 30)} 0`);
        b.setAttribute('butterfly-fly', [
            `y: ${slot.y.toFixed(2)}`,
            `z: ${slot.z.toFixed(2)}`,
            `speed: ${(2 + Math.random() * 2).toFixed(2)}`
        ].join('; '));
        swarm.appendChild(b);
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
