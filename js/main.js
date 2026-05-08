window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            document.getElementById('status-msg').classList.add('hidden');
            document.getElementById('calibration-msg').classList.remove('hidden');
            
            if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
                DeviceOrientationEvent.requestPermission().then(res => initAR());
            } else {
                initAR();
            }
        });
    }
});

function initAR() {
    const calib = document.getElementById('calibration-msg');
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
