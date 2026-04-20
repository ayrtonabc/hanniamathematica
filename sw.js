const CACHE_NAME = "matematyczne-przygody-v1";
const PRECACHE_URLS = ["./", "./index.html", "./manifest.webmanifest"];
const ICON_BUF = new Map();

async function generateIconPng(size) {
  if (!self.OffscreenCanvas) return null;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const r = Math.floor(size * 0.18);

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#ff7aa2");
  grad.addColorStop(1, "#62c4ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  const tile = Math.max(18, Math.floor(size / 10));
  for (let x = 0; x < size; x += tile) {
    for (let y = 0; y < size; y += tile) {
      if ((x / tile + y / tile) % 2 === 0) ctx.fillRect(x, y, 1, tile);
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(11,22,48,0.55)";
  ctx.fillRect(0, 0, size, size * 0.12);

  ctx.fillStyle = "#0a1020";
  ctx.lineWidth = Math.max(6, Math.floor(size * 0.05));
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth, r);
  } else {
    const x = ctx.lineWidth / 2;
    const y = ctx.lineWidth / 2;
    const w = size - ctx.lineWidth;
    const h = size - ctx.lineWidth;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  ctx.stroke();

  const cx = size * 0.5;
  const cy = size * 0.52;
  const outer = size * 0.26;
  const inner = size * 0.12;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd35c";
  ctx.fill();
  ctx.strokeStyle = "rgba(10,16,32,0.4)";
  ctx.lineWidth = Math.max(4, Math.floor(size * 0.02));
  ctx.stroke();

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return await blob.arrayBuffer();
}

async function iconResponse(size) {
  if (!ICON_BUF.has(size)) ICON_BUF.set(size, generateIconPng(size));
  const buf = await ICON_BUF.get(size);
  if (!buf) return new Response("", { status: 404 });
  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === "navigate";
  const isIcon192 = url.pathname.endsWith("/icon-192.png") || url.pathname === "/icon-192.png";
  const isIcon512 = url.pathname.endsWith("/icon-512.png") || url.pathname === "/icon-512.png";

  if (isIcon192 || isIcon512) {
    event.respondWith(iconResponse(isIcon192 ? 192 : 512));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (isNav) {
        const cached = await cache.match("./index.html");
        if (cached) return cached;
      }

      const cached = await cache.match(req);
      if (cached) {
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
            })
            .catch(() => {})
        );
        return cached;
      }

      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        if (isNav) {
          const fallback = await cache.match("./index.html");
          if (fallback) return fallback;
        }
        return new Response("", { status: 504 });
      }
    })()
  );
});
