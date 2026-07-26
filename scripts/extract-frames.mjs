import { createRequire } from "node:module";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeModules =
  process.env.CODEX_NODE_MODULES ??
  "C:\\Users\\cgsf3\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const { chromium } = require(path.join(runtimeModules, "playwright"));
const sharp = require(path.join(runtimeModules, "sharp"));

const defaultInput = path.resolve(
  root,
  "source",
  "pink-flower-source.mp4",
);

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

const input = path.resolve(argument("--input", defaultInput));
const output = path.resolve(
  root,
  argument("--output", path.join("assets", "pink-alpha-frames")),
);
const assetName = argument("--name", "pink-alpha");
const matteMode = argument("--matte", "soft");
const frameCount = 36;
const outputSize = Number(argument("--size", "720"));

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

async function encodeFrame(pngBuffer) {
  if (matteMode === "none") {
    return sharp(pngBuffer)
      .resize(outputSize, outputSize, { fit: "fill" })
      .webp({ quality: 96, effort: 5 })
      .toBuffer();
  }

  const { data, info } = await sharp(pngBuffer)
    .resize(outputSize, outputSize, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const result = Buffer.alloc(data.length);
  const edgeFeather = outputSize * 0.08;
  const assumedBackground = 238;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const chroma = max - min;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const darkness = 255 - luminance;

      const purpleBias = Math.max(0, (red + blue) * 0.5 - green);
      const signal =
        chroma * 1.65 +
        purpleBias * 1.3 +
        Math.max(0, darkness - 34) * Math.min(1, chroma / 24);
      let alpha = smoothstep(20, 92, signal);

      const edgeDistance = Math.min(
        x,
        y,
        info.width - 1 - x,
        info.height - 1 - y,
      );
      alpha *= smoothstep(0, edgeFeather, edgeDistance);
      alpha = smoothstep(0.16, 0.86, alpha);
      const alphaByte = Math.round(alpha * 255);
      const safeAlpha = Math.max(alpha, 0.08);
      result[offset] = Math.round(
        Math.min(
          255,
          Math.max(0, (red - assumedBackground * (1 - alpha)) / safeAlpha),
        ),
      );
      result[offset + 1] = Math.round(
        Math.min(
          255,
          Math.max(0, (green - assumedBackground * (1 - alpha)) / safeAlpha),
        ),
      );
      result[offset + 2] = Math.round(
        Math.min(
          255,
          Math.max(0, (blue - assumedBackground * (1 - alpha)) / safeAlpha),
        ),
      );
      result[offset + 3] = alphaByte < 3 ? 0 : alphaByte;
    }
  }

  return sharp(result, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .webp({ quality: 96, alphaQuality: 96, effort: 5 })
    .toBuffer();
}

async function startSourceServer(videoPath) {
  const sourceStat = await stat(videoPath);
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end('<video src="/source.mp4" muted playsinline></video>');
      return;
    }

    if (request.url !== "/source.mp4") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const range = request.headers.range;
    if (!range) {
      response.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Length": sourceStat.size,
        "Content-Type": "video/mp4",
      });
      createReadStream(videoPath).pipe(response);
      return;
    }

    const [startText, endText] = range.replace("bytes=", "").split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : sourceStat.size - 1;
    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${sourceStat.size}`,
      "Content-Type": "video/mp4",
    });
    createReadStream(videoPath, { start, end }).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
  };
}

await mkdir(output, { recursive: true });

const sourceServer = await startSourceServer(input);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });

try {
  await page.goto(sourceServer.url, { waitUntil: "load" });
  await page.waitForSelector("video");
  const metadata = await page.$eval("video", async (video) => {
    video.controls = false;
    video.muted = true;
    if (video.readyState < 2) {
      await new Promise((resolve) =>
        video.addEventListener("loadeddata", resolve, { once: true }),
      );
    }
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  });

  const startTime = 0.18;
  const endTime = Math.max(startTime, metadata.duration - 0.06);
  const files = [];

  for (let index = 0; index < frameCount; index += 1) {
    const progress = index / (frameCount - 1);
    const time = startTime + (endTime - startTime) * progress;
    const dataUrl = await page.$eval(
      "video",
      async (video, seekTime) => {
        await new Promise((resolve) => {
          const done = () => resolve();
          video.pause();
          video.currentTime = seekTime;
          if (Math.abs(video.currentTime - seekTime) < 0.002 && video.readyState >= 2) {
            resolve();
          } else {
            video.addEventListener("seeked", done, { once: true });
          }
        });
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d", { alpha: true });
        context.drawImage(video, 0, 0);
        return canvas.toDataURL("image/png");
      },
      time,
    );
    const sourcePng = Buffer.from(dataUrl.split(",")[1], "base64");
    const frame = await encodeFrame(sourcePng);
    const filename = `${assetName}-${String(index).padStart(3, "0")}.webp`;
    await writeFile(path.join(output, filename), frame);
    files.push(filename);
    process.stdout.write(`\rExtracted ${index + 1}/${frameCount}`);
  }

  const manifest = {
    source: path.relative(root, input).replaceAll("\\", "/"),
    duration: metadata.duration,
    sourceFps: 30,
    playbackFps: 18,
    frameCount,
    width: outputSize,
    height: outputSize,
    startTime,
    endTime,
    matte: matteMode,
    files,
  };
  await writeFile(
    path.join(output, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`\nWrote ${frameCount} frames to ${output}\n`);
} finally {
  await browser.close();
  await new Promise((resolve) => sourceServer.server.close(resolve));
}
