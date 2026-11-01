/**
 * monopoly-mesh.js - Procedural 3D Mr. Monopoly / Rich Uncle Pennybags
 *                    (with Interactive "Mandela Effect" Monocle Toggle!)
 *
 * Designed from the official 2026 McDonald's Monopoly Game Board (MONOPOLY-gameboard.pdf):
 *  - Portly dapper gentleman silhouette in a black morning-coat tuxedo with split coattails,
 *    sculpted lapels, white dress shirt front with tuxedo studs, and bright red bow tie
 *  - Cheerful round head with rosy cheeks, bushy white eyebrows & side-hair tufts,
 *    and his iconic sweeping white handlebar mustache
 *  - Tall glossy black stovepipe Top Hat with ribbon band
 *  - White-gloved hands: right hand waves (`rightArm`), left hand holds his gold-topped cane (`leftArm`)
 *  - Gray formal trousers with white spats over glossy black dress shoes
 *  - Interactive `monocleGroup` (gold rim + glass lens + draped gold chain to lapel)
 *    toggled via `setMonocle(bool)` / `toggleMonocle()` ("Canonical Reality" vs "Mandela Timeline")
 * Air-gapped: 100% procedural Three.js geometry.
 */

window.buildMonopolyMesh = function(THREE) {
    const monopolyGroup = new THREE.Group();
    monopolyGroup.name = "MrMonopoly";

    function std(color, roughness = 0.55, metalness = 0.04, extra = {}) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    }

    const tuxBlack     = std(0x181a22, 0.50, 0.06);           // tailored black morning coat
    const lapelBlack   = std(0x232631, 0.35, 0.12);           // satin tuxedo lapels & top hat sheen
    const hatBandMat   = std(0x3b3f4c, 0.45, 0.10);           // silk hatband
    const shirtWhite   = std(0xf8fafc, 0.45, 0.02);           // crisp white dress shirt, gloves, spats
    const hairWhite    = std(0xfafaf9, 0.65, 0.01);           // bushy white mustache, eyebrows, side hair
    const bowTieRed    = std(0xdc2626, 0.48, 0.04);           // iconic red bow tie
    const pantsGray    = std(0x334155, 0.65, 0.03);           // formal charcoal-gray striped trousers
    const shoeBlack    = std(0x0f1117, 0.22, 0.12);           // polished black dress shoes
    const skinPeach    = std(0xf4c29f, 0.52, 0.02);           // warm gentleman complexion
    const cheekRosy    = std(0xeb9b78, 0.50, 0.02);           // rosy cheeks & bulbous nose
    const goldMat      = std(0xfacc15, 0.22, 0.85);           // 24k Gold cane top & Mandela monocle!
    const lensMat      = std(0xbae6fd, 0.10, 0.20, { transparent: true, opacity: 0.42, side: THREE.DoubleSide });
    const mouthDark    = std(0x2a080c, 0.90, 0.0, { side: THREE.DoubleSide });

    // ------------------------------------------------------------------
    // 1. Portly Tuxedo Torso + White Dress Shirt Front + Red Bow Tie + Coattails
    // ------------------------------------------------------------------
    const bodyGroup = new THREE.Group();
    monopolyGroup.add(bodyGroup);

    // Portly round gentleman belly profile
    const torsoProfile = new THREE.SplineCurve([
        new THREE.Vector2(0.001, -0.68),
        new THREE.Vector2(0.44, -0.66),
        new THREE.Vector2(0.56, -0.42),
        new THREE.Vector2(0.60, -0.10), // portly waistcoat belly
        new THREE.Vector2(0.55,  0.26),
        new THREE.Vector2(0.45,  0.58),
        new THREE.Vector2(0.30,  0.78),
        new THREE.Vector2(0.001, 0.84)
    ]).getPoints(48);
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 56);
    torsoGeo.scale(1.0, 1.0, 0.84);
    torsoGeo.computeVertexNormals();
    const torsoMesh = new THREE.Mesh(torsoGeo, tuxBlack);
    bodyGroup.add(torsoMesh);

    // Crisp white dress-shirt V-plastron on the upper chest between the lapels
    const shirtShape = new THREE.Shape();
    shirtShape.moveTo(-0.18, 0.32);
    shirtShape.lineTo(0.18, 0.32);
    shirtShape.lineTo(0.0, -0.26);
    shirtShape.closePath();
    const shirtFront = new THREE.Mesh(new THREE.ShapeGeometry(shirtShape), shirtWhite);
    shirtFront.position.set(0, 0.38, 0.455);
    shirtFront.rotation.x = -0.21;
    bodyGroup.add(shirtFront);

    // 3 tiny black tuxedo studs down the center of the white shirt
    [0.52, 0.40, 0.28].forEach((sy, idx) => {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.020, 10, 8), tuxBlack);
        stud.position.set(0, sy, 0.432 + idx * 0.025);
        bodyGroup.add(stud);
    });

    // Satin black tuxedo lapels framing the white shirt V
    [-1, 1].forEach(side => {
        const lapelGeo = new THREE.BoxGeometry(0.105, 0.58, 0.035);
        const lapel = new THREE.Mesh(lapelGeo, lapelBlack);
        lapel.position.set(side * 0.14, 0.38, 0.455);
        lapel.rotation.z = side * 0.31;
        lapel.rotation.y = side * 0.22;
        lapel.rotation.x = -0.21;
        bodyGroup.add(lapel);
    });

    // Split morning-coat coattails hanging behind the back
    [-1, 1].forEach(side => {
        const tailGeo = new THREE.CylinderGeometry(0.48, 0.54, 0.68, 20, 4, true, Math.PI + side * 0.12 - 0.45, 0.90);
        tailGeo.scale(1.0, 1.0, 0.85);
        const tail = new THREE.Mesh(tailGeo, tuxBlack);
        tail.material.side = THREE.DoubleSide;
        tail.position.set(0, -0.58, -0.02);
        bodyGroup.add(tail);
    });

    // White winged dress collar + Iconic Bright Red Bow Tie
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 12, 32), shirtWhite);
    collarRing.scale.set(1.04, 0.95, 0.78);
    collarRing.position.set(0, 0.75, 0.04);
    collarRing.rotation.x = Math.PI / 2 + 0.10;
    bodyGroup.add(collarRing);

    const bowTieGroup = new THREE.Group();
    bowTieGroup.position.set(0, 0.66, 0.39);
    bowTieGroup.rotation.x = -0.15;
    bodyGroup.add(bowTieGroup);

    const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), bowTieRed);
    bowKnot.scale.set(0.9, 1.0, 0.7);
    bowTieGroup.add(bowKnot);

    [-1, 1].forEach(side => {
        const wingGeo = new THREE.ConeGeometry(0.095, 0.19, 16);
        wingGeo.rotateZ(side * Math.PI / 2);
        wingGeo.scale(1.0, 1.0, 0.45);
        const wing = new THREE.Mesh(wingGeo, bowTieRed);
        wing.position.set(side * 0.09, 0, 0);
        bowTieGroup.add(wing);
    });

    // ------------------------------------------------------------------
    // 2. Head: Rosy Cheeks, Bushy White Mustache, Top Hat & Mandela Monocle!
    // ------------------------------------------------------------------
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.24, 0.05);
    monopolyGroup.add(headGroup);

    // Round cheerful head sphere
    const headGeo = new THREE.SphereGeometry(0.48, 40, 32);
    headGeo.scale(1.06, 0.98, 0.96);
    headGroup.add(new THREE.Mesh(headGeo, skinPeach));

    // Plump rosy cheeks
    [-1, 1].forEach(side => {
        const cheekGeo = new THREE.SphereGeometry(0.19, 20, 16);
        cheekGeo.scale(1.15, 0.88, 0.92);
        const cheek = new THREE.Mesh(cheekGeo, cheekRosy);
        cheek.position.set(side * 0.29, -0.06, 0.27);
        headGroup.add(cheek);

        // Ears
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skinPeach);
        ear.scale.set(0.65, 1.15, 0.85);
        ear.position.set(side * 0.50, 0.0, -0.02);
        headGroup.add(ear);

        // Bushy white temple hair puffs above the ears (classic bald-crown Pennybags side hair)
        for (let i = 0; i < 3; i++) {
            const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.105 - i * 0.01, 2), hairWhite);
            puff.position.set(side * (0.46 - i * 0.03), 0.14 - i * 0.06, 0.06 - i * 0.08);
            headGroup.add(puff);
        }
    });

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.30, 24), skinPeach);
    neck.position.y = -0.38;
    headGroup.add(neck);

    // Round bulbous nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 18), cheekRosy);
    nose.scale.set(1.08, 0.95, 1.12);
    nose.position.set(0, 0.0, 0.49);
    headGroup.add(nose);

    // Sweeping White Handlebar Mustache!
    const mustacheGroup = new THREE.Group();
    mustacheGroup.position.set(0, -0.11, 0.45);
    headGroup.add(mustacheGroup);

    [-1, 1].forEach(side => {
        // 5 overlapping sculpted segments forming each curled handlebar wing
        const pts = [
            { x: side * 0.05, y:  0.01, z: 0.04, r: 0.078, sx: 1.25, sy: 0.85 },
            { x: side * 0.15, y:  0.00, z: 0.03, r: 0.074, sx: 1.30, sy: 0.82 },
            { x: side * 0.25, y: -0.02, z: 0.00, r: 0.064, sx: 1.25, sy: 0.78 },
            { x: side * 0.34, y: -0.01, z: -0.03, r: 0.050, sx: 1.20, sy: 0.75 },
            { x: side * 0.40, y:  0.03, z: -0.05, r: 0.036, sx: 1.10, sy: 0.90 } // upturned handlebar tip!
        ];
        pts.forEach(p => {
            const seg = new THREE.Mesh(new THREE.SphereGeometry(p.r, 16, 12), hairWhite);
            seg.scale.set(p.sx, p.sy, 0.85);
            seg.position.set(p.x, p.y, p.z);
            mustacheGroup.add(seg);
        });
    });

    // Cheerful smile peeking right beneath the handlebar mustache
    const smileShape = new THREE.Shape();
    smileShape.moveTo(-0.14, 0.0);
    smileShape.quadraticCurveTo(0, -0.02, 0.14, 0.0);
    smileShape.quadraticCurveTo(0, -0.13, -0.14, 0.0);
    const smileMesh = new THREE.Mesh(new THREE.ShapeGeometry(smileShape, 18), mouthDark);
    smileMesh.position.set(0, -0.15, 0.44);
    smileMesh.rotation.x = 0.15;
    headGroup.add(smileMesh);

    // Expressive Eyes + Bushy White Eyebrows
    function buildEye(side) {
        const g = new THREE.Group();
        g.position.set(side * 0.155, 0.12, 0.435);
        g.rotation.y = side * 0.18;

        const R = 0.078;
        const ballGeo = new THREE.SphereGeometry(R, 20, 16);
        ballGeo.scale(0.95, 1.12, 0.55);
        g.add(new THREE.Mesh(ballGeo, std(0xffffff, 0.15)));

        const look = new THREE.Group();
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), shoeBlack);
        pupil.scale.set(1, 1.08, 0.35);
        pupil.position.z = R * 0.55;
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), std(0xffffff, 0.1));
        glint.position.set(0.012, 0.015, R * 0.55 + 0.014);
        look.add(pupil, glint);
        look.userData.base = look.position.clone();
        g.add(look);

        const lidGeo = new THREE.SphereGeometry(R * 1.08, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
        lidGeo.scale(0.95, 1.12, 0.60);
        const lid = new THREE.Mesh(lidGeo, skinPeach);
        lid.rotation.x = -1.15;
        g.add(lid);

        // Bushy white eyebrow
        const browGeo = new THREE.SphereGeometry(0.048, 14, 10);
        browGeo.scale(1.9, 0.65, 0.8);
        const brow = new THREE.Mesh(browGeo, hairWhite);
        brow.position.set(0, 0.10, 0.02);
        brow.rotation.z = -side * 0.18;
        g.add(brow);

        headGroup.add(g);
        return { group: g, look, lid };
    }
    const leftEyeRig = buildEye(-1);
    const rightEyeRig = buildEye(1);

    // ------------------------------------------------------------------
    // 3. The "Mandela Effect" Monocle Group (Toggled ON/OFF!)
    // ------------------------------------------------------------------
    const monocleGroup = new THREE.Group();
    monocleGroup.name = "MandelaMonocle";
    monocleGroup.visible = false; // Canonical Reality default: NO monocle!
    headGroup.add(monocleGroup);

    // Gleaming 24k Gold Monocle Rim over his right eye (viewer's left: x = -0.155)
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 14, 32), goldMat);
    rimMesh.position.set(-0.16, 0.12, 0.485);
    rimMesh.rotation.y = -0.18;
    monocleGroup.add(rimMesh);

    // Small gold gallery tab on outer edge of monocle
    const tabMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.02), goldMat);
    tabMesh.position.set(-0.28, 0.10, 0.46);
    monocleGroup.add(tabMesh);

    // Translucent cyan glass lens inside the gold rim
    const lensMesh = new THREE.Mesh(new THREE.CircleGeometry(0.108, 28), lensMat);
    lensMesh.position.set(-0.16, 0.12, 0.487);
    lensMesh.rotation.y = -0.18;
    monocleGroup.add(lensMesh);

    // Delicate gold chain draping from the monocle tab down along his cheek toward his lapel
    for (let c = 0; c < 14; c++) {
        const t = c / 13;
        const link = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), goldMat);
        const cx = -0.28 - Math.sin(t * Math.PI * 0.7) * 0.06 + t * 0.08;
        const cy = 0.09 - t * 0.52 - Math.sin(t * Math.PI) * 0.06;
        const cz = 0.45 - t * 0.12;
        link.position.set(cx, cy, cz);
        monocleGroup.add(link);
    }

    // ------------------------------------------------------------------
    // 4. Tall Glossy Black Stovepipe Top Hat
    // ------------------------------------------------------------------
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.34, 0.0);
    hatGroup.rotation.x = -0.05;
    hatGroup.rotation.z = -0.04;
    headGroup.add(hatGroup);

    // Curved dapper top-hat brim
    const brimProfile = [
        new THREE.Vector2(0.36, 0.0),
        new THREE.Vector2(0.56, -0.01),
        new THREE.Vector2(0.68, 0.03),
        new THREE.Vector2(0.70, 0.06),
        new THREE.Vector2(0.64, 0.07),
        new THREE.Vector2(0.36, 0.03)
    ];
    const brimGeo = new THREE.LatheGeometry(brimProfile, 44);
    brimGeo.scale(1.02, 1.0, 1.05);
    brimGeo.computeVertexNormals();
    hatGroup.add(new THREE.Mesh(brimGeo, lapelBlack));

    // Tall stovepipe crown (flares slightly toward the flat top)
    const crownGeo = new THREE.CylinderGeometry(0.43, 0.38, 0.62, 40);
    const crown = new THREE.Mesh(crownGeo, lapelBlack);
    crown.position.y = 0.32;
    hatGroup.add(crown);

    // Satin hatband ribbon at base of crown
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.392, 0.385, 0.10, 40, 1, true), hatBandMat);
    band.position.y = 0.07;
    hatGroup.add(band);

    // ------------------------------------------------------------------
    // 5. Tuxedo Arms + White Gloves + Golden Walking Cane (`leftArm`)
    // ------------------------------------------------------------------
    function buildArm(side, withCane) {
        const pivot = new THREE.Group();

        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), tuxBlack);
        pivot.add(shoulder);

        const upperGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.46, 20);
        upperGeo.translate(0, -0.23, 0);
        pivot.add(new THREE.Mesh(upperGeo, tuxBlack));

        const elbow = new THREE.Group();
        elbow.position.y = -0.44;
        elbow.rotation.x = withCane ? -0.55 : -0.38;
        elbow.rotation.z = -side * 0.12;
        pivot.add(elbow);

        elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 12), tuxBlack));

        const foreGeo = new THREE.CylinderGeometry(0.128, 0.115, 0.34, 20);
        foreGeo.translate(0, -0.17, 0);
        elbow.add(new THREE.Mesh(foreGeo, tuxBlack));

        // White French shirt cuff
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.124, 0.07, 20), shirtWhite);
        cuff.position.y = -0.35;
        elbow.add(cuff);

        // White-gloved gentleman hand
        const handGroup = new THREE.Group();
        handGroup.position.y = -0.44;
        elbow.add(handGroup);

        const palmGeo = new THREE.SphereGeometry(0.125, 18, 14);
        palmGeo.scale(1.0, 1.1, 0.75);
        handGroup.add(new THREE.Mesh(palmGeo, shirtWhite));

        for (let i = 0; i < 4; i++) {
            const fGeo = new THREE.SphereGeometry(0.038, 10, 8);
            fGeo.scale(0.95, 1.9, 0.9);
            const finger = new THREE.Mesh(fGeo, shirtWhite);
            const spread = (i - 1.5) * 0.045;
            finger.position.set(spread, -0.105, 0.015);
            finger.rotation.z = spread * 1.3;
            finger.rotation.x = withCane ? 0.65 : 0.18;
            handGroup.add(finger);
        }
        const thumbGeo = new THREE.SphereGeometry(0.042, 10, 8);
        thumbGeo.scale(0.95, 1.6, 0.9);
        const thumb = new THREE.Mesh(thumbGeo, shirtWhite);
        thumb.position.set(-side * 0.11, -0.02, 0.04);
        thumb.rotation.z = -side * 0.65;
        thumb.rotation.x = 0.25;
        handGroup.add(thumb);

        // Golden-Topped Walking Cane in his left hand!
        if (withCane) {
            const caneGroup = new THREE.Group();
            caneGroup.position.set(-0.02, -0.06, 0.06);
            caneGroup.rotation.x = 0.52;
            caneGroup.rotation.z = -0.18;
            handGroup.add(caneGroup);

            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 1.15, 14), shoeBlack);
            shaft.position.y = -0.48;
            caneGroup.add(shaft);

            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 14), goldMat);
            knob.position.y = 0.10;
            caneGroup.add(knob);

            const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.025, 0.05, 14), goldMat);
            ferrule.position.y = 0.04;
            caneGroup.add(ferrule);

            const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.018, 0.06, 12), goldMat);
            tip.position.y = -1.04;
            caneGroup.add(tip);
        }

        return { pivot, elbow, handGroup };
    }

    const L = buildArm(-1, true), R = buildArm(1, false);
    const leftArm = L.pivot, rightArm = R.pivot;
    leftArm.position.set(-0.54, 0.48, 0.02);
    rightArm.position.set(0.54, 0.48, 0.02);
    monopolyGroup.add(leftArm, rightArm);

    // ------------------------------------------------------------------
    // 6. Charcoal Trousers + White Spats + Polished Black Dress Shoes
    // ------------------------------------------------------------------
    [-1, 1].forEach(side => {
        const leg = new THREE.Group();
        leg.position.set(side * 0.23, -0.62, 0.02);
        monopolyGroup.add(leg);

        const pantGeo = new THREE.CylinderGeometry(0.19, 0.16, 0.68, 22);
        pantGeo.translate(0, -0.34, 0);
        leg.add(new THREE.Mesh(pantGeo, pantsGray));

        // White ankle spat cover over the shoe instep
        const spatGeo = new THREE.ConeGeometry(0.165, 0.20, 20, 1, true);
        spatGeo.scale(0.95, 1.0, 1.25);
        const spat = new THREE.Mesh(spatGeo, shirtWhite);
        spat.position.set(0, -0.68, 0.04);
        leg.add(spat);

        // Polished black dress shoe
        const shoe = new THREE.Group();
        shoe.position.set(0, -0.78, 0.10);
        shoe.rotation.y = side * 0.22;
        leg.add(shoe);

        const shoeGeo = new THREE.SphereGeometry(0.16, 22, 16);
        shoeGeo.scale(0.92, 0.58, 1.55);
        shoe.add(new THREE.Mesh(shoeGeo, shoeBlack));
    });

    monopolyGroup.scale.setScalar(0.88);
    monopolyGroup.position.y = -0.24;

    // ------------------------------------------------------------------
    // 6b. Era Props: Classic / Golden "$" Moneybag in Right Hand (`R.handGroup`)
    // ------------------------------------------------------------------
    const moneyBagGroup = new THREE.Group();
    moneyBagGroup.position.set(0.02, -0.24, 0.08);
    moneyBagGroup.rotation.x = 0.22;
    moneyBagGroup.rotation.z = -0.15;
    moneyBagGroup.visible = false;
    R.handGroup.add(moneyBagGroup);

    const bagCanvas = document.createElement("canvas");
    bagCanvas.width = 256;
    bagCanvas.height = 256;
    const bagCtx = bagCanvas.getContext("2d");
    function paintMoneyBagTexture(bgHex, symbolHex) {
        bagCtx.fillStyle = bgHex;
        bagCtx.fillRect(0, 0, 256, 256);
        bagCtx.fillStyle = symbolHex;
        bagCtx.font = "900 130px serif";
        bagCtx.textAlign = "center";
        bagCtx.textBaseline = "middle";
        bagCtx.fillText("$", 128, 138);
    }
    paintMoneyBagTexture("#d6c3a5", "#2e4a21");
    const bagTex = new THREE.CanvasTexture(bagCanvas);
    const bagMat = new THREE.MeshStandardMaterial({
        map: bagTex,
        roughness: 0.65,
        metalness: 0.1
    });
    const bagPlainMat = std(0xd6c3a5, 0.65, 0.1);
    const bagTieMat = std(0x854d0e, 0.5, 0.2);

    // Plump sack body
    const sackGeo = new THREE.SphereGeometry(0.20, 28, 22);
    sackGeo.scale(1.0, 1.15, 0.88);
    sackGeo.rotateY(-Math.PI / 2);
    const sackMesh = new THREE.Mesh(sackGeo, bagMat);
    moneyBagGroup.add(sackMesh);

    // Cinch rope around top of moneybag
    const cinch = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.020, 10, 22), bagTieMat);
    cinch.rotation.x = Math.PI / 2;
    cinch.position.y = 0.20;
    moneyBagGroup.add(cinch);

    // Flared ruffled sack crown above the cinch
    const ruffleGeo = new THREE.ConeGeometry(0.12, 0.11, 18, 1, true);
    ruffleGeo.rotateX(Math.PI);
    const ruffle = new THREE.Mesh(ruffleGeo, bagPlainMat);
    ruffle.material.side = THREE.DoubleSide;
    ruffle.position.y = 0.25;
    moneyBagGroup.add(ruffle);

    // ------------------------------------------------------------------
    // 7. Unified Mascot API + Mandela Monocle Control + Era Mode Switcher
    // ------------------------------------------------------------------
    let currentEra = "1980";

    function setMonocle(enabled) {
        monocleGroup.visible = !!enabled;
        return monocleGroup.visible;
    }

    function toggleMonocle() {
        monocleGroup.visible = !monocleGroup.visible;
        return monocleGroup.visible;
    }

    function setFurColor(baseHex, tipHex) {}

    function setEraMode(mode) {
        currentEra = mode || "1980";
        if (currentEra === "1971") {
            // 1936 Mandela Vintage Era: Sepia newsprint tones, Mandela Monocle ON, Burlap $ Moneybag!
            setMonocle(true);
            if (typeof window.syncMonocleButtonUI === "function") window.syncMonocleButtonUI(true);
            moneyBagGroup.visible = true;
            paintMoneyBagTexture("#d6c3a5", "#1f3a1d");
            bagTex.needsUpdate = true;
            bagMat.roughness = 0.72;
            bagMat.metalness = 0.05;
            bagPlainMat.color.setHex(0xd6c3a5);

            tuxBlack.color.setHex(0x3a2e25);
            lapelBlack.color.setHex(0x4a3b30);
            lapelBlack.metalness = 0.12;
            lapelBlack.roughness = 0.45;
            hatBandMat.color.setHex(0x6b5344);
            shirtWhite.color.setHex(0xf3e8d2);
            hairWhite.color.setHex(0xefe6d5);
            bowTieRed.color.setHex(0x8c3328);
            pantsGray.color.setHex(0x57483c);
            skinPeach.color.setHex(0xe3c5a8);
            cheekRosy.color.setHex(0xd4a383);
            goldMat.color.setHex(0xd4af37);
            lensMat.color.setHex(0xfef08a);
            lensMat.opacity = 0.45;
        } else if (currentEra === "2026") {
            // 2026 Golden Edition Overdrive: 24K Gold Top Hat & Lapels, Emerald Bow Tie & Hatband, Golden Moneybag!
            setMonocle(true);
            if (typeof window.syncMonocleButtonUI === "function") window.syncMonocleButtonUI(true);
            moneyBagGroup.visible = true;
            paintMoneyBagTexture("#fbbf24", "#047857");
            bagTex.needsUpdate = true;
            bagMat.roughness = 0.25;
            bagMat.metalness = 0.75;
            bagPlainMat.color.setHex(0xfbbf24);

            tuxBlack.color.setHex(0x181a22);
            lapelBlack.color.setHex(0xffd700);
            lapelBlack.metalness = 0.82;
            lapelBlack.roughness = 0.22;
            hatBandMat.color.setHex(0x10b981);
            shirtWhite.color.setHex(0xf8fafc);
            hairWhite.color.setHex(0xfafaf9);
            bowTieRed.color.setHex(0x10b981);
            pantsGray.color.setHex(0x334155);
            skinPeach.color.setHex(0xf4c29f);
            cheekRosy.color.setHex(0xeb9b78);
            goldMat.color.setHex(0xffd700);
            lensMat.color.setHex(0x34d399);
            lensMat.opacity = 0.58;
        } else {
            // 1980s Canonical Tycoon (Exact Original Default)
            setMonocle(false);
            if (typeof window.syncMonocleButtonUI === "function") window.syncMonocleButtonUI(false);
            moneyBagGroup.visible = false;

            tuxBlack.color.setHex(0x181a22);
            lapelBlack.color.setHex(0x232631);
            lapelBlack.metalness = 0.12;
            lapelBlack.roughness = 0.35;
            hatBandMat.color.setHex(0x3b3f4c);
            shirtWhite.color.setHex(0xf8fafc);
            hairWhite.color.setHex(0xfafaf9);
            bowTieRed.color.setHex(0xdc2626);
            pantsGray.color.setHex(0x334155);
            skinPeach.color.setHex(0xf4c29f);
            cheekRosy.color.setHex(0xeb9b78);
            goldMat.color.setHex(0xfacc15);
            lensMat.color.setHex(0xbae6fd);
            lensMat.opacity = 0.42;
        }
    }

    function lookAt(mx, my) {
        [leftEyeRig, rightEyeRig].forEach(rig => {
            const b = rig.look.userData.base;
            rig.look.position.x = b.x + mx * 0.025;
            rig.look.position.y = b.y + my * 0.025;
        });
        headGroup.rotation.y = mx * 0.25;
        headGroup.rotation.x = -my * 0.12;
    }

    function update(elapsed) {
        const speedMult = currentEra === "2026" ? 2.0 : 1.0;
        // Jovial tycoon head bob + mustache wiggle
        headGroup.position.y = 1.24 + Math.abs(Math.sin(elapsed * 2.2 * speedMult)) * 0.022;
        headGroup.rotation.z = Math.sin(elapsed * 1.1 * speedMult) * 0.045;
        mustacheGroup.rotation.z = Math.sin(elapsed * 3.2 * speedMult) * 0.025;

        if (moneyBagGroup.visible) {
            moneyBagGroup.rotation.y = Math.sin(elapsed * 2.5 * speedMult) * 0.25;
        }

        // Blink
        const t = elapsed % 4.3;
        const blink = t > 4.1 ? Math.sin(((t - 4.1) / 0.2) * Math.PI) : 0;
        leftEyeRig.lid.rotation.x = rightEyeRig.lid.rotation.x = -1.15 + blink * 1.2;
    }

    return {
        root: monopolyGroup,
        baseY: -0.24,
        parts: {
            head: headGroup,
            body: bodyGroup,
            leftArm,
            rightArm,
            armRest: 0.38,
            waveLift: 2.35,
            monocleGroup,
            setMonocle,
            toggleMonocle,
            extraArmsGroup: null,
            upperLeftArm: null,
            upperRightArm: null,
            setFurColor,
            setEraMode,
            lookAt,
            update
        },
        setMonocle,
        toggleMonocle,
        setFurColor,
        lookAt,
        update
    };
};
