/**
 * Procedural themed background music for Arcade Arena.
 * Routes all music voices through a shared dynamics compressor.
 * Hub and standalone game pages call start(trackId) / stop(); volume follows localStorage "arcadeSound".
 */
window.ArcadeMusic = (function ArcadeMusicModule() {
    let ctx = null;
    let limiter = null;
    let musicGain = null;
    let musicFilter = null;
    let distortion = null;
    let playing = false;
    let currentTrack = null;
    let scheduleTimer = null;
    let nextStepTime = 0;
    let step = 0;
    let volumeMult = 0.8;
  const SCHEDULE_AHEAD = 0.35;

    // --- Track timing (BPM, gain, loop length in 16th-note steps) ---
    const TRACKS = {
        hub: { bpm: 92, baseGain: 0.26, loopSteps: 64 },
        tagZone: { bpm: 128, baseGain: 0.3, loopSteps: 64 },
        fastEagle: { bpm: 108, baseGain: 0.24, loopSteps: 64 },
        spaceRunner: { bpm: 132, baseGain: 0.32, loopSteps: 64 },
        waterRoyale: { bpm: 118, baseGain: 0.3, loopSteps: 64 }
    };

    function beatDur(track) {
        return 60 / TRACKS[track].bpm;
    }

    function stepDur(track) {
        return beatDur(track) / 4;
    }

    // --- Audio graph: compressor limiter → destination; voices → gain → lowpass → limiter ---
    function init() {
        if (ctx) return ctx;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        limiter = ctx.createDynamicsCompressor();
        const t = ctx.currentTime;
        limiter.threshold.setValueAtTime(-16, t);
        limiter.knee.setValueAtTime(6, t);
        limiter.ratio.setValueAtTime(12, t);
        limiter.attack.setValueAtTime(0.005, t);
        limiter.release.setValueAtTime(0.1, t);
        limiter.connect(ctx.destination);

        musicGain = ctx.createGain();
        musicFilter = ctx.createBiquadFilter();
        musicFilter.type = 'lowpass';
        musicFilter.frequency.setValueAtTime(18000, t);
        musicFilter.Q.setValueAtTime(0.7, t);
        musicGain.gain.setValueAtTime(0.0001, t);
        musicGain.connect(musicFilter);
        musicFilter.connect(limiter);

        distortion = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i += 1) {
            const x = (i * 2) / 256 - 1;
            curve[i] = Math.tanh(2.8 * x);
        }
        distortion.curve = curve;
        distortion.oversample = '4x';
        return ctx;
    }

    function resume() {
        init();
        if (ctx.state === 'suspended') ctx.resume();
    }

    function connectVoice(gainNode) {
        init();
        gainNode.connect(musicGain);
    }

    function setMasterGain(track) {
        if (!musicGain || !ctx) return;
        const target = TRACKS[track].baseGain * volumeMult;
        musicGain.gain.setTargetAtTime(Math.max(0.0001, target), ctx.currentTime, 0.08);
    }

    function setVolumeMult(mult) {
        volumeMult = Math.max(0, Math.min(1, mult));
        if (currentTrack) setMasterGain(currentTrack);
        else if (musicGain && ctx) musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    }

    // Reads hub sound slider value (0–100) from localStorage key "arcadeSound".
    function readStoredVolume() {
        try {
            return Math.max(0, Math.min(1, Number(localStorage.getItem('arcadeSound') ?? 80) / 100));
        } catch (_) {
            return 0.8;
        }
    }

    // --- Voice scheduling helpers (one-shot oscillators / noise bursts) ---
    function scheduleNoise(ctxRef, time, dur, level, filterType, filterFreq) {
        const len = Math.max(1, Math.floor(ctxRef.sampleRate * dur));
        const buf = ctxRef.createBuffer(1, len, ctxRef.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const noise = ctxRef.createBufferSource();
        noise.buffer = buf;
        const filter = ctxRef.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, time);
        const gain = ctxRef.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(level * volumeMult, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        noise.connect(filter);
        filter.connect(gain);
        connectVoice(gain);
        noise.start(time);
        noise.stop(time + dur + 0.01);
    }

    function scheduleTone(ctxRef, time, dur, freq, type, level, options = {}) {
        const osc = ctxRef.createOscillator();
        const gain = ctxRef.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        if (options.slideTo) {
            osc.frequency.exponentialRampToValueAtTime(options.slideTo, time + dur * 0.85);
        }
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(level * volumeMult, time + 0.008);
        gain.gain.setValueAtTime(level * volumeMult * 0.85, time + dur * 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        let output = osc;
        if (options.distort) {
            osc.connect(distortion);
            output = distortion;
        }
        if (options.filter) {
            const f = ctxRef.createBiquadFilter();
            f.type = options.filter.type || 'lowpass';
            f.frequency.setValueAtTime(options.filter.freq || 1200, time);
            output.connect(f);
            output = f;
        }
        output.connect(gain);
        connectVoice(gain);
        osc.start(time);
        osc.stop(time + dur + 0.02);
    }

    // --- Per-track step composers (each schedules notes for one 16th-note step) ---
    function scheduleHub(step, time) {
        const sixteenth = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const roots = [65.41, 73.42, 58.27, 82.41];
        if (sixteenth === 0) scheduleTone(ctx, time, stepDur('hub') * 3.8, roots[bar], 'sine', 0.14, { filter: { type: 'lowpass', freq: 280 } });
        if ([0, 8].includes(sixteenth)) scheduleTone(ctx, time, 0.09, 48, 'sine', 0.2);
        if (sixteenth % 4 === 2) scheduleTone(ctx, time, stepDur('hub') * 0.7, roots[bar] * 2, 'triangle', 0.05);
        if ([3, 7, 11, 15].includes(sixteenth)) scheduleTone(ctx, time, stepDur('hub') * 0.55, [523.25, 587.33, 659.25, 698.46][bar], 'sine', 0.035);
    }

    function scheduleTagZone(step, time) {
        const sixteenth = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const melody = [392, 440, 523.25, 440, 349.23, 392, 329.63, 349.23];
        const bass = [98, 98, 87.31, 98];
        if (sixteenth % 4 === 0) scheduleTone(ctx, time, 0.08, 62, 'sine', 0.22);
        if ([4, 12].includes(sixteenth)) scheduleNoise(ctx, time, 0.05, 0.12, 'bandpass', 1800);
        if (sixteenth % 2 === 0) scheduleTone(ctx, time, stepDur('tagZone') * 0.85, bass[bar], 'square', 0.07, { filter: { type: 'lowpass', freq: 420 } });
        if (sixteenth % 2 === 1) scheduleTone(ctx, time, stepDur('tagZone') * 0.75, melody[(sixteenth + bar * 3) % melody.length], 'square', 0.06, { filter: { type: 'lowpass', freq: 2200 } });
    }

    function scheduleFastEagle(step, time) {
        const sixteenth = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const arp = [261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66];
        if (sixteenth % 2 === 0) scheduleTone(ctx, time, stepDur('fastEagle') * 0.9, arp[(sixteenth / 2 + bar) % arp.length], 'sine', 0.07);
        if (sixteenth === 0) scheduleTone(ctx, time, stepDur('fastEagle') * 2.5, [130.81, 146.83, 164.81, 174.61][bar], 'triangle', 0.05, { filter: { type: 'lowpass', freq: 500 } });
        if ([7, 15].includes(sixteenth)) scheduleTone(ctx, time, 0.18, 880 + bar * 40, 'sine', 0.03, { slideTo: 660 });
    }

    function scheduleSpaceRunner(step, time) {
        const sixteenth = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const bass = [55, 55, 49, 62];
        if (sixteenth % 4 === 0) scheduleTone(ctx, time, 0.09, 52, 'sine', 0.24);
        if (sixteenth % 2 === 1) scheduleNoise(ctx, time, 0.025, 0.05, 'highpass', 7000);
        if ([0, 6, 8, 14].includes(sixteenth)) scheduleTone(ctx, time, stepDur('spaceRunner') * 0.9, bass[bar], 'sawtooth', 0.09, { distort: true, filter: { type: 'lowpass', freq: 260 } });
        if (sixteenth === 0) scheduleTone(ctx, time, stepDur('spaceRunner') * 3.5, bass[bar] * 1.5, 'triangle', 0.06, { filter: { type: 'lowpass', freq: 900 } });
    }

    function scheduleWaterRoyale(step, time) {
        const sixteenth = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const melody = [523.25, 587.33, 659.25, 698.46, 784, 698.46, 659.25, 587.33];
        if ([0, 8].includes(sixteenth)) scheduleTone(ctx, time, 0.07, 70, 'sine', 0.16);
        if (sixteenth % 2 === 0) scheduleTone(ctx, time, stepDur('waterRoyale') * 0.8, melody[(sixteenth / 2 + bar * 2) % melody.length], 'sine', 0.09, { slideTo: melody[(sixteenth / 2 + bar * 2) % melody.length] * 0.98 });
        if ([4, 12].includes(sixteenth)) scheduleNoise(ctx, time, 0.04, 0.08, 'bandpass', 2400);
        if (sixteenth === 10) scheduleTone(ctx, time, 0.12, 1760, 'triangle', 0.04, { slideTo: 1320 });
    }

    const schedulers = {
        hub: scheduleHub,
        tagZone: scheduleTagZone,
        fastEagle: scheduleFastEagle,
        spaceRunner: scheduleSpaceRunner,
        waterRoyale: scheduleWaterRoyale
    };

    // --- Playback scheduler (lookahead buffer keeps Web Audio ahead of real time) ---
    function advance() {
        if (!playing || !currentTrack || !ctx) return;
        const track = currentTrack;
        const loopSteps = TRACKS[track].loopSteps;
        const dur = stepDur(track);
        while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
            schedulers[track](step, nextStepTime);
            nextStepTime += dur;
            step = (step + 1) % loopSteps;
        }
    }

    // --- Public transport controls ---
    function start(trackId) {
        if (!TRACKS[trackId]) return;
        resume();
        volumeMult = readStoredVolume();
        if (volumeMult <= 0) {
            stop();
            return;
        }
        if (playing && currentTrack === trackId) {
            setMasterGain(trackId);
            return;
        }
        stop();
        currentTrack = trackId;
        playing = true;
        step = 0;
        nextStepTime = ctx.currentTime + 0.06;
        setMasterGain(trackId);
        if (scheduleTimer) clearInterval(scheduleTimer);
        scheduleTimer = setInterval(advance, 25);
        advance();
    }

    function stop() {
        playing = false;
        currentTrack = null;
        if (scheduleTimer) {
            clearInterval(scheduleTimer);
            scheduleTimer = null;
        }
        if (musicGain && ctx) {
            musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
        }
    }

    return {
        init,
        resume,
        start,
        stop,
        advance,
        setVolumeMult,
        readStoredVolume
    };
})();
