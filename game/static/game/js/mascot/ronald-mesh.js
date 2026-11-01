/**
 * ronald-mesh.js - Procedural 3D Ronald McDonald (Skinny Jumpsuit & Big Red Clown Shoes Edition)
 *
 * Designed from dataset/Ronald_McDonald.webp:
 *  - Tall, slender/skinny silhouette (narrow chest/waist, slightly baggy hip pockets,
 *    cropped knee-length yellow jumpsuit legs, and skinny red-and-white striped socks)
 *  - Bright yellow jumpsuit with white pointed collar, red center zipper placket,
 *    two angled red slash pocket trims, and the red circle badge + yellow "M" on the left chest
 *  - GLSL Red & White horizontal stripe shader on the slender sleeves and socks
 *  - Red inner wrist cuffs + bright yellow 5-fingered waving gloves on the shared
 *    `rightArm` / `leftArm` shoulder rig
 *  - Oversized glossy red clown shoes with thick black lug soles and yellow bow laces
 *  - Clown face with white face-paint, high arched eyebrows, shiny red clown nose,
 *    wide red painted smile with white teeth, and fluffy center-parted red clown hair
 * Air-gapped: 100% procedural GLSL & Three.js geometry.
 */

window.buildRonaldMesh = function(THREE) {
    const ronaldGroup = new THREE.Group();
    ronaldGroup.name = "RonaldMcDonald";

    const shared = {
        uTime:     { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.35, 0.6, 0.75).normalize() },
        uRedCol:   { value: new THREE.Color(0xc81919) },
        uWhiteCol: { value: new THREE.Color(0xf8fafc) }
    };

    // ------------------------------------------------------------------
    // 1. Red & White Horizontal Stripe Shader (Sleeves, Socks, Undershirt)
    // ------------------------------------------------------------------
    const stripeVertex = `
        varying vec3 vObj;
        varying vec3 vNormalV;
        void main() {
            vObj = position;
            vNormalV = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const stripeFragment = `
        uniform vec3  uRedCol;
        uniform vec3  uWhiteCol;
        uniform vec3  uLightDir;
        uniform float uFreq;
        uniform float uPhase;
        varying vec3  vObj;
        varying vec3  vNormalV;

        void main() {
            float fold = sin(atan(vObj.x, vObj.z) * 5.0) * 0.008;
            float wave = sin((vObj.y + fold) * uFreq + uPhase);
            float mask = smoothstep(-0.08, 0.08, wave);
            vec3 base = mix(uRedCol, uWhiteCol, mask);

            vec3 n = normalize(vNormalV);
            float diff = max(dot(n, uLightDir), 0.0);
            float wrap = dot(n, uLightDir) * 0.5 + 0.5;
            vec3 col = base * (0.60 + 0.34 * wrap + 0.22 * diff);
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function makeRedWhiteStripeMat(freq = 28.0, phase = 0.0) {
        return new THREE.ShaderMaterial({
            uniforms: {
                uRedCol:   shared.uRedCol,
                uWhiteCol: shared.uWhiteCol,
                uLightDir: shared.uLightDir,
                uFreq:     { value: freq },
                uPhase:    { value: phase }
            },
            vertexShader: stripeVertex,
            fragmentShader: stripeFragment,
            side: THREE.DoubleSide
        });
    }

    // Standard materials
    function std(color, roughness = 0.6, metalness = 0.02, extra = {}) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    }
    const suitYellow   = std(0xfacc15, 0.68);           // bright yellow jumpsuit
    const suitYellowDk = std(0xeab308, 0.72);
    const trimRed      = std(0xd61f1f, 0.55);           // zipper, pockets, wrist cuffs, badge
    const shoeRed      = std(0xc81414, 0.24, 0.08);     // glossy red leather clown shoes!
    const soleBlack    = std(0x141418, 0.85);           // thick black lug soles
    const gloveYellow  = std(0xfde047, 0.62);           // bright yellow gloves & shoelaces
    const collarWhite  = std(0xf8fafc, 0.5, 0.02, { side: THREE.DoubleSide });
    const faceWhite    = std(0xf8fafc, 0.45);           // white clown makeup
    const skinPeach    = std(0xf2c1a0, 0.55);           // natural skin around upper cheeks/eyes
    const hairRed      = std(0xb91c1c, 0.78);           // curly red clown wig
    const hairRedHi    = std(0xdc2626, 0.72);
    const lipRed       = std(0xc81919, 0.42);           // painted red clown smile & nose
    const noseRed      = std(0xd61919, 0.22, 0.05);     // shiny red clown nose
    const mouthDark    = std(0x28060a, 0.9, 0, { side: THREE.DoubleSide });
    const archMat      = std(0xfef08a, 0.35, 0.1, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });

    // ------------------------------------------------------------------
    // 2. Slender Yellow Jumpsuit Torso + Red Zipper + Pockets + Chest Logo
    // ------------------------------------------------------------------
    const bodyGroup = new THREE.Group();
    ronaldGroup.add(bodyGroup);

    // Tall, skinny torso profile with a slight baggy flare at the hip pockets (matching Ronald_McDonald.webp)
    const torsoProfile = new THREE.SplineCurve([
        new THREE.Vector2(0.001, -0.42),
        new THREE.Vector2(0.32, -0.40),
        new THREE.Vector2(0.38, -0.22), // baggy hip pocket flare
        new THREE.Vector2(0.34,  0.05), // slim waist
        new THREE.Vector2(0.33,  0.38), // slender chest
        new THREE.Vector2(0.31,  0.66), // narrow shoulders
        new THREE.Vector2(0.20,  0.82),
        new THREE.Vector2(0.001, 0.86)
    ]).getPoints(48);
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 48);
    torsoGeo.scale(1.0, 1.0, 0.74);
    torsoGeo.computeVertexNormals();
    const torsoMesh = new THREE.Mesh(torsoGeo, suitYellow);
    bodyGroup.add(torsoMesh);

    // Striped turtleneck peeking inside the V of the white collar
    const neckTurtleneck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.19, 0.22, 24),
        makeRedWhiteStripeMat(34.0, 0.5)
    );
    neckTurtleneck.position.set(0, 0.86, 0.02);
    bodyGroup.add(neckTurtleneck);

    // Crisp white pointed shirt collar flaps at the neck
    [-1, 1].forEach(side => {
        const collarShape = new THREE.Shape();
        collarShape.moveTo(0, 0);
        collarShape.lineTo(side * 0.22, 0.04);
        collarShape.lineTo(side * 0.15, -0.19);
        collarShape.lineTo(side * 0.02, -0.08);
        collarShape.closePath();
        const flap = new THREE.Mesh(new THREE.ShapeGeometry(collarShape), collarWhite);
        flap.position.set(side * 0.02, 0.80, 0.21);
        flap.rotation.x = -0.28;
        flap.rotation.y = side * 0.25;
        bodyGroup.add(flap);
    });
    // Back collar band
    const collarBack = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.04, 10, 28), collarWhite);
    collarBack.scale.set(1.05, 0.9, 0.82);
    collarBack.position.set(0, 0.81, 0.02);
    collarBack.rotation.x = Math.PI / 2 + 0.15;
    bodyGroup.add(collarBack);

    // Center vertical red zipper placket running from collar (y=0.74) down to crouch/waist (y=-0.12)
    const zipperGeo = new THREE.BoxGeometry(0.048, 0.86, 0.025);
    const zipper = new THREE.Mesh(zipperGeo, trimRed);
    zipper.position.set(0, 0.31, 0.245);
    zipper.rotation.x = -0.02;
    bodyGroup.add(zipper);

    // Diagonal red welt slash pockets on left and right hips (matching Ronald_McDonald.webp)
    [-1, 1].forEach(side => {
        const pocketGeo = new THREE.BoxGeometry(0.22, 0.042, 0.025);
        const pocket = new THREE.Mesh(pocketGeo, trimRed);
        pocket.position.set(side * 0.20, -0.02, 0.245);
        pocket.rotation.z = -side * 0.52;
        pocket.rotation.y = side * 0.42;
        bodyGroup.add(pocket);
    });

    // Red circle patch with yellow Golden Arches "M" on Ronald's left chest (viewer's right: x = +0.145)
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0.145, 0.50, 0.242);
    badgeGroup.rotation.y = 0.32;
    badgeGroup.rotation.x = -0.08;
    bodyGroup.add(badgeGroup);

    const badgeCircle = new THREE.Mesh(new THREE.CircleGeometry(0.095, 28), trimRed);
    badgeGroup.add(badgeCircle);

    const arch = new THREE.Shape();
    arch.moveTo(-0.055, -0.038);
    arch.quadraticCurveTo(-0.028, 0.062, 0.0, -0.005);
    arch.quadraticCurveTo(0.028, 0.062, 0.055, -0.038);
    arch.lineTo(0.038, -0.038);
    arch.quadraticCurveTo(0.022, 0.028, 0.0, -0.022);
    arch.quadraticCurveTo(-0.022, 0.028, -0.038, -0.038);
    arch.closePath();
    const archMesh = new THREE.Mesh(new THREE.ShapeGeometry(arch, 14), archMat);
    archMesh.position.z = 0.004;
    badgeGroup.add(archMesh);

    // ------------------------------------------------------------------
    // 3. Cropped Baggy Yellow Jumpsuit Legs + Skinny Striped Socks + Giant Red Clown Shoes
    // ------------------------------------------------------------------
    const sockStripeMat = makeRedWhiteStripeMat(26.0, 0.2);

    [-1, 1].forEach(side => {
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.165, -0.28, 0.0);
        ronaldGroup.add(legGroup);

        // Baggy upper yellow jumpsuit leg tapering to just below the knee
        const pantProfile = [
            new THREE.Vector2(0.13, -0.56), // knee hem
            new THREE.Vector2(0.15, -0.42),
            new THREE.Vector2(0.19, -0.20), // slight baggy thigh
            new THREE.Vector2(0.185, 0.04)
        ];
        const pantGeo = new THREE.LatheGeometry(pantProfile, 28);
        pantGeo.scale(1.0, 1.0, 0.88);
        pantGeo.computeVertexNormals();
        legGroup.add(new THREE.Mesh(pantGeo, suitYellow));

        // Yellow knee cuff band
        const kneeCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.128, 0.05, 24), suitYellowDk);
        kneeCuff.scale.set(1.0, 1.0, 0.88);
        kneeCuff.position.y = -0.56;
        legGroup.add(kneeCuff);

        // Skinny red-and-white striped sock emerging from knee cuff down into the shoe
        const sockGeo = new THREE.CylinderGeometry(0.082, 0.072, 0.38, 20, 6);
        sockGeo.translate(0, -0.74, 0);
        legGroup.add(new THREE.Mesh(sockGeo, sockStripeMat));

        // --------------------------------------------------------------
        // Giant Glossy Red Clown Shoe with Black Lug Sole & Yellow Laces
        // --------------------------------------------------------------
        const shoe = new THREE.Group();
        shoe.position.set(side * 0.03, -0.94, 0.14);
        shoe.rotation.y = side * 0.26; // classic turned-out clown stance
        shoe.scale.set(1.26, 1.16, 1.28); // extra-big iconic red clown shoes!
        legGroup.add(shoe);

        // High red ankle boot collar
        const ankleGeo = new THREE.CylinderGeometry(0.095, 0.115, 0.15, 20);
        const ankle = new THREE.Mesh(ankleGeo, shoeRed);
        ankle.position.set(0, 0.08, -0.08);
        shoe.add(ankle);

        // Midfoot vamp / instep
        const vampGeo = new THREE.SphereGeometry(0.135, 22, 16);
        vampGeo.scale(0.96, 0.72, 1.45);
        const vamp = new THREE.Mesh(vampGeo, shoeRed);
        vamp.position.set(0, 0.01, 0.02);
        shoe.add(vamp);

        // Huge bulbous glossy red clown toe box!
        const bigToeGeo = new THREE.SphereGeometry(0.175, 26, 18);
        bigToeGeo.scale(1.15, 0.70, 1.36);
        const bigToe = new THREE.Mesh(bigToeGeo, shoeRed);
        bigToe.position.set(0, 0.005, 0.20);
        shoe.add(bigToe);

        // Thick black lug sole under the entire giant shoe
        const soleRear = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.13, 0.05, 20), soleBlack);
        soleRear.scale.set(1.0, 1.0, 1.3);
        soleRear.position.set(0, -0.065, -0.04);
        shoe.add(soleRear);

        const soleFront = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.19, 0.055, 24), soleBlack);
        soleFront.scale.set(1.14, 1.0, 1.34);
        soleFront.position.set(0, -0.065, 0.19);
        shoe.add(soleFront);

        // Bright yellow crisscross laces + floppy bow loops on top of the instep
        for (let l = 0; l < 3; l++) {
            const laceBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.022), gloveYellow);
            laceBar.position.set(0, 0.085 - l * 0.024, -0.01 + l * 0.032);
            laceBar.rotation.x = 0.55;
            laceBar.rotation.z = (l % 2 === 0 ? 1 : -1) * 0.25;
            shoe.add(laceBar);
        }
        // Yellow bow loops at top of shoe tongue
        [-1, 1].forEach(bSide => {
            const loopGeo = new THREE.TorusGeometry(0.042, 0.012, 8, 16);
            loopGeo.scale(1.3, 0.8, 1.0);
            const loop = new THREE.Mesh(loopGeo, gloveYellow);
            loop.position.set(bSide * 0.055, 0.11, 0.01);
            loop.rotation.y = bSide * 0.35;
            loop.rotation.z = -bSide * 0.3;
            shoe.add(loop);
        });
    });

    // ------------------------------------------------------------------
    // 4. Head: White Clown Face Paint, Red Nose, Big Red Smile & Curly Red Hair
    // ------------------------------------------------------------------
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.25, 0.04);
    ronaldGroup.add(headGroup);

    // Slender oval head base (bright white clown makeup)
    const headGeo = new THREE.SphereGeometry(0.35, 36, 28);
    headGeo.scale(0.92, 1.12, 0.95);
    const headMesh = new THREE.Mesh(headGeo, faceWhite);
    headGroup.add(headMesh);

    // Subtle peach skin patches around the upper eye sockets (classic Ronald makeup leaves skin around the eyes)
    [-1, 1].forEach(side => {
        const eyePatchGeo = new THREE.SphereGeometry(0.095, 18, 14);
        eyePatchGeo.scale(1.0, 1.1, 0.35);
        const eyePatch = new THREE.Mesh(eyePatchGeo, skinPeach);
        eyePatch.position.set(side * 0.10, 0.08, 0.295);
        eyePatch.rotation.y = side * 0.22;
        headGroup.add(eyePatch);
    });

    // Slender white-painted neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.26, 20), faceWhite);
    neck.position.y = -0.32;
    headGroup.add(neck);

    // Tracking Eyes + High Arched Clown Eyebrows
    function buildEye(side) {
        const g = new THREE.Group();
        g.position.set(side * 0.10, 0.08, 0.315);
        g.rotation.y = side * 0.16;

        const R = 0.055;
        const ballGeo = new THREE.SphereGeometry(R, 18, 14);
        ballGeo.scale(0.95, 1.1, 0.55);
        g.add(new THREE.Mesh(ballGeo, std(0xffffff, 0.15)));

        const look = new THREE.Group();
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), soleBlack);
        pupil.scale.set(1, 1.05, 0.35);
        pupil.position.z = R * 0.55;
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), std(0xffffff, 0.1));
        glint.position.set(0.009, 0.012, R * 0.55 + 0.01);
        look.add(pupil, glint);
        look.userData.base = look.position.clone();
        g.add(look);

        // Blinking lid
        const lidGeo = new THREE.SphereGeometry(R * 1.08, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
        lidGeo.scale(0.95, 1.1, 0.60);
        const lid = new THREE.Mesh(lidGeo, skinPeach);
        lid.rotation.x = -1.15;
        g.add(lid);

        // High arched thin black clown eyebrow on the white forehead
        const browGeo = new THREE.TorusGeometry(0.065, 0.009, 8, 20, Math.PI * 0.85);
        const brow = new THREE.Mesh(browGeo, soleBlack);
        brow.position.set(0, 0.075, 0.012);
        brow.rotation.z = Math.PI * 0.08;
        g.add(brow);

        headGroup.add(g);
        return { group: g, look, lid };
    }
    const leftEyeRig = buildEye(-1);
    const rightEyeRig = buildEye(1);

    // Bulbous shiny red clown nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 16), noseRed);
    nose.position.set(0, -0.01, 0.36);
    headGroup.add(nose);

    // Wide Painted Red Clown Mouth + Cheerful Open Smile with White Teeth
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.14, 0.305);
    mouthGroup.rotation.x = 0.08;
    headGroup.add(mouthGroup);

    // Large red clown lip makeup patch surrounding the mouth
    const lipPaintShape = new THREE.Shape();
    lipPaintShape.moveTo(-0.18, 0.06);
    lipPaintShape.quadraticCurveTo(0, 0.01, 0.18, 0.06);
    lipPaintShape.quadraticCurveTo(0.21, -0.08, 0.12, -0.15);
    lipPaintShape.quadraticCurveTo(0, -0.21, -0.12, -0.15);
    lipPaintShape.quadraticCurveTo(-0.21, -0.08, -0.18, 0.06);
    const lipPaint = new THREE.Mesh(new THREE.ShapeGeometry(lipPaintShape, 24), lipRed);
    mouthGroup.add(lipPaint);

    // Dark inner smile cavity
    const cavityShape = new THREE.Shape();
    cavityShape.moveTo(-0.12, 0.02);
    cavityShape.quadraticCurveTo(0, -0.02, 0.12, 0.02);
    cavityShape.quadraticCurveTo(0, -0.14, -0.12, 0.02);
    const cavity = new THREE.Mesh(new THREE.ShapeGeometry(cavityShape, 20), mouthDark);
    cavity.position.z = 0.004;
    mouthGroup.add(cavity);

    // Upper white teeth row inside the smile
    const teethShape = new THREE.Shape();
    teethShape.moveTo(-0.095, 0.012);
    teethShape.quadraticCurveTo(0, -0.018, 0.095, 0.012);
    teethShape.quadraticCurveTo(0, -0.055, -0.095, 0.012);
    const teeth = new THREE.Mesh(new THREE.ShapeGeometry(teethShape, 16), faceWhite);
    teeth.position.z = 0.008;
    mouthGroup.add(teeth);

    // Voluminous Center-Parted Curly Red Clown Hair Wig (framed behind & around the white face!)
    const wigGroup = new THREE.Group();
    headGroup.add(wigGroup);

    // Main back wig volume (set back at z = -0.14 so the white forehead & face are 100% exposed!)
    const wigBaseGeo = new THREE.SphereGeometry(0.38, 28, 22);
    wigBaseGeo.scale(1.10, 1.06, 0.78);
    const wigBase = new THREE.Mesh(wigBaseGeo, hairRed);
    wigBase.position.set(0, 0.10, -0.14);
    wigGroup.add(wigBase);

    // Sculpted curly hair puffs framing the center part, temples, and sides of the face
    const puffs = [
        // Top left & right parted crown lobes
        { x: -0.15, y: 0.36, z: 0.04, r: 0.16, sx: 1.2, sy: 0.95, sz: 0.95, hi: true },
        { x:  0.15, y: 0.36, z: 0.04, r: 0.16, sx: 1.2, sy: 0.95, sz: 0.95, hi: true },
        { x: -0.28, y: 0.26, z: 0.02, r: 0.16, sx: 1.1, sy: 1.0,  sz: 0.9,  hi: false },
        { x:  0.28, y: 0.26, z: 0.02, r: 0.16, sx: 1.1, sy: 1.0,  sz: 0.9,  hi: false },
        // Mid side curls framing the cheeks
        { x: -0.34, y: 0.12, z: 0.0,  r: 0.15, sx: 1.0, sy: 1.1,  sz: 0.9,  hi: true },
        { x:  0.34, y: 0.12, z: 0.0,  r: 0.15, sx: 1.0, sy: 1.1,  sz: 0.9,  hi: true },
        // Lower side curls near jaw/ears
        { x: -0.31, y: -0.04, z: -0.02, r: 0.135, sx: 0.95, sy: 1.0, sz: 0.85, hi: false },
        { x:  0.31, y: -0.04, z: -0.02, r: 0.135, sx: 0.95, sy: 1.0, sz: 0.85, hi: false },
        // Forehead wave tufts high above the eyebrows
        { x: -0.15, y: 0.29, z: 0.18, r: 0.10, sx: 1.25, sy: 0.70, sz: 0.75, hi: true },
        { x:  0.15, y: 0.29, z: 0.18, r: 0.10, sx: 1.25, sy: 0.70, sz: 0.75, hi: true }
    ];
    puffs.forEach(p => {
        const g = new THREE.IcosahedronGeometry(p.r, 2);
        g.scale(p.sx, p.sy, p.sz);
        const m = new THREE.Mesh(g, p.hi ? hairRedHi : hairRed);
        m.position.set(p.x, p.y, p.z);
        wigGroup.add(m);
    });

    // ------------------------------------------------------------------
    // 5. Slender Striped Sleeves + Red Wristbands + Bright Yellow 5-Finger Gloves
    // ------------------------------------------------------------------
    function buildArm(side) {
        const pivot = new THREE.Group();
        const sleeveMat = makeRedWhiteStripeMat(28.0, 0.0);

        // Striped shoulder cap emerging from the yellow sleeveless armhole
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), sleeveMat);
        pivot.add(shoulder);

        // Slender red-and-white striped upper arm
        const upperGeo = new THREE.CylinderGeometry(0.115, 0.10, 0.48, 20, 6);
        upperGeo.translate(0, -0.24, 0);
        pivot.add(new THREE.Mesh(upperGeo, sleeveMat));

        // Elbow joint
        const elbow = new THREE.Group();
        elbow.position.y = -0.46;
        elbow.rotation.x = -0.35;
        elbow.rotation.z = -side * 0.10;
        pivot.add(elbow);

        elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.098, 14, 12), sleeveMat));

        // Flared red-and-white striped forearm sleeve
        const foreGeo = new THREE.CylinderGeometry(0.098, 0.128, 0.36, 20, 6);
        foreGeo.translate(0, -0.18, 0);
        elbow.add(new THREE.Mesh(foreGeo, sleeveMat));

        // Fitted red inner wristband extending from the flared striped sleeve (matching Ronald_McDonald.webp!)
        const wristGeo = new THREE.CylinderGeometry(0.078, 0.074, 0.13, 18);
        wristGeo.translate(0, -0.40, 0);
        elbow.add(new THREE.Mesh(wristGeo, trimRed));

        // Bright yellow 5-fingered clown glove
        const handGroup = new THREE.Group();
        handGroup.position.y = -0.50;
        elbow.add(handGroup);

        const palmGeo = new THREE.SphereGeometry(0.098, 18, 14);
        palmGeo.scale(1.02, 1.15, 0.65);
        handGroup.add(new THREE.Mesh(palmGeo, gloveYellow));

        // 4 slender fingers + 1 thumb (5 digits total, matching Ronald_McDonald.webp!)
        for (let i = 0; i < 4; i++) {
            const fGeo = new THREE.SphereGeometry(0.026, 10, 8);
            fGeo.scale(0.9, 2.5, 0.85);
            const finger = new THREE.Mesh(fGeo, gloveYellow);
            const spread = (i - 1.5) * 0.038;
            finger.position.set(spread, -0.11, 0.01);
            finger.rotation.z = spread * 1.6;
            finger.rotation.x = 0.12;
            handGroup.add(finger);
        }
        const thumbGeo = new THREE.SphereGeometry(0.028, 10, 8);
        thumbGeo.scale(0.95, 2.1, 0.9);
        const thumb = new THREE.Mesh(thumbGeo, gloveYellow);
        thumb.position.set(-side * 0.095, -0.02, 0.03);
        thumb.rotation.z = -side * 0.75;
        thumb.rotation.x = 0.2;
        handGroup.add(thumb);

        return { pivot, elbow, handGroup };
    }

    const L = buildArm(-1), R = buildArm(1);
    const leftArm = L.pivot, rightArm = R.pivot;
    leftArm.position.set(-0.35, 0.56, 0.0);
    rightArm.position.set(0.35, 0.56, 0.0);
    ronaldGroup.add(leftArm, rightArm);

    ronaldGroup.scale.setScalar(1.0);
    ronaldGroup.position.y = -0.02;

    // ------------------------------------------------------------------
    // 5b. Era 1 ("1971" / 1963 Debut): Paper-Cup Nose, Tray Hat & Burger Belt!
    // ------------------------------------------------------------------
    // 1. Paper Drink Cup on Nose (1963 Willard Scott signature!)
    const cupNoseGroup = new THREE.Group();
    cupNoseGroup.position.set(0, -0.01, 0.38);
    cupNoseGroup.visible = false;
    headGroup.add(cupNoseGroup);

    const cupBodyGeo = new THREE.CylinderGeometry(0.048, 0.068, 0.16, 20);
    cupBodyGeo.rotateX(Math.PI / 2);
    const cupBody = new THREE.Mesh(cupBodyGeo, std(0xfefcf6, 0.45));
    cupBody.position.z = 0.05;
    cupNoseGroup.add(cupBody);

    const cupStripeGeo = new THREE.CylinderGeometry(0.054, 0.060, 0.045, 20, 1, true);
    cupStripeGeo.rotateX(Math.PI / 2);
    const cupStripe = new THREE.Mesh(cupStripeGeo, std(0xd61f1f, 0.4));
    cupStripe.position.z = 0.05;
    cupNoseGroup.add(cupStripe);

    const cupRimGeo = new THREE.TorusGeometry(0.048, 0.007, 10, 20);
    const cupRim = new THREE.Mesh(cupRimGeo, std(0xffffff, 0.3));
    cupRim.position.z = 0.13;
    cupNoseGroup.add(cupRim);

    // 2. 1963 Fast-Food Tray Hat (with Burger, Fries & Milkshake on top!)
    const trayHatGroup = new THREE.Group();
    trayHatGroup.position.set(0, 0.44, 0.02);
    trayHatGroup.rotation.z = -0.06;
    trayHatGroup.rotation.x = 0.08;
    trayHatGroup.visible = false;
    headGroup.add(trayHatGroup);

    const traySilverMat = std(0xdbeafe, 0.32, 0.55);
    const trayBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.032, 0.46), traySilverMat);
    trayHatGroup.add(trayBase);
    // Raised tray rim edges
    [
        { sx: 0.70, sy: 0.048, sz: 0.025, x: 0, z: 0.22 },
        { sx: 0.70, sy: 0.048, sz: 0.025, x: 0, z: -0.22 },
        { sx: 0.025, sy: 0.048, sz: 0.46, x: -0.34, z: 0 },
        { sx: 0.025, sy: 0.048, sz: 0.46, x: 0.34, z: 0 }
    ].forEach(r => {
        const rim = new THREE.Mesh(new THREE.BoxGeometry(r.sx, r.sy, r.sz), traySilverMat);
        rim.position.set(r.x, 0.015, r.z);
        trayHatGroup.add(rim);
    });

    // Helper for mini 3D burger (used on Tray Hat & Magic Belt)
    function buildClassicBurger(scale = 1.0) {
        const bg = new THREE.Group();
        const bunM = std(0xd97706, 0.5);
        const patM = std(0x451a03, 0.7);
        const chzM = std(0xfacc15, 0.4);
        const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.035, 18), bunM);
        bot.position.y = 0.018;
        const pat = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.032, 18), patM);
        pat.position.y = 0.048;
        const chz = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.15), chzM);
        chz.position.y = 0.066;
        chz.rotation.y = Math.PI / 4;
        const topG = new THREE.SphereGeometry(0.098, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
        topG.scale(1, 0.68, 1);
        const top = new THREE.Mesh(topG, bunM);
        top.position.y = 0.07;
        bg.add(bot, pat, chz, top);
        bg.scale.setScalar(scale);
        return bg;
    }

    // Burger on left of tray
    const trayBurger = buildClassicBurger(1.05);
    trayBurger.position.set(-0.19, 0.016, 0.04);
    trayHatGroup.add(trayBurger);

    // Red Fry Carton + Golden French Fries in center of tray
    const fryBoxGroup = new THREE.Group();
    fryBoxGroup.position.set(0.0, 0.016, -0.02);
    const fryBox = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.07), std(0xd61f1f, 0.45));
    fryBox.position.y = 0.07;
    fryBoxGroup.add(fryBox);
    const fryGoldMat = std(0xfacc15, 0.35);
    for (let f = -3; f <= 3; f++) {
        const h = 0.10 + (Math.abs(f) % 2) * 0.035;
        const fry = new THREE.Mesh(new THREE.BoxGeometry(0.016, h, 0.016), fryGoldMat);
        fry.position.set(f * 0.016, 0.14 + h * 0.25, (f % 2) * 0.01);
        fry.rotation.z = -f * 0.06;
        fryBoxGroup.add(fry);
    }
    trayHatGroup.add(fryBoxGroup);

    // Paper Milkshake Cup + Straw on right of tray
    const shakeGroup = new THREE.Group();
    shakeGroup.position.set(0.19, 0.016, 0.03);
    const shakeCup = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.050, 0.18, 20), std(0xfefcf6, 0.4));
    shakeCup.position.y = 0.09;
    const shakeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.058, 0.05, 20, 1, true), std(0xd61f1f, 0.4));
    shakeBand.position.y = 0.09;
    const shakeLid = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), std(0xffffff, 0.25, 0.05));
    shakeLid.position.y = 0.18;
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 10), std(0xd61f1f, 0.3));
    straw.position.set(0.015, 0.23, 0);
    straw.rotation.z = -0.22;
    shakeGroup.add(shakeCup, shakeBand, shakeLid, straw);
    trayHatGroup.add(shakeGroup);

    // 3. 1963 Magic Hamburger Belt around waist
    const magicBeltGroup = new THREE.Group();
    magicBeltGroup.position.set(0, -0.06, 0.0);
    magicBeltGroup.visible = false;
    bodyGroup.add(magicBeltGroup);

    const beltRingGeo = new THREE.CylinderGeometry(0.355, 0.365, 0.09, 36);
    beltRingGeo.scale(1.02, 1.0, 0.76);
    const beltRing = new THREE.Mesh(beltRingGeo, std(0x18181b, 0.5, 0.3));
    magicBeltGroup.add(beltRing);

    const beltBurger = buildClassicBurger(0.95);
    beltBurger.rotation.x = Math.PI / 2;
    beltBurger.position.set(0, 0.0, 0.26);
    magicBeltGroup.add(beltBurger);

    // ------------------------------------------------------------------
    // 5c. Era 3 ("2026" Golden Star): Golden Arch Wand & Floating Golden Aura!
    // ------------------------------------------------------------------
    const goldenWandGroup = new THREE.Group();
    goldenWandGroup.position.set(0.0, -0.08, 0.08);
    goldenWandGroup.rotation.x = 0.45;
    goldenWandGroup.rotation.z = -0.20;
    goldenWandGroup.visible = false;
    R.handGroup.add(goldenWandGroup);

    const goldGlowMat = std(0xffd700, 0.18, 0.85, { emissive: 0xb45309, emissiveIntensity: 0.65 });
    const wandShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.56, 14), goldGlowMat);
    wandShaft.position.y = 0.22;
    goldenWandGroup.add(wandShaft);

    const wandArchMesh = new THREE.Mesh(new THREE.ShapeGeometry(arch, 18), goldGlowMat);
    wandArchMesh.scale.setScalar(2.4);
    wandArchMesh.position.set(0, 0.54, 0);
    goldenWandGroup.add(wandArchMesh);

    const wandRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 12, 28), goldGlowMat);
    wandRing.position.set(0, 0.53, 0);
    goldenWandGroup.add(wandRing);

    // Floating Golden Crown / Halo above Ronald's head in 2026 mode
    const goldenHalo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 14, 36), goldGlowMat);
    goldenHalo.rotation.x = Math.PI / 2 - 0.12;
    goldenHalo.position.set(0, 0.52, -0.04);
    goldenHalo.visible = false;
    headGroup.add(goldenHalo);

    // ------------------------------------------------------------------
    // 6. Unified Mascot API + Era Mode Switcher
    // ------------------------------------------------------------------
    let currentEra = "1980";

    function setFurColor(baseHex, tipHex) {}

    function setEraMode(mode) {
        currentEra = mode || "1980";
        if (currentEra === "1971") {
            // 1963 Willard Scott Debut: Paper Drink Cup Nose, Fast-Food Tray Hat & Magic Burger Belt!
            cupNoseGroup.visible = true;
            trayHatGroup.visible = true;
            magicBeltGroup.visible = true;
            nose.visible = false;
            goldenWandGroup.visible = false;
            goldenHalo.visible = false;

            // Flatten top crown hair puffs slightly so the Tray Hat sits flush on his head
            wigGroup.scale.set(1.0, 0.86, 1.0);
            suitYellow.color.setHex(0xfde047);
            trimRed.color.setHex(0xb91c1c);
            shoeRed.color.setHex(0xb91c1c);
            shoeRed.metalness = 0.08;
            shared.uWhiteCol.value.setHex(0xf5f5dc);
        } else if (currentEra === "2026") {
            // 2026 Golden Star Overdrive: Golden Arch Wand, Floating Golden Halo & 24K Gold Trim!
            cupNoseGroup.visible = false;
            trayHatGroup.visible = false;
            magicBeltGroup.visible = false;
            nose.visible = true;
            goldenWandGroup.visible = true;
            goldenHalo.visible = true;

            wigGroup.scale.set(1.0, 1.0, 1.0);
            suitYellow.color.setHex(0xffe033);
            trimRed.color.setHex(0xffd700);
            shoeRed.color.setHex(0xffb703);
            shoeRed.metalness = 0.65;
            shared.uWhiteCol.value.setHex(0xfff08a);
        } else {
            // 1980s Classic McDonaldland Ronald (Exact Original Default)
            cupNoseGroup.visible = false;
            trayHatGroup.visible = false;
            magicBeltGroup.visible = false;
            nose.visible = true;
            goldenWandGroup.visible = false;
            goldenHalo.visible = false;

            wigGroup.scale.set(1.0, 1.0, 1.0);
            suitYellow.color.setHex(0xfacc15);
            trimRed.color.setHex(0xd61f1f);
            shoeRed.color.setHex(0xc81414);
            shoeRed.metalness = 0.08;
            shared.uWhiteCol.value.setHex(0xf8fafc);
        }
    }

    function lookAt(mx, my) {
        [leftEyeRig, rightEyeRig].forEach(rig => {
            const b = rig.look.userData.base;
            rig.look.position.x = b.x + mx * 0.02;
            rig.look.position.y = b.y + my * 0.02;
        });
        headGroup.rotation.y = mx * 0.25;
        headGroup.rotation.x = -my * 0.12;
    }

    function update(elapsed) {
        shared.uTime.value = elapsed;
        const speedMult = currentEra === "2026" ? 2.0 : 1.0;

        // Energetic clown head bob & friendly tilt
        headGroup.position.y = 1.25 + Math.abs(Math.sin(elapsed * 2.3 * speedMult)) * 0.025;
        headGroup.rotation.z = Math.sin(elapsed * 1.2 * speedMult) * 0.05;

        if (goldenWandGroup.visible) {
            wandArchMesh.rotation.y = elapsed * 2.6;
            goldenHalo.position.y = 0.52 + Math.sin(elapsed * 3.5) * 0.03;
        }

        // Blink
        const t = elapsed % 4.1;
        const blink = t > 3.9 ? Math.sin(((t - 3.9) / 0.2) * Math.PI) : 0;
        leftEyeRig.lid.rotation.x = rightEyeRig.lid.rotation.x = -1.15 + blink * 1.2;
    }

    return {
        root: ronaldGroup,
        parts: {
            head: headGroup,
            body: bodyGroup,
            leftArm,
            rightArm,
            armRest: 0.36,
            waveLift: 2.55, // High overhead wave like Ronald_McDonald.webp!
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
