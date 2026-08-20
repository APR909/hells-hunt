import * as THREE from "./vendor/three.module.min.js";
import { buildCorridor, setupLighting } from "./corridor.js";
import { playShot, playHit, playEmptyClick, playEscape, playRoundStart, playGameOver, startMusic, toggleMusic } from "./sound.js";

const AMMO_PER_ROUND = 5;
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
const gunSpriteEl = document.getElementById("gunSprite");

// ---------- three.js setup ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 100);
camera.position.set(0, 0, 2);

const corridor = buildCorridor(scene);
const lighting = setupLighting(scene, camera);

// ---------- 2D Doom-style weapon sprite ----------
// A flat pixel-art overlay instead of 3D geometry — animated purely with
// CSS transforms (bob, sway, recoil) and a texture swap for the fire frame,
// matching the classic Doom weapon-HUD approach.
let recoilKick = 0;
let aimOffsetX = 0;
let aimOffsetY = 0;

function resize() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
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
  walk1: loadPixelTexture("assets/demon-walk1.png"),
  walk2: loadPixelTexture("assets/demon-walk2.png"),
  walkHit: loadPixelTexture("assets/demon-walk-hit.png"),
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
let maxAmmoThisRound = AMMO_PER_ROUND;
let misses = 0;
let demons = [];
let roundState = "idle";
let gameActive = false;

function demonCountForRound(r) {
  if (r <= 2) return 2;
  if (r <= 4) return 3;
  if (r <= 7) return 4;
  return 5;
}

const FLOOR_Y = -3.7;

function spawnDemon(delay = 0) {
  const speed = 6 + round * 0.6 + Math.random() * 1.2;
  const isWalking = Math.random() < 0.4;
  const baseX = -4 + Math.random() * 8;
  const baseY = isWalking ? FLOOR_Y : -1.8 + Math.random() * 3.2;

  const material = new THREE.SpriteMaterial({ map: isWalking ? demonTex.walk1 : demonTex.fly1, transparent: true });
  const sprite = new THREE.Sprite(material);
  // walk sprites are 26x36 (taller than wide), fly sprites are 30x24 (wider than tall) —
  // scale non-uniformly so neither type looks squashed or stretched
  if (isWalking) sprite.scale.set(SPRITE_SCALE * 0.72, SPRITE_SCALE, 1);
  else sprite.scale.set(SPRITE_SCALE * 1.25, SPRITE_SCALE, 1);
  sprite.position.set(baseX, baseY, -42 - Math.random() * 6);
  scene.add(sprite);

  demons.push({
    sprite,
    type: isWalking ? "walking" : "flying",
    baseX,
    baseY,
    vz: speed * (isWalking ? 0.85 : 1),
    // erratic "wander" target — re-picked periodically instead of a smooth sine wave
    wanderX: baseX,
    wanderNextAt: -delay + 0.15 + Math.random() * 0.35,
    wobbleAmp: isWalking ? 1.4 + Math.random() * 1.0 : 0.9 + Math.random() * 1.0,
    t: -delay,
    wingPhase: 0,
    state: "active",
    hitAt: 0,
  });
}

function clearDemons() {
  demons.forEach((d) => scene.remove(d.sprite));
  demons = [];
}

function themeIndexForRound(r) {
  if (r <= 3) return 0;
  if (r <= 6) return 1;
  return 2;
}

function startRound() {
  clearDemons();
  roundState = "spawning";
  roundValueEl.textContent = round;

  const themeIndex = themeIndexForRound(round);
  const enteringNewZone = round > 1 && themeIndexForRound(round - 1) !== themeIndex;
  corridor.setTheme(themeIndex);
  lighting.setTheme(themeIndex);

  const count = demonCountForRound(round);
  ammo = Math.max(AMMO_PER_ROUND, count + 2);
  maxAmmoThisRound = ammo;
  for (let i = 0; i < count; i++) spawnDemon(i * 0.6);
  playRoundStart();
  flashRound(enteringNewZone ? corridor.themeName.toUpperCase() : `RONDA ${round}`);
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
  ammoDotsEl.innerHTML = Array.from({ length: maxAmmoThisRound })
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
  gunFireUntil = performance.now() + 110;
  recoilKick = 1;
  gunSpriteEl.src = "assets/gun-fire.png";
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
  const flyingSprites = demons.filter((d) => d.state === "active").map((d) => d.sprite);
  const hits = raycaster.intersectObjects(flyingSprites);

  let hit = false;
  if (hits.length > 0) {
    const target = demons.find((d) => d.sprite === hits[0].object);
    if (target) {
      target.state = "hit";
      target.hitAt = performance.now();
      target.sprite.material.map = target.type === "walking" ? demonTex.walkHit : demonTex.hit;
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
  startMusic();
});
document.getElementById("btnRetry").addEventListener("click", resetGame);

const btnMusicToggle = document.getElementById("btnMusicToggle");
btnMusicToggle.addEventListener("click", () => {
  const playing = toggleMusic();
  btnMusicToggle.setAttribute("aria-pressed", String(playing));
});

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

      if (d.state === "active") {
        d.sprite.position.z += d.vz * dt;

        // erratic side-to-side wander: pick a new lateral target every so often
        // and jerk toward it, instead of a smooth predictable sine wave
        if (d.t > d.wanderNextAt) {
          const range = d.type === "walking" ? 3.2 : 4.2;
          d.wanderX = Math.max(-4.2, Math.min(4.2, d.baseX + (Math.random() * 2 - 1) * range));
          d.wanderNextAt = d.t + 0.22 + Math.random() * 0.32;
        }
        const jerk = 1 - Math.pow(0.0002, dt); // fast, snappy approach — reads as erratic, not floaty
        d.sprite.position.x += (d.wanderX - d.sprite.position.x) * jerk;

        if (d.type === "walking") {
          d.sprite.position.y = FLOOR_Y;
          d.wingPhase += dt * 7;
          d.sprite.material.map = Math.floor(d.wingPhase) % 2 === 0 ? demonTex.walk1 : demonTex.walk2;
        } else {
          d.sprite.position.y = d.baseY + Math.sin(d.t * 2.2) * d.wobbleAmp * 0.35;
          d.wingPhase += dt * 11;
          d.sprite.material.map = Math.floor(d.wingPhase) % 2 === 0 ? demonTex.fly1 : demonTex.fly2;
        }

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

  // idle breathing sway + eased recoil kick that decays back to rest
  recoilKick *= Math.pow(0.0015, dt * 1.2); // 20% faster recoil recovery -> higher effective fire rate
  const breatheY = Math.sin(elapsed * 1.7) * 2.2 + Math.sin(elapsed * 0.85) * 1.3;
  const breatheX = Math.sin(elapsed * 1.1) * 1.4;

  // walking sway — as if the player were striding forward: a side-to-side
  // sway with a bob that doubles frequency (one small bob per footstep)
  const walkCycle = elapsed * 3.4;
  const walkSwayX = Math.sin(walkCycle) * 5.5;
  const walkSwayY = Math.abs(Math.sin(walkCycle)) * 4.5;

  // a small position nudge toward the crosshair — subtler than true aim
  // tracking, closer to how modern doom-likes nudge a flat weapon sprite
  aimOffsetX += (mouseNDC.x * 14 - aimOffsetX) * Math.min(1, dt * 9);
  aimOffsetY += (-mouseNDC.y * 10 - aimOffsetY) * Math.min(1, dt * 9);

  const offsetX = breatheX + walkSwayX + aimOffsetX;
  const offsetY = -breatheY - walkSwayY + aimOffsetY + recoilKick * 26;
  const kickScale = 1 + recoilKick * 0.05;
  gunSpriteEl.style.transform =
    `translate(calc(-38% + ${offsetX.toFixed(1)}px), ${offsetY.toFixed(1)}px) scale(${kickScale.toFixed(3)})`;

  const firing = performance.now() < gunFireUntil;
  if (!firing && gunSpriteEl.src.includes("gun-fire")) {
    gunSpriteEl.src = "assets/gun-idle.png";
  }

  renderer.clear();
  renderer.render(scene, camera);

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
