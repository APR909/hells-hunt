import { playShot, playHit, playEmptyClick, playEscape, playRoundStart, playGameOver } from "./sound.js";

const CANVAS_W = 1000;
const CANVAS_H = 600;
const HIT_RADIUS = 30;
const AMMO_PER_ROUND = 3;
const MAX_MISSES = 3;

const canvas = document.getElementById("scene");
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext("2d");

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

const sprites = {};
["fly1", "fly2", "hit"].forEach((name) => {
  const img = new Image();
  img.src = `assets/demon-${name}.png`;
  sprites[name] = img;
});
const guns = {};
["idle", "fire"].forEach((name) => {
  const img = new Image();
  img.src = `assets/gun-${name}.png`;
  guns[name] = img;
});

let mouseX = CANVAS_W / 2;
let mouseY = CANVAS_H / 2;
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scale = CANVAS_W / rect.width;
  mouseX = (e.clientX - rect.left) * scale;
  mouseY = (e.clientY - rect.top) * scale;
});

let faceLockUntil = 0;
function setFace(name, holdMs) {
  const src = `assets/face-${name}.png`;
  if (faceImgEl.getAttribute("src") !== src) faceImgEl.src = src;
  faceLockUntil = holdMs ? performance.now() + holdMs : 0;
}

let gunFireUntil = 0;
function triggerGunFire() {
  gunFireUntil = performance.now() + 130;
}

// title screen wing-flap animation
let titleFlap = false;
const titleFlapTimer = setInterval(() => {
  titleFlap = !titleFlap;
  titleDemonImg.src = titleFlap ? "assets/demon-fly2.png" : "assets/demon-fly1.png";
}, 220);

let score = 0;
let round = 1;
let ammo = AMMO_PER_ROUND;
let misses = 0;
let demons = [];
let roundState = "idle"; // "spawning" | "active" | "resolving"
let gameActive = false;

function demonCountForRound(r) {
  if (r <= 2) return 1;
  if (r <= 5) return 2;
  return 3;
}

function spawnDemon(delay = 0) {
  const speed = 70 + round * 9 + Math.random() * 20;
  const startX = 120 + Math.random() * (CANVAS_W - 240);
  demons.push({
    baseX: startX,
    x: startX,
    y: CANVAS_H + 30,
    vy: -speed,
    wobbleAmp: 25 + Math.random() * 25,
    wobbleFreq: 1.2 + Math.random() * 1.2,
    wobblePhase: Math.random() * Math.PI * 2,
    t: -delay,
    wingPhase: 0,
    state: "flying", // "flying" | "hit" | "gone"
    hitAt: 0,
    spawnDelay: delay,
  });
}

function startRound() {
  ammo = AMMO_PER_ROUND;
  demons = [];
  roundState = "spawning";
  roundValueEl.textContent = round;
  const count = demonCountForRound(round);
  for (let i = 0; i < count; i++) spawnDemon(i * 0.5);
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

canvas.addEventListener("click", (e) => {
  if (!gameActive || roundState !== "spawning" && roundState !== "active") return;
  if (ammo <= 0) {
    playEmptyClick();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scale = CANVAS_W / rect.width;
  const cx = (e.clientX - rect.left) * scale;
  const cy = (e.clientY - rect.top) * scale;

  ammo--;
  playShot();
  triggerGunFire();
  updateHud();

  let hit = false;
  for (const d of demons) {
    if (d.state !== "flying") continue;
    const dist = Math.hypot(d.x - cx, d.y - cy);
    if (dist < HIT_RADIUS) {
      d.state = "hit";
      d.hitAt = performance.now();
      score += 10 + round * 2;
      playHit();
      hit = true;
      break;
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
  demons = [];
  gameOverScreenEl.classList.add("hidden");
  gameActive = true;
  setFace("idle");
  startRound();
}

document.getElementById("btnStart").addEventListener("click", () => {
  clearInterval(titleFlapTimer);
  titleScreenEl.classList.add("hidden");
  gameStageEl.classList.remove("hidden");
  resetGame();
});
document.getElementById("btnRetry").addEventListener("click", resetGame);

let lastTime = performance.now();
let elapsed = 0;
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  elapsed += dt;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground(elapsed);

  if (gameActive) {
    demons.forEach((d) => {
      if (d.state === "gone") return;
      d.t += dt;
      if (d.t < 0) return; // staggered spawn delay not reached yet

      if (d.state === "flying") {
        d.y += d.vy * dt;
        d.x = d.baseX + Math.sin(d.t * d.wobbleFreq + d.wobblePhase) * d.wobbleAmp;
        d.wingPhase += dt * 11;
        if (d.y < -30 || d.x < -30 || d.x > CANVAS_W + 30) {
          d.state = "gone";
          d.escaped = true;
        }
      } else if (d.state === "hit") {
        d.y += 140 * dt; // fall
        d.x += Math.sin(d.t * 20) * 40 * dt;
        if (performance.now() - d.hitAt > 500) d.state = "gone";
      }
    });

    demons.forEach((d) => drawDemon(d));

    if (roundState === "spawning" || roundState === "active") {
      roundState = "active";
      endRoundCheck();
    }

    if (performance.now() >= faceLockUntil) {
      setFace(ammo > 0 ? "aim" : "idle");
    }
  }

  drawGunHud();
  drawCrosshair();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function drawBackground(t) {
  ctx.fillStyle = "#0a0403";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const vx = CANVAS_W / 2;
  const vy = CANVAS_H * 0.4;

  // perspective corridor edges converging to the vanishing point
  ctx.strokeStyle = "rgba(180,60,30,0.3)";
  ctx.lineWidth = 2;
  [[0, 0], [CANVAS_W, 0], [CANVAS_W, CANVAS_H], [0, CANVAS_H]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(vx, vy);
    ctx.stroke();
  });

  // floor/ceiling cross-struts, receding into the distance
  ctx.strokeStyle = "rgba(200,70,35,0.22)";
  for (let i = 1; i <= 5; i++) {
    const p = ((t * 0.35 + i / 5) % 1);
    const w = p * CANVAS_W * 1.3;
    const h = p * CANVAS_H * 1.3;
    ctx.strokeRect(vx - w / 2, vy - h / 2, w, h);
  }

  // glowing core at the vanishing point
  const coreGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, 70);
  coreGrad.addColorStop(0, "rgba(255,140,60,0.55)");
  coreGrad.addColorStop(1, "rgba(255,140,60,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(vx, vy, 70, 0, Math.PI * 2);
  ctx.fill();

  // drifting embers
  ctx.fillStyle = "rgba(255,120,50,0.5)";
  for (let i = 0; i < 22; i++) {
    const ex = (i * 137 + Math.sin(t * 0.4 + i) * 20) % CANVAS_W;
    const ey = (i * 251 + t * 30) % CANVAS_H;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ground silhouette
  ctx.fillStyle = "#08030299";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  ctx.lineTo(0, CANVAS_H - 50);
  for (let x = 0; x <= CANVAS_W; x += 40) {
    ctx.lineTo(x, CANVAS_H - 50 - Math.sin(x * 0.01) * 12);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  ctx.fill();
}

function drawDemon(d) {
  if (d.t < 0) return;
  const sprite = d.state === "hit" ? sprites.hit : Math.floor(d.wingPhase) % 2 === 0 ? sprites.fly1 : sprites.fly2;
  if (!sprite.complete || sprite.naturalWidth === 0) return;
  const scale = 2.2;
  const w = sprite.naturalWidth * scale;
  const h = sprite.naturalHeight * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (d.state === "hit") {
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.min(0.6, (performance.now() - d.hitAt) / 400));
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  } else {
    ctx.drawImage(sprite, d.x - w / 2, d.y - h / 2, w, h);
  }
  ctx.restore();
}

function drawGunHud() {
  const firing = performance.now() < gunFireUntil;
  const sprite = firing ? guns.fire : guns.idle;
  if (!sprite.complete || sprite.naturalWidth === 0) return;
  const scale = 1.9;
  const w = sprite.naturalWidth * scale;
  const h = sprite.naturalHeight * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, CANVAS_W / 2 - w / 2 + 30, CANVAS_H - h + 40, w, h);
  ctx.restore();
}

function drawCrosshair() {
  ctx.save();
  ctx.fillStyle = "#39ff6a";
  ctx.shadowColor = "#39ff6a";
  ctx.shadowBlur = 4;
  ctx.fillRect(mouseX - 1.5, mouseY - 1.5, 3, 3);
  ctx.restore();
}
