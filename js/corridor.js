import * as THREE from "./vendor/three.module.min.js";

const CORRIDOR_LENGTH = 60;
const CORRIDOR_W = 14;
const CORRIDOR_H = 10;
const RING_COUNT = 10;
const RING_SPACING = CORRIDOR_LENGTH / RING_COUNT;
const SCROLL_SPEED = 6.5;

const DOOR_H = CORRIDOR_H - 0.6;

const texLoader = new THREE.TextureLoader();
function tileTexture(path, repeatX, repeatY) {
  const tex = texLoader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCorridor(scene) {
  const group = new THREE.Group();

  const wallTex = tileTexture("assets/textures/wall.png", 5, 2.2);
  const wallTexSide = tileTexture("assets/textures/wall.png", 8, 2.2);
  const floorTex = tileTexture("assets/textures/floor.png", 4, 16);
  const hazardTex = tileTexture("assets/textures/hazard.png", 8, 1);
  const skullTex = texLoader.load("assets/textures/skull.png");
  skullTex.colorSpace = THREE.SRGBColorSpace;

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
  const wallMatSide = new THREE.MeshStandardMaterial({ map: wallTexSide, roughness: 0.85 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.8 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.6, metalness: 0.4 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8a7358, roughness: 0.55, metalness: 0.35, emissive: 0x1a0e06, emissiveIntensity: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5a1010, roughness: 0.6 });

  const stripMatL = new THREE.MeshStandardMaterial({
    color: 0x3a0a05, emissive: 0xff3a10, emissiveIntensity: 1.4, roughness: 0.4,
  });
  const stripMatR = stripMatL.clone();

  // floor + ceiling
  const floorGeo = new THREE.PlaneGeometry(CORRIDOR_W, CORRIDOR_LENGTH);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -CORRIDOR_H / 2, -CORRIDOR_LENGTH / 2 + 5);
  group.add(floor);

  const ceiling = new THREE.Mesh(floorGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CORRIDOR_H / 2, -CORRIDOR_LENGTH / 2 + 5);
  group.add(ceiling);

  // red ceiling trim strip, like the reference image's banner
  const trim = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_W, 0.5), trimMat);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(0, CORRIDOR_H / 2 - 0.01, -CORRIDOR_LENGTH / 2 + 5);
  group.add(trim);

  // side walls, textured tech-panels
  const wallGeo = new THREE.PlaneGeometry(CORRIDOR_LENGTH, CORRIDOR_H);
  const leftWall = new THREE.Mesh(wallGeo, wallMatSide);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-CORRIDOR_W / 2, 0, -CORRIDOR_LENGTH / 2 + 5);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, wallMatSide);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(CORRIDOR_W / 2, 0, -CORRIDOR_LENGTH / 2 + 5);
  group.add(rightWall);

  // hazard stripe skirting along the base of both walls
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_LENGTH, 0.5), new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 }));
    strip.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    strip.position.set(side * (CORRIDOR_W / 2 - 0.02), -CORRIDOR_H / 2 + 0.3, -CORRIDOR_LENGTH / 2 + 5);
    group.add(strip);
  });

  // scrolling structural rings — beams framing an archway, a door panel that
  // rises open as it nears the camera, a skull lintel, and emergency strips
  const rings = [];
  const beamThickness = 0.5;

  for (let i = 0; i < RING_COUNT; i++) {
    const ring = new THREE.Group();

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_W, beamThickness, beamThickness), beamMat);
    topBeam.position.y = CORRIDOR_H / 2 - beamThickness / 2;
    ring.add(topBeam);

    const bottomBeam = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_W, beamThickness, beamThickness), beamMat);
    bottomBeam.position.y = -CORRIDOR_H / 2 + beamThickness / 2;
    ring.add(bottomBeam);

    const leftBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThickness, CORRIDOR_H, beamThickness), beamMat);
    leftBeam.position.x = -CORRIDOR_W / 2 + beamThickness / 2;
    ring.add(leftBeam);

    const rightBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThickness, CORRIDOR_H, beamThickness), beamMat);
    rightBeam.position.x = CORRIDOR_W / 2 - beamThickness / 2;
    ring.add(rightBeam);

    // door panel — fills the archway, slides up into the lintel to "open"
    const door = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_W - beamThickness * 2, DOOR_H, 0.3), doorMat);
    door.position.set(0, -CORRIDOR_H / 2 + beamThickness + DOOR_H / 2, 0);
    ring.add(door);

    // skull lintel decoration above the archway (three, like the reference)
    const skullMat = new THREE.MeshStandardMaterial({ map: skullTex, transparent: true, roughness: 0.7, emissive: 0x3a2410, emissiveIntensity: 0.3 });
    [-1, 0, 1].forEach((sx) => {
      const skull = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.9), skullMat);
      skull.position.set(sx * 3, CORRIDOR_H / 2 - 1.3, 0.28);
      ring.add(skull);
    });

    // emergency light strips on the two side beams
    const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.15, CORRIDOR_H * 0.5, 0.15), stripMatL);
    stripL.position.set(-CORRIDOR_W / 2 + beamThickness + 0.1, -0.6, 0);
    ring.add(stripL);
    const stripR = new THREE.Mesh(new THREE.BoxGeometry(0.15, CORRIDOR_H * 0.5, 0.15), stripMatR);
    stripR.position.set(CORRIDOR_W / 2 - beamThickness - 0.1, -0.6, 0);
    ring.add(stripR);

    ring.position.z = -i * RING_SPACING;
    ring.userData.door = door;
    ring.userData.doorOpen = 0;
    group.add(ring);
    rings.push(ring);
  }

  // distant glow at the far end, suggesting an opening into hell
  const glowGeo = new THREE.PlaneGeometry(CORRIDOR_W * 0.8, CORRIDOR_H * 0.8);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.55 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 0, -CORRIDOR_LENGTH + 4);
  group.add(glow);

  scene.add(group);

  // door event state — doors are open by default; every ~30s one ring's
  // door swings shut for a few seconds, then reopens
  let eventPhase = "idle"; // idle | closed | opening
  let eventRingIndex = -1;
  let nextEventAt = 14;
  let eventCloseUntil = 0;

  return {
    group,
    rings,
    glow,
    update(dt, t) {
      if (eventPhase === "idle" && t > nextEventAt) {
        eventRingIndex = Math.floor(Math.random() * RING_COUNT);
        eventPhase = "closed";
        eventCloseUntil = t + 3.5;
      } else if (eventPhase === "closed" && t > eventCloseUntil) {
        eventPhase = "opening";
      }

      rings.forEach((ring, i) => {
        ring.position.z += SCROLL_SPEED * dt;
        if (ring.position.z > 0) ring.position.z -= RING_COUNT * RING_SPACING;

        const isEventRing = i === eventRingIndex && eventPhase !== "idle";
        const target = isEventRing && eventPhase === "closed" ? 0 : 1;
        ring.userData.doorOpen += (target - ring.userData.doorOpen) * Math.min(1, dt * 2.2);
        ring.userData.door.position.y =
          -CORRIDOR_H / 2 + beamThickness + DOOR_H / 2 + ring.userData.doorOpen * DOOR_H;
      });

      if (eventPhase === "opening" && rings[eventRingIndex].userData.doorOpen > 0.97) {
        eventPhase = "idle";
        eventRingIndex = -1;
        nextEventAt = t + 30;
      }

      const pulse = 1.1 + Math.sin(t * 3) * 0.5;
      stripMatL.emissiveIntensity = pulse;
      stripMatR.emissiveIntensity = pulse;
      glow.material.opacity = 0.45 + Math.sin(t * 1.6) * 0.15;
    },
  };
}

export function setupLighting(scene) {
  const ambient = new THREE.AmbientLight(0x4a2418, 3.2);
  scene.add(ambient);

  const key = new THREE.PointLight(0xff8a50, 5, 26, 1.7);
  key.position.set(0, 1.5, -2);
  scene.add(key);

  const rim = new THREE.PointLight(0xff3300, 3, 34, 1.7);
  rim.position.set(0, 0, -18);
  scene.add(rim);

  return { ambient, key, rim };
}
