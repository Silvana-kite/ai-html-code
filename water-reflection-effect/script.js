const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d", { alpha: false });
const toggleButton = document.querySelector("#toggle");
const restartButton = document.querySelector("#restart");

const imageSources = [
  "./assets/1.png",
  "./assets/2.png",
  "./assets/3.png",
  "./assets/4.png",
  "./assets/5.png",
];

const duration = 10.5;
const sparkles = [];

let images = [];
let width = 0;
let height = 0;
let dpr = 1;
let startTime = performance.now();
let paused = false;
let pauseStarted = 0;
let rafId = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapIndex(index, total) {
  return ((index % total) + total) % total;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loadImages() {
  return Promise.all(
    imageSources.map(
      (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`图片加载失败：${src}`));
          image.src = src;
        }),
    ),
  );
}

function seedScene() {
  sparkles.length = 0;

  for (let i = 0; i < 110; i += 1) {
    sparkles.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 2.6,
      speed: 0.12 + Math.random() * 0.36,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > 0.55 ? "#62d9ff" : "#ffd166",
    });
  }
}

function drawBackground(time, progress) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.8);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#02030a");
  gradient.addColorStop(0.45, "#081228");
  gradient.addColorStop(0.58, "#050815");
  gradient.addColorStop(1, "#010106");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const glowA = ctx.createRadialGradient(
    width * (0.38 + 0.12 * Math.sin(progress * Math.PI * 2)),
    height * 0.22,
    0,
    width * 0.5,
    height * 0.28,
    Math.max(width, height) * 0.62,
  );
  glowA.addColorStop(0, `rgba(71, 196, 255, ${0.18 + pulse * 0.08})`);
  glowA.addColorStop(0.4, "rgba(80, 70, 220, 0.08)");
  glowA.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, width, height);

  const glowB = ctx.createRadialGradient(
    width * (0.72 - 0.18 * Math.sin(time * 0.32)),
    height * 0.62,
    0,
    width * 0.7,
    height * 0.6,
    Math.max(width, height) * 0.52,
  );
  glowB.addColorStop(0, "rgba(255, 71, 150, 0.16)");
  glowB.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function getStageMetrics() {
  const horizon = clamp(height * 0.515, height * 0.45, height * 0.58);
  const panelH = clamp(height * 0.45, 260, 430);
  const panelW = panelH * 16 / 9;
  const spacing = panelW;
  const travel = spacing * images.length;
  const baseBottom = horizon - 12;
  return { horizon, panelW, panelH, spacing, travel, baseBottom };
}

function getPanelTransform(centerX, panelW, panelH, baseBottom) {
  const normalized = clamp((centerX - width * 0.5) / (width * 0.5 + panelW), -1.35, 1.35);
  const abs = Math.abs(normalized);
  const side = Math.min(1, abs);

  // 不变形单张图片；弧面感只来自极轻微的垂直位置和透明度变化。
  const arcDrop = Math.pow(side, 1.55) * 10;
  const depthShadow = 10;
  const drawW = panelW;
  const drawH = panelH;
  const y = baseBottom - drawH + arcDrop;

  return {
    x: centerX - drawW * 0.5,
    y,
    w: drawW,
    h: drawH,
    side,
    depthShadow,
    alpha: clamp(1 - side * 0.08 - Math.max(0, abs - 0.98) * 1.25, 0, 1),
  };
}

function drawImageCover(image, x, y, w, h) {
  const ratio = Math.max(w / image.width, h / image.height);
  const sw = w / ratio;
  const sh = h / ratio;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawPanel(image, transform, index) {
  if (transform.alpha <= 0.02) return;

  ctx.save();
  ctx.globalAlpha = transform.alpha;
  ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
  ctx.shadowBlur = transform.depthShadow;

  drawImageCover(image, transform.x, transform.y, transform.w, transform.h);

  ctx.restore();
}

function drawPanelReflection(image, transform, index, progress, horizon) {
  if (transform.alpha <= 0.02) return;

  const reflectionTop = horizon + 4;
  const reflectionH = transform.h * 0.7;
  const rowHeight = 4;
  const accent = index % 2 === 0 ? "rgba(98, 217, 255, 0.2)" : "rgba(255, 92, 168, 0.18)";

  ctx.save();
  ctx.globalAlpha = transform.alpha * 0.7;
  ctx.translate(transform.x + transform.w * 0.5, reflectionTop);
  ctx.beginPath();
  ctx.rect(-transform.w * 0.5, 0, transform.w, reflectionH);
  ctx.clip();

  const ratio = Math.max(transform.w / image.width, transform.h / image.height);
  const sw = transform.w / ratio;
  const sh = transform.h / ratio;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;

  for (let yy = 0; yy < reflectionH; yy += rowHeight) {
    const normalized = yy / reflectionH;
    const wave =
      Math.sin(yy * 0.075 + progress * Math.PI * 10 + transform.x * 0.008) * (6 + normalized * 17) +
      Math.sin(yy * 0.19 - progress * Math.PI * 18) * (2 + normalized * 7);
    const destX = -transform.w * 0.5 + wave;
    const srcY = sy + sh * (1 - normalized) - (sh / reflectionH) * rowHeight;
    const srcH = Math.max(1, (sh / reflectionH) * rowHeight * 1.3);

    ctx.drawImage(
      image,
      sx,
      clamp(srcY, sy, sy + sh - srcH),
      sw,
      srcH,
      destX,
      yy,
      transform.w,
      rowHeight + 1,
    );
  }

  const fade = ctx.createLinearGradient(0, 0, 0, reflectionH);
  fade.addColorStop(0, "rgba(255,255,255,0)");
  fade.addColorStop(0.48, "rgba(8,16,28,0.24)");
  fade.addColorStop(1, "rgba(0,0,0,0.94)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = fade;
  ctx.fillRect(-transform.w * 0.5, 0, transform.w, reflectionH);

  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const yy = 12 + i * reflectionH * 0.14 + Math.sin(progress * Math.PI * 4 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(-transform.w * 0.5, yy);
    ctx.bezierCurveTo(-transform.w * 0.16, yy + 9, transform.w * 0.18, yy - 12, transform.w * 0.5, yy + 5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCurvedGallery(progress, horizon) {
  const { panelW, panelH, spacing, travel, baseBottom } = getStageMetrics();
  const scroll = progress * travel;
  const firstIndex = Math.floor((scroll - width * 0.9) / spacing) - 1;
  const lastIndex = Math.ceil((scroll + width * 1.9) / spacing) + 1;
  const visiblePanels = [];

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const centerX = width * 0.5 + i * spacing - scroll;
    const imageIndex = wrapIndex(i, images.length);
    const transform = getPanelTransform(centerX, panelW, panelH, baseBottom);

    if (transform.alpha > 0.02) {
      visiblePanels.push({ image: images[imageIndex], transform, imageIndex, order: i });
    }
  }

  visiblePanels.sort((a, b) => a.order - b.order);
  for (const panel of visiblePanels) {
    drawPanel(panel.image, panel.transform, panel.imageIndex);
  }

  for (const panel of visiblePanels) {
    drawPanelReflection(panel.image, panel.transform, panel.imageIndex, progress, horizon);
  }
}

function drawWaterSurface(time, horizon) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const water = ctx.createLinearGradient(0, horizon - 18, 0, height);
  water.addColorStop(0, "rgba(122, 227, 255, 0.22)");
  water.addColorStop(0.08, "rgba(255, 255, 255, 0.12)");
  water.addColorStop(0.28, "rgba(22, 122, 180, 0.12)");
  water.addColorStop(1, "rgba(10, 16, 28, 0.02)");
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon - 20, width, height - horizon + 20);

  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i += 1) {
    const y = horizon + i * 13 + Math.sin(time * 1.4 + i) * 3;
    const opacity = Math.max(0, 0.22 - i * 0.009);
    ctx.strokeStyle = `rgba(164, 232, 255, ${opacity})`;
    ctx.beginPath();
    for (let x = -40; x <= width + 40; x += 36) {
      const wave = Math.sin(x * 0.018 + time * 2.2 + i * 0.7) * (3 + i * 0.28);
      if (x === -40) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(230, 252, 255, 0.48)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 22) {
    const y = horizon + Math.sin(x * 0.025 + time * 2.6) * 2;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSparkles(time, horizon) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const point of sparkles) {
    const drift = (point.x + time * point.speed * 0.02) % 1;
    const x = drift * width;
    const y = horizon + point.y * (height - horizon) * 0.84;
    const blink = 0.35 + 0.65 * Math.sin(time * 2.4 + point.phase);
    ctx.fillStyle =
      point.color === "#62d9ff"
        ? `rgba(98, 217, 255, ${0.16 * blink})`
        : `rgba(255, 209, 102, ${0.14 * blink})`;
    ctx.beginPath();
    ctx.ellipse(x, y, point.size * (2.5 + blink), point.size, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.55, "rgba(0,0,0,0.08)");
  vignette.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function draw(now) {
  const elapsed = ((now - startTime) / 1000) % duration;
  const progress = elapsed / duration;
  const time = elapsed;
  const { horizon } = getStageMetrics();

  drawBackground(time, progress);
  drawSparkles(time, horizon);
  drawCurvedGallery(progress, horizon);
  drawWaterSurface(time, horizon);
  drawVignette();

  if (!paused) rafId = requestAnimationFrame(draw);
}

function setPaused(nextPaused) {
  paused = nextPaused;
  toggleButton.textContent = paused ? "播放" : "暂停";
  if (paused) {
    pauseStarted = performance.now();
    cancelAnimationFrame(rafId);
  } else {
    startTime += performance.now() - pauseStarted;
    rafId = requestAnimationFrame(draw);
  }
}

toggleButton.addEventListener("click", () => setPaused(!paused));
restartButton.addEventListener("click", () => {
  startTime = performance.now();
  if (paused) setPaused(false);
});

window.addEventListener("resize", resize);

resize();
loadImages()
  .then((loaded) => {
    images = loaded;
    seedScene();
    rafId = requestAnimationFrame(draw);
  })
  .catch((error) => {
    ctx.fillStyle = "#03040a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f5fbff";
    ctx.font = "16px sans-serif";
    ctx.fillText(error.message, 24, 48);
  });
