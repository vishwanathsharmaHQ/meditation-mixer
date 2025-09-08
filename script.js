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
        
        // Create separate audio contexts for each track to avoid conflicts
        for (const track of trackNames) {
            try {
                // Create individual audio context for each track
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
                // Create fallback analyser
                this.analysers[track] = null;
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
                // Resume individual audio context if suspended
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
                // Resume individual audio context if suspended
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
        let avgAmplitude = 0;

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
                // Fallback to default breathing pattern
                avgAmplitude = 0.1;
            } else {
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
                // Calculate average amplitude from audio data
                avgAmplitude = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength / 255;
            }
        } else {
            // Single track visualization
            const analyser = this.analysers[this.currentVisualizerTrack];
            
            if (!analyser) {
                // Fallback to default breathing pattern
                avgAmplitude = 0.1;
            } else {
                bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);
                // Calculate average amplitude from audio data
                avgAmplitude = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength / 255;
            }
        }

        // Smooth the amplitude changes
        if (!this.smoothedAmplitude) this.smoothedAmplitude = avgAmplitude;
        this.smoothedAmplitude = this.smoothedAmplitude * 0.8 + avgAmplitude * 0.2;

        const canvas = this.canvas;
        const ctx = this.canvasContext;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Use audio amplitude to drive the breathing pattern
        const breathProgress = Math.min(this.smoothedAmplitude * 2, 1); // Scale amplitude to 0-1
        const easedProgress = this.easeInOutSine(breathProgress);

        // Grid configuration
        const gridSize = 15; // 15x15 grid
        const dotSize = 12;
        const spacing = 20;
        const totalWidth = (gridSize - 1) * spacing;
        const totalHeight = (gridSize - 1) * spacing;
        const startX = centerX - totalWidth / 2;
        const startY = centerY - totalHeight / 2;

        // Calculate how many dots to fill based on breathing progress
        const totalDots = gridSize * gridSize;
        const centerDot = Math.floor(gridSize / 2);
        const maxRadius = Math.sqrt(2 * Math.pow(centerDot, 2));
        const currentRadius = easedProgress * maxRadius;

        // Get track color
        const hue = this.getTrackHue(this.currentVisualizerTrack);

        // Draw squares in grid pattern
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const x = startX + col * spacing - dotSize / 2;
                const y = startY + row * spacing - dotSize / 2;

                // Calculate distance from center
                const distanceFromCenter = Math.sqrt(
                    Math.pow(col - centerDot, 2) + Math.pow(row - centerDot, 2)
                );

                // Determine if this square should be filled
                const shouldFill = distanceFromCenter <= currentRadius;

                if (shouldFill) {
                    // Filled square with breathing color
                    const intensity = 1 - (distanceFromCenter / currentRadius) * 0.3;
                    ctx.fillStyle = `hsla(${hue}, 70%, ${50 + intensity * 30}%, ${0.8 + intensity * 0.2})`;
                    ctx.fillRect(x, y, dotSize, dotSize);
                } else {
                    // Empty square (outline only)
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, dotSize, dotSize);
                }
            }
        }

        // Draw breathing instruction text based on amplitude
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const instructionText = breathProgress > 0.3 ? 'BREATHE IN' : 'BREATHE OUT';
        ctx.fillText(instructionText, centerX, centerY + totalHeight / 2 + 40);
        
        // Show amplitude level
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '12px Arial';
        ctx.fillText(`Audio Level: ${Math.round(avgAmplitude * 100)}%`, centerX, centerY + totalHeight / 2 + 20);

        // Draw track name
        ctx.fillStyle = `hsl(${hue}, 70%, 70%)`;
        ctx.font = 'bold 12px Arial';
        ctx.fillText(this.currentVisualizerTrack.toUpperCase(), centerX, centerY + totalHeight / 2 + 60);

        requestAnimationFrame(() => this.drawVisualizer());
    }

    easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
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
