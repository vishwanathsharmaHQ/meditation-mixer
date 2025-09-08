class MeditationAudioMixer {
    constructor() {
        this.audioElements = {};
        this.audioContexts = {};
        this.analysers = {};
        this.sources = {};
        this.currentVisualizerTrack = 'breath';
        this.isVisualizerRunning = false;
        this.canvas = null;
        this.canvasContext = null;
        
        this.init();
    }

    init() {
        this.setupAudioElements();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupWebAudioAPI();
        this.startVisualizer();
    }

    setupAudioElements() {
        const trackNames = ['breath', 'music', 'percussion', 'voice'];
        
        trackNames.forEach(track => {
            const audioId = `${track}Audio`;
            this.audioElements[track] = document.getElementById(audioId);
            
            // Set initial volume
            this.audioElements[track].volume = 0.7;
            
            // Enable looping for meditation tracks
            this.audioElements[track].loop = true;
        });
    }

    setupCanvas() {
        this.canvas = document.getElementById('visualizer');
        this.canvasContext = this.canvas.getContext('2d');
    }

    setupEventListeners() {
        // Master controls
        document.getElementById('playAll').addEventListener('click', () => this.playAll());
        document.getElementById('pauseAll').addEventListener('click', () => this.pauseAll());

        // Individual track controls
        document.querySelectorAll('.play-pause-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const audioId = e.currentTarget.getAttribute('data-audio');
                const trackName = this.getTrackNameFromAudioId(audioId);
                this.togglePlayPause(trackName, e.currentTarget);
            });
        });

        // Volume controls
        document.querySelectorAll('.volume-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const audioId = e.target.getAttribute('data-audio');
                const trackName = this.getTrackNameFromAudioId(audioId);
                const volume = e.target.value / 100;
                
                this.setVolume(trackName, volume);
                this.updateVolumeDisplay(e.target, e.target.value);
            });
        });

        // Visualizer track selection
        document.querySelectorAll('input[name="visualizerTrack"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.currentVisualizerTrack = e.target.value;
                }
            });
        });
    }

    async setupWebAudioAPI() {
        const trackNames = ['breath', 'music', 'percussion', 'voice'];
        
        for (const track of trackNames) {
            try {
                // Create audio context
                this.audioContexts[track] = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create analyser
                this.analysers[track] = this.audioContexts[track].createAnalyser();
                this.analysers[track].fftSize = 256;
                this.analysers[track].smoothingTimeConstant = 0.8;
                
                // Create source from audio element
                this.sources[track] = this.audioContexts[track].createMediaElementSource(this.audioElements[track]);
                
                // Connect: source -> analyser -> destination
                this.sources[track].connect(this.analysers[track]);
                this.analysers[track].connect(this.audioContexts[track].destination);
                
            } catch (error) {
                console.error(`Error setting up Web Audio API for ${track}:`, error);
            }
        }
    }

    getTrackNameFromAudioId(audioId) {
        return audioId.replace('Audio', '').toLowerCase();
    }

    async togglePlayPause(trackName, button) {
        const audio = this.audioElements[trackName];
        const playIcon = button.querySelector('.play-icon');
        const pauseIcon = button.querySelector('.pause-icon');

        try {
            if (audio.paused) {
                // Resume audio context if suspended
                if (this.audioContexts[trackName] && this.audioContexts[trackName].state === 'suspended') {
                    await this.audioContexts[trackName].resume();
                }
                
                await audio.play();
                button.classList.add('playing');
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                audio.pause();
                button.classList.remove('playing');
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        } catch (error) {
            console.error(`Error toggling play/pause for ${trackName}:`, error);
        }
    }

    async playAll() {
        const trackNames = ['breath', 'music', 'percussion', 'voice'];
        
        for (const track of trackNames) {
            try {
                // Resume audio context if suspended
                if (this.audioContexts[track] && this.audioContexts[track].state === 'suspended') {
                    await this.audioContexts[track].resume();
                }
                
                await this.audioElements[track].play();
                
                // Update button state
                const button = document.querySelector(`[data-audio="${track}Audio"]`);
                if (button) {
                    button.classList.add('playing');
                    button.querySelector('.play-icon').style.display = 'none';
                    button.querySelector('.pause-icon').style.display = 'block';
                }
            } catch (error) {
                console.error(`Error playing ${track}:`, error);
            }
        }
    }

    pauseAll() {
        const trackNames = ['breath', 'music', 'percussion', 'voice'];
        
        trackNames.forEach(track => {
            this.audioElements[track].pause();
            
            // Update button state
            const button = document.querySelector(`[data-audio="${track}Audio"]`);
            if (button) {
                button.classList.remove('playing');
                button.querySelector('.play-icon').style.display = 'block';
                button.querySelector('.pause-icon').style.display = 'none';
            }
        });
    }

    setVolume(trackName, volume) {
        this.audioElements[trackName].volume = volume;
    }

    updateVolumeDisplay(slider, value) {
        const volumeValue = slider.parentElement.querySelector('.volume-value');
        if (volumeValue) {
            volumeValue.textContent = `${value}%`;
        }
    }

    startVisualizer() {
        if (this.isVisualizerRunning) return;
        
        this.isVisualizerRunning = true;
        this.drawVisualizer();
    }

    drawVisualizer() {
        if (!this.isVisualizerRunning) return;

        let dataArray;
        let bufferLength;

        if (this.currentVisualizerTrack === 'all') {
            // Combine data from all tracks
            const trackNames = ['breath', 'music', 'percussion', 'voice'];
            const allData = [];
            let maxBufferLength = 0;

            // Get data from all available analysers
            trackNames.forEach(track => {
                if (this.analysers[track]) {
                    const trackBufferLength = this.analysers[track].frequencyBinCount;
                    const trackDataArray = new Uint8Array(trackBufferLength);
                    this.analysers[track].getByteFrequencyData(trackDataArray);
                    allData.push(trackDataArray);
                    maxBufferLength = Math.max(maxBufferLength, trackBufferLength);
                }
            });

            if (allData.length === 0) {
                requestAnimationFrame(() => this.drawVisualizer());
                return;
            }

            // Combine all frequency data
            bufferLength = maxBufferLength;
            dataArray = new Uint8Array(bufferLength);
            
            for (let i = 0; i < bufferLength; i++) {
                let sum = 0;
                let count = 0;
                allData.forEach(trackData => {
                    if (i < trackData.length) {
                        sum += trackData[i];
                        count++;
                    }
                });
                dataArray[i] = count > 0 ? sum / count : 0;
            }
        } else {
            // Single track visualization
            const analyser = this.analysers[this.currentVisualizerTrack];
            
            if (!analyser) {
                requestAnimationFrame(() => this.drawVisualizer());
                return;
            }

            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
        }

        const canvas = this.canvas;
        const ctx = this.canvasContext;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw frequency bars in circular pattern
        const barCount = 64; // Use fewer bars for cleaner look
        const angleStep = (2 * Math.PI) / barCount;
        
        // Find the maximum amplitude for normalization
        let maxAmplitude = 0;
        for (let i = 0; i < Math.min(barCount, bufferLength); i++) {
            const dataIndex = Math.floor((i / barCount) * bufferLength);
            maxAmplitude = Math.max(maxAmplitude, dataArray[dataIndex]);
        }
        
        // Ensure we have some minimum activity for visualization
        maxAmplitude = Math.max(maxAmplitude, 30);
        
        for (let i = 0; i < barCount; i++) {
            // Use a logarithmic distribution to better represent frequency spectrum
            const logIndex = Math.floor(Math.pow(i / barCount, 1.5) * bufferLength);
            const dataIndex = Math.min(logIndex, bufferLength - 1);
            
            let amplitude = dataArray[dataIndex] / maxAmplitude;
            
            // Add some base activity and smooth the amplitude
            amplitude = Math.max(amplitude, 0.1) * 0.8 + 0.2;
            amplitude = Math.min(amplitude, 1);
            
            const angle = i * angleStep - Math.PI / 2; // Start from top
            const barHeight = amplitude * (radius * 0.4);
            
            // Calculate positions
            const innerRadius = radius * 0.6;
            const outerRadius = innerRadius + barHeight;
            
            const x1 = centerX + Math.cos(angle) * innerRadius;
            const y1 = centerY + Math.sin(angle) * innerRadius;
            const x2 = centerX + Math.cos(angle) * outerRadius;
            const y2 = centerY + Math.sin(angle) * outerRadius;

            // Color based on amplitude and track with more variation
            const hue = this.getTrackHue(this.currentVisualizerTrack);
            const saturation = 60 + (amplitude * 40);
            const lightness = 40 + (amplitude * 40);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Draw center circle with pulsing effect
        const avgAmplitude = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength / 255;
        const pulseRadius = 20 + (avgAmplitude * 15);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
        const hue = this.getTrackHue(this.currentVisualizerTrack);
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${0.3 + avgAmplitude * 0.4})`;
        ctx.fill();

        // Draw track name in center
        ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.currentVisualizerTrack.toUpperCase(), centerX, centerY);

        requestAnimationFrame(() => this.drawVisualizer());
    }

    getTrackHue(trackName) {
        const hues = {
            breath: 200,    // Blue
            music: 280,     // Purple
            percussion: 30, // Orange
            voice: 120,     // Green
            all: 320        // Magenta/Pink for combined visualization
        };
        return hues[trackName] || 200;
    }

    stopVisualizer() {
        this.isVisualizerRunning = false;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MeditationAudioMixer();
});

// Handle page visibility changes to manage audio contexts
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, you might want to pause audio or reduce processing
        console.log('Page hidden');
    } else {
        // Page is visible again
        console.log('Page visible');
    }
});
