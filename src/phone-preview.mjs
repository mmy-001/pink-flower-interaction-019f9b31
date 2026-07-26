import {
  afterimageFrames,
  bloomFrame,
  playbackDuration,
} from "./sequencing.mjs";

const shell = document.querySelector("#phone-shell");
const canvas = document.querySelector("#phone-flower");
const context = canvas.getContext("2d", { alpha: true });
const status = document.querySelector("#phone-load-status");
const statusWrap = status.closest(".phone-status");

const PLAYBACK_RATE = 1.2;
const AFTERIMAGE_ALPHA = [0.11, 0.065, 0.035, 0.018];
const scene = {
  width: 0,
  height: 0,
  dpr: 1,
  frames: [],
  manifest: null,
  startedAt: null,
  pointerDown: null,
};

function setStatus(message, mode) {
  status.textContent = message;
  statusWrap.classList.toggle("is-ready", mode === "ready");
  statusWrap.classList.toggle("is-error", mode === "error");
}

function resize() {
  const bounds = shell.getBoundingClientRect();
  scene.width = bounds.width;
  scene.height = bounds.height;
  scene.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(bounds.width * scene.dpr);
  canvas.height = Math.round(bounds.height * scene.dpr);
  context.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
}

async function loadFrames() {
  const response = await fetch("./assets/pink-alpha-frames/manifest.json");
  if (!response.ok) throw new Error(`花瓣清单加载失败（${response.status}）`);
  scene.manifest = await response.json();

  for (const [index, file] of scene.manifest.files.entries()) {
    const frame = await new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`第 ${index + 1} 帧加载失败`));
      image.src = `./assets/pink-alpha-frames/${file}`;
    });
    scene.frames.push(frame);
    setStatus(`花瓣准备中 ${index + 1} / ${scene.manifest.frameCount}`);
  }

  shell.classList.add("is-canvas-ready");
  setStatus("花瓣就绪 · 轻触手机", "ready");
}

function replay() {
  if (!scene.frames.length) return;
  scene.startedAt = performance.now();
}

function handlePointerDown(event) {
  scene.pointerDown = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
  };
  shell.setPointerCapture?.(event.pointerId);
}

function handlePointerUp(event) {
  const start = scene.pointerDown;
  scene.pointerDown = null;
  shell.releasePointerCapture?.(event.pointerId);
  if (!start) return;

  const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
  if (distance < 14 && performance.now() - start.time < 650) replay();
}

function drawFrame(image, size, alpha = 1, filter = "none") {
  const x = scene.width * 0.5 - size / 2;
  const y = scene.height * 0.57 - size / 2;
  context.save();
  context.globalAlpha = alpha;
  context.filter = filter;
  context.drawImage(image, x, y, size, size);
  context.restore();
}

function render(now) {
  context.clearRect(0, 0, scene.width, scene.height);

  if (scene.frames.length) {
    const duration = playbackDuration(scene.manifest.duration, PLAYBACK_RATE);
    const elapsed = scene.startedAt === null ? 0 : now - scene.startedAt;
    const progress = Math.min(1, Math.max(0, elapsed / duration));
    const index =
      scene.startedAt === null
        ? 0
        : bloomFrame(elapsed, 0, scene.frames.length - 1, duration);
    const size = scene.width * (0.61 + progress * 0.07);
    const image = scene.frames[index];

    drawFrame(
      image,
      size * 1.035,
      0.22,
      "blur(8px) saturate(1.25)",
    );

    if (scene.startedAt !== null && progress < 1) {
      const ghostFade = 1 - Math.min(1, Math.max(0, (progress - 0.78) / 0.22));
      afterimageFrames(index, AFTERIMAGE_ALPHA.length).forEach(
        (frame, ghostIndex) => {
          drawFrame(
            scene.frames[frame],
            size,
            AFTERIMAGE_ALPHA[ghostIndex] * ghostFade,
          );
        },
      );
    }

    drawFrame(image, size, 1, "saturate(1.1) contrast(1.035)");
  }

  requestAnimationFrame(render);
}

shell.addEventListener("pointerdown", handlePointerDown);
shell.addEventListener("pointerup", handlePointerUp);
shell.addEventListener("pointercancel", () => {
  scene.pointerDown = null;
});
shell.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    replay();
  }
});
new ResizeObserver(resize).observe(shell);

resize();
loadFrames().catch((error) => {
  console.error(error);
  setStatus(`${error.message} · 请刷新重试`, "error");
});
requestAnimationFrame(render);
