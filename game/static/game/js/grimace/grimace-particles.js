/**
 * grimace-particles.js - Multi-Character McDonaldland & Monopoly Color Spectrum Vortex
 *
 * Celebrates all 5 3D characters (Grimace, Birdie, Hamburglar, Ronald McDonald,
 * and Mr. Monopoly) plus the official Monopoly property color groups with a neutral-white
 * soft glow sprite so every vertex color shines at full saturation.
 */

window.buildGrimaceParticles = function(THREE, particleCount = 220) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const angles = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);
    const vSpeeds = new Float32Array(particleCount);

    // Full McDonaldland + Monopoly 2026 Golden Edition color spectrum
    const multiCharacterPalette = [
        new THREE.Color(0xa855f7), // Grimace Shake Purple
        new THREE.Color(0xc084fc), // Grimace Lavender Highlight
        new THREE.Color(0xfacc15), // Golden Arches & Birdie Feather Yellow
        new THREE.Color(0xec4899), // Birdie Coveralls Magenta-Pink
        new THREE.Color(0x38bdf8), // Birdie Aviator Goggle Sky-Cyan
        new THREE.Color(0xef4444), // Hamburglar & Ronald Crimson Red
        new THREE.Color(0xf97316), // Hamburglar Ginger & Burger Bun Orange
        new THREE.Color(0xf8fafc), // Hamburglar Stripe & Ronald Clown White
        new THREE.Color(0x10b981), // Mr. Monopoly Emerald Cash Green
        new THREE.Color(0x3b82f6), // Monopoly Boardwalk Royal Blue
        new THREE.Color(0xfde047)  // 24k Gold Overdrive Spark
    ];

    for (let i = 0; i < particleCount; i++) {
        const radius = 1.2 + Math.random() * 2.3;
        const angle = Math.random() * Math.PI * 2;
        const y = -1.6 + Math.random() * 3.6;

        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(angle) * radius;

        radii[i] = radius;
        angles[i] = angle;
        vSpeeds[i] = 0.5 + Math.random() * 1.5;
        scales[i] = 2.0 + Math.random() * 4.0;

        const col = multiCharacterPalette[i % multiCharacterPalette.length];
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Pure white radial gradient sprite so vertexColors render with 100% true multi-color fidelity
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.28)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        size: 0.22,
        map: texture,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const points = new THREE.Points(geometry, material);

    return {
        points,
        update: function(delta, speedMultiplier = 1.0) {
            const pos = geometry.attributes.position.array;
            for (let i = 0; i < particleCount; i++) {
                angles[i] += delta * vSpeeds[i] * speedMultiplier * 1.8;
                pos[i * 3] = Math.cos(angles[i]) * radii[i];
                pos[i * 3 + 2] = Math.sin(angles[i]) * radii[i];
                pos[i * 3 + 1] += delta * (0.8 * speedMultiplier);

                // Recycle back to bottom
                if (pos[i * 3 + 1] > 2.5) {
                    pos[i * 3 + 1] = -1.6;
                }
            }
            geometry.attributes.position.needsUpdate = true;
        }
    };
};
