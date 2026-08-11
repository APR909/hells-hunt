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

export function buildGun() {
  const gun = new THREE.Group();

  // --- barrel ---
  const barrel = box(0.09, 1.5, 0.09, METAL, 0.35);
  barrel.position.set(0, 0.95, 0);
  gun.add(barrel);

  // --- pump foregrip ---
  const pump = box(0.24, 0.42, 0.22, WOOD, 0.65);
  pump.position.set(0, 0.28, 0);
  gun.add(pump);
  const pumpHighlight = box(0.06, 0.4, 0.23, WOOD_LIGHT, 0.6);
  pumpHighlight.position.set(-0.1, 0.28, 0);
  gun.add(pumpHighlight);

  // --- receiver ---
  const receiver = box(0.26, 0.34, 0.32, METAL_DARK, 0.5);
  receiver.position.set(0, -0.05, 0.02);
  gun.add(receiver);

  // --- stock, angled back toward the shoulder (down + toward camera/+Z) ---
  const stock = box(0.2, 0.24, 1.1, WOOD, 0.65);
  stock.position.set(0.03, -0.32, 0.75);
  stock.rotation.x = -0.32;
  gun.add(stock);

  // --- muzzle flash (hidden by default, scaled up briefly when firing) ---
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.95 });
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), flashMat);
  flash.position.set(0, 1.75, 0);
  flash.scale.set(0.001, 0.001, 0.001);
  gun.add(flash);
  const flashLight = new THREE.PointLight(0xffaa44, 0, 6, 2);
  flashLight.position.set(0, 1.7, 0);
  gun.add(flashLight);

  // --- left hand: wraps the pump foregrip ---
  const leftHand = new THREE.Group();
  const leftPalm = roundedBlob(0.17, 0.13, 0.15, SKIN);
  leftHand.add(leftPalm);
  for (let i = 0; i < 4; i++) {
    const finger = roundedBlob(0.045, 0.045, 0.11, SKIN);
    finger.position.set(-0.09 + i * 0.06, 0.1, -0.05);
    leftHand.add(finger);
  }
  const leftCuff = box(0.22, 0.16, 0.22, SLEEVE, 0.8);
  leftCuff.position.set(-0.22, 0.05, 0);
  leftHand.add(leftCuff);
  leftHand.position.set(-0.02, 0.3, 0.02);
  gun.add(leftHand);

  // --- right hand: grips near the trigger ---
  const rightHand = new THREE.Group();
  const rightPalm = roundedBlob(0.16, 0.15, 0.16, SKIN);
  rightHand.add(rightPalm);
  for (let i = 0; i < 4; i++) {
    const finger = roundedBlob(0.045, 0.045, 0.1, SKIN);
    finger.position.set(-0.08 + i * 0.055, -0.02, 0.13);
    rightHand.add(finger);
  }
  const rightCuff = box(0.2, 0.18, 0.24, SLEEVE, 0.8);
  rightCuff.position.set(0.15, -0.18, 0.28);
  rightHand.add(rightCuff);
  rightHand.position.set(0.06, -0.22, 0.28);
  gun.add(rightHand);

  gun.position.set(1.05, -1.35, -3.4);
  gun.rotation.y = -0.18;
  gun.rotation.x = 0.05;
  gun.scale.setScalar(0.85);

  return { gun, flash, flashLight, restY: gun.position.y, restZ: gun.position.z };
}
