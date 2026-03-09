let audioCtx = null;
let customAvatarData = '';

function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function setConnectionStatus(online) {
    const el = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    if (online) {
        el.classList.remove('offline');
        text.textContent = 'Онлайн';
    } else {
        el.classList.add('offline');
        text.textContent = 'Офлайн';
    }
}

function lightenColor(c, p) { 
    if (!c?.startsWith('#')) return c; 
    const n = parseInt(c.slice(1), 16); 
    return `rgb(${Math.min(255,(n>>16)+p)},${Math.min(255,((n>>8)&0xFF)+p)},${Math.min(255,(n&0xFF)+p)})`; 
}

function initAudio() { 
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const sounds = {
        hit: [150, 'sine', 0.3, 0.1],
        pocket: [300, 'sine', 0.2, 0.3],
        wall: [100, 'triangle', 0.15, 0.05],
        collision: [200 + Math.random() * 100, 'sine', 0.1, 0.08],
        foul: [200, 'sawtooth', 0.2, 0.5],
        win: [400, 'sine', 0.15, 0.3],
        pong: [400, 'square', 0.1, 0.05],
        score: [600, 'sine', 0.2, 0.2]
    };
    const [freq, wave, vol, dur] = sounds[type] || sounds.hit;
    osc.frequency.value = freq;
    osc.type = wave;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + dur);
}

function handleAvatarUpload(inputId, textId, previewId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) {
            alert('Файл слишком большой. Максимум 500KB');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const size = 64;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const scale = Math.max(size / img.width, size / img.height);
                const x = (size - img.width * scale) / 2;
                const y = (size - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                customAvatarData = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById(textId).textContent = 'Загружено!';
                if (previewId) {
                    document.getElementById(previewId).innerHTML = `<img src="${customAvatarData}" alt="">`;
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}