import * as THREE from "./vendor/three.module.min.js";

const CORRIDOR_LENGTH = 60;
const CORRIDOR_W = 14;
const CORRIDOR_H = 10;
const RING_COUNT = 10;
const RING_SPACING = CORRIDOR_LENGTH / RING_COUNT;
const SCROLL_SPEED = 6.5; // world units per second

export function buildCorridor(scene) {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a1512, roughness: 0.85, metalness: 0.15 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c0f0c, roughness: 0.9, metalness: 0.1 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.6, metalness: 0.4 });
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x3a0a05,
    emissive: 0xff3a10,
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });

  // floor + ceiling
  const floorGeo = new THREE.PlaneGeometry(CORRIDOR_W, CORRIDOR_LENGTH);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -CORRIDOR_H / 2, -CORRIDOR_LENGTH / 2 + 5);
  group.add(floor);

  const ceiling = new THREE.Mesh(floorGeo, wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CORRIDOR_H / 2, -CORRIDOR_LENGTH / 2 + 5);
  group.add(ceiling);

  // side walls
  const wallGeo = new THREE.PlaneGeometry(CORRIDOR_LENGTH, CORRIDOR_H);
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-CORRIDOR_W / 2, 0, -CORRIDOR_LENGTH / 2 + 5);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(CORRIDOR_W / 2, 0, -CORRIDOR_LENGTH / 2 + 5);
  group.add(rightWall);

  // scrolling structural rings — each is 4 beams forming a rectangle, plus 2 emissive strips
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

    // emergency light strips on the two side beams
    const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.15, CORRIDOR_H * 0.5, 0.15), stripMat);
    stripL.position.set(-CORRIDOR_W / 2 + beamThickness + 0.1, 0, 0);
    ring.add(stripL);
    const stripR = stripL.clone();
    stripR.position.x = CORRIDOR_W / 2 - beamThickness - 0.1;
    ring.add(stripR);

    ring.position.z = -i * RING_SPACING;
    ring.userData.baseIndex = i;
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

  return {
    group,
    rings,
    glow,
    update(dt, t) {
      rings.forEach((ring) => {
        ring.position.z += SCROLL_SPEED * dt;
        if (ring.position.z > 0) ring.position.z -= RING_COUNT * RING_SPACING;
      });
      // pulse the emergency strips and the distant glow
      const pulse = 1.1 + Math.sin(t * 3) * 0.5;
      rings.forEach((ring) => {
        ring.children.forEach((c) => {
          if (c.material === stripMat) c.material.emissiveIntensity = pulse;
        });
      });
      glow.material.opacity = 0.45 + Math.sin(t * 1.6) * 0.15;
    },
  };
}

export function setupLighting(scene) {
  const ambient = new THREE.AmbientLight(0x3a1a12, 1.4);
  scene.add(ambient);

  const key = new THREE.PointLight(0xff6a30, 3.5, 22, 2);
  key.position.set(0, 1.5, -2);
  scene.add(key);

  const rim = new THREE.PointLight(0xff2200, 2.2, 30, 2);
  rim.position.set(0, 0, -18);
  scene.add(rim);

  return { ambient, key, rim };
}
