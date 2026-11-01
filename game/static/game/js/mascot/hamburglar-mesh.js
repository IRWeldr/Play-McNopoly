/**
 * hamburglar-mesh.js - Procedural 3D Hamburglar ("Robble Robble!" Pattern Edition)
 *
 * Refactored from birdie-mesh.js to match dataset/Hamburgler.jpeg:
 *  - Pattern-driven GLSL shaders (crisp horizontal black & white prison stripes
 *    on torso, sleeves, and pants + procedural repeating Hamburger pattern on
 *    his oversized double-layered red necktie) instead of extruded fur/feathers
 *  - Flared two-tone burglar cape (matte black exterior + golden-yellow lining
 *    with black border trim visible beside the arms)
 *  - Sculpted peach puppet head with chubby cheeks, button nose, big round ears,
 *    ginger-orange bangs, black bandit domino mask, close-set tracking eyes, and
 *    mischievous single-tooth grin
 *  - Wide-brimmed flat-top black bandit hat with pale-yellow ribbon band
 *  - Striped sleeves + white cuffs + plump red burglar gloves on the shared
 *    `rightArm` / `leftArm` shoulder rig so mascot-core.js waves identically
 * Air-gapped: 100% procedural GLSL & Three.js geometry.
 */

window.buildHamburglarMesh = function(THREE) {
    const hamburglarGroup = new THREE.Group();
    hamburglarGroup.name = "Hamburglar";

    const shared = {
        uTime:     { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.35, 0.6, 0.75).normalize() },
        uBlackCol: { value: new THREE.Color(0x141418) },
        uWhiteCol: { value: new THREE.Color(0xf6f5f0) }
    };

    // ------------------------------------------------------------------
    // 1. Pattern Shaders: Horizontal Prison Stripes & Hamburger Tie
    // ------------------------------------------------------------------
    const patternVertex = `
        varying vec3 vObj;
        varying vec3 vNormalV;
        varying vec2 vUv;
        void main() {
            vObj = position;
            vUv = uv;
            vNormalV = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // Crisp anti-aliased horizontal black & white costume stripes with soft cloth shading
    const stripeFragment = `
        uniform vec3  uBlackCol;
        uniform vec3  uWhiteCol;
        uniform vec3  uLightDir;
        uniform float uFreq;
        uniform float uPhase;
        varying vec3  vObj;
        varying vec3  vNormalV;

        void main() {
            // Subtle cloth fold modulation along circumference
            float fold = sin(atan(vObj.x, vObj.z) * 6.0) * 0.012;
            float wave = sin((vObj.y + fold) * uFreq + uPhase);
            // Sharp anti-aliased transition between black and white bands
            float mask = smoothstep(-0.08, 0.08, wave);
            vec3 base = mix(uBlackCol, uWhiteCol, mask);

            vec3 n = normalize(vNormalV);
            float diff = max(dot(n, uLightDir), 0.0);
            float wrap = dot(n, uLightDir) * 0.5 + 0.5;
            float rim  = pow(1.0 - abs(n.z), 3.0) * 0.12;
            vec3 col = base * (0.58 + 0.34 * wrap + 0.22 * diff) + vec3(rim);
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function makeStripeMat(freq = 22.0, phase = 0.0) {
        return new THREE.ShaderMaterial({
            uniforms: {
                uBlackCol: shared.uBlackCol,
                uWhiteCol: shared.uWhiteCol,
                uLightDir: shared.uLightDir,
                uFreq:     { value: freq },
                uPhase:    { value: phase }
            },
            vertexShader: patternVertex,
            fragmentShader: stripeFragment,
            side: THREE.DoubleSide
        });
    }

    // Procedural Hamburger-Patterned Red Necktie Shader (matches Hamburgler.jpeg)
    const tieFragment = `
        uniform vec3  uLightDir;
        varying vec3  vNormalV;
        varying vec2  vUv;

        // 2D rounded box SDF for burger layers
        float sdRoundBox(vec2 p, vec2 b, float r) {
            vec2 q = abs(p) - b + r;
            return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        void main() {
            vec3 tieRed   = vec3(0.80, 0.12, 0.12);
            vec3 bunGold  = vec3(0.95, 0.68, 0.25);
            vec3 bunLight = vec3(0.99, 0.84, 0.52);
            vec3 pattyBrn = vec3(0.27, 0.11, 0.04);

            // Staggered grid of large, bold hamburgers across the tie blade (matching Hamburgler.jpeg)
            vec2 gridScale = vec2(1.45, 3.2);
            vec2 gv = vUv * gridScale;
            float row = floor(gv.y);
            gv.x += mod(row, 2.0) * 0.5;
            vec2 p = fract(gv) - vec2(0.5, 0.5);

            vec3 col = tieRed;

            // Top dome bun (semi-ellipse above y = 0.05)
            vec2 pTop = p - vec2(0.0, 0.10);
            float dTop = length(pTop * vec2(0.95, 1.55)) - 0.36;
            dTop = max(dTop, -(p.y - 0.04)); // flat underside of top bun

            // Middle dark brown burger patty
            float dPatty = sdRoundBox(p - vec2(0.0, -0.04), vec2(0.37, 0.06), 0.03);

            // Bottom flat golden bun
            float dBot = sdRoundBox(p - vec2(0.0, -0.17), vec2(0.35, 0.06), 0.035);

            // Layer composite with soft anti-aliased edges
            if (dTop < 0.02) {
                float m = 1.0 - smoothstep(-0.015, 0.015, dTop);
                vec3 bunShade = mix(bunGold, bunLight, clamp((p.y - 0.04) * 3.2, 0.0, 1.0));
                col = mix(col, bunShade, m);
            }
            if (dBot < 0.02) {
                float m = 1.0 - smoothstep(-0.015, 0.015, dBot);
                col = mix(col, bunGold * 0.95, m);
            }
            if (dPatty < 0.02) {
                float m = 1.0 - smoothstep(-0.015, 0.015, dPatty);
                col = mix(col, pattyBrn, m);
            }

            vec3 n = normalize(vNormalV);
            float diff = max(dot(n, uLightDir), 0.0);
            float wrap = dot(n, uLightDir) * 0.5 + 0.5;
            col *= (0.62 + 0.32 * wrap + 0.22 * diff);
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    const tiePatternMat = new THREE.ShaderMaterial({
        uniforms: { uLightDir: shared.uLightDir },
        vertexShader: patternVertex,
        fragmentShader: tieFragment,
        side: THREE.DoubleSide
    });

    // Standard materials for solid costume parts
    function std(color, roughness = 0.65, metalness = 0.02, extra = {}) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    }
    const skinMat      = std(0xf4c29f, 0.55);           // warm peach puppet skin
    const noseMat      = std(0xe5a47e, 0.5);            // slightly rosy button nose
    const hairMat      = std(0xd9531e, 0.75);           // bright ginger-orange hair
    const blackMat     = std(0x181920, 0.72);           // charcoal-black mask & outer cape
    const hatBlackMat  = std(0x22242e, 0.52, 0.08);     // slight studio sheen so hat silhouette pops against dark background
    const capeYellow   = std(0xfacc15, 0.75, 0.02, { side: THREE.DoubleSide }); // yellow inner cape lining
    const hatBandMat   = std(0xfef08a, 0.45);           // pale yellow hat ribbon
    const gloveRed     = std(0xd62424, 0.7);            // bright red burglar gloves & shoe trim
    const tieKnotRed   = std(0xc81e1e, 0.65);           // solid red tie knot
    const whiteMat     = std(0xf8fafc, 0.55);           // white cuffs, tooth, shoe base
    const eyeWhite     = std(0xffffff, 0.15);
    const pupilMat     = std(0x09090b, 0.15);
    const mouthMat     = std(0x2a080c, 0.9, 0, { side: THREE.DoubleSide });
    const tongueMat    = std(0xef6c86, 0.5);

    // ------------------------------------------------------------------
    // 2. Striped Torso + Two-Tone Black/Yellow Burglar Cape
    // ------------------------------------------------------------------
    const bodyGroup = new THREE.Group();
    hamburglarGroup.add(bodyGroup);

    const torsoProfile = new THREE.SplineCurve([
        new THREE.Vector2(0.001, -0.72),
        new THREE.Vector2(0.42, -0.70),
        new THREE.Vector2(0.50, -0.46),
        new THREE.Vector2(0.52, -0.15),
        new THREE.Vector2(0.50, 0.22),
        new THREE.Vector2(0.43, 0.56),
        new THREE.Vector2(0.30, 0.78),
        new THREE.Vector2(0.001, 0.84)
    ]).getPoints(48);
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 56);
    torsoGeo.scale(1, 1, 0.82);
    torsoGeo.computeVertexNormals();
    const torsoMesh = new THREE.Mesh(torsoGeo, makeStripeMat(24.0, 0.4));
    bodyGroup.add(torsoMesh);

    // Black cape collar around the neck/shoulders
    const capeCollar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.065, 14, 36), blackMat);
    capeCollar.scale.set(1.06, 0.95, 0.72);
    capeCollar.position.set(0, 0.73, 0.02);
    capeCollar.rotation.x = Math.PI / 2 + 0.12;
    bodyGroup.add(capeCollar);

    // Flared Burglar Cape: hangs behind the back and flares out beside the arms,
    // showing the golden-yellow inner lining framed by a black outer border (matching Hamburgler.jpeg)
    const capeGroup = new THREE.Group();
    capeGroup.position.set(0, 0.72, -0.04);
    bodyGroup.add(capeGroup);

    // Outer black cape shell (flares from r=0.38 at neck to r=0.88 at lower hem)
    const outerCapeGeo = new THREE.CylinderGeometry(0.38, 0.88, 1.48, 40, 12, true, Math.PI - 1.42, 2.84);
    outerCapeGeo.translate(0, -0.74, 0);
    outerCapeGeo.scale(1.0, 1.0, 0.62);
    const outerCape = new THREE.Mesh(outerCapeGeo, std(0x141418, 0.85, 0.02, { side: THREE.DoubleSide }));
    capeGroup.add(outerCape);

    // Inner bright yellow lining (slightly narrower & shorter so the black border frames the bottom and side edges!)
    const innerCapeGeo = new THREE.CylinderGeometry(0.36, 0.81, 1.38, 40, 12, true, Math.PI - 1.30, 2.60);
    innerCapeGeo.translate(0, -0.68, 0.015);
    innerCapeGeo.scale(1.0, 1.0, 0.60);
    const innerCape = new THREE.Mesh(innerCapeGeo, capeYellow);
    capeGroup.add(innerCape);

    // ------------------------------------------------------------------
    // 3. Oversized Double-Layered Hamburger Necktie (Refactored from Birdie's Scarf)
    // ------------------------------------------------------------------
    const tieGroup = new THREE.Group();
    tieGroup.position.set(0, 0.70, 0.40);
    bodyGroup.add(tieGroup);

    // Red V-strap under the collar + chunky trapezoidal knot
    [-1, 1].forEach(side => {
        const neckStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.03), tieKnotRed);
        neckStrap.position.set(side * 0.08, 0.05, -0.06);
        neckStrap.rotation.z = side * 0.45;
        neckStrap.rotation.x = -0.3;
        tieGroup.add(neckStrap);
    });
    const knotGeo = new THREE.CylinderGeometry(0.11, 0.075, 0.16, 4);
    knotGeo.rotateY(Math.PI / 4);
    knotGeo.scale(1.15, 1.0, 0.55);
    const knot = new THREE.Mesh(knotGeo, tieKnotRed);
    knot.position.set(0, -0.05, 0.02);
    tieGroup.add(knot);

    // Helper to build a tapered, pointed necktie blade that drapes cleanly in front of the striped belly
    function buildTieBlade(topW, botW, length, pointLen, zOffset, curveAmp) {
        const geo = new THREE.PlaneGeometry(1, length, 8, 24);
        geo.translate(0, -length / 2, 0);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i); // -0.5 .. 0.5
            const y = pos.getY(i); // 0 .. -length
            const t = -y / length; // 0 at knot .. 1 at bottom point

            // Taper width: widens down the blade, then narrows sharply into a diamond tip
            const tipStart = 1.0 - (pointLen / length);
            let halfW;
            if (t < tipStart) {
                const u = t / tipStart;
                halfW = (topW * (1 - u) + botW * u) * 0.5;
            } else {
                const u = (t - tipStart) / (1.0 - tipStart);
                halfW = botW * 0.5 * Math.max(0.02, 1.0 - u);
            }
            pos.setX(i, x * 2.0 * halfW);

            // Bow gently outward over the striped belly, staying strictly outside torsoGeo (z >= 0.44)
            const bowOut = Math.sin(Math.min(1.0, t * 1.05) * Math.PI * 0.85) * curveAmp;
            pos.setZ(i, bowOut + zOffset);
        }
        geo.computeVertexNormals();
        return new THREE.Mesh(geo, tiePatternMat);
    }

    // In Hamburgler.jpeg, his tie has a wide upper burger blade + a longer lower burger blade peeking underneath
    const upperTieBlade = buildTieBlade(0.14, 0.36, 0.94, 0.18, 0.045, 0.065);
    upperTieBlade.position.y = -0.11;
    tieGroup.add(upperTieBlade);

    const lowerTieBlade = buildTieBlade(0.13, 0.32, 1.32, 0.18, 0.022, 0.055);
    lowerTieBlade.position.y = -0.11;
    tieGroup.add(lowerTieBlade);

    // ------------------------------------------------------------------
    // 4. Head: Sculpted Puppet Face, Ginger Hair, Bandit Mask & 1-Tooth Grin
    // ------------------------------------------------------------------
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.24, 0.06);
    hamburglarGroup.add(headGroup);

    // Main peach head sphere (slightly wider across the cheeks)
    const headGeo = new THREE.SphereGeometry(0.52, 40, 32);
    headGeo.scale(1.08, 0.96, 0.95);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(headMesh);

    // Chubby puppet cheeks (left & right lower face bulges matching Hamburgler.jpeg)
    [-1, 1].forEach(side => {
        const cheekGeo = new THREE.SphereGeometry(0.24, 24, 18);
        cheekGeo.scale(1.15, 0.85, 0.95);
        const cheek = new THREE.Mesh(cheekGeo, skinMat);
        cheek.position.set(side * 0.31, -0.10, 0.25);
        headGroup.add(cheek);
    });

    // Rounded chin
    const chinGeo = new THREE.SphereGeometry(0.22, 20, 16);
    chinGeo.scale(1.35, 0.7, 0.95);
    const chin = new THREE.Mesh(chinGeo, skinMat);
    chin.position.set(0, -0.26, 0.26);
    headGroup.add(chin);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.32, 24), skinMat);
    neck.position.y = -0.38;
    headGroup.add(neck);

    // Big round cupped puppet ears sticking out on the sides
    [-1, 1].forEach(side => {
        const earGroup = new THREE.Group();
        earGroup.position.set(side * 0.56, 0.02, -0.02);
        earGroup.rotation.y = -side * 0.28;
        earGroup.rotation.z = -side * 0.12;

        const outerEar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.055, 12, 24), skinMat);
        outerEar.scale.set(0.85, 1.15, 0.7);
        const innerEar = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), noseMat);
        innerEar.scale.set(0.85, 1.15, 1);
        innerEar.position.z = -0.01;
        earGroup.add(outerEar, innerEar);
        headGroup.add(earGroup);
    });

    // Ginger-orange hair bangs swept across the forehead strictly underneath the hat brim
    const hairGroup = new THREE.Group();
    headGroup.add(hairGroup);
    const hairCapGeo = new THREE.SphereGeometry(0.49, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.42);
    hairCapGeo.scale(1.04, 0.58, 0.90);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.y = -0.02;
    hairCap.rotation.x = -0.18;
    hairGroup.add(hairCap);

    // Sculpted swept ginger bangs over the forehead (between the hat brim and the black domino mask)
    [
        { x: -0.26, y: 0.21, z: 0.38, rx: 0.25, ry: -0.3, rz: 0.45, sx: 0.21, sy: 0.085, sz: 0.12 },
        { x: -0.06, y: 0.23, z: 0.43, rx: 0.30, ry: -0.1, rz: 0.28, sx: 0.24, sy: 0.09,  sz: 0.13 },
        { x:  0.16, y: 0.23, z: 0.41, rx: 0.28, ry:  0.2, rz: 0.15, sx: 0.24, sy: 0.09,  sz: 0.13 },
        { x:  0.34, y: 0.19, z: 0.31, rx: 0.20, ry:  0.4, rz: -0.25, sx: 0.21, sy: 0.09, sz: 0.14 },
        { x: -0.44, y: 0.13, z: 0.14, rx: 0.1,  ry: -0.6, rz: 0.35, sx: 0.17, sy: 0.10,  sz: 0.14 },
        { x:  0.45, y: 0.13, z: 0.14, rx: 0.1,  ry:  0.6, rz: -0.35, sx: 0.17, sy: 0.10,  sz: 0.14 }
    ].forEach(b => {
        const bangGeo = new THREE.SphereGeometry(1, 16, 12);
        bangGeo.scale(b.sx, b.sy, b.sz);
        const bang = new THREE.Mesh(bangGeo, hairMat);
        bang.position.set(b.x, b.y, b.z);
        bang.rotation.set(b.rx, b.ry, b.rz);
        hairGroup.add(bang);
    });

    // Black Lone-Ranger / Bandit Domino Mask across the eyes
    const maskGroup = new THREE.Group();
    maskGroup.position.set(0, 0.10, 0.45);
    headGroup.add(maskGroup);

    [-1, 1].forEach(side => {
        // Rounded mask lobe around each eye
        const lobeGeo = new THREE.SphereGeometry(0.22, 24, 18);
        lobeGeo.scale(1.18, 0.88, 0.38);
        const lobe = new THREE.Mesh(lobeGeo, blackMat);
        lobe.position.set(side * 0.17, 0.0, -0.02);
        lobe.rotation.y = side * 0.24;
        lobe.rotation.z = -side * 0.06;
        maskGroup.add(lobe);

        // Elastic side strap running back toward the temples/ears
        const strapGeo = new THREE.BoxGeometry(0.28, 0.028, 0.03);
        const strap = new THREE.Mesh(strapGeo, blackMat);
        strap.position.set(side * 0.40, 0.06, -0.16);
        strap.rotation.y = side * 0.78;
        strap.rotation.z = side * 0.24;
        maskGroup.add(strap);
    });
    // Center bridge of the mask
    const maskBridge = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), blackMat);
    maskBridge.scale.set(1.2, 0.75, 0.45);
    maskBridge.position.set(0, 0.01, 0.01);
    maskGroup.add(maskBridge);

    // Cute round button nose perched right below the mask bridge
    const noseGeo = new THREE.SphereGeometry(0.095, 20, 16);
    noseGeo.scale(1.12, 0.92, 1.08);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, -0.03, 0.53);
    headGroup.add(nose);

    // Close-set round white cartoon eyes inside the mask with tracking black pupils
    function buildEye(side) {
        const g = new THREE.Group();
        // Close-set like Hamburgler.jpeg!
        g.position.set(side * 0.115, 0.105, 0.49);
        g.rotation.y = side * 0.12;

        const R = 0.088;
        const ballGeo = new THREE.SphereGeometry(R, 22, 18);
        ballGeo.scale(0.95, 1.08, 0.55);
        g.add(new THREE.Mesh(ballGeo, eyeWhite));

        const look = new THREE.Group();
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), pupilMat);
        pupil.scale.set(1, 1.05, 0.35);
        pupil.position.z = R * 0.55;
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), std(0xffffff, 0.1));
        glint.position.set(0.014, 0.018, R * 0.55 + 0.016);
        look.add(pupil, glint);
        look.userData.base = look.position.clone();
        g.add(look);

        // Blinking upper lid
        const lidGeo = new THREE.SphereGeometry(R * 1.08, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
        lidGeo.scale(0.95, 1.08, 0.60);
        const lid = new THREE.Mesh(lidGeo, blackMat);
        lid.rotation.x = -1.15;
        g.add(lid);

        headGroup.add(g);
        return { group: g, look, lid };
    }
    const leftEyeRig = buildEye(-1);
    const rightEyeRig = buildEye(1);

    // Mischievous smile with Hamburglar's signature single front tooth
    const smileGroup = new THREE.Group();
    smileGroup.position.set(0, -0.15, 0.465);
    smileGroup.rotation.x = 0.12;
    headGroup.add(smileGroup);

    const smileShape = new THREE.Shape();
    smileShape.moveTo(-0.22, 0.04);
    smileShape.quadraticCurveTo(0, -0.05, 0.22, 0.04);
    smileShape.quadraticCurveTo(0, -0.17, -0.22, 0.04);
    const smileCavity = new THREE.Mesh(new THREE.ShapeGeometry(smileShape, 24), mouthMat);
    smileGroup.add(smileCavity);

    // Signature single square white front tooth hanging from the center upper lip
    const toothGeo = new THREE.BoxGeometry(0.062, 0.052, 0.025);
    const tooth = new THREE.Mesh(toothGeo, whiteMat);
    tooth.position.set(0.0, -0.022, 0.012);
    smileGroup.add(tooth);

    // Subtle pink tongue at bottom of mouth cavity
    const tongueGeo = new THREE.SphereGeometry(0.065, 14, 10);
    tongueGeo.scale(1.3, 0.45, 0.5);
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(0, -0.075, 0.006);
    smileGroup.add(tongue);

    // ------------------------------------------------------------------
    // 5. Wide-Brimmed Flat-Top Black Bandit Hat with Pale-Yellow Ribbon
    // ------------------------------------------------------------------
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.32, 0.04);
    hatGroup.rotation.x = 0.12;  // tilted slightly forward so the flat crown and yellow ribbon band are clearly visible!
    hatGroup.rotation.z = -0.04; // jaunty slight tilt like Hamburgler.jpeg
    headGroup.add(hatGroup);

    // Wide flat-ish black brim
    const brimProfile = [
        new THREE.Vector2(0.42, 0.0),
        new THREE.Vector2(0.75, -0.01),
        new THREE.Vector2(1.02, 0.005),
        new THREE.Vector2(1.06, 0.02),
        new THREE.Vector2(1.00, 0.032),
        new THREE.Vector2(0.42, 0.025)
    ];
    const brimGeo = new THREE.LatheGeometry(brimProfile, 48);
    brimGeo.scale(1.04, 1.0, 0.92);
    brimGeo.computeVertexNormals();
    const brim = new THREE.Mesh(brimGeo, hatBlackMat);
    hatGroup.add(brim);

    // Flat-topped cylindrical black crown
    const crownGeo = new THREE.CylinderGeometry(0.47, 0.50, 0.28, 40);
    crownGeo.scale(1.04, 1.0, 0.94);
    const crown = new THREE.Mesh(crownGeo, hatBlackMat);
    crown.position.y = 0.15;
    hatGroup.add(crown);

    // Pale-yellow hatband ribbon around the lower crown
    const bandGeo = new THREE.CylinderGeometry(0.492, 0.506, 0.105, 40, 1, true);
    bandGeo.scale(1.045, 1.0, 0.945);
    const hatBand = new THREE.Mesh(bandGeo, hatBandMat);
    hatBand.position.y = 0.075;
    hatGroup.add(hatBand);

    // ------------------------------------------------------------------
    // 6. Striped Sleeves + White Cuffs + Bright Red Gloves (Shared Arm Rig)
    // ------------------------------------------------------------------
    function buildArm(side) {
        const pivot = new THREE.Group();
        const sleeveMat = makeStripeMat(24.0, 0.0);

        // Striped shoulder cap
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 16), sleeveMat);
        pivot.add(shoulder);

        // Striped upper sleeve
        const upperGeo = new THREE.CylinderGeometry(0.165, 0.145, 0.48, 22, 6);
        upperGeo.translate(0, -0.24, 0);
        pivot.add(new THREE.Mesh(upperGeo, sleeveMat));

        // Elbow bend
        const elbow = new THREE.Group();
        elbow.position.y = -0.46;
        elbow.rotation.x = -0.42;
        elbow.rotation.z = -side * 0.12;
        pivot.add(elbow);

        const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), sleeveMat);
        elbow.add(elbowJoint);

        // Striped forearm sleeve
        const foreGeo = new THREE.CylinderGeometry(0.14, 0.13, 0.36, 20, 6);
        foreGeo.translate(0, -0.18, 0);
        elbow.add(new THREE.Mesh(foreGeo, sleeveMat));

        // Crisp white shirt cuff at the wrist
        const cuffGeo = new THREE.CylinderGeometry(0.138, 0.144, 0.085, 20);
        cuffGeo.translate(0, -0.37, 0);
        elbow.add(new THREE.Mesh(cuffGeo, whiteMat));

        // Plump bright-red cartoon burglar glove
        const handGroup = new THREE.Group();
        handGroup.position.y = -0.47;
        elbow.add(handGroup);

        const palmGeo = new THREE.SphereGeometry(0.145, 20, 16);
        palmGeo.scale(1.05, 1.12, 0.78);
        handGroup.add(new THREE.Mesh(palmGeo, gloveRed));

        // 3 plump cartoon fingers + 1 thumb (matching Hamburgler.jpeg)
        for (let i = 0; i < 3; i++) {
            const fGeo = new THREE.SphereGeometry(0.056, 14, 12);
            fGeo.scale(1.0, 1.85, 0.92);
            const finger = new THREE.Mesh(fGeo, gloveRed);
            const spread = (i - 1) * 0.068;
            finger.position.set(spread, -0.125, 0.02);
            finger.rotation.z = spread * 1.45;
            finger.rotation.x = 0.22;
            handGroup.add(finger);
        }
        // Plump thumb
        const thumbGeo = new THREE.SphereGeometry(0.056, 14, 12);
        thumbGeo.scale(1.0, 1.65, 0.95);
        const thumb = new THREE.Mesh(thumbGeo, gloveRed);
        thumb.position.set(-side * 0.135, -0.03, 0.055);
        thumb.rotation.z = -side * 0.68;
        thumb.rotation.x = 0.3;
        handGroup.add(thumb);

        return { pivot, elbow, handGroup };
    }

    const L = buildArm(-1), R = buildArm(1);
    const leftArm = L.pivot, rightArm = R.pivot;
    leftArm.position.set(-0.52, 0.50, 0.02);
    rightArm.position.set(0.52, 0.50, 0.02);
    hamburglarGroup.add(leftArm, rightArm);

    // ------------------------------------------------------------------
    // 7. Striped Pant Legs + Red & White Spat Sneakers
    // ------------------------------------------------------------------
    const legStripeMat = makeStripeMat(22.0, 1.1);
    [-1, 1].forEach(side => {
        const leg = new THREE.Group();
        leg.position.set(side * 0.25, -0.66, 0.02);
        leg.rotation.z = side * 0.04;

        // Striped trouser leg
        const pantGeo = new THREE.CylinderGeometry(0.21, 0.185, 0.76, 24, 8);
        pantGeo.translate(0, -0.38, 0);
        leg.add(new THREE.Mesh(pantGeo, legStripeMat));

        // Flared trouser cuff at the ankle
        const pantCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.205, 0.11, 24), legStripeMat);
        pantCuff.position.y = -0.74;
        leg.add(pantCuff);

        // Chunky Red & White Cartoon Sneaker (matches Hamburgler.jpeg)
        const shoe = new THREE.Group();
        shoe.position.set(0, -0.88, 0.10);
        shoe.rotation.y = side * 0.22;
        leg.add(shoe);

        // White rounded shoe body
        const shoeBaseGeo = new THREE.SphereGeometry(0.20, 24, 16);
        shoeBaseGeo.scale(0.95, 0.62, 1.55);
        const shoeBase = new THREE.Mesh(shoeBaseGeo, whiteMat);
        shoeBase.position.set(0, 0.02, 0.05);
        shoe.add(shoeBase);

        // Red saddle / vamp overlay across the top of the sneaker
        const saddleGeo = new THREE.SphereGeometry(0.185, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
        saddleGeo.scale(0.98, 0.66, 1.38);
        const saddle = new THREE.Mesh(saddleGeo, gloveRed);
        saddle.position.set(0, 0.03, 0.04);
        shoe.add(saddle);

        // White toe cap bump at the front
        const toeCapGeo = new THREE.SphereGeometry(0.13, 18, 12);
        toeCapGeo.scale(1.08, 0.62, 1.05);
        const toeCap = new THREE.Mesh(toeCapGeo, whiteMat);
        toeCap.position.set(0, 0.0, 0.23);
        shoe.add(toeCap);

        // Flat white sole rim
        const soleGeo = new THREE.CylinderGeometry(0.19, 0.20, 0.055, 24);
        soleGeo.scale(0.96, 1.0, 1.58);
        const sole = new THREE.Mesh(soleGeo, whiteMat);
        sole.position.set(0, -0.06, 0.05);
        shoe.add(sole);

        hamburglarGroup.add(leg);
    });

    hamburglarGroup.scale.setScalar(1.0);
    hamburglarGroup.position.y = -0.05;

    // ------------------------------------------------------------------
    // 7b. Era 1 ("1971" Debut): Pointed Witch Nose & "LONE JOGGER" Shirt
    // ------------------------------------------------------------------
    const pointedNoseGeo = new THREE.ConeGeometry(0.088, 0.28, 20);
    pointedNoseGeo.rotateX(Math.PI / 2 + 0.18);
    const pointedNose = new THREE.Mesh(pointedNoseGeo, noseMat);
    pointedNose.position.set(0, -0.04, 0.64);
    pointedNose.visible = false;
    headGroup.add(pointedNose);

    // 1971 "LONE JOGGER" Red Chest Shirt (replaces the 1980s burger tie in 1971 mode)
    const ljCanvas = document.createElement("canvas");
    ljCanvas.width = 512;
    ljCanvas.height = 256;
    const ljCtx = ljCanvas.getContext("2d");
    ljCtx.fillStyle = "#b91c1c";
    ljCtx.fillRect(0, 0, 512, 256);
    ljCtx.fillStyle = "#fde047";
    ljCtx.font = "900 54px monospace";
    ljCtx.textAlign = "center";
    ljCtx.fillText("LONE", 256, 110);
    ljCtx.fillText("JOGGER", 256, 175);
    const ljTex = new THREE.CanvasTexture(ljCanvas);
    const ljMat = new THREE.MeshStandardMaterial({
        map: ljTex,
        roughness: 0.75,
        metalness: 0.02,
        side: THREE.DoubleSide
    });
    const ljShirtGeo = new THREE.CylinderGeometry(0.45, 0.515, 0.62, 36, 6, true, -0.85, 1.70);
    ljShirtGeo.scale(1.01, 1.0, 0.85);
    const loneJoggerShirt = new THREE.Mesh(ljShirtGeo, ljMat);
    loneJoggerShirt.position.set(0, 0.34, 0.01);
    loneJoggerShirt.visible = false;
    bodyGroup.add(loneJoggerShirt);

    // ------------------------------------------------------------------
    // 7c. Era 3 ("2026" Cyber-Heist): Glowing Cyber-Visor & Double Golden Burgers
    // ------------------------------------------------------------------
    const cyberVisorGroup = new THREE.Group();
    cyberVisorGroup.position.set(0, 0.105, 0.50);
    cyberVisorGroup.visible = false;
    headGroup.add(cyberVisorGroup);

    const visorGlassMat = std(0x00f0ff, 0.1, 0.9, {
        emissive: 0x00d8ff,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.78
    });
    const visorLaserMat = std(0xff2a55, 0.1, 0.9, {
        emissive: 0xff1e42,
        emissiveIntensity: 1.2
    });
    const visorShieldGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.15, 32, 1, true, -0.95, 1.90);
    visorShieldGeo.scale(1.08, 1.0, 0.45);
    const visorShield = new THREE.Mesh(visorShieldGeo, visorGlassMat);
    cyberVisorGroup.add(visorShield);

    const visorLaserGeo = new THREE.CylinderGeometry(0.368, 0.368, 0.024, 32, 1, true, -0.88, 1.76);
    visorLaserGeo.scale(1.08, 1.0, 0.46);
    const visorLaser = new THREE.Mesh(visorLaserGeo, visorLaserMat);
    cyberVisorGroup.add(visorLaser);

    // Helper to build a 3D Golden Heist Hamburger held in each gloved hand
    function buildHeistBurger(side) {
        const bGroup = new THREE.Group();
        const bunMat = std(0xf59e0b, 0.35, 0.35, { emissive: 0x451a03, emissiveIntensity: 0.25 });
        const pattyM = std(0x451a03, 0.65, 0.1);
        const cheeseM = std(0xfacc15, 0.25, 0.4, { emissive: 0x713f12, emissiveIntensity: 0.35 });
        const lettuceM = std(0x22c55e, 0.5, 0.05);
        const seedM = std(0xfef08a, 0.3, 0.2);

        // Bottom bun
        const botBun = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.055, 20), bunMat);
        botBun.position.y = -0.05;
        bGroup.add(botBun);

        // Ruffled green lettuce ring
        const lettuce = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 8, 18), lettuceM);
        lettuce.rotation.x = Math.PI / 2;
        lettuce.position.y = -0.018;
        bGroup.add(lettuce);

        // Juicy burger patty
        const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.05, 20), pattyM);
        patty.position.y = 0.01;
        bGroup.add(patty);

        // Melted square golden cheese slice
        const cheese = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.016, 0.26), cheeseM);
        cheese.position.y = 0.038;
        cheese.rotation.y = Math.PI / 4;
        bGroup.add(cheese);

        // Domed top sesame bun
        const topBunGeo = new THREE.SphereGeometry(0.165, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
        topBunGeo.scale(1.0, 0.72, 1.0);
        const topBun = new THREE.Mesh(topBunGeo, bunMat);
        topBun.position.y = 0.042;
        bGroup.add(topBun);

        // Sesame seeds on top bun
        for (let s = 0; s < 7; s++) {
            const a = (s / 7) * Math.PI * 2;
            const seed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), seedM);
            seed.scale.set(1.4, 0.6, 0.8);
            seed.position.set(Math.cos(a) * 0.085, 0.125, Math.sin(a) * 0.085);
            seed.rotation.y = -a;
            bGroup.add(seed);
        }

        bGroup.position.set(side * 0.04, -0.14, 0.16);
        bGroup.rotation.x = 0.45;
        bGroup.rotation.z = -side * 0.25;
        bGroup.visible = false;
        return bGroup;
    }

    const leftBurger = buildHeistBurger(-1);
    const rightBurger = buildHeistBurger(1);
    L.handGroup.add(leftBurger);
    R.handGroup.add(rightBurger);

    // ------------------------------------------------------------------
    // 8. Unified Mascot API + Era Mode Switcher
    // ------------------------------------------------------------------
    let currentEra = "1980";

    function setFurColor(baseHex, tipHex) {
        // Optional mode tinting for Hamburglar's stripes if desired
    }

    function setEraMode(mode) {
        currentEra = mode || "1980";
        if (currentEra === "1971") {
            // 1971 "Lone Jogger" Debut: Pointed witch nose, ashen skin, scraggly grey hair, LONE JOGGER chest shirt
            pointedNose.visible = true;
            loneJoggerShirt.visible = true;
            tieGroup.visible = false;
            cyberVisorGroup.visible = false;
            leftBurger.visible = false;
            rightBurger.visible = false;

            skinMat.color.setHex(0xd6c7b8);
            noseMat.color.setHex(0xc4a48c);
            hairMat.color.setHex(0x52525b);
            hatBandMat.color.setHex(0xfef08a);
            hatGroup.rotation.z = -0.15;
            shared.uWhiteCol.value.setHex(0xdad7cd);
        } else if (currentEra === "2026") {
            // 2026 Cyber-Heist Overdrive: Glowing HUD Visor, Double Golden Burgers in hands, 24K Gold Hatband!
            pointedNose.visible = false;
            loneJoggerShirt.visible = false;
            tieGroup.visible = true;
            cyberVisorGroup.visible = true;
            leftBurger.visible = true;
            rightBurger.visible = true;

            skinMat.color.setHex(0xf4c29f);
            noseMat.color.setHex(0xe5a47e);
            hairMat.color.setHex(0xff5722);
            hatBandMat.color.setHex(0xffd700);
            hatGroup.rotation.z = -0.04;
            shared.uWhiteCol.value.setHex(0xfff4cc);
        } else {
            // 1980s Robble Classic (Exact Original Default)
            pointedNose.visible = false;
            loneJoggerShirt.visible = false;
            tieGroup.visible = true;
            cyberVisorGroup.visible = false;
            leftBurger.visible = false;
            rightBurger.visible = false;

            skinMat.color.setHex(0xf4c29f);
            noseMat.color.setHex(0xe5a47e);
            hairMat.color.setHex(0xd9531e);
            hatBandMat.color.setHex(0xfef08a);
            hatGroup.rotation.z = -0.04;
            shared.uWhiteCol.value.setHex(0xf6f5f0);
        }
    }

    function lookAt(mx, my) {
        [leftEyeRig, rightEyeRig].forEach(rig => {
            const b = rig.look.userData.base;
            rig.look.position.x = b.x + mx * 0.028;
            rig.look.position.y = b.y + my * 0.028;
        });
        headGroup.rotation.y = mx * 0.26;
        headGroup.rotation.x = -my * 0.12;
    }

    function update(elapsed) {
        shared.uTime.value = elapsed;
        const speedMult = currentEra === "2026" ? 2.0 : 1.0;

        // Sneaky "Robble Robble" head bob & mischievous tilt
        headGroup.position.y = 1.24 + Math.abs(Math.sin(elapsed * 2.4 * speedMult)) * 0.025;
        headGroup.rotation.z = Math.sin(elapsed * 1.3 * speedMult) * 0.055;

        // Oversized hamburger necktie sways gently
        tieGroup.rotation.z = Math.sin(elapsed * 2.0 * speedMult) * 0.04;
        lowerTieBlade.rotation.z = Math.sin(elapsed * 2.0 * speedMult - 0.5) * 0.025;

        // Burglar cape billows
        capeGroup.rotation.x = 0.04 + Math.sin(elapsed * 2.2 * speedMult) * (currentEra === "2026" ? 0.06 : 0.025);

        // Rotate the stolen golden burgers slightly in 2026 Heist Mode
        if (leftBurger.visible) {
            leftBurger.rotation.y = elapsed * 2.2;
            rightBurger.rotation.y = -elapsed * 2.2;
        }

        // Periodic blink
        const t = elapsed % 4.0;
        const blink = t > 3.8 ? Math.sin(((t - 3.8) / 0.2) * Math.PI) : 0;
        leftEyeRig.lid.rotation.x = rightEyeRig.lid.rotation.x = -1.15 + blink * 1.2;
    }

    return {
        root: hamburglarGroup,
        parts: {
            head: headGroup,
            body: bodyGroup,
            leftArm,
            rightArm,
            armRest: 0.42,
            waveLift: 2.35,
            extraArmsGroup: null,
            upperLeftArm: null,
            upperRightArm: null,
            setFurColor,
            setEraMode,
            lookAt,
            update
        },
        setFurColor,
        lookAt,
        update
    };
};
