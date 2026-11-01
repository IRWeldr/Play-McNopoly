/**
 * birdie-mesh.js - Procedural 3D Birdie the Early Bird (Feathered Edition)
 *
 * Shares Grimace's architecture so both mascots behave identically:
 *  - Shell-textured GLSL "feather" shader (same technique as Grimace's fur, but
 *    with elongated, overlapping, downward-lying feather cells + quill shading)
 *  - Lathe-profile pear body (like Grimace's egg body) under felt overalls
 *  - Shoulder-pivot wing-arms exported as `rightArm` / `leftArm`, so
 *    mascot-core.js drives the exact same wave / idle sway as Grimace
 *  - Shared `setFurColor`, `lookAt`, `update` API
 * Air-gapped: no external textures.
 */

window.buildBirdieMesh = function(THREE) {
    const birdieGroup = new THREE.Group();
    birdieGroup.name = "BirdieTheEarlyBird";

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const SHELLS = window.BIRDIE_FEATHER_SHELLS || (isMobile ? 8 : 14);

    // ------------------------------------------------------------------
    // 1. Shared feather uniforms
    // ------------------------------------------------------------------
    const shared = {
        uColor:    { value: new THREE.Color(0xf5b40c) }, // warm golden base
        uTipColor: { value: new THREE.Color(0xffe066) }, // sunlit feather tips
        uTime:     { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.35, 0.6, 0.75).normalize() }
    };

    const featherVertex = `
        uniform float uShell;
        uniform float uLen;
        uniform float uTime;
        uniform vec3  uFaceCenter;
        uniform float uFaceRadius;
        varying vec3  vObj;
        varying vec3  vNormalV;
        void main() {
            vec3 n = normalize(normal);
            float faceMask = 1.0;
            if (uFaceRadius > 0.0) {
                faceMask = smoothstep(uFaceRadius * 0.5, uFaceRadius, distance(position, uFaceCenter));
            }
            float len = uLen * mix(0.25, 1.0, faceMask);
            vec3 p = position + n * len * uShell;
            p.y -= uShell * len * 0.9;                                   // feathers lie flat, pointing down
            p.x += sin(uTime * 2.4 + position.y * 5.0) * 0.006 * uShell; // light ruffle
            vObj = position;
            vNormalV = normalize(normalMatrix * n);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
    `;

    const featherFragment = `
        uniform float uShell;
        uniform float uDensity;
        uniform vec3  uColor;
        uniform vec3  uTipColor;
        uniform vec3  uLightDir;
        varying vec3  vObj;
        varying vec3  vNormalV;
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
            // Feather scale lattice: wrap around the body (angle, height), staggered rows
            float ang = atan(vObj.x, vObj.z);
            vec2 uv = vec2(ang * 0.75, vObj.y * 1.25) * uDensity;
            float row = floor(uv.y);
            uv.x += mod(row, 2.0) * 0.5;                // brick stagger = overlapping feathers
            vec2 cell = floor(uv);
            vec2 f = fract(uv) - vec2(0.5, 0.5);
            float h = hash(cell);
            f.x += (h - 0.5) * 0.12;

            // Rounded feather: full width at top, soft rounded tip at the bottom
            float widthAt = mix(0.62, 0.32, clamp(0.5 - f.y, 0.0, 1.0));
            float inside = abs(f.x) / widthAt;
            if (uShell > 0.0) {
                float shrink = 1.0 - uShell * 0.55;
                if (inside > shrink || h < uShell * 0.2) discard;
            }
            float quill = 1.0 - smoothstep(0.0, 0.05, abs(f.x));   // central shaft
            float edge  = smoothstep(0.6, 1.0, inside) + smoothstep(0.25, 0.5, -f.y) * 0.6; // shadowed rim

            vec3 n = normalize(vNormalV);
            float diff = max(dot(n, uLightDir), 0.0);
            float wrap = dot(n, uLightDir) * 0.5 + 0.5;
            float rim  = pow(1.0 - abs(n.z), 2.5);
            float ao   = mix(0.72, 1.1, pow(uShell, 0.7));
            vec3 base  = mix(uColor, uTipColor, uShell * (0.55 + 0.45 * h));
            base *= 1.0 - edge * 0.16;
            base = mix(base, uColor * 0.85, quill * 0.25 * uShell);
            vec3 col = base * (0.5 + 0.42 * wrap + 0.3 * diff) * ao;
            col += uTipColor * rim * 0.3 * uShell;
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    const featherMaterials = [];

    /** Wrap a geometry in a base mesh + N feather shells. Returns a Group. */
    function feathered(geometry, opts = {}) {
        const len = opts.len !== undefined ? opts.len * 0.7 : 0.035;
        const shells = opts.shells || SHELLS;
        const group = new THREE.Group();
        for (let i = 0; i <= shells; i++) {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uShell:      { value: i / shells },
                    uLen:        { value: len },
                    uDensity:    { value: opts.density || 9.0 },
                    uFaceCenter: { value: opts.faceCenter || new THREE.Vector3() },
                    uFaceRadius: { value: opts.faceRadius || 0.0 },
                    uColor:      shared.uColor,
                    uTipColor:   shared.uTipColor,
                    uTime:       shared.uTime,
                    uLightDir:   shared.uLightDir
                },
                vertexShader: featherVertex,
                fragmentShader: featherFragment
            });
            featherMaterials.push(mat);
            const m = new THREE.Mesh(geometry, mat);
            m.renderOrder = i;
            group.add(m);
        }
        return group;
    }

    // Plain materials (fabric, beak, eyes)
    function std(color, roughness = 0.6, metalness = 0.02, extra = {}) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    }
    const feltPink     = std(0xc2187a, 0.95);           // felt costume fabric (matte)
    const feltPinkDark = std(0x9d1463, 0.95);
    const beakMat      = std(0xf28c0f, 0.45);
    const capMat       = std(0x6b1a2a, 0.9);
    const goggleFrame  = std(0xf8fafc, 0.3, 0.3);
    const goggleLens   = std(0x7dd3fc, 0.1, 0.7, { transparent: true, opacity: 0.7 });
    const eyeWhite     = std(0xffffff, 0.15);
    const eyeShadow    = std(0x5ec8f0, 0.5);
    const irisMat      = std(0x0f172a, 0.2);
    const blackMat     = std(0x09090b, 0.2);
    const mouthMat     = std(0x3a0a16, 0.9, 0, { side: THREE.DoubleSide });
    const tongueMat    = std(0xf0708a, 0.4);
    const archMat      = std(0xfacc15, 0.3, 0.2, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    const scarfMat     = std(0xf8fafc, 0.8, 0, { side: THREE.DoubleSide });

    // ------------------------------------------------------------------
    // 2. Pear body (lathe, like Grimace) - feathered upper chest
    // ------------------------------------------------------------------
    const profile = new THREE.SplineCurve([
        new THREE.Vector2(0.001, -0.66),
        new THREE.Vector2(0.42, -0.64),
        new THREE.Vector2(0.58, -0.52),
        new THREE.Vector2(0.64, -0.32),
        new THREE.Vector2(0.62, -0.05),
        new THREE.Vector2(0.55, 0.25),
        new THREE.Vector2(0.42, 0.56),
        new THREE.Vector2(0.28, 0.76),
        new THREE.Vector2(0.001, 0.82)
    ]).getPoints(48);
    // Extend feathered chest down to y = 0.16 so there is zero gap at the sides under the wings when Birdie rotates!
    const chestProfile = profile.filter(p => p.y >= 0.16);
    const chestGeo = new THREE.LatheGeometry(chestProfile, 56);
    chestGeo.scale(1, 1, 0.8);
    // Tuck the front lower chest slightly inward right behind the pink bib so feather shells never poke through the bib/waist junction
    const chestPos = chestGeo.attributes.position;
    for (let i = 0; i < chestPos.count; i++) {
        const vx = chestPos.getX(i);
        const vy = chestPos.getY(i);
        const vz = chestPos.getZ(i);
        if (vz > 0.15 && vy < 0.44 && Math.abs(vx) < 0.36) {
            const frontWeight = Math.min(1, (0.44 - vy) / 0.12) * Math.min(1, (0.36 - Math.abs(vx)) / 0.12);
            chestPos.setZ(i, vz - 0.065 * frontWeight);
        }
    }
    chestGeo.computeVertexNormals();

    const bodyGroup = new THREE.Group();
    bodyGroup.add(feathered(chestGeo, {
        len: 0.04,
        faceCenter: new THREE.Vector3(0, 0.26, 0.42),
        faceRadius: 0.28
    }));
    birdieGroup.add(bodyGroup);

    // Felt overalls: slightly wider at the waist (y = 0.24) so it cleanly encloses the bottom of the feathered chest
    const overallProfile = [
        new THREE.Vector2(0.001, -0.74),
        new THREE.Vector2(0.46, -0.72),
        new THREE.Vector2(0.56, -0.52),
        new THREE.Vector2(0.59, -0.28),
        new THREE.Vector2(0.59, 0.02),
        new THREE.Vector2(0.585, 0.24),
        new THREE.Vector2(0.44, 0.22), // angled inner rim so the waist cap sits cleanly below the bib transition
    ];
    const overallGeo = new THREE.LatheGeometry(overallProfile, 56);
    overallGeo.scale(1, 1, 0.85);
    overallGeo.computeVertexNormals();
    const overalls = new THREE.Mesh(overallGeo, feltPink);
    bodyGroup.add(overalls);

    // Bib panel + straps: starts at y = 0.22 with exact waist radius (0.586) matching overallGeo at y = 0.24, tapering smoothly up to y = 0.44
    const bibGeo = new THREE.CylinderGeometry(0.50, 0.587, 0.23, 36, 6, true, -0.70, 1.40);
    bibGeo.scale(1, 1, 0.852);
    const bib = new THREE.Mesh(bibGeo, feltPink);
    bib.material.side = THREE.DoubleSide;
    bib.position.y = 0.325;
    bodyGroup.add(bib);
    [-1, 1].forEach(side => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.46, 0.045), feltPinkDark);
        strap.position.set(side * 0.21, 0.56, 0.38);
        strap.rotation.x = -0.45;
        strap.rotation.z = -side * 0.12;
        bodyGroup.add(strap);
    });

    // Golden Arches centered cleanly on the unified bib/chest front
    const arch = new THREE.Shape();
    arch.moveTo(-0.16, -0.09);
    arch.quadraticCurveTo(-0.08, 0.16, 0.0, 0.0);
    arch.quadraticCurveTo(0.08, 0.16, 0.16, -0.09);
    arch.lineTo(0.115, -0.09);
    arch.quadraticCurveTo(0.065, 0.08, 0.0, -0.035);
    arch.quadraticCurveTo(-0.065, 0.08, -0.115, -0.09);
    arch.closePath();
    const archMesh = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), archMat);
    archMesh.position.set(0, 0.22, 0.49);
    archMesh.rotation.x = -0.22;
    bodyGroup.add(archMesh);

    // Distinct shortall pant legs + folded cuffs
    [-1, 1].forEach(side => {
        const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.32, 24), feltPink);
        shortLeg.scale.set(1, 1, 0.9);
        shortLeg.position.set(side * 0.25, -0.78, 0.0);
        bodyGroup.add(shortLeg);

        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.09, 24), feltPinkDark);
        cuff.scale.set(1, 1, 0.92);
        cuff.position.set(side * 0.25, -0.92, 0.0);
        bodyGroup.add(cuff);
    });

    // White aviator scarf: snug collar band around the neck + two long ribbon tails draped down the outer right edge of the overalls
    const collarBand = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.055, 14, 32), scarfMat);
    collarBand.scale.set(1.02, 0.96, 0.65);
    collarBand.position.set(0, 0.72, 0.05);
    collarBand.rotation.x = Math.PI / 2 + 0.12;
    bodyGroup.add(collarBand);

    const scarfTails = [];
    // Front tail drapes cleanly along the outer right edge of the overalls down to the hip
    // Back tail trails visibly just outside the hip
    [
        { x: 0.27, z: 0.44, len: 1.28, w: 0.095, ry: 0.22, rz: -0.03, curve: 0.11 },
        { x: 0.37, z: 0.32, len: 1.38, w: 0.088, ry: 0.42, rz: -0.07, curve: 0.12 }
    ].forEach((cfg, idx) => {
        const tailGeo = new THREE.PlaneGeometry(cfg.w, cfg.len, 4, 20);
        tailGeo.translate(0, -cfg.len / 2, 0); // pivot from the top at the collar
        const pos = tailGeo.attributes.position;
        for (let v = 0; v < pos.count; v++) {
            const y = pos.getY(v); // 0 at collar down to -cfg.len at hem
            const t = -y / cfg.len; // 0 .. 1
            // Follow the gentle outward curve of the overalls, then hang vertically
            const bowOut = Math.sin(t * Math.PI * 0.85) * cfg.curve;
            pos.setZ(v, bowOut);
        }
        tailGeo.computeVertexNormals();
        const tail = new THREE.Mesh(tailGeo, scarfMat);
        tail.position.set(cfg.x, 0.68, cfg.z);
        tail.rotation.y = cfg.ry;
        tail.rotation.z = cfg.rz;
        tail.userData = { baseRz: cfg.rz, basePos: tailGeo.attributes.position.array.slice(), len: cfg.len, curve: cfg.curve };
        bodyGroup.add(tail);
        scarfTails.push(tail);
    });

    // ------------------------------------------------------------------
    // 3. Head (feathered, face mask keeps the face smooth)
    // ------------------------------------------------------------------
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.24, 0.05);
    birdieGroup.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.56, 40, 30);
    headGeo.scale(1.05, 1.0, 0.96);
    headGroup.add(feathered(headGeo, {
        len: 0.04, density: 11.0,
        faceCenter: new THREE.Vector3(0, 0.0, 0.52), faceRadius: 0.38
    }));

    // Feathered neck to connect head and body
    const neck = feathered(new THREE.CylinderGeometry(0.3, 0.34, 0.35, 24, 2), { len: 0.04 });
    neck.position.y = -0.38;
    headGroup.add(neck);

    // Maroon flying helmet perched on the crown
    const capGeo = new THREE.SphereGeometry(0.62, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.44);
    capGeo.scale(1.07, 1.02, 1.0);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.04, -0.05);
    cap.rotation.x = -0.32;
    headGroup.add(cap);
    // Helmet seam ridge
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.02, 6, 40, Math.PI), capMat);
    seam.rotation.set(-0.32, Math.PI / 2, 0);
    seam.position.set(0, 0.04, -0.05);
    headGroup.add(seam);

    // Goggles strapped on the helmet
    const goggles = new THREE.Group();
    goggles.position.set(0, 0.48, 0.34);
    goggles.rotation.x = -0.55;
    [-0.16, 0.16].forEach(gx => {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.04, 12, 24), goggleFrame);
        frame.position.x = gx;
        const lensGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.03, 20);
        lensGeo.rotateX(Math.PI / 2);
        const lens = new THREE.Mesh(lensGeo, goggleLens);
        lens.position.x = gx;
        goggles.add(frame, lens);
    });
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), goggleFrame);
    bridge.rotation.z = Math.PI / 2;
    goggles.add(bridge);
    headGroup.add(goggles);

    // Braided pigtails with pink yarn pompoms (swing on idle)
    const pigtails = [];
    [-1, 1].forEach(side => {
        const tail = new THREE.Group();
        tail.position.set(side * 0.5, 0.12, -0.2);
        for (let i = 0; i < 5; i++) {
            const seg = new THREE.Mesh(new THREE.SphereGeometry(0.085 - i * 0.008, 12, 10), capMat);
            seg.scale.set(1, 0.8, 1);
            seg.position.set(side * i * 0.06, -i * 0.085, 0);
            tail.add(seg);
        }
        const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), feltPink);
        pom.position.set(side * 0.32, -0.44, 0);
        tail.add(pom);
        headGroup.add(tail);
        pigtails.push(tail);
    });

    // ------------------------------------------------------------------
    // 4. Duck bill (open cheerful smile)
    // ------------------------------------------------------------------
    const beak = new THREE.Group();
    beak.position.set(0, -0.1, 0.46);
    headGroup.add(beak);

    const upperGeo = new THREE.SphereGeometry(0.26, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    upperGeo.scale(1.35, 0.55, 1.3);
    const upper = new THREE.Mesh(upperGeo, beakMat);
    upper.position.set(0, 0.0, 0.06);
    upper.rotation.x = 0.15;
    beak.add(upper);

    const lowerGeo = new THREE.SphereGeometry(0.21, 24, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    lowerGeo.scale(1.25, 0.6, 1.15);
    const lower = new THREE.Mesh(lowerGeo, beakMat);
    lower.position.set(0, -0.06, 0.05);
    lower.rotation.x = 0.25;
    beak.add(lower);

    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), mouthMat);
    mouth.scale.set(1.25, 0.32, 1);
    mouth.position.set(0, -0.045, 0.12);
    mouth.rotation.x = -0.35;
    beak.add(mouth);

    const tongueGeo = new THREE.SphereGeometry(0.09, 14, 10);
    tongueGeo.scale(1.1, 0.35, 1.1);
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(0, -0.07, 0.16);
    beak.add(tongue);

    // Nostrils
    [-1, 1].forEach(side => {
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), blackMat);
        n.scale.set(1.4, 0.6, 1);
        n.position.set(side * 0.08, 0.1, 0.33);
        beak.add(n);
    });

    // ------------------------------------------------------------------
    // 5. Eyes (aqua lids, lashes, tracking pupils, blink)
    // ------------------------------------------------------------------
    function buildEye(side) {
        const g = new THREE.Group();
        g.position.set(side * 0.19, 0.17, 0.43);
        g.rotation.y = side * 0.2;

        const R = 0.13;
        const ballGeo = new THREE.SphereGeometry(R, 22, 18);
        ballGeo.scale(0.9, 1.3, 0.6);
        g.add(new THREE.Mesh(ballGeo, eyeWhite));

        const look = new THREE.Group();
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), irisMat);
        iris.scale.set(1, 1.2, 0.3);
        iris.position.z = R * 0.58;
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), std(0xffffff, 0.1));
        glint.position.set(0.018, 0.03, R * 0.58 + 0.02);
        look.add(iris, glint);
        look.position.y = -0.02;
        look.userData.base = look.position.clone();
        g.add(look);

        // Aqua eyeshadow lid (static) + blinking lid (yellow felt)
        const shadowGeo = new THREE.SphereGeometry(R * 1.06, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.3);
        shadowGeo.scale(0.9, 1.3, 0.64);
        g.add(new THREE.Mesh(shadowGeo, eyeShadow));

        const lidGeo = new THREE.SphereGeometry(R * 1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        lidGeo.scale(0.9, 1.3, 0.66);
        const lid = new THREE.Mesh(lidGeo, eyeShadow);
        lid.rotation.x = -1.1; // tucked open
        g.add(lid);

        // Lashes fanning upward and outward
        for (let i = 0; i < 4; i++) {
            const lash = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.003, 0.1, 6), blackMat);
            const a = -0.5 + i * 0.33;
            lash.position.set(Math.sin(a) * R * 0.85, R * 1.22 + Math.cos(a) * 0.02, R * 0.25);
            lash.rotation.z = -a * 1.2 - side * 0.35;
            lash.rotation.x = -0.4;
            g.add(lash);
        }

        headGroup.add(g);
        return { group: g, look, lid };
    }
    const leftEyeRig = buildEye(-1);
    const rightEyeRig = buildEye(1);

    // ------------------------------------------------------------------
    // 6. Wing-arms: same shoulder-pivot rig as Grimace (rightArm/leftArm)
    // ------------------------------------------------------------------
    function buildWing(side) {
        const pivot = new THREE.Group();

        const shoulder = feathered(new THREE.SphereGeometry(0.2, 18, 14), { len: 0.04, shells: Math.max(6, SHELLS - 4) });
        pivot.add(shoulder);

        // Upper wing: flattened tapered limb hanging down from the pivot
        const upperGeo = new THREE.CylinderGeometry(0.19, 0.15, 0.62, 18, 4);
        upperGeo.translate(0, -0.31, 0);
        upperGeo.scale(1, 1, 0.6);
        pivot.add(feathered(upperGeo, { len: 0.045, shells: Math.max(6, SHELLS - 4) }));

        // Forearm / wingtip section (slight forward bend like Grimace's elbow)
        const elbow = new THREE.Group();
        elbow.position.y = -0.62;
        elbow.rotation.x = -0.35;
        pivot.add(elbow);
        const foreGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.45, 16, 3);
        foreGeo.translate(0, -0.22, 0);
        foreGeo.scale(1, 1, 0.55);
        elbow.add(feathered(foreGeo, { len: 0.04, shells: Math.max(6, SHELLS - 4) }));

        // Primary flight feathers fanning from the wingtip (Birdie's "fingers")
        const primaries = new THREE.Group();
        primaries.position.y = -0.42;
        elbow.add(primaries);
        for (let i = 0; i < 5; i++) {
            const fGeo = new THREE.SphereGeometry(0.07, 10, 8);
            fGeo.scale(0.7, 3.0, 0.25);
            fGeo.translate(0, -0.18, 0);
            const f = feathered(fGeo, { len: 0.015, shells: 4, density: 16 });
            f.rotation.z = side * (-0.55 + i * 0.27);
            f.position.x = side * (-0.06 + i * 0.03);
            primaries.add(f);
        }
        // Secondary feathers trailing along the back edge of the wing
        for (let i = 0; i < 4; i++) {
            const sGeo = new THREE.SphereGeometry(0.06, 10, 8);
            sGeo.scale(0.8, 2.4, 0.25);
            const s = feathered(sGeo, { len: 0.012, shells: 3, density: 16 });
            s.position.set(side * 0.15, -0.15 - i * 0.14, -0.04);
            s.rotation.z = side * 0.35;
            pivot.add(s);
        }

        return { pivot, elbow, primaries };
    }

    const L = buildWing(-1), R = buildWing(1);
    const leftArm = L.pivot, rightArm = R.pivot;
    leftArm.position.set(-0.6, 0.48, 0.0);
    rightArm.position.set(0.6, 0.48, 0.0);
    birdieGroup.add(leftArm, rightArm);

    // ------------------------------------------------------------------
    // 7. Feathered legs + orange webbed feet
    // ------------------------------------------------------------------
    [-1, 1].forEach(side => {
        const leg = new THREE.Group();
        leg.position.set(side * 0.26, -0.9, 0.02);

        const thigh = feathered(new THREE.CylinderGeometry(0.14, 0.1, 0.55, 16, 3), { len: 0.04, shells: Math.max(6, SHELLS - 4) });
        thigh.position.y = -0.26;
        leg.add(thigh);

        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.22, 12), beakMat);
        shin.position.y = -0.62;
        leg.add(shin);

        const foot = new THREE.Group();
        foot.position.set(0, -0.74, 0.12);
        foot.rotation.y = side * 0.25;
        for (let t = -1; t <= 1; t++) {
            const toeGeo = new THREE.SphereGeometry(0.075, 12, 10);
            toeGeo.scale(0.9, 0.5, 3.0);
            const toe = new THREE.Mesh(toeGeo, beakMat);
            toe.position.set(t * 0.1, 0, 0.12);
            toe.rotation.y = t * 0.35;
            foot.add(toe);
        }
        const web = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16, Math.PI * 0.2, Math.PI * 0.6), beakMat);
        web.material.side = THREE.DoubleSide;
        web.rotation.x = -Math.PI / 2;
        web.position.set(0, 0.0, 0.0);
        foot.add(web);
        leg.add(foot);

        birdieGroup.add(leg);
    });

    // Scale to occupy the same frame as Grimace
    birdieGroup.scale.setScalar(1.0);
    birdieGroup.position.y = -0.05;

    // ------------------------------------------------------------------
    // 7b. Era 1 ("1971" / 1980 Debut): Cracked Giant White Hatchling Egg!
    // ------------------------------------------------------------------
    const eggGroup = new THREE.Group();
    eggGroup.visible = false; // Hidden in default 1980s Classic & 2026 Overdrive
    const eggShellMat = std(0xfefcf6, 0.35, 0.05, { side: THREE.DoubleSide });
    const eggInnerMat = std(0xf3ead8, 0.65, 0.0, { side: THREE.DoubleSide });

    // Lower half of giant egg cupping Birdie's lower torso/waist
    const eggBottomGeo = new THREE.SphereGeometry(0.68, 36, 24, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.54);
    eggBottomGeo.scale(1.02, 1.25, 0.92);
    const eggBottom = new THREE.Mesh(eggBottomGeo, eggShellMat);
    eggBottom.position.set(0, -0.22, 0.0);
    eggGroup.add(eggBottom);

    // Zigzag cracked egg rim teeth around the waist (y ≈ -0.15)
    const numTeeth = 16;
    for (let i = 0; i < numTeeth; i++) {
        const a0 = (i / numTeeth) * Math.PI * 2;
        const aMid = ((i + 0.5) / numTeeth) * Math.PI * 2;
        const a1 = ((i + 1) / numTeeth) * Math.PI * 2;
        const rx = 0.68 * Math.sin(Math.PI * 0.46) * 1.02;
        const rz = 0.68 * Math.sin(Math.PI * 0.46) * 0.92;
        const yBase = -0.22 + 0.68 * Math.cos(Math.PI * 0.46) * 1.25;
        const toothHeight = (i % 2 === 0) ? 0.16 : 0.11;

        const triGeo = new THREE.BufferGeometry();
        const verts = new Float32Array([
            Math.cos(a0) * rx,   yBase - 0.02, Math.sin(a0) * rz,
            Math.cos(a1) * rx,   yBase - 0.02, Math.sin(a1) * rz,
            Math.cos(aMid) * (rx * 0.98), yBase + toothHeight, Math.sin(aMid) * (rz * 0.98),
        ]);
        triGeo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
        triGeo.computeVertexNormals();
        eggGroup.add(new THREE.Mesh(triGeo, eggShellMat));
        eggGroup.add(new THREE.Mesh(triGeo, eggInnerMat));
    }

    // Cute tilted cracked top-shell cap perched jauntily on top of her aviator cap
    const eggCapGroup = new THREE.Group();
    eggCapGroup.visible = false;
    const eggCapGeo = new THREE.SphereGeometry(0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
    eggCapGeo.scale(1.1, 0.85, 1.05);
    const eggCapMesh = new THREE.Mesh(eggCapGeo, eggShellMat);
    eggCapGroup.add(eggCapMesh);
    eggCapGroup.position.set(-0.12, 0.48, -0.04);
    eggCapGroup.rotation.z = 0.28;
    eggCapGroup.rotation.x = -0.18;
    headGroup.add(eggCapGroup);

    birdieGroup.add(eggGroup);

    // ------------------------------------------------------------------
    // 8. API (mirrors Grimace + Era Mode Switcher)
    // ------------------------------------------------------------------
    let currentEra = "1980";

    function setFurColor(baseHex, tipHex) {
        shared.uColor.value.setHex(baseHex);
        shared.uTipColor.value.setHex(tipHex);
    }

    function setEraMode(mode) {
        currentEra = mode || "1980";
        if (currentEra === "1971") {
            // 1980 Debut Hatchling Mode: Giant cracked egg shell + oversized silver goggles on forehead
            eggGroup.visible = true;
            eggCapGroup.visible = true;
            goggles.position.set(0, 0.48, 0.34);
            goggles.rotation.x = -0.55;
            goggles.scale.set(1.08, 1.08, 1.08);
            goggleLens.color.setHex(0xcbd5e1);
            goggleLens.emissive.setHex(0x000000);
            goggleLens.emissiveIntensity = 0.0;
            goggleLens.opacity = 0.75;
            scarfMat.color.setHex(0xf8fafc);
            scarfMat.emissive.setHex(0x000000);
            setFurColor(0xf7c61b, 0xffe566);
        } else if (currentEra === "2026") {
            // 2026 Supersonic Overdrive: Goggles snapped down over eyes with glowing Cyan HUD + 24K Gold Scarf!
            eggGroup.visible = false;
            eggCapGroup.visible = false;
            goggles.position.set(0, 0.17, 0.56);
            goggles.rotation.x = 0.0;
            goggles.scale.set(1.22, 1.22, 1.22);
            goggleLens.color.setHex(0x00f0ff);
            goggleLens.emissive.setHex(0x00d8ff);
            goggleLens.emissiveIntensity = 0.75;
            goggleLens.opacity = 0.72;
            scarfMat.color.setHex(0xffd700);
            scarfMat.emissive.setHex(0x553800);
            setFurColor(0xffe033, 0xfff59d);
        } else {
            // 1980s Classic Aviator (Exact Original Default)
            eggGroup.visible = false;
            eggCapGroup.visible = false;
            goggles.position.set(0, 0.48, 0.34);
            goggles.rotation.x = -0.55;
            goggles.scale.set(1, 1, 1);
            goggleLens.color.setHex(0x7dd3fc);
            goggleLens.emissive.setHex(0x000000);
            goggleLens.emissiveIntensity = 0.0;
            goggleLens.opacity = 0.7;
            scarfMat.color.setHex(0xf8fafc);
            scarfMat.emissive.setHex(0x000000);
            setFurColor(0xf7c61b, 0xffe566);
        }
    }

    function lookAt(mx, my) {
        [leftEyeRig, rightEyeRig].forEach(rig => {
            const b = rig.look.userData.base;
            rig.look.position.x = b.x + mx * 0.035;
            rig.look.position.y = b.y + my * 0.035;
        });
        headGroup.rotation.y = mx * 0.25;
        headGroup.rotation.x = -my * 0.12;
    }

    function update(elapsed) {
        shared.uTime.value = elapsed;
        const speedMult = currentEra === "2026" ? 2.2 : 1.0;

        // Bird-like head bob + pigtail swing
        headGroup.position.y = 1.24 + Math.abs(Math.sin(elapsed * 2.2 * speedMult)) * 0.025;
        headGroup.rotation.z = Math.sin(elapsed * 1.1 * speedMult) * 0.05;
        pigtails.forEach((p, i) => {
            p.rotation.z = Math.sin(elapsed * 2.2 * speedMult + i * Math.PI) * 0.12;
        });

        // Primary feathers ruffle
        [L, R].forEach((w, i) => {
            w.primaries.rotation.x = Math.sin(elapsed * 3 * speedMult + i) * (currentEra === "2026" ? 0.16 : 0.08);
        });

        // White/Gold aviator scarf tails flutter in the breeze
        scarfTails.forEach((tail, idx) => {
            tail.rotation.z = tail.userData.baseRz + Math.sin(elapsed * 2.4 * speedMult + idx * 1.1) * (currentEra === "2026" ? 0.08 : 0.035);
        });

        // Gentle rocking of the hatchling egg in 1971 debut mode
        if (eggGroup.visible) {
            eggGroup.rotation.z = Math.sin(elapsed * 2.8) * 0.04;
        }

        // Blink: lid rolls down over the eye
        const t = elapsed % 4.2;
        const blink = t > 4.0 ? Math.sin(((t - 4.0) / 0.2) * Math.PI) : 0;
        leftEyeRig.lid.rotation.x = rightEyeRig.lid.rotation.x = -1.1 + blink * 1.2;
    }

    return {
        root: birdieGroup,
        parts: {
            head: headGroup,
            body: bodyGroup,
            leftArm,
            rightArm,
            leftEye: leftEyeRig.group,
            rightEye: rightEyeRig.group,
            leftPupil: leftEyeRig.look,
            rightPupil: rightEyeRig.look,
            armRest: 0.55,     // wings held slightly out (Birdie's open, friendly stance)
            waveLift: 2.5,     // raise the wing higher than Grimace for a big flappy wave
            setFurColor,
            setEraMode,
            lookAt
        },
        update,
        lookAt
    };
};
