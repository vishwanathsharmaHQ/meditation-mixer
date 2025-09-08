class MeditationAudioMixer {
    constructor() {
        this.audioElements = {};
        this.audioContext = null;
        this.analysers = {};
        this.sources = {};
        this.pannerNodes = {};
        this.gainNodes = {};
        this.currentVisualizerTrack = 'breath';
        this.isVisualizerRunning = false;
        this.canvas = null;
        this.canvasContext = null;
        this.spatialCanvas = null;
        this.spatialContext = null;
        
        // 3D Spatial Audio Properties
        this.audioSources = {
            breath: { x: 0, y: 0, z: 0, color: 'hsl(200, 70%, 60%)' },
            music: { x: 2, y: 0, z: 0, color: 'hsl(280, 70%, 60%)' },
            percussion: { x: -2, y: 0, z: 0, color: 'hsl(30, 70%, 60%)' },
            voice: { x: 0, y: 2, z: 0, color: 'hsl(120, 70%, 60%)' }
        };
        
        this.listener = { x: 0, y: 0, z: 0 };
        this.isDragging = false;
        this.dragTarget = null;
        this.canvasSize = 400;
        this.maxDistance = 5;
        
        this.init();
    }

    async init() {
        this.setupAudioElements();
        this.setupCanvas();
        this.setupSpatialCanvas();
        this.setupEventListeners();
        await this.setupWebAudioAPI();
        this.startVisualizer();
        this.drawSpatialCanvas();
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

    setupSpatialCanvas() {
        this.spatialCanvas = document.getElementById('spatialCanvas');
        this.spatialContext = this.spatialCanvas.getContext('2d');
        
        // Set canvas size
        this.spatialCanvas.width = this.canvasSize;
        this.spatialCanvas.height = this.canvasSize;
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

        // Spatial control preset buttons
        document.getElementById('resetPositions').addEventListener('click', () => this.resetPositions());
        document.getElementById('surroundPreset').addEventListener('click', () => this.setSurroundPreset());
        document.getElementById('frontPreset').addEventListener('click', () => this.setFrontPreset());

        // Spatial canvas mouse events
        this.spatialCanvas.addEventListener('mousedown', (e) => this.onSpatialMouseDown(e));
        this.spatialCanvas.addEventListener('mousemove', (e) => this.onSpatialMouseMove(e));
        this.spatialCanvas.addEventListener('mouseup', () => this.onSpatialMouseUp());
        this.spatialCanvas.addEventListener('mouseleave', () => this.onSpatialMouseUp());

        // Touch events for mobile
        this.spatialCanvas.addEventListener('touchstart', (e) => this.onSpatialTouchStart(e));
        this.spatialCanvas.addEventListener('touchmove', (e) => this.onSpatialTouchMove(e));
        this.spatialCanvas.addEventListener('touchend', () => this.onSpatialMouseUp());
    }

    async setupWebAudioAPI() {
        try {
            // Create single audio context for all tracks
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const trackNames = ['breath', 'music', 'percussion', 'voice'];
            
            for (const track of trackNames) {
                // Create analyser for visualization
                this.analysers[track] = this.audioContext.createAnalyser();
                this.analysers[track].fftSize = 256;
                this.analysers[track].smoothingTimeConstant = 0.8;
                
                // Create gain node for volume control
                this.gainNodes[track] = this.audioContext.createGain();
                this.gainNodes[track].gain.value = 0.7;
                
                // Create panner node for 3D positioning
                this.pannerNodes[track] = this.audioContext.createPanner();
                this.setupPannerNode(this.pannerNodes[track]);
                
                // Create source from audio element
                this.sources[track] = this.audioContext.createMediaElementSource(this.audioElements[track]);
                
                // Connect: source -> gain -> panner -> analyser -> destination
                this.sources[track].connect(this.gainNodes[track]);
                this.gainNodes[track].connect(this.pannerNodes[track]);
                this.pannerNodes[track].connect(this.analysers[track]);
                this.analysers[track].connect(this.audioContext.destination);
                
                // Set initial position
                this.updateAudioPosition(track);
            }
            
            // Setup listener
            this.setupAudioListener();
            
        } catch (error) {
            console.error('Error setting up Web Audio API:', error);
        }
    }

    setupPannerNode(pannerNode) {
        // Configure panner for optimal 3D audio
        pannerNode.panningModel = 'HRTF';
        pannerNode.distanceModel = 'inverse';
        pannerNode.refDistance = 1;
        pannerNode.maxDistance = 10;
        pannerNode.rolloffFactor = 1;
        pannerNode.coneInnerAngle = 360;
        pannerNode.coneOuterAngle = 0;
        pannerNode.coneOuterGain = 0;
    }

    setupAudioListener() {
        if (this.audioContext.listener.positionX) {
            // Modern browsers with AudioParam
            this.audioContext.listener.positionX.value = this.listener.x;
            this.audioContext.listener.positionY.value = this.listener.y;
            this.audioContext.listener.positionZ.value = this.listener.z;
            
            this.audioContext.listener.forwardX.value = 0;
            this.audioContext.listener.forwardY.value = 0;
            this.audioContext.listener.forwardZ.value = -1;
            
            this.audioContext.listener.upX.value = 0;
            this.audioContext.listener.upY.value = 1;
            this.audioContext.listener.upZ.value = 0;
        } else {
            // Fallback for older browsers
            this.audioContext.listener.setPosition(this.listener.x, this.listener.y, this.listener.z);
            this.audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0);
        }
    }

    updateAudioPosition(trackName) {
        const source = this.audioSources[trackName];
        const pannerNode = this.pannerNodes[trackName];
        
        if (pannerNode && source) {
            if (pannerNode.positionX) {
                // Modern browsers with AudioParam
                pannerNode.positionX.value = source.x;
                pannerNode.positionY.value = source.y;
                pannerNode.positionZ.value = source.z;
            } else {
                // Fallback for older browsers
                pannerNode.setPosition(source.x, source.y, source.z);
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
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
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
        
        // Resume audio context if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        for (const track of trackNames) {
            try {
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
        if (this.gainNodes[trackName]) {
            this.gainNodes[trackName].gain.value = volume;
        }
    }

    updateVolumeDisplay(slider, value) {
        const volumeValue = slider.parentElement.querySelector('.volume-value');
        if (volumeValue) {
            volumeValue.textContent = `${value}%`;
        }
    }

    // Spatial Audio Control Methods
    resetPositions() {
        this.audioSources.breath = { ...this.audioSources.breath, x: 0, y: 0, z: 0 };
        this.audioSources.music = { ...this.audioSources.music, x: 2, y: 0, z: 0 };
        this.audioSources.percussion = { ...this.audioSources.percussion, x: -2, y: 0, z: 0 };
        this.audioSources.voice = { ...this.audioSources.voice, x: 0, y: 2, z: 0 };
        
        Object.keys(this.audioSources).forEach(track => {
            this.updateAudioPosition(track);
        });
        
        this.drawSpatialCanvas();
    }

    setSurroundPreset() {
        this.audioSources.breath = { ...this.audioSources.breath, x: 0, y: 3, z: 0 };
        this.audioSources.music = { ...this.audioSources.music, x: 3, y: 0, z: 0 };
        this.audioSources.percussion = { ...this.audioSources.percussion, x: 0, y: -3, z: 0 };
        this.audioSources.voice = { ...this.audioSources.voice, x: -3, y: 0, z: 0 };
        
        Object.keys(this.audioSources).forEach(track => {
            this.updateAudioPosition(track);
        });
        
        this.drawSpatialCanvas();
    }

    setFrontPreset() {
        this.audioSources.breath = { ...this.audioSources.breath, x: -1, y: 2, z: 0 };
        this.audioSources.music = { ...this.audioSources.music, x: 1, y: 2, z: 0 };
        this.audioSources.percussion = { ...this.audioSources.percussion, x: -2, y: 1, z: 0 };
        this.audioSources.voice = { ...this.audioSources.voice, x: 2, y: 1, z: 0 };
        
        Object.keys(this.audioSources).forEach(track => {
            this.updateAudioPosition(track);
        });
        
        this.drawSpatialCanvas();
    }

    // Spatial Canvas Interaction Methods
    getCanvasCoordinates(e) {
        const rect = this.spatialCanvas.getBoundingClientRect();
        const scaleX = this.spatialCanvas.width / rect.width;
        const scaleY = this.spatialCanvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    getTouchCoordinates(e) {
        const rect = this.spatialCanvas.getBoundingClientRect();
        const scaleX = this.spatialCanvas.width / rect.width;
        const scaleY = this.spatialCanvas.height / rect.height;
        
        const touch = e.touches[0];
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY
        };
    }

    worldToCanvas(worldX, worldY) {
        const centerX = this.canvasSize / 2;
        const centerY = this.canvasSize / 2;
        const scale = (this.canvasSize / 2) / this.maxDistance;
        
        return {
            x: centerX + worldX * scale,
            y: centerY - worldY * scale // Flip Y axis
        };
    }

    canvasToWorld(canvasX, canvasY) {
        const centerX = this.canvasSize / 2;
        const centerY = this.canvasSize / 2;
        const scale = this.maxDistance / (this.canvasSize / 2);
        
        return {
            x: (canvasX - centerX) * scale,
            y: -(canvasY - centerY) * scale // Flip Y axis
        };
    }

    getTrackAtPosition(canvasX, canvasY) {
        const trackNames = Object.keys(this.audioSources);
        
        for (const track of trackNames) {
            const source = this.audioSources[track];
            const canvasPos = this.worldToCanvas(source.x, source.y);
            const distance = Math.sqrt(
                Math.pow(canvasX - canvasPos.x, 2) + 
                Math.pow(canvasY - canvasPos.y, 2)
            );
            
            if (distance <= 15) { // 15px radius for interaction
                return track;
            }
        }
        
        return null;
    }

    onSpatialMouseDown(e) {
        const coords = this.getCanvasCoordinates(e);
        const track = this.getTrackAtPosition(coords.x, coords.y);
        
        if (track) {
            this.isDragging = true;
            this.dragTarget = track;
            this.spatialCanvas.style.cursor = 'grabbing';
        }
    }

    onSpatialMouseMove(e) {
        const coords = this.getCanvasCoordinates(e);
        
        if (this.isDragging && this.dragTarget) {
            const worldPos = this.canvasToWorld(coords.x, coords.y);
            
            // Constrain to max distance
            const distance = Math.sqrt(worldPos.x * worldPos.x + worldPos.y * worldPos.y);
            if (distance > this.maxDistance) {
                const scale = this.maxDistance / distance;
                worldPos.x *= scale;
                worldPos.y *= scale;
            }
            
            this.audioSources[this.dragTarget].x = worldPos.x;
            this.audioSources[this.dragTarget].y = worldPos.y;
            
            this.updateAudioPosition(this.dragTarget);
            this.drawSpatialCanvas();
        } else {
            // Update cursor based on hover
            const track = this.getTrackAtPosition(coords.x, coords.y);
            this.spatialCanvas.style.cursor = track ? 'grab' : 'default';
        }
    }

    onSpatialMouseUp() {
        this.isDragging = false;
        this.dragTarget = null;
        this.spatialCanvas.style.cursor = 'default';
    }

    onSpatialTouchStart(e) {
        e.preventDefault();
        const coords = this.getTouchCoordinates(e);
        const track = this.getTrackAtPosition(coords.x, coords.y);
        
        if (track) {
            this.isDragging = true;
            this.dragTarget = track;
        }
    }

    onSpatialTouchMove(e) {
        e.preventDefault();
        if (this.isDragging && this.dragTarget) {
            const coords = this.getTouchCoordinates(e);
            const worldPos = this.canvasToWorld(coords.x, coords.y);
            
            // Constrain to max distance
            const distance = Math.sqrt(worldPos.x * worldPos.x + worldPos.y * worldPos.y);
            if (distance > this.maxDistance) {
                const scale = this.maxDistance / distance;
                worldPos.x *= scale;
                worldPos.y *= scale;
            }
            
            this.audioSources[this.dragTarget].x = worldPos.x;
            this.audioSources[this.dragTarget].y = worldPos.y;
            
            this.updateAudioPosition(this.dragTarget);
            this.drawSpatialCanvas();
        }
    }

    // Spatial Canvas Drawing
    drawSpatialCanvas() {
        const ctx = this.spatialContext;
        const centerX = this.canvasSize / 2;
        const centerY = this.canvasSize / 2;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
        
        // Draw background grid
        this.drawGrid(ctx);
        
        // Draw distance circles
        this.drawDistanceCircles(ctx, centerX, centerY);
        
        // Draw listener (center)
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw listener label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('YOU', centerX, centerY - 20);
        
        // Draw audio sources
        Object.keys(this.audioSources).forEach(track => {
            this.drawAudioSource(ctx, track);
        });
        
        // Draw connection lines
        this.drawConnectionLines(ctx, centerX, centerY);
    }

    drawGrid(ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        const gridSize = 40;
        for (let x = 0; x <= this.canvasSize; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvasSize);
            ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvasSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvasSize, y);
            ctx.stroke();
        }
    }

    drawDistanceCircles(ctx, centerX, centerY) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        
        const scale = (this.canvasSize / 2) / this.maxDistance;
        for (let i = 1; i <= this.maxDistance; i++) {
            const radius = i * scale;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    drawAudioSource(ctx, trackName) {
        const source = this.audioSources[trackName];
        const canvasPos = this.worldToCanvas(source.x, source.y);
        
        // Draw source dot
        ctx.fillStyle = source.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(trackName.toUpperCase(), canvasPos.x, canvasPos.y - 15);
        
        // Draw distance indicator
        const distance = Math.sqrt(source.x * source.x + source.y * source.y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '8px Arial';
        ctx.fillText(`${distance.toFixed(1)}m`, canvasPos.x, canvasPos.y + 20);
    }

    drawConnectionLines(ctx, centerX, centerY) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        Object.keys(this.audioSources).forEach(track => {
            const source = this.audioSources[track];
            const canvasPos = this.worldToCanvas(source.x, source.y);
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(canvasPos.x, canvasPos.y);
            ctx.stroke();
        });
        
        ctx.setLineDash([]);
    }

    // Visualizer Methods (existing functionality)
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

        const analyser = this.analysers[this.currentVisualizerTrack];
        
        if (!analyser) {
            avgAmplitude = 0.1;
        } else {
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            avgAmplitude = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength / 255;
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
        const breathProgress = Math.min(this.smoothedAmplitude * 2, 1);
        const easedProgress = this.easeInOutSine(breathProgress);

        // Grid configuration
        const gridSize = 15;
        const dotSize = 12;
        const spacing = 20;
        const totalWidth = (gridSize - 1) * spacing;
        const totalHeight = (gridSize - 1) * spacing;
        const startX = centerX - totalWidth / 2;
        const startY = centerY - totalHeight / 2;

        // Calculate how many dots to fill based on breathing progress
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

                const distanceFromCenter = Math.sqrt(
                    Math.pow(col - centerDot, 2) + Math.pow(row - centerDot, 2)
                );

                const shouldFill = distanceFromCenter <= currentRadius;

                if (shouldFill) {
                    const intensity = 1 - (distanceFromCenter / currentRadius) * 0.3;
                    ctx.fillStyle = `hsla(${hue}, 70%, ${50 + intensity * 30}%, ${0.8 + intensity * 0.2})`;
                    ctx.fillRect(x, y, dotSize, dotSize);
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, dotSize, dotSize);
                }
            }
        }

        // Draw track name
        ctx.fillStyle = `hsl(${hue}, 70%, 70%)`;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.currentVisualizerTrack.toUpperCase(), centerX, centerY + totalHeight / 2 + 40);

        requestAnimationFrame(() => this.drawVisualizer());
    }

    easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    getTrackHue(trackName) {
        const hues = {
            breath: 200,
            music: 280,
            percussion: 30,
            voice: 120
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
        console.log('Page hidden');
    } else {
        console.log('Page visible');
    }
});
