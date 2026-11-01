/**
 * grimace-mesh.js - Procedural 3D Grimace Mesh Builder (Generations Edition)
 * Furry "Grimace Shake" look: lathed egg body + shell-textured fur shader,
 * heavy-lidded eyes, dark brows, open smile, stubby legs, hands at hips.
 * Still supports the toggleable 1971 4-arm configuration.
 * Air-gapped: no external textures; fur is generated procedurally in GLSL.
 */

window.buildGrimaceMesh = function(THREE) {
    const grimaceGroup = new THREE.Group();
    grimaceGroup.name = "GrimaceMascot";

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const SHELLS = window.GRIMACE_FUR_SHELLS || (isMobile ? 10 : 18);
    const DEPTH = 0.86; // front-to-back squash of the body

    // ------------------------------------------------------------------
    // 1. Shared fur uniforms (one update recolours every furry part)
    // ------------------------------------------------------------------
    const shared = {
        uColor:    { value: new THREE.Color(0x8f6fd8) }, // reference lavender
        uTipColor: { value: new THREE.Color(0xc3adf5) }, // light fur tips
        uTime:     { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.35, 0.6, 0.75).normalize() }
    };

    const furVertex = `
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
                faceMask = smoothstep(uFaceRadius * 0.55, uFaceRadius, distance(position, uFaceCenter));
            }
            float len = uLen * mix(0.22, 1.0, faceMask);
            vec3 p = position + n * len * uShell;
            p.y -= uShell * uShell * len * 0.55;                         // gravity droop
            p.x += sin(uTime * 2.0 + position.y * 4.0) * 0.012 * uShell; // gentle sway
            vObj = position;
            vNormalV = normalize(normalMatrix * n);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
    `;

    const furFragment = `
        uniform float uShell;
        uniform float uDensity;
        uniform vec3  uColor;
        uniform vec3  uTipColor;
        uniform vec3  uLightDir;
        varying vec3  vObj;
        varying vec3  vNormalV;
        float hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        void main() {
            // Rotated lattice + per-cell jitter avoids concentric moire rings
            const mat3 rot = mat3(0.80, -0.36, 0.48,  0.60, 0.48, -0.64,  0.0, 0.80, 0.60);
            vec3 q = rot * vObj * uDensity;
            vec3 c = floor(q);
            float h = hash(c);
            vec3 jitter = vec3(hash(c + 11.7), hash(c + 23.1), hash(c + 37.9)) - 0.5;
            vec3 f = fract(q) - 0.5 - jitter * 0.45;
            if (uShell > 0.0) {
                float thick = (1.0 - uShell) * 0.6;
                if (length(f) > thick || h < uShell * 0.9) discard;
            }
            vec3 n = normalize(vNormalV);
            float diff = max(dot(n, uLightDir), 0.0);
            float wrap = max(dot(n, uLightDir) * 0.5 + 0.5, 0.0);
            float rim  = pow(1.0 - abs(n.z), 2.5);
            float ao   = mix(0.55, 1.05, pow(uShell, 0.6));
            vec3 base  = mix(uColor, uTipColor, uShell * uShell * (0.6 + 0.4 * h));
            vec3 col   = base * (0.38 + 0.45 * wrap + 0.35 * diff) * ao;
            col += uTipColor * rim * 0.35 * uShell;
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    const furMaterials = [];

    /** Wrap a geometry in a base mesh + N fur shells. Returns a Group. */
    function furry(geometry, opts = {}) {
        const len = opts.len !== undefined ? opts.len : 0.08;
        const shells = opts.shells || SHELLS;
        const group = new THREE.Group();
        for (let i = 0; i <= shells; i++) {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uShell:      { value: i / shells },
                    uLen:        { value: len },
                    uDensity:    { value: opts.density || 58.0 },
                    uFaceCenter: { value: opts.faceCenter || new THREE.Vector3() },
                    uFaceRadius: { value: opts.faceRadius || 0.0 },
                    uColor:      shared.uColor,
                    uTipColor:   shared.uTipColor,
                    uTime:       shared.uTime,
                    uLightDir:   shared.uLightDir
                },
                vertexShader: furVertex,
                fragmentShader: furFragment
            });
            furMaterials.push(mat);
            const m = new THREE.Mesh(geometry, mat);
            m.renderOrder = i;
            group.add(m);
        }
        return group;
    }

    // ------------------------------------------------------------------
    // 2. Egg / pear body (lathe profile, wide belly, narrower dome head)
    // ------------------------------------------------------------------
    const profile = new THREE.SplineCurve([
        new THREE.Vector2(0.001, -1.22),
        new THREE.Vector2(0.62, -1.19),
        new THREE.Vector2(1.03, -1.03),
        new THREE.Vector2(1.27, -0.74),
        new THREE.Vector2(1.34, -0.38),
        new THREE.Vector2(1.28, 0.02),
        new THREE.Vector2(1.12, 0.42),
        new THREE.Vector2(0.92, 0.84),
        new THREE.Vector2(0.70, 1.20),
        new THREE.Vector2(0.40, 1.45),
        new THREE.Vector2(0.001, 1.54)
    ]).getPoints(60);

    const bodyGeo = new THREE.LatheGeometry(profile, 72);
    bodyGeo.scale(1, 1, DEPTH);
    bodyGeo.computeVertexNormals();

    // Radius lookup r(y) so face parts sit exactly on the surface
    function radiusAt(y) {
        for (let i = 0; i < profile.length - 1; i++) {
            const a = profile[i], b = profile[i + 1];
            if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
                const t = (y - a.y) / ((b.y - a.y) || 1e-6);
                return a.x + (b.x - a.x) * t;
            }
        }
        return 0;
    }
    function surfZ(x, y) {
        const r = radiusAt(y);
        return Math.sqrt(Math.max(r * r - x * x, 0)) * DEPTH;
    }

    const faceCenter = new THREE.Vector3(0, 0.82, surfZ(0, 0.82));
    const body = furry(bodyGeo, { len: 0.1, faceCenter, faceRadius: 0.62 });
    grimaceGroup.add(body);

    // ------------------------------------------------------------------
    // 3. Face
    // ------------------------------------------------------------------
    const std = (color, rough = 0.6, extra = {}) =>
        new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra));

    const eyeWhiteMat = std(0xf4f1ec, 0.25);
    const irisMat     = std(0x3d2614, 0.3);
    const pupilMat    = std(0x0a0606, 0.2);
    const glintMat    = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lidMat      = std(0x8a6ad0, 0.9);
    const browMat     = std(0x2e2140, 1.0);
    const mouthMat    = std(0x4a0d1a, 0.7, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const tongueMat   = std(0xe2707e, 0.45, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });

    function buildEye(side) {
        const x = 0.21 * side, y = 0.98;
        const g = new THREE.Group();
        g.position.set(x, y, surfZ(x, y) - 0.03);
        g.rotation.y = side * 0.22;

        const R = 0.155;
        const eyeGeo = new THREE.SphereGeometry(R, 24, 18);
        eyeGeo.scale(1, 1.2, 0.6);
        g.add(new THREE.Mesh(eyeGeo, eyeWhiteMat));

        // Iris + pupil + glint (grouped so they can track the pointer)
        const look = new THREE.Group();
        const front = R * 0.6;
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), irisMat);
        iris.scale.set(1, 1.1, 0.3);
        iris.position.z = front - 0.005;
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), pupilMat);
        pupil.scale.set(1, 1, 0.3);
        pupil.position.z = front + 0.008;
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), glintMat);
        glint.position.set(0.022, 0.026, front + 0.016);
        look.add(iris, pupil, glint);
        look.position.set(-side * 0.035, -0.035, 0); // lazy, slightly cross-eyed gaze
        look.userData.base = look.position.clone();
        g.add(look);

        // Upper eyelid (shorter arc so pupils remain clearly visible)
        const lidGeo = new THREE.SphereGeometry(R * 1.06, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.38);
        lidGeo.scale(1, 1.2, 0.66);
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.rotation.x = 0.22;
        g.add(lid);


        // Thick dark brow
        const browGeo = new THREE.TorusGeometry(0.15, 0.042, 8, 20, 2.0);
        browGeo.scale(1, 1, 0.6);
        const brow = new THREE.Mesh(browGeo, browMat);
        brow.position.set(0, 0.24, 0.03);
        brow.rotation.z = Math.PI / 2 - 1.0 - side * 0.18;
        g.add(brow);

        grimaceGroup.add(g);
        return { group: g, look, lid };
    }

    const leftEyeRig = buildEye(-1);
    const rightEyeRig = buildEye(1);

    // Open smile with tongue (curved to hug the body surface)
    function curvedShape(shape, curve) {
        const geo = new THREE.ShapeGeometry(shape, 24);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            pos.setZ(i, -x * x * curve);
        }
        geo.computeVertexNormals();
        return geo;
    }

    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-0.25, 0.02);
    mouthShape.quadraticCurveTo(0, 0.07, 0.25, 0.02);
    mouthShape.quadraticCurveTo(0.2, -0.3, 0, -0.3);
    mouthShape.quadraticCurveTo(-0.2, -0.3, -0.25, 0.02);

    const tongueShape = new THREE.Shape();
    tongueShape.moveTo(-0.16, -0.17);
    tongueShape.quadraticCurveTo(0, -0.08, 0.16, -0.17);
    tongueShape.quadraticCurveTo(0.12, -0.29, 0, -0.29);
    tongueShape.quadraticCurveTo(-0.12, -0.29, -0.16, -0.17);

    const mouth = new THREE.Group();
    const mouthY = 0.66;
    mouth.position.set(0, mouthY, surfZ(0, mouthY) + 0.04);
    mouth.rotation.x = -0.38;
    mouth.scale.set(0.9, 0.85, 1);
    mouth.add(new THREE.Mesh(curvedShape(mouthShape, 0.4), mouthMat));
    const tongue = new THREE.Mesh(curvedShape(tongueShape, 0.4), tongueMat);
    tongue.position.z = 0.006;
    mouth.add(tongue);
    grimaceGroup.add(mouth);

    // ------------------------------------------------------------------
    // 4. Arms (shoulder pivot -> upper arm -> bent forearm -> mitten hand)
    // ------------------------------------------------------------------
    function buildHand() {
        const hand = new THREE.Group();
        const palmGeo = new THREE.SphereGeometry(0.21, 20, 14);
        palmGeo.scale(0.95, 1.05, 0.8);
        hand.add(furry(palmGeo, { len: 0.045, shells: Math.max(6, SHELLS >> 1) }));
        // Three stubby finger bumps + thumb
        const fingerGeo = new THREE.SphereGeometry(0.075, 12, 10);
        [-0.1, 0, 0.1].forEach((fx) => {
            const f = furry(fingerGeo, { len: 0.03, shells: 5 });
            f.position.set(fx, -0.17, 0.06);
            hand.add(f);
        });
        const thumb = furry(fingerGeo, { len: 0.03, shells: 5 });
        thumb.position.set(0, -0.02, 0.17);
        hand.add(thumb);
        return hand;
    }

    function buildArm(side, opts = {}) {
        const l1 = opts.l1 || 0.62, l2 = opts.l2 || 0.5;
        const pivot = new THREE.Group();

        const upperGeo = new THREE.CylinderGeometry(0.2, 0.19, l1, 18, 4);
        upperGeo.translate(0, -l1 / 2, 0);
        pivot.add(furry(upperGeo, { len: 0.07, shells: Math.max(8, SHELLS - 4) }));

        const shoulderGeo = new THREE.SphereGeometry(0.21, 16, 12);
        pivot.add(furry(shoulderGeo, { len: 0.07, shells: Math.max(8, SHELLS - 4) }));

        const elbow = new THREE.Group();
        elbow.position.y = -l1;
        elbow.rotation.x = -1.0;             // bend forward
        elbow.rotation.z = -side * 0.15;     // bring hands toward the hips
        pivot.add(elbow);

        const elbowGeo = new THREE.SphereGeometry(0.195, 16, 12);
        elbow.add(furry(elbowGeo, { len: 0.07, shells: Math.max(8, SHELLS - 4) }));

        const foreGeo = new THREE.CylinderGeometry(0.19, 0.17, l2, 18, 3);
        foreGeo.translate(0, -l2 / 2, 0);
        elbow.add(furry(foreGeo, { len: 0.07, shells: Math.max(8, SHELLS - 4) }));

        const hand = buildHand();
        hand.position.y = -l2 - 0.1;
        hand.rotation.z = side * 0.2;
        elbow.add(hand);

        return { pivot, hand, elbow };
    }

    const L = buildArm(-1), R = buildArm(1);
    const leftArm = L.pivot, rightArm = R.pivot;
    leftArm.position.set(-1.24, 0.26, 0.02);
    rightArm.position.set(1.24, 0.26, 0.02);
    leftArm.rotation.z = -0.3;
    rightArm.rotation.z = 0.3;
    grimaceGroup.add(leftArm, rightArm);

    // ------------------------------------------------------------------
    // 5. Legs + big soft feet
    // ------------------------------------------------------------------
    [-1, 1].forEach((side) => {
        const legGeo = new THREE.CylinderGeometry(0.3, 0.27, 0.55, 18, 3);
        const leg = furry(legGeo, { len: 0.07, shells: Math.max(8, SHELLS - 4) });
        leg.position.set(0.47 * side, -1.32, 0.02);
        grimaceGroup.add(leg);

        const footGeo = new THREE.SphereGeometry(0.36, 22, 14);
        footGeo.scale(1.05, 0.45, 1.35);
        const foot = furry(footGeo, { len: 0.06, shells: Math.max(8, SHELLS - 4) });
        foot.position.set(0.5 * side, -1.62, 0.16);
        foot.rotation.y = side * 0.18;
        grimaceGroup.add(foot);
    });

    // Soft contact shadow (canvas radial gradient, no external asset)
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext("2d");
    const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.6),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -1.8, 0.1);
    grimaceGroup.add(shadow);

    // ------------------------------------------------------------------
    // 6. 1971 EVIL GRIMACE extra upper arms (toggleable)
    // ------------------------------------------------------------------
    const extraArmsGroup = new THREE.Group();
    extraArmsGroup.name = "EvilGrimaceUpperArms";
    extraArmsGroup.visible = false;

    const UL = buildArm(-1, { l1: 0.5, l2: 0.42 });
    const UR = buildArm(1, { l1: 0.5, l2: 0.42 });
    const upperLeftArm = UL.pivot, upperRightArm = UR.pivot;
    upperLeftArm.position.set(-0.95, 0.82, 0.12);
    upperRightArm.position.set(0.95, 0.82, 0.12);
    upperLeftArm.rotation.z = -1.1;
    upperRightArm.rotation.z = 1.1;
    extraArmsGroup.add(upperLeftArm, upperRightArm);
    grimaceGroup.add(extraArmsGroup);

    // 1971 Stolen Milkshake Cups clutched in Evil Grimace's extra upper hands!
    function buildStolen1971Shake(side) {
        const sg = new THREE.Group();
        const cupM = std(0xfefcf6, 0.4);
        const redM = std(0xd61f1f, 0.4);
        const goldM = std(0xfacc15, 0.35);
        const lidM = std(0xffffff, 0.25);

        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.10, 0.36, 20), cupM);
        cup.position.y = 0.06;
        sg.add(cup);

        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.118, 0.10, 20, 1, true), redM);
        stripe.position.y = 0.06;
        sg.add(stripe);

        const goldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.136, 0.130, 0.035, 20, 1, true), goldM);
        goldBand.position.y = 0.14;
        sg.add(goldBand);

        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.146, 0.03, 20), lidM);
        lid.position.y = 0.245;
        sg.add(lid);

        const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 10), redM);
        straw.position.set(side * 0.03, 0.34, 0);
        straw.rotation.z = -side * 0.22;
        sg.add(straw);

        sg.position.set(side * 0.05, -0.18, 0.18);
        sg.rotation.x = 0.55;
        sg.rotation.z = -side * 0.35;
        return sg;
    }
    UL.hand.add(buildStolen1971Shake(-1));
    UR.hand.add(buildStolen1971Shake(1));

    // ------------------------------------------------------------------
    // 6b. 2026 OVERDRIVE ("King Grimace"): 24K Gold Crown, Gold Bow Tie & Legendary Grimace Shake!
    // ------------------------------------------------------------------
    const overdriveGroup = new THREE.Group();
    overdriveGroup.name = "Grimace2026OverdriveProps";
    overdriveGroup.visible = false;
    grimaceGroup.add(overdriveGroup);

    const goldCrownMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.20,
        metalness: 0.85,
        emissive: 0x78350f,
        emissiveIntensity: 0.35
    });
    const gemPurpleMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        roughness: 0.12,
        metalness: 0.5,
        emissive: 0x9333ea,
        emissiveIntensity: 0.8
    });
    const gemEmeraldMat = new THREE.MeshStandardMaterial({
        color: 0x34d399,
        roughness: 0.12,
        metalness: 0.5,
        emissive: 0x059669,
        emissiveIntensity: 0.8
    });
    const gemRubyMat = new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        roughness: 0.12,
        metalness: 0.5,
        emissive: 0xe11d48,
        emissiveIntensity: 0.8
    });

    // 1. 24K Gold Royal Crown perched on Grimace's dome
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 1.46, 0.02);
    crownGroup.rotation.z = -0.06;
    crownGroup.rotation.x = 0.08;
    overdriveGroup.add(crownGroup);

    const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.16, 36), goldCrownMat);
    crownBand.scale.set(1.0, 1.0, 0.85);
    crownGroup.add(crownBand);

    const lowerRim = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.028, 12, 36), goldCrownMat);
    lowerRim.rotation.x = Math.PI / 2;
    lowerRim.scale.set(1.0, 0.85, 1.0);
    lowerRim.position.y = -0.07;
    crownGroup.add(lowerRim);

    // 8 Royal Crown Spikes + Top Gold Pearls + Jewels around the band
    const numSpikes = 8;
    const gemMats = [gemPurpleMat, gemEmeraldMat, gemRubyMat, gemPurpleMat];
    for (let i = 0; i < numSpikes; i++) {
        const a = (i / numSpikes) * Math.PI * 2;
        const rx = 0.405;
        const rz = 0.405 * 0.85;

        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.22, 12), goldCrownMat);
        spike.position.set(Math.cos(a) * rx, 0.18, Math.sin(a) * rz);
        crownGroup.add(spike);

        const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), goldCrownMat);
        pearl.position.set(Math.cos(a) * rx, 0.30, Math.sin(a) * rz);
        crownGroup.add(pearl);

        // Jewel set into the front/side band under each spike
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), gemMats[i % gemMats.length]);
        gem.position.set(Math.cos(a) * (rx + 0.018), 0.0, Math.sin(a) * (rz + 0.018));
        gem.rotation.y = -a;
        crownGroup.add(gem);
    }

    // 2. Gleaming 24K Gold Bow Tie on Grimace's chest
    const bowTieGroup = new THREE.Group();
    const bowY = 0.26;
    bowTieGroup.position.set(0, bowY, surfZ(0, bowY) + 0.06);
    bowTieGroup.rotation.x = -0.15;
    overdriveGroup.add(bowTieGroup);

    const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 14), goldCrownMat);
    bowKnot.scale.set(0.9, 1.0, 0.7);
    bowTieGroup.add(bowKnot);
    [-1, 1].forEach(side => {
        const wingGeo = new THREE.ConeGeometry(0.14, 0.28, 18);
        wingGeo.rotateZ(side * Math.PI / 2);
        wingGeo.scale(1.0, 1.0, 0.45);
        const wing = new THREE.Mesh(wingGeo, goldCrownMat);
        wing.position.set(side * 0.13, 0, 0);
        bowTieGroup.add(wing);
    });

    // 3. The Legendary Purple Grimace Shake held in his left hand (`L.hand`)
    const grimaceShakeGroup = new THREE.Group();
    grimaceShakeGroup.position.set(-0.06, -0.22, 0.22);
    grimaceShakeGroup.rotation.x = 0.52;
    grimaceShakeGroup.rotation.z = 0.28;
    grimaceShakeGroup.visible = false;
    L.hand.add(grimaceShakeGroup);

    const shakePurpleMat = new THREE.MeshStandardMaterial({
        color: 0x9333ea,
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0x581c87,
        emissiveIntensity: 0.35
    });
    const whipCreamMat = std(0xfffdf9, 0.35);

    // Purple Grimace Shake cup + Gold band
    const gCup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.42, 24), shakePurpleMat);
    gCup.position.y = 0.08;
    grimaceShakeGroup.add(gCup);

    const gGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.142, 0.09, 24, 1, true), goldCrownMat);
    gGoldBand.position.y = 0.09;
    grimaceShakeGroup.add(gGoldBand);

    // Fluffy Whipped Cream Dome on top of the cup
    const creamDome = new THREE.Mesh(new THREE.SphereGeometry(0.168, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), whipCreamMat);
    creamDome.position.y = 0.28;
    grimaceShakeGroup.add(creamDome);

    const creamPeak = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.12, 16), whipCreamMat);
    creamPeak.position.y = 0.43;
    grimaceShakeGroup.add(creamPeak);

    // Multi-color Birthday Sprinkles on the Whipped Cream!
    const sprinkleCols = [0xf43f5e, 0xfacc15, 0x38bdf8, 0x4ade80, 0xc084fc, 0xfb923c];
    for (let s = 0; s < 14; s++) {
        const a = (s / 14) * Math.PI * 2;
        const r = 0.06 + (s % 3) * 0.032;
        const sp = new THREE.Mesh(
            new THREE.CylinderGeometry(0.010, 0.010, 0.038, 6),
            std(sprinkleCols[s % sprinkleCols.length], 0.3)
        );
        sp.position.set(Math.cos(a) * r, 0.38 - r * 0.45, Math.sin(a) * r);
        sp.rotation.set(Math.sin(s), a, Math.PI / 3);
        grimaceShakeGroup.add(sp);
    }

    // Golden-Purple Straw sticking out of the Whipped Cream
    const gStraw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 12), goldCrownMat);
    gStraw.position.set(-0.04, 0.44, 0.02);
    gStraw.rotation.z = 0.24;
    grimaceShakeGroup.add(gStraw);

    // ------------------------------------------------------------------
    // 7. Control handles + Era Mode Switcher
    // ------------------------------------------------------------------
    let currentEra = "1980";

    function setFurColor(baseHex, tipHex) {
        shared.uColor.value.setHex(baseHex);
        shared.uTipColor.value.setHex(tipHex !== undefined ? tipHex : baseHex);
        lidMat.color.setHex(baseHex).multiplyScalar(0.95);
    }

    function setEraMode(mode) {
        currentEra = mode || "1980";
        if (currentEra === "1971") {
            extraArmsGroup.visible = true;
            overdriveGroup.visible = false;
            grimaceShakeGroup.visible = false;
            setFurColor(0x5b3a9e, 0x8d6cc9);
        } else if (currentEra === "2026") {
            extraArmsGroup.visible = false;
            overdriveGroup.visible = true;
            grimaceShakeGroup.visible = true;
            setFurColor(0x9b78ec, 0xf1d28a);
        } else {
            extraArmsGroup.visible = false;
            overdriveGroup.visible = false;
            grimaceShakeGroup.visible = false;
            setFurColor(0x8f6fd8, 0xc3adf5);
        }
    }

    function lookAt(mx, my) {
        [leftEyeRig, rightEyeRig].forEach((rig) => {
            const b = rig.look.userData.base;
            rig.look.position.x = b.x + mx * 0.035;
            rig.look.position.y = b.y + my * 0.03;
        });
    }

    function update(elapsed) {
        shared.uTime.value = elapsed;
        if (overdriveGroup.visible) {
            crownGroup.rotation.y = Math.sin(elapsed * 2.2) * 0.15;
            bowTieGroup.rotation.z = Math.sin(elapsed * 3.5) * 0.06;
        }
        // Occasional slow blink
        const t = elapsed % 4.5;
        const blink = t > 4.3 ? Math.sin(((t - 4.3) / 0.2) * Math.PI) : 0;
        leftEyeRig.lid.rotation.x = rightEyeRig.lid.rotation.x = 0.22 + blink * 1.25;

    }

    return {
        root: grimaceGroup,
        parts: {
            lowerBody: body,
            upperBody: body,
            leftEye: leftEyeRig.group,
            rightEye: rightEyeRig.group,
            leftPupil: leftEyeRig.look,
            rightPupil: rightEyeRig.look,
            mouth,
            leftArm,
            rightArm,
            leftHand: L.hand,
            rightHand: R.hand,
            extraArmsGroup,
            upperLeftArm,
            upperRightArm,
            setFurColor,
            setEraMode,
            lookAt,
            update
        }
    };
};
