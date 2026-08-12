import * as THREE from "./vendor/three.module.min.js";

const SKIN = 0xc89c72;
const SKIN_DARK = 0xa87c58;
const SLEEVE = 0x44412a;
const WOOD = 0x60381e;
const WOOD_LIGHT = 0x7a4a28;
const METAL = 0x7a7c82;
const METAL_DARK = 0x3c3e44;

// flatShading turns every face into a distinct flat-colored facet instead of
// smoothly blending normals — this is what makes low-poly geometry actually
// read as "pixel art" rather than a smooth blob once lit.
function box(w, h, d, color, roughness = 0.7) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness, flatShading: true,
    metalness: color === METAL || color === METAL_DARK ? 0.6 : 0.05,
  });
  return new THREE.Mesh(geo, mat);
}

// A voxel-style finger: a short stack of blocks instead of a smooth capsule.
function voxelFinger(w, segH, segCount, color, shadeColor) {
  const group = new THREE.Group();
  for (let i = 0; i < segCount; i++) {
    const seg = box(w, segH, w, i % 2 === 0 ? color : shadeColor, 0.75);
    seg.position.y = i * segH;
    group.add(seg);
  }
  return group;
}

// A voxel-style hand: a blocky palm plus a row of blocky finger-stacks —
// same silhouette idea as the 2D pixel sprites, built out of cubes instead
// of smooth spheres.
function voxelHand(color, shadeColor) {
  const hand = new THREE.Group();
  const palm = box(0.24, 0.16, 0.22, color, 0.75);
  hand.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = voxelFinger(0.045, 0.045, 2, color, shadeColor);
    finger.position.set(-0.09 + i * 0.06, 0.08, 0.08);
    hand.add(finger);
  }
  const thumb = voxelFinger(0.05, 0.045, 2, color, shadeColor);
  thumb.rotation.z = Math.PI / 2.4;
  thumb.position.set(-0.15, 0.02, -0.02);
  hand.add(thumb);
  return hand;
}

// Axis convention for this whole model: -Z = forward / away from the camera
// (down the corridor), +Y = up, +X = to the player's right.
export function buildGun() {
  const gun = new THREE.Group();

  // --- barrel: long along -Z (forward), with a slight upward tilt ---
  const barrelGroup = new THREE.Group();
  const barrel = box(0.1, 0.1, 1.75, METAL, 0.35);
  barrel.position.set(0, 0, -0.85);
  barrelGroup.add(barrel);
  const barrelTopHighlight = box(0.1, 0.03, 1.75, METAL, 0.2);
  barrelTopHighlight.position.set(0, 0.05, -0.85);
  barrelGroup.add(barrelTopHighlight);
  // pixel-block sight nub on top of the barrel
  const sight = box(0.04, 0.05, 0.04, METAL_DARK, 0.3);
  sight.position.set(0, 0.08, -1.55);
  barrelGroup.add(sight);
  barrelGroup.rotation.x = 0.16;
  gun.add(barrelGroup);

  // --- pump foregrip: wraps the front half of the barrel, ridged in blocks ---
  const pump = box(0.26, 0.24, 0.5, WOOD, 0.65);
  pump.position.set(0, -0.06, -0.62);
  pump.rotation.x = 0.16;
  gun.add(pump);
  const pumpHighlight = box(0.06, 0.25, 0.5, WOOD_LIGHT, 0.6);
  pumpHighlight.position.set(-0.11, -0.06, -0.62);
  pumpHighlight.rotation.x = 0.16;
  gun.add(pumpHighlight);
  for (let i = 0; i < 4; i++) {
    const ridge = box(0.27, 0.03, 0.05, WOOD_LIGHT, 0.55);
    ridge.position.set(0, -0.06, -0.42 - i * 0.08);
    ridge.rotation.x = 0.16;
    gun.add(ridge);
  }

  // --- receiver: sits where barrel meets stock ---
  const receiver = box(0.28, 0.3, 0.34, METAL_DARK, 0.5);
  receiver.position.set(0, -0.08, 0.02);
  gun.add(receiver);
  const ejectionPort = box(0.29, 0.1, 0.14, 0x18181a, 0.4);
  ejectionPort.position.set(0, 0.02, -0.02);
  gun.add(ejectionPort);
  const rivet1 = box(0.03, 0.03, 0.03, METAL, 0.3);
  rivet1.position.set(0.15, -0.14, 0.1);
  gun.add(rivet1);
  const rivet2 = box(0.03, 0.03, 0.03, METAL, 0.3);
  rivet2.position.set(0.15, -0.02, 0.1);
  gun.add(rivet2);

  // --- stock: extends back (+Z, toward the viewer/shoulder) and down ---
  const stock = box(0.22, 0.26, 1.15, WOOD, 0.65);
  stock.position.set(0.02, -0.28, 0.72);
  stock.rotation.x = 0.3;
  gun.add(stock);
  const stockTop = box(0.06, 0.26, 1.15, WOOD_LIGHT, 0.6);
  stockTop.position.set(-0.09, -0.28, 0.72);
  stockTop.rotation.x = 0.3;
  gun.add(stockTop);
  const buttplate = box(0.24, 0.28, 0.06, METAL_DARK, 0.4);
  buttplate.position.set(0.02, -0.51, 1.24);
  buttplate.rotation.x = 0.3;
  gun.add(buttplate);

  // --- muzzle flash, at the far tip of the barrel ---
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.95 });
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 6), flashMat);
  flash.position.set(0, 0.32, -1.75);
  flash.rotation.x = -Math.PI / 2 + 0.16;
  flash.scale.set(0.001, 0.001, 0.001);
  gun.add(flash);
  const flashLight = new THREE.PointLight(0xffaa44, 0, 6, 2);
  flashLight.position.set(0, 0.32, -1.75);
  gun.add(flashLight);

  // --- left hand: wraps the pump foregrip ---
  const leftHand = voxelHand(SKIN, SKIN_DARK);
  const leftCuff = box(0.24, 0.22, 0.26, SLEEVE, 0.8);
  leftCuff.position.set(-0.24, -0.04, 0.14);
  leftHand.add(leftCuff);
  leftHand.position.set(-0.02, -0.1, -0.58);
  leftHand.rotation.x = 0.16;
  gun.add(leftHand);

  // --- right hand: grips near the trigger, behind the receiver ---
  const rightHand = voxelHand(SKIN, SKIN_DARK);
  const rightCuff = box(0.22, 0.24, 0.22, SLEEVE, 0.8);
  rightCuff.position.set(0.16, -0.2, 0.28);
  rightHand.add(rightCuff);
  rightHand.position.set(0.03, -0.28, 0.24);
  rightHand.rotation.x = -0.3;
  gun.add(rightHand);

  gun.position.set(0, -1.05, -2.9);
  gun.rotation.y = 0;
  gun.rotation.x = 0.02;
  gun.scale.setScalar(0.95);

  return {
    gun, flash, flashLight,
    restX: gun.position.x, restY: gun.position.y, restZ: gun.position.z,
    restRotX: gun.rotation.x, restRotY: gun.rotation.y,
  };
}
