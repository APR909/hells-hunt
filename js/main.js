import * as THREE from "./vendor/three.module.min.js";
import { buildCorridor, setupLighting } from "./corridor.js";
import { buildGun } from "./gun3d.js";
import { playShot, playHit, playEmptyClick, playEscape, playRoundStart, playGameOver } from "./sound.js";

const AMMO_PER_ROUND = 3;
const MAX_MISSES = 3;
const SPRITE_SCALE = 2.1;
const ESCAPE_Z = 1.5;

const canvasWrap = document.getElementById("sceneWrap");
const canvas = document.getElementById("scene");

const titleScreenEl = document.getElementById("titleScreen");
const gameOverScreenEl = document.getElementById("gameOverScreen");
const gameStageEl = document.getElementById("gameStage");
const scoreValueEl = document.getElementById("scoreValue");
const roundValueEl = document.getElementById("roundValue");
const ammoDotsEl = document.getElementById("ammoDots");
const missDotsEl = document.getElementById("missDots");
const missFlashEl = document.getElementById("missFlash");
const roundFlashEl = document.getElementById("roundFlash");
const finalScoreTextEl = document.getElementById("finalScoreText");
const titleDemonImg = document.getElementById("titleDemonImg");
const faceImgEl = document.getElementById("faceImg");
const crosshairEl = document.getElementById("crosshair");

// ---------- three.js setup ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 100);
camera.position.set(0, 0, 2);

const corridor = buildCorridor(scene);
setupLighting(scene);

const gunScene = new THREE.Scene();
const gunCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 10);
const { gun, flash, flashLight, restY, restZ } = buildGun();
gunScene.add(gun);
const gunKeyLight = new THREE.DirectionalLight(0xffb070, 3.2);
gunKeyLight.position.set(-1, 1.5, 1.5);
gunScene.add(gunKeyLight);
const gunFillLight = new THREE.DirectionalLight(0xff6a30, 1.4);
gunFillLight.position.set(1, -0.5, 1);
gunScene.add(gunFillLight);
gunScene.add(new THREE.AmbientLight(0x603520, 2.2));

function resize() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  gunCamera.aspect = w / h;
  gunCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ---------- sprite textures ----------
const texLoader = new THREE.TextureLoader();
function loadPixelTexture(path) {
  const tex = texLoader.load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const demonTex = {
  fly1: loadPixelTexture("assets/demon-fly1.png"),
  fly2: loadPixelTexture("assets/demon-fly2.png"),
  hit: loadPixelTexture("assets/demon-hit.png"),
};

// ---------- title screen wing-flap ----------
let titleFlap = false;
const titleFlapTimer = setInterval(() => {
  titleFlap = !titleFlap;
  titleDemonImg.src = titleFlap ? "assets/demon-fly2.png" : "assets/demon-fly1.png";
}, 220);

// ---------- game state ----------
let score = 0;
let round = 1;
let ammo = AMMO_PER_ROUND;
let misses = 0;
let demons = [];
let roundState = "idle";
let gameActive = false;

function demonCountForRound(r) {
  if (r <= 2) return 1;
  if (r <= 5) return 2;
  return 3;
}

function spawnDemon(delay = 0) {
  const speed = 11 + round * 1.1 + Math.random() * 2.2;
  const baseX = -4 + Math.random() * 8;
  const baseY = -1.8 + Math.random() * 3.2;

  const material = new THREE.SpriteMaterial({ map: demonTex.fly1, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(SPRITE_SCALE, SPRITE_SCALE, 1);
  sprite.position.set(baseX, baseY, -42 - Math.random() * 6);
  scene.add(sprite);

  demons.push({
    sprite,
    baseX,
    baseY,
    vz: speed,
    wobbleAmp: 0.6 + Math.random() * 0.7,
    wobbleFreq: 1.1 + Math.random() * 1.1,
    wobblePhase: Math.random() * Math.PI * 2,
    t: -delay,
    wingPhase: 0,
    state: "flying",
    hitAt: 0,
  });
}

function clearDemons() {
  demons.forEach((d) => scene.remove(d.sprite));
  demons = [];
}

function startRound() {
  ammo = AMMO_PER_ROUND;
  clearDemons();
  roundState = "spawning";
  roundValueEl.textContent = round;
  const count = demonCountForRound(round);
  for (let i = 0; i < count; i++) spawnDemon(i * 0.6);
  playRoundStart();
  flashRound(`RONDA ${round}`);
  updateHud();
}

function flashRound(text) {
  roundFlashEl.textContent = text;
  roundFlashEl.classList.add("show");
  setTimeout(() => roundFlashEl.classList.remove("show"), 900);
}
function flashMiss() {
  missFlashEl.classList.add("show");
  setTimeout(() => missFlashEl.classList.remove("show"), 700);
}

function updateHud() {
  scoreValueEl.textContent = score;
  ammoDotsEl.innerHTML = Array.from({ length: AMMO_PER_ROUND })
    .map((_, i) => `<span class="${i < ammo ? "" : "spent"}"></span>`)
    .join("");
  missDotsEl.innerHTML = Array.from({ length: MAX_MISSES })
    .map((_, i) => `<span class="${i < misses ? "hit" : ""}"></span>`)
    .join("");
}

// ---------- face reactions ----------
let faceLockUntil = 0;
function setFace(name, holdMs) {
  const src = `assets/face-${name}.png`;
  if (faceImgEl.getAttribute("src") !== src) faceImgEl.src = src;
  faceLockUntil = holdMs ? performance.now() + holdMs : 0;
}

// ---------- gun firing animation ----------
let gunFireUntil = 0;
function triggerGunFire() {
  gunFireUntil = performance.now() + 130;
  flash.scale.set(1, 1, 1);
  flashLight.intensity = 4;
}

// ---------- crosshair + raycasting ----------
let mouseNDC = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  mouseNDC.x = (mx / rect.width) * 2 - 1;
  mouseNDC.y = -(my / rect.height) * 2 + 1;
  crosshairEl.style.left = `${mx}px`;
  crosshairEl.style.top = `${my}px`;
});

canvas.addEventListener("click", () => {
  if (!gameActive || (roundState !== "spawning" && roundState !== "active")) return;
  if (ammo <= 0) {
    playEmptyClick();
    return;
  }

  ammo--;
  playShot();
  triggerGunFire();
  updateHud();

  raycaster.setFromCamera(mouseNDC, camera);
  const flyingSprites = demons.filter((d) => d.state === "flying").map((d) => d.sprite);
  const hits = raycaster.intersectObjects(flyingSprites);

  let hit = false;
  if (hits.length > 0) {
    const target = demons.find((d) => d.sprite === hits[0].object);
    if (target) {
      target.state = "hit";
      target.hitAt = performance.now();
      target.sprite.material.map = demonTex.hit;
      score += 10 + round * 2;
      playHit();
      hit = true;
    }
  }
  setFace(hit ? "happy" : "hurt", 500);
  updateHud();
});

function allResolved() {
  return demons.every((d) => d.state === "gone");
}

function endRoundCheck() {
  if (!allResolved()) return;
  roundState = "resolving";

  const anyEscaped = demons.some((d) => d.escaped);
  if (anyEscaped) {
    misses++;
    flashMiss();
    playEscape();
    setFace("hurt", 900);
    updateHud();
    if (misses >= MAX_MISSES) {
      setTimeout(gameOver, 500);
      return;
    }
  }
  setTimeout(() => {
    round++;
    startRound();
  }, 1000);
}

function gameOver() {
  gameActive = false;
  playGameOver();
  setFace("dead");
  finalScoreTextEl.textContent = `Puntuación final: ${score} · ronda ${round}`;
  gameOverScreenEl.classList.remove("hidden");
}

function resetGame() {
  score = 0;
  round = 1;
  misses = 0;
  clearDemons();
  gameOverScreenEl.classList.add("hidden");
  gameActive = true;
  setFace("idle");
  startRound();
}

document.getElementById("btnStart").addEventListener("click", () => {
  clearInterval(titleFlapTimer);
  titleScreenEl.classList.add("hidden");
  gameStageEl.classList.remove("hidden");
  resize();
  resetGame();
});
document.getElementById("btnRetry").addEventListener("click", resetGame);

// ---------- render loop ----------
let lastTime = performance.now();
let elapsed = 0;

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 20);
  lastTime = now;
  elapsed += dt;

  corridor.update(dt, elapsed);

  if (gameActive) {
    demons.forEach((d) => {
      if (d.state === "gone") return;
      d.t += dt;
      if (d.t < 0) return;

      if (d.state === "flying") {
        d.sprite.position.z += d.vz * dt;
        d.sprite.position.x = d.baseX + Math.sin(d.t * d.wobbleFreq + d.wobblePhase) * d.wobbleAmp;
        d.sprite.position.y = d.baseY + Math.cos(d.t * d.wobbleFreq * 0.8 + d.wobblePhase) * d.wobbleAmp * 0.5;
        d.wingPhase += dt * 11;
        d.sprite.material.map = Math.floor(d.wingPhase) % 2 === 0 ? demonTex.fly1 : demonTex.fly2;
        if (d.sprite.position.z > ESCAPE_Z) {
          d.state = "gone";
          d.escaped = true;
          scene.remove(d.sprite);
        }
      } else if (d.state === "hit") {
        d.sprite.position.y -= 3.2 * dt;
        d.sprite.material.rotation += dt * 6;
        const age = performance.now() - d.hitAt;
        d.sprite.material.opacity = Math.max(0, 1 - age / 500);
        if (age > 500) {
          d.state = "gone";
          scene.remove(d.sprite);
        }
      }
    });

    if (roundState === "spawning" || roundState === "active") {
      roundState = "active";
      endRoundCheck();
    }

    if (performance.now() >= faceLockUntil) {
      setFace(ammo > 0 ? "aim" : "idle");
    }
  }

  // gun recoil + flash decay
  const firing = performance.now() < gunFireUntil;
  gun.position.y = restY + (firing ? -0.06 : 0);
  gun.position.z = restZ + (firing ? 0.08 : 0);
  if (!firing && flash.scale.x > 0.001) {
    flash.scale.multiplyScalar(0.7);
    flashLight.intensity *= 0.7;
  }

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(gunScene, gunCamera);

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
