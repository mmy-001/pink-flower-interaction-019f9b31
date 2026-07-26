import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const portArgument = process.argv.indexOf("--port");
const port = Number(
  portArgument >= 0
    ? process.argv[portArgument + 1]
    : process.env.PINK_FLOWER_PORT || process.env.PORT || 4173,
);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".webp", "image/webp"],
]);

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, `http://${host}`).pathname,
  );

  if (pathname === "/__health") {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(
      '{"ok":true,"projectId":"019f9b31-feaa-7803-a3ae-8f1b741ad9e9"}\n',
    );
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (
    !filePath.startsWith(`${root}${path.sep}`) &&
    filePath !== path.join(root, "index.html")
  ) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": body.length,
      "Content-Type":
        mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Pink flower interaction: http://${host}:${port}`);
});
