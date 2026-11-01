/**
 * grimace-core.js - WebGL Grimace 3D Controller
 * Manages Scene, Camera, Generational Modes (1971 / 1980 / 2026), and Reaction Triggers.
 */

(function() {
    let scene, camera, renderer, mascotObj, particlesObj;
    let container;
    let clock = new THREE.Clock();
    let currentMode = "1980"; // "1971" (Evil 4-arms), "1980" (Classic 2-arms), "2026" (Cyber Overdrive)
    let isOverdrive = false;
    let targetRotationY = 0;
    let isWaving = false;
    let waveTimer = 0;

    function initGrimace(mountId) {
        container = document.getElementById(mountId);
        if (!container) return;

        const width = container.clientWidth || 380;
        const height = container.clientHeight || 380;

        // 1. Scene & Camera
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
        camera.position.set(0, 0.15, 6.6);
        camera.lookAt(0, -0.12, 0);

        // 2. WebGL Renderer with Alpha
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        // 3. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfbbf24, 0.85); // Warm golden light
        dirLight.position.set(3, 5, 4);
        scene.add(dirLight);

        const purpleRimLight = new THREE.DirectionalLight(0xc084fc, 0.9); // Purple rim light
        purpleRimLight.position.set(-3, -2, -2);
        scene.add(purpleRimLight);

        // 4. Build Mascot & Particles
        mascotObj = window.buildGrimaceMesh(THREE);
        scene.add(mascotObj.root);

        particlesObj = window.buildGrimaceParticles(THREE, 180);
        scene.add(particlesObj.points);

        // 5. Interactive Mouse / Pointer Tracking
        container.addEventListener("mousemove", onMouseMove);
        window.addEventListener("resize", onWindowResize);

        animate();
    }

    function onMouseMove(e) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        targetRotationY = mouseX * 0.45;

        // Move irises slightly toward pointer
        if (mascotObj && mascotObj.parts && mascotObj.parts.lookAt) {
            mascotObj.parts.lookAt(mouseX, mouseY);
        }
    }

    function onWindowResize() {
        if (!container || !camera || !renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        // 1. Idle mascot breathing / wobble
        if (mascotObj && mascotObj.root) {
            // Smooth rotation interpolation
            mascotObj.root.rotation.y += (targetRotationY - mascotObj.root.rotation.y) * 0.08;

            // Idle breathing bob
            const bobSpeed = isOverdrive ? 6.0 : 2.2;
            const bobAmp = isOverdrive ? 0.08 : 0.04;
            mascotObj.root.position.y = Math.sin(elapsed * bobSpeed) * bobAmp;

            // Subtle squash & stretch
            const scaleY = 1.0 + Math.sin(elapsed * bobSpeed) * 0.015;
            mascotObj.root.scale.set(1.0, scaleY, 1.0);

            // Arm animations
            const parts = mascotObj.parts;
            if (parts) {
                if (parts.update) parts.update(elapsed);

                // Secondary 1971 Evil arms spin if active
                if (parts.extraArmsGroup && parts.extraArmsGroup.visible) {
                    parts.upperLeftArm.rotation.x = Math.sin(elapsed * 4.0) * 0.4 - 0.2;
                    parts.upperRightArm.rotation.x = -Math.sin(elapsed * 4.0) * 0.4 - 0.2;
                }

                // Friendly waving gesture (right arm swings up and out)
                if (isWaving) {
                    waveTimer -= delta;
                    parts.rightArm.rotation.z = 2.3 + Math.sin(elapsed * 12.0) * 0.3;
                    if (waveTimer <= 0) {
                        isWaving = false;
                        parts.rightArm.rotation.z = 0.3;
                    }
                } else {
                    parts.rightArm.rotation.z = 0.3 + Math.sin(elapsed * 2.0) * 0.03;
                }
                parts.leftArm.rotation.z = -0.3 - Math.sin(elapsed * 2.0) * 0.03;
            }
        }

        // 2. Particle vortex update
        if (particlesObj) {
            const speed = isOverdrive ? 3.5 : (currentMode === "1971" ? 1.8 : 0.8);
            particlesObj.update(delta, speed);
        }

        renderer.render(scene, camera);
    }

    // Public API for Dashboard & Board Interactions
    window.GrimaceEngine = {
        init: initGrimace,

        setMode: function(mode) {
            currentMode = mode;
            if (!mascotObj || !mascotObj.parts) return;

            const parts = mascotObj.parts;
            const paint = (base, tip) => {
                if (parts.setFurColor) parts.setFurColor(base, tip);
            };
            if (mode === "1971") {
                // 1971 EVIL GRIMACE: 4 arms, shake-stealing kinetic mode
                parts.extraArmsGroup.visible = true;
                paint(0x5b3a9e, 0x8d6cc9); // Darker vintage purple
                console.log("🎩 Grimace Mode: 1971 Evil Grimace (4 Arms Active)");
            } else if (mode === "1980") {
                // 1980s CLASSIC / Grimace Shake reference lavender
                parts.extraArmsGroup.visible = false;
                paint(0x8f6fd8, 0xc3adf5);
                console.log("🎩 Grimace Mode: 1980s Classic Friendly Taste Bud");
            } else if (mode === "2026") {
                // 2026 GOLDEN EDITION: brighter fur with golden-frosted tips
                parts.extraArmsGroup.visible = false;
                paint(0x9b78ec, 0xf1d28a);
                console.log("🎩 Grimace Mode: 2026 Cyber Golden Shake Overdrive");
            }
        },

        wave: function(duration = 2.0) {
            isWaving = true;
            waveTimer = duration;
        },

        setOverdrive: function(active) {
            isOverdrive = active;
            if (active) {
                targetRotationY = 0;
                this.setMode("2026");
            } else {
                this.setMode("1980");
            }
        },

        reactToProperty: function(propertyData) {
            if (!propertyData) return;
            if (propertyData.is_collected) {
                // Happy wave
                this.wave(2.5);
            } else if (propertyData.is_rare) {
                // Rare piece alert: shake head slightly
                targetRotationY = 0.5;
                setTimeout(() => { targetRotationY = -0.5; }, 200);
                setTimeout(() => { targetRotationY = 0; }, 400);
            }
        }
    };
})();
