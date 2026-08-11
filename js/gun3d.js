import * as THREE from "./vendor/three.module.min.js";

const SKIN = 0xc89c72;
const SLEEVE = 0x44412a;
const WOOD = 0x60381e;
const WOOD_LIGHT = 0x7a4a28;
const METAL = 0x7a7c82;
const METAL_DARK = 0x3c3e44;

function box(w, h, d, color, roughness = 0.7) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: color === METAL || color === METAL_DARK ? 0.6 : 0.05 });
  return new THREE.Mesh(geo, mat);
}

function roundedBlob(rx, ry, rz, color) {
  const geo = new THREE.SphereGeometry(1, 10, 8);
  geo.scale(rx, ry, rz);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02 });
  return new THREE.Mesh(geo, mat);
}

// Axis convention for this whole model: -Z = forward / away from the camera
// (down the corridor), +Y = up, +X = to the player's right. The barrel and
// stock both run mostly along Z, NOT Y — a gun pointed at the screen should
// recede into the distance, not stand up like a vertical pole.
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
  barrelGroup.rotation.x = 0.16; // tips the far end of the barrel upward
  gun.add(barrelGroup);

  // --- pump foregrip: wraps the front half of the barrel ---
  const pump = box(0.26, 0.24, 0.5, WOOD, 0.65);
  pump.position.set(0, -0.06, -0.62);
  pump.rotation.x = 0.16;
  gun.add(pump);
  const pumpHighlight = box(0.06, 0.25, 0.5, WOOD_LIGHT, 0.6);
  pumpHighlight.position.set(-0.11, -0.06, -0.62);
  pumpHighlight.rotation.x = 0.16;
  gun.add(pumpHighlight);

  // --- receiver: sits where barrel meets stock ---
  const receiver = box(0.28, 0.3, 0.34, METAL_DARK, 0.5);
  receiver.position.set(0, -0.08, 0.02);
  gun.add(receiver);
  const ejectionPort = box(0.29, 0.1, 0.14, 0x18181a, 0.4);
  ejectionPort.position.set(0, 0.02, -0.02);
  gun.add(ejectionPort);

  // --- stock: extends back (+Z, toward the viewer/shoulder) and down ---
  const stock = box(0.22, 0.26, 1.15, WOOD, 0.65);
  stock.position.set(0.02, -0.28, 0.72);
  stock.rotation.x = 0.3; // angles down toward the shoulder
  gun.add(stock);
  const stockTop = box(0.06, 0.26, 1.15, WOOD_LIGHT, 0.6);
  stockTop.position.set(-0.09, -0.28, 0.72);
  stockTop.rotation.x = 0.3;
  gun.add(stockTop);

  // --- muzzle flash, at the far tip of the barrel ---
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.95 });
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), flashMat);
  flash.position.set(0, 0.32, -1.75);
  flash.rotation.x = -Math.PI / 2 + 0.16;
  flash.scale.set(0.001, 0.001, 0.001);
  gun.add(flash);
  const flashLight = new THREE.PointLight(0xffaa44, 0, 6, 2);
  flashLight.position.set(0, 0.32, -1.75);
  gun.add(flashLight);

  // --- left hand: wraps the pump foregrip ---
  const leftHand = new THREE.Group();
  const leftPalm = roundedBlob(0.17, 0.15, 0.17, SKIN);
  leftHand.add(leftPalm);
  for (let i = 0; i < 4; i++) {
    const finger = roundedBlob(0.045, 0.045, 0.1, SKIN);
    finger.position.set(-0.09 + i * 0.06, 0.13, 0.02);
    leftHand.add(finger);
  }
  const leftCuff = box(0.24, 0.22, 0.26, SLEEVE, 0.8);
  leftCuff.position.set(-0.24, -0.04, 0.14);
  leftHand.add(leftCuff);
  leftHand.position.set(-0.02, -0.08, -0.6);
  leftHand.rotation.x = 0.16;
  gun.add(leftHand);

  // --- right hand: grips near the trigger, behind the receiver ---
  const rightHand = new THREE.Group();
  const rightPalm = roundedBlob(0.16, 0.17, 0.17, SKIN);
  rightHand.add(rightPalm);
  for (let i = 0; i < 4; i++) {
    const finger = roundedBlob(0.045, 0.045, 0.1, SKIN);
    finger.position.set(-0.08 + i * 0.055, 0.15, -0.03);
    rightHand.add(finger);
  }
  const rightCuff = box(0.22, 0.24, 0.22, SLEEVE, 0.8);
  rightCuff.position.set(0.16, -0.22, 0.22);
  rightHand.add(rightCuff);
  rightHand.position.set(0.05, -0.3, 0.22);
  gun.add(rightHand);

  gun.position.set(1.0, -1.05, -2.9);
  gun.rotation.y = -0.22;
  gun.rotation.x = 0.02;
  gun.scale.setScalar(0.95);

  return {
    gun, flash, flashLight,
    restX: gun.position.x, restY: gun.position.y, restZ: gun.position.z,
    restRotX: gun.rotation.x, restRotY: gun.rotation.y,
  };
}
