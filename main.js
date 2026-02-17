document.addEventListener("DOMContentLoaded", function(event) {

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const waveformSelect = document.getElementById('waveform');
    let selectedWaveform = 'sine';

    waveformSelect.addEventListener('change', function() {
        selectedWaveform = this.value;
    });

    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
        '73': 1046.502261170122,    //I - C
        '56': 1108.730516992571,    //8 - C#
        '79': 1174.659153037467,    //O - D
        '57': 1244.508131081553,    //9 - D#
        '80': 1318.510330255652,    //P - E
    }

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

    // simple peak limiter settings (now controlled by sliders)
    let limiterThreshold = 0.2; // when to start reducing
    let limiterCeiling = 0.4;   // never allow measured level to exceed this
    let limiterEngaged = false;

    // set up limiter sliders
    const thresholdSlider = document.getElementById('threshold');
    const ceilingSlider = document.getElementById('ceiling');
    const thresholdValue = document.getElementById('thresholdValue');
    const ceilingValue = document.getElementById('ceilingValue');

    if (thresholdSlider) {
        thresholdSlider.addEventListener('input', function() {
            limiterThreshold = parseFloat(this.value);
            thresholdValue.textContent = limiterThreshold.toFixed(2);
        });
    }

    if (ceilingSlider) {
        ceilingSlider.addEventListener('input', function() {
            limiterCeiling = parseFloat(this.value);
            ceilingValue.textContent = limiterCeiling.toFixed(2);
        });
    }

    // create an analyser node for the live volume meter
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    // create an AM gain stage (modulated by an LFO)
    const amGain = audioCtx.createGain();
    // default depth is 0 -> amGain at 1.0
    amGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

    // connect audio graph: masterGain -> amGain -> analyser -> destination
    masterGain.connect(amGain);
    amGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    // --- AM (LFO) setup ---
    const lfoOsc = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.setValueAtTime(5.0, audioCtx.currentTime); // default 5 Hz
    // lfo produces -1..1; scale to +/-depth/2 so AM = base + lfo*depth/2
    lfoGain.gain.setValueAtTime(0.0, audioCtx.currentTime); // default depth 0

    // route LFO into the gain AudioParam of the amGain node
    lfoOsc.connect(lfoGain);
    lfoGain.connect(amGain.gain);
    lfoOsc.start();

    // wire up sliders for AM
    const amFreqSlider = document.getElementById('amFreq');
    const amDepthSlider = document.getElementById('amDepth');
    const amFreqValue = document.getElementById('amFreqValue');
    const amDepthValue = document.getElementById('amDepthValue');

    if (amFreqSlider) {
        amFreqSlider.addEventListener('input', function() {
            const v = parseFloat(this.value);
            lfoOsc.frequency.setValueAtTime(v, audioCtx.currentTime);
            if (amFreqValue) amFreqValue.textContent = v.toFixed(1);
        });
    }

    if (amDepthSlider) {
        amDepthSlider.addEventListener('input', function() {
            const depth = parseFloat(this.value);
            // LFO gain should be depth/2 so lfo(-1..1)*(depth/2) -> +/-depth/2
            lfoGain.gain.setValueAtTime(depth / 2.0, audioCtx.currentTime);
            // base gain should be 1 - depth/2 so result ranges [1-depth .. 1]
            amGain.gain.setValueAtTime(1.0 - (depth / 2.0), audioCtx.currentTime);
            if (amDepthValue) amDepthValue.textContent = depth.toFixed(2);
        });
    }

    // --- FM / Vibrato setup (global LFO modulating oscillator frequency) ---
    const lfo2Osc = audioCtx.createOscillator();
    const lfo2Gain = audioCtx.createGain();
    lfo2Osc.type = 'sine';
    lfo2Osc.frequency.setValueAtTime(5.0, audioCtx.currentTime); // default 5 Hz
    // depth in Hz (0 => no vibrato)
    lfo2Gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    lfo2Osc.connect(lfo2Gain);
    lfo2Osc.start();

    // wire up sliders for FM
    const fmFreqSlider = document.getElementById('fmFreq');
    const fmDepthSlider = document.getElementById('fmDepth');
    const fmFreqValue = document.getElementById('fmFreqValue');
    const fmDepthValue = document.getElementById('fmDepthValue');

    if (fmFreqSlider) {
        fmFreqSlider.addEventListener('input', function() {
            const v = parseFloat(this.value);
            lfo2Osc.frequency.setValueAtTime(v, audioCtx.currentTime);
            if (fmFreqValue) fmFreqValue.textContent = v.toFixed(1);
        });
    }

    if (fmDepthSlider) {
        fmDepthSlider.addEventListener('input', function() {
            const depth = parseFloat(this.value);
            // depth is in Hz; LFO output (-1..1) * depth => +/- depth
            lfo2Gain.gain.setValueAtTime(depth, audioCtx.currentTime);
            if (fmDepthValue) fmDepthValue.textContent = depth.toFixed(1);
        });
    }

    // --- Partials LFO (modulates each partial's amplitude mix) ---
    const lfoPartials = audioCtx.createOscillator();
    lfoPartials.type = 'sine';
    lfoPartials.frequency.setValueAtTime(1.0, audioCtx.currentTime);
    lfoPartials.start();

    let partialsLfoDepth = 0.25; // default depth (fractional modulation)
    const partialsLfoFreqSlider = document.getElementById('partialsLfoFreq');
    const partialsLfoDepthSlider = document.getElementById('partialsLfoDepth');
    const partialsLfoFreqValue = document.getElementById('partialsLfoFreqValue');
    const partialsLfoDepthValue = document.getElementById('partialsLfoDepthValue');

    if (partialsLfoFreqSlider) {
        partialsLfoFreqSlider.addEventListener('input', function() {
            const v = parseFloat(this.value);
            lfoPartials.frequency.setValueAtTime(v, audioCtx.currentTime);
            if (partialsLfoFreqValue) partialsLfoFreqValue.textContent = v.toFixed(1);
        });
    }

    if (partialsLfoDepthSlider) {
        partialsLfoDepthSlider.addEventListener('input', function() {
            partialsLfoDepth = parseFloat(this.value);
            if (partialsLfoDepthValue) partialsLfoDepthValue.textContent = partialsLfoDepth.toFixed(2);
            // update any active partial lfo gains to reflect new depth
            Object.values(activeOscillators).forEach(note => {
                if (!note.partials) return;
                note.partials.forEach((p, i) => {
                    try {
                        const baseAmp = (partialVolumes[i] !== undefined) ? partialVolumes[i] : (defaultPartialVolumes[i] || 0.01);
                        // set the per-partial LFO gain to baseAmp * depth
                        if (p.lfoGain) p.lfoGain.gain.setValueAtTime(baseAmp * partialsLfoDepth, audioCtx.currentTime);
                    } catch(e) {}
                });
            });
        });
    }
    
    // --- ADSR controls ---
    const attackSlider = document.getElementById('attack');
    const decaySlider = document.getElementById('decay');
    const sustainSlider = document.getElementById('sustain');
    const releaseSlider = document.getElementById('release');
    const attackValue = document.getElementById('attackValue');
    const decayValue = document.getElementById('decayValue');
    const sustainValue = document.getElementById('sustainValue');
    const releaseValue = document.getElementById('releaseValue');

    let attackTime = attackSlider ? parseFloat(attackSlider.value) : 0.005;
    let decayTime = decaySlider ? parseFloat(decaySlider.value) : 0.05;
    let sustainLevel = sustainSlider ? parseFloat(sustainSlider.value) : 0.8;
    let releaseTime = releaseSlider ? parseFloat(releaseSlider.value) : 0.3;

    function wireSlider(slider, valueEl, setter) {
        if (!slider) return;
        slider.addEventListener('input', function() {
            const v = parseFloat(this.value);
            setter(v);
            if (valueEl) valueEl.textContent = (typeof v === 'number' && v.toFixed) ? v.toFixed((v>=1||v<0.1)?2:3) : String(v);
        });
    }

    wireSlider(attackSlider, attackValue, v => attackTime = v);
    wireSlider(decaySlider, decayValue, v => decayTime = v);
    wireSlider(sustainSlider, sustainValue, v => sustainLevel = v);
    wireSlider(releaseSlider, releaseValue, v => releaseTime = v);

    // --- Partials (additive synthesis) controls ---
    const numPartialsSlider = document.getElementById('numPartials');
    const numPartialsValue = document.getElementById('numPartialsValue');
    const partialsContainer = document.getElementById('partialsContainer');

    // default per-partial volumes (reasonable decay for up to 8 partials)
    const defaultPartialVolumes = [0.6, 0.25, 0.12, 0.06, 0.03, 0.015, 0.008, 0.004];
    let numPartials = parseInt(numPartialsSlider ? numPartialsSlider.value : 3, 10) || 3;
    let partialVolumes = defaultPartialVolumes.slice(0, numPartials);

    function renderPartialControls(n) {
        if (!partialsContainer) return;
        partialsContainer.innerHTML = '';
        for (let i = 0; i < n; i++) {
            const idx = i + 1;
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '8px';
            wrapper.style.alignItems = 'center';

            const label = document.createElement('label');
            label.style.minWidth = '140px';
            label.textContent = `Partial ${idx} (×${idx}):`;

            const input = document.createElement('input');
            input.type = 'range';
            input.min = '0';
            input.max = '1';
            input.step = '0.01';
            input.value = (partialVolumes[i] !== undefined) ? partialVolumes[i] : (defaultPartialVolumes[i] || 0.01);
            input.style.flex = '1';
            input.id = `partialVol${idx}`;

            const span = document.createElement('span');
            span.textContent = parseFloat(input.value).toFixed(2);
            span.style.minWidth = '48px';

            input.addEventListener('input', function() {
                const v = parseFloat(this.value);
                partialVolumes[i] = v;
                span.textContent = v.toFixed(2);
                // update any active partial for this index
                Object.values(activeOscillators).forEach(note => {
                    if (!note.partials) return;
                    const p = note.partials[i];
                    if (p) {
                        try {
                            // update base amplitude
                            p.gain.gain.setValueAtTime(v, audioCtx.currentTime);
                            // update lfo gain scale for this partial
                            if (p.lfoGain) p.lfoGain.gain.setValueAtTime(v * partialsLfoDepth, audioCtx.currentTime);
                        } catch (e) {}
                    }
                });
            });

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            wrapper.appendChild(span);
            partialsContainer.appendChild(wrapper);
        }
    }

    // initialize controls
    renderPartialControls(numPartials);
    if (numPartialsValue) numPartialsValue.textContent = numPartials.toString();

    if (numPartialsSlider) {
        numPartialsSlider.addEventListener('input', function() {
            numPartials = parseInt(this.value, 10);
            if (numPartialsValue) numPartialsValue.textContent = numPartials.toString();
            // ensure partialVolumes length
            partialVolumes = defaultPartialVolumes.slice(0, numPartials).map(v => v);
            renderPartialControls(numPartials);
        });
    }

    // helper: when partialVolumes or lfo depth change, update active oscillators accordingly
    function updateActivePartialsForIndex(idx, newBase) {
        Object.values(activeOscillators).forEach(note => {
            if (!note.partials) return;
            const p = note.partials[idx];
            if (p) {
                try {
                    p.gain.gain.setValueAtTime(newBase, audioCtx.currentTime);
                    if (p.lfoGain) p.lfoGain.gain.setValueAtTime(newBase * partialsLfoDepth, audioCtx.currentTime);
                } catch (e) {}
            }
        });
    }

    activeOscillators = {}

    // set up canvas meter
    const meterCanvas = document.getElementById('meter');
    const meterCtx = meterCanvas ? meterCanvas.getContext('2d') : null;
    const meterWidth = meterCanvas ? meterCanvas.width : 300;
    const meterHeight = meterCanvas ? meterCanvas.height : 20;
    const meterValueEl = document.getElementById('meterValue');
    const meterData = new Uint8Array(analyser.fftSize);

    function drawMeter() {
        requestAnimationFrame(drawMeter);
        if (!meterCtx) return;

        analyser.getByteTimeDomainData(meterData);

        let sum = 0;
        let peak = 0;

        for (let i = 0; i < meterData.length; i++) {
            const v = (meterData[i] - 128) / 128.0; // Normalize -1..1
            const absV = Math.abs(v);
            
            if (absV > peak) peak = absV; // Track absolute peak
            sum += v * v;
        }
        
        const rms = Math.sqrt(sum / meterData.length);
        const visualLevel = Math.min(1, rms * 1.6); // Boosted RMS for display

        // LIMITER LOGIC: Use PEAK to prevent clipping
        const currentGain = masterGain.gain.value;
        
        if (peak > limiterThreshold) {
            // Reduction based on peak
            const requiredFactor = limiterCeiling / peak;
            const newTarget = Math.min(currentGain, currentGain * requiredFactor);
            
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.setTargetAtTime(newTarget, audioCtx.currentTime, 0.005); // Fast attack
            limiterEngaged = true;

        } else if (limiterEngaged && peak < (limiterThreshold - 0.05)) {
            // Release only when peak is safe
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.5); // Slow release
            limiterEngaged = false;
        }

        // Draw Logic (using visualLevel)
        if (meterValueEl) {
            const db = rms <= 1e-6 ? '-∞' : (20 * Math.log10(rms)).toFixed(1);
            meterValueEl.textContent = rms.toFixed(3) + ' (' + db + ' dB)';
        }

        meterCtx.fillStyle = '#222';
        meterCtx.fillRect(0, 0, meterWidth, meterHeight);

        const grad = meterCtx.createLinearGradient(0, 0, meterWidth, 0);
        grad.addColorStop(0, '#0f0');
        grad.addColorStop(0.6, '#ff0');
        grad.addColorStop(1, '#f00');
        meterCtx.fillStyle = grad;
        meterCtx.fillRect(0, 0, meterWidth * visualLevel, meterHeight);
    }

    // start the meter loop
    drawMeter();

    // adjust master gain based on number of active notes to avoid clipping
    function updateHeadroom() {
        const activeCount = Object.keys(activeOscillators).length;

        // Estimate theoretical max volume based on per-note partial amplitudes
        // Sum the partial volumes to estimate per-note amplitude (fall back to 0.3)
        const perNoteSum = (partialVolumes && partialVolumes.length) ? partialVolumes.reduce((a,b)=>a+b,0) : 0.3;
        const potentialAmplitude = (activeCount * perNoteSum) + 0.1;

        // If potential volume > 1.0, lower the master gain to fit it
        let safeGain = 1.0;
        if (potentialAmplitude > 1.0) {
            safeGain = 1.0 / potentialAmplitude;
        }

        // Smoothly transition to the safe gain
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setTargetAtTime(safeGain, audioCtx.currentTime, 0.05);
    }

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
        playNote(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            const note = activeOscillators[key];
            // apply the same release envelope to all partial gains and stop oscillators
            if (note && note.partials) {
                note.partials.forEach(p => {
                    try {
                        // release envelope on envGain smoothly (use linear ramp)
                        const nowRel = audioCtx.currentTime;
                        if (p.envGain) p.envGain.gain.cancelScheduledValues(nowRel);
                        try { const cur = p.envGain.gain.value; p.envGain.gain.setValueAtTime(cur, nowRel); } catch(e) {}
                        if (p.envGain) p.envGain.gain.linearRampToValueAtTime(0.0001, nowRel + releaseTime);
                        // disconnect FM LFO from this oscillator's frequency param (if connected)
                        try { lfo2Gain.disconnect(p.osc.frequency); } catch (e) {}
                        // disconnect partial LFO
                        try { if (p.lfoGain) p.lfoGain.disconnect(); } catch (e) {}
                        // stop oscillator after release time plus small buffer
                        p.osc.stop(audioCtx.currentTime + releaseTime + 0.05);
                    } catch (e) {}
                });
            }
            delete activeOscillators[key];

            // update headroom after a note is released
            updateHeadroom();
        }
    }

    function playNote(key) {
        // Additive synthesis using natural overtones (integer multiples)
        const baseFreq = keyboardFrequencyMap[key];
        const partials = [];
        const peakTime = 0.05; // shared attack

        for (let i = 0; i < numPartials; i++) {
            const mul = i + 1; // natural overtone: 1,2,3,...
            const amp = (partialVolumes[i] !== undefined) ? partialVolumes[i] : (defaultPartialVolumes[i] || 0.01);

            const osc = audioCtx.createOscillator();
            const envGain = audioCtx.createGain();
            const gain = audioCtx.createGain();

            osc.type = selectedWaveform;
            osc.frequency.setValueAtTime(baseFreq * mul, audioCtx.currentTime);

            // compute base gain and LFO contribution so the total gain remains >= 0
            const lfoContribution = amp * partialsLfoDepth / 2.0;
            const baseGain = Math.max(0.0001, amp - lfoContribution);
            // ramp base gain into place
            gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(baseGain, audioCtx.currentTime + peakTime);

            // create a per-partial LFO gain node that scales the global partials LFO
            const pLfoGain = audioCtx.createGain();
            // initial lfo amplitude contribution = lfoContribution
            pLfoGain.gain.setValueAtTime(lfoContribution, audioCtx.currentTime);
            try { lfoPartials.connect(pLfoGain); } catch (e) {}
            // route LFO to the gain AudioParam so it adds/subtracts around baseGain
            pLfoGain.connect(gain.gain);

            // connect FM LFO to this oscillator's frequency AudioParam
            try { lfo2Gain.connect(osc.frequency); } catch (e) {}

            // routing: osc -> envGain (ADSR) -> gain (base + LFO) -> masterGain
            osc.connect(envGain);
            envGain.connect(gain);
            gain.connect(masterGain);

            // schedule envelope on envGain (attack -> decay -> sustain)
            const now = audioCtx.currentTime;
            envGain.gain.cancelScheduledValues(now);
            envGain.gain.setValueAtTime(0.0001, now);
            envGain.gain.linearRampToValueAtTime(1.0, now + attackTime);
            envGain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

            osc.start();
            partials.push({ osc, envGain, gain, mul, amp, lfoGain: pLfoGain });
        }

        activeOscillators[key] = { partials };
        // update headroom immediately when a note starts
        updateHeadroom();
    }

});
