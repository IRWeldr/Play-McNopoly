/**
 * mascot-core.js - Unified 3D Mascot Arena Controller
 * Supports seamless switching between Grimace, Birdie, Hamburglar, Ronald, and Mr. Monopoly,
 * Pointer tracking, Era modes, and Boardroom reaction gestures.
 */

(function() {
    let scene, camera, renderer, mascotObj, particlesObj;
    let container;
    let clock = new THREE.Clock();
    let currentMascot = "grimace"; // "grimace" | "birdie"
    let currentMode = "1980";      // "1971" (Evil 4-arms), "1980" (Classic), "2026" (Cyber Overdrive)
    let isOverdrive = false;
    let targetRotationY = 0;
    let isWaving = false;
    let waveTimer = 0;

    function initMascot(mountId) {
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfbbf24, 0.9); // Warm golden sun
        dirLight.position.set(3, 5, 4);
        scene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(0xc084fc, 0.85); // Rim highlight
        rimLight.position.set(-3, -2, -2);
        scene.add(rimLight);

        // 4. Build Mascot & Particles
        loadMascot(currentMascot);

        particlesObj = window.buildGrimaceParticles(THREE, 180);
        scene.add(particlesObj.points);

        // 5. Interactive Mouse / Touch Pointer Tracking
        container.addEventListener("mousemove", onMouseMove);
        container.addEventListener("touchmove", function(e) {
            if (e.touches && e.touches.length > 0) {
                onMouseMove(e.touches[0]);
            }
        }, { passive: true });
        window.addEventListener("resize", onWindowResize);
        setTimeout(onWindowResize, 60);
        setTimeout(onWindowResize, 250);

        animate();
    }

    function loadMascot(type) {
        if (mascotObj && mascotObj.root) {
            scene.remove(mascotObj.root);
        }

        currentMascot = type;
        if (type === "birdie" && typeof window.buildBirdieMesh === "function") {
            mascotObj = window.buildBirdieMesh(THREE);
            console.log("🐤 Loaded Birdie the Early Bird 3D Mesh");
        } else if (type === "hamburglar" && typeof window.buildHamburglarMesh === "function") {
            mascotObj = window.buildHamburglarMesh(THREE);
            console.log("🍔 Loaded Hamburglar 3D Mesh");
        } else if (type === "ronald" && typeof window.buildRonaldMesh === "function") {
            mascotObj = window.buildRonaldMesh(THREE);
            console.log("🤡 Loaded Ronald McDonald 3D Mesh");
        } else if (type === "monopoly" && typeof window.buildMonopolyMesh === "function") {
            mascotObj = window.buildMonopolyMesh(THREE);
            console.log("🎩 Loaded Mr. Monopoly 3D Mesh");
        } else if (typeof window.buildGrimaceMesh === "function") {
            mascotObj = window.buildGrimaceMesh(THREE);
            console.log("🎩 Loaded Grimace 3D Mesh");
        }
        
        if (mascotObj && mascotObj.root) {
            scene.add(mascotObj.root);
        }
    }

    function onMouseMove(e) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        targetRotationY = mouseX * 0.45;

        // Move irises / head toward pointer
        if (mascotObj) {
            if (mascotObj.lookAt) {
                mascotObj.lookAt(mouseX, mouseY);
            } else if (mascotObj.parts && mascotObj.parts.lookAt) {
                mascotObj.parts.lookAt(mouseX, mouseY);
            }
        }
    }

    function onWindowResize() {
        if (!container || !camera || !renderer) return;
        const width = container.clientWidth || 320;
        const height = container.clientHeight || 260;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        if (mascotObj && mascotObj.root) {
            // Smooth rotation interpolation
            mascotObj.root.rotation.y += (targetRotationY - mascotObj.root.rotation.y) * 0.08;

            // Idle breathing bob (preserving per-mascot vertical framing offset baseY)
            const bobSpeed = isOverdrive ? 6.0 : 2.2;
            const bobAmp = isOverdrive ? 0.08 : 0.04;
            const baseY = mascotObj.baseY !== undefined ? mascotObj.baseY : 0.0;
            mascotObj.root.position.y = baseY + Math.sin(elapsed * bobSpeed) * bobAmp;

            // Mascot-specific continuous animation
            if (mascotObj.update) {
                mascotObj.update(elapsed);
            }

            // Arm/Wing animations for Grimace
            const parts = mascotObj.parts;
            if (parts && parts.rightArm) {
                if (parts.update) parts.update(elapsed);

                // Secondary 1971 Evil arms spin if active
                if (parts.extraArmsGroup && parts.extraArmsGroup.visible) {
                    parts.upperLeftArm.rotation.x = Math.sin(elapsed * 4.0) * 0.4 - 0.2;
                    parts.upperRightArm.rotation.x = -Math.sin(elapsed * 4.0) * 0.4 - 0.2;
                }

                // Friendly waving gesture (shared by all mascots)
                const rest = parts.armRest !== undefined ? parts.armRest : 0.3;
                const lift = parts.waveLift !== undefined ? parts.waveLift : 2.3;
                const isBird = currentMascot === "birdie";
                if (isWaving) {
                    waveTimer -= delta;
                    const speed = isBird ? 16.0 : 12.0;
                    const amp = isBird ? 0.45 : 0.3;
                    parts.rightArm.rotation.z = lift + Math.sin(elapsed * speed) * amp;
                    if (waveTimer <= 0) {
                        isWaving = false;
                        parts.rightArm.rotation.z = rest;
                    }
                } else {
                    parts.rightArm.rotation.z = rest + Math.sin(elapsed * 2.0) * (isBird ? 0.06 : 0.03);
                }
                if (parts.leftArm) {
                    parts.leftArm.rotation.z = -rest - Math.sin(elapsed * 2.0) * (isBird ? 0.06 : 0.03);
                }
            }
        }

        // Particle vortex update
        if (particlesObj) {
            const speed = isOverdrive ? 3.5 : (currentMode === "1971" ? 1.8 : 0.8);
            particlesObj.update(delta, speed);
        }

        renderer.render(scene, camera);
    }

    // Public API
    window.GrimaceEngine = window.MascotEngine = {
        init: function(mountId) {
            initMascot(mountId);
        },

        switchMascot: function(type) {
            loadMascot(type);
        },

        getMascot: function() {
            return currentMascot;
        },

        toggleMonocle: function() {
            if (mascotObj && typeof mascotObj.toggleMonocle === "function") {
                return mascotObj.toggleMonocle();
            }
            return false;
        },

        setMonocle: function(enabled) {
            if (mascotObj && typeof mascotObj.setMonocle === "function") {
                return mascotObj.setMonocle(enabled);
            }
            return false;
        },

        setMode: function(mode) {
            currentMode = mode;
            if (!mascotObj || !mascotObj.parts) return;
            const parts = mascotObj.parts;

            if (typeof parts.setEraMode === "function") {
                parts.setEraMode(mode);
            }

            // Applies to Grimace modes or Mr. Monopoly Mandela Timeline
            if (currentMascot === "grimace") {
                const paint = (base, tip) => {
                    if (parts.setFurColor) parts.setFurColor(base, tip);
                };
                if (mode === "1971") {
                    if (parts.extraArmsGroup) parts.extraArmsGroup.visible = true;
                    paint(0x5b3a9e, 0x8d6cc9);
                } else if (mode === "1980") {
                    if (parts.extraArmsGroup) parts.extraArmsGroup.visible = false;
                    paint(0x8f6fd8, 0xc3adf5);
                } else if (mode === "2026") {
                    if (parts.extraArmsGroup) parts.extraArmsGroup.visible = false;
                    paint(0x9b78ec, 0xf1d28a);
                }
            } else if (currentMascot === "monopoly" && parts.setMonocle && typeof parts.setEraMode !== "function") {
                const on = mode !== "1980";
                parts.setMonocle(on);
                if (typeof window.syncMonocleButtonUI === "function") {
                    window.syncMonocleButtonUI(on);
                }
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
                this.wave(2.5);
            } else if (propertyData.is_rare) {
                targetRotationY = 0.5;
                setTimeout(() => { targetRotationY = -0.5; }, 200);
                setTimeout(() => { targetRotationY = 0; }, 400);
            }
        }
    };
})();
