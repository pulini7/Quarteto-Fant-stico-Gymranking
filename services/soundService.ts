// Simple Web Audio API Synthesizer for Game Sounds
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const playTone = (freq: number, type: OscillatorType, duration: number, delay: number = 0) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + delay + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + duration);
};

export const playSound = {
    success: () => {
        // Success "Ding"
        playTone(523.25, 'sine', 0.1, 0); // C5
        playTone(659.25, 'sine', 0.1, 0.1); // E5
        playTone(783.99, 'sine', 0.4, 0.2); // G5
    },
    levelUp: () => {
        // Final Fantasy style simplistic
        const now = 0;
        const speed = 0.1;
        [523.25, 587.33, 659.25, 698.46, 783.99, 880.00].forEach((freq, i) => {
            playTone(freq, 'square', 0.2, now + (i * speed));
        });
        playTone(1046.50, 'square', 0.6, now + (6 * speed));
    },
    click: () => {
        playTone(400, 'triangle', 0.05, 0);
    },
    error: () => {
        playTone(150, 'sawtooth', 0.2, 0);
        playTone(100, 'sawtooth', 0.2, 0.15);
    },
    camera: () => {
        // Shutter sound simulation
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const bufferSize = audioCtx.sampleRate * 0.1; // 100ms
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    }
};