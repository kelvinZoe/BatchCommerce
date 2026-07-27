import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src');
const assets = join(src, 'assets');
const iconDir = join(assets, 'icons');

mkdirSync(iconDir, { recursive: true });

const colors = {
  ink: '#142033',
  ink2: '#1b3443',
  teal: '#1fb6a6',
  mint: '#c9f7e7',
  amber: '#d89222',
  cream: '#fff8e7',
  white: '#ffffff'
};

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Batch Commerce">
  <defs>
    <linearGradient id="bg" x1="64" y1="40" x2="448" y2="472" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#142033"/>
      <stop offset="0.55" stop-color="#123f42"/>
      <stop offset="1" stop-color="#1fb6a6"/>
    </linearGradient>
    <linearGradient id="top" x1="160" y1="128" x2="352" y2="206" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff8e7"/>
      <stop offset="1" stop-color="#bdf5e4"/>
    </linearGradient>
    <linearGradient id="mid" x1="118" y1="224" x2="394" y2="304" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1fb6a6"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="low" x1="150" y1="338" x2="362" y2="398" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#d89222"/>
      <stop offset="1" stop-color="#f0bd62"/>
    </linearGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="116" fill="url(#bg)"/>
  <path d="M104 333c27 73 82 110 152 110s125-37 152-110" fill="none" stroke="#fff8e7" stroke-opacity=".88" stroke-width="18" stroke-linecap="round"/>
  <path d="M116 325h280" fill="none" stroke="#fff8e7" stroke-opacity=".42" stroke-width="12" stroke-linecap="round"/>
  <circle cx="184" cy="424" r="15" fill="#fff8e7"/>
  <circle cx="328" cy="424" r="15" fill="#fff8e7"/>
  <rect x="151" y="118" width="210" height="82" rx="28" fill="url(#top)"/>
  <rect x="118" y="218" width="276" height="92" rx="30" fill="url(#mid)"/>
  <rect x="151" y="338" width="210" height="70" rx="27" fill="url(#low)"/>
  <g fill="#123f42" fill-opacity=".94">
    <circle cx="151" cy="159" r="13"/><circle cx="361" cy="159" r="13"/>
    <circle cx="118" cy="264" r="15"/><circle cx="394" cy="264" r="15"/>
    <circle cx="151" cy="373" r="12"/><circle cx="361" cy="373" r="12"/>
  </g>
  <path d="M214 132v54M202 230v66M215 349v48" fill="none" stroke="#142033" stroke-opacity=".2" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 14"/>
  <path d="M181 159h150M157 264h198M186 373h140" fill="none" stroke="#142033" stroke-opacity=".22" stroke-width="13" stroke-linecap="round"/>
</svg>
`;

const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="288" viewBox="0 0 1040 288" role="img" aria-label="Batch Commerce">
  <defs>
    <linearGradient id="word" x1="292" y1="96" x2="832" y2="198" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#142033"/>
      <stop offset=".48" stop-color="#142033"/>
      <stop offset=".49" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#1fb6a6"/>
    </linearGradient>
  </defs>
  <g transform="translate(48 40) scale(.42)">
    ${markSvg.replace(/<\?xml[^>]*>\n?|<svg[^>]*>|<\/svg>/g, '')}
  </g>
  <text x="292" y="167" fill="url(#word)" font-size="84" font-weight="800" font-family="Avenir Next, Montserrat, Verdana, sans-serif" letter-spacing="-4">BatchCommerce</text>
  <text x="298" y="214" fill="#64748b" font-size="25" font-weight="700" font-family="Avenir Next, Montserrat, Verdana, sans-serif" letter-spacing="5">BATCH-FIRST SHOP OPERATIONS</text>
</svg>
`;

writeText(join(assets, 'batchcommerce_icon.svg'), markSvg);
writeText(join(assets, 'batchcommerce_logo.svg'), logoSvg);
writeText(join(src, 'favicon.svg'), markSvg.replace('width="512" height="512"', 'width="64" height="64"'));

const png1024 = renderIconPng(1024);
writeFileSync(join(assets, 'batchcommerce_icon.png'), png1024);
writeFileSync(join(assets, 'batchcommerce_logo.png'), png1024);

for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  writeFileSync(join(iconDir, `icon-${size}x${size}.png`), renderIconPng(size));
}

writeFileSync(join(src, 'favicon.ico'), createIco(renderIconPng(32)));

function writeText(path, value) {
  writeFileSync(path, value, 'utf8');
}

function renderIconPng(size) {
  const width = size;
  const height = size;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = (x + y) / (width + height);
      const color = mix(hex(colors.ink), hex(colors.teal), Math.pow(t, 1.35));
      setPixel(pixels, width, x, y, color.r, color.g, color.b, 255);
    }
  }

  const s = size / 512;
  drawCart(pixels, width, height, s);
  drawTicket(pixels, width, height, 151 * s, 118 * s, 210 * s, 82 * s, 28 * s, 13 * s, (x, y) => {
    return mix(hex(colors.cream), hex(colors.mint), (x - 151 * s) / (210 * s));
  });
  drawTicket(pixels, width, height, 118 * s, 218 * s, 276 * s, 92 * s, 30 * s, 15 * s, (x, y) => {
    return mix(hex(colors.teal), hex('#0f766e'), (x - 118 * s) / (276 * s));
  });
  drawTicket(pixels, width, height, 151 * s, 338 * s, 210 * s, 70 * s, 27 * s, 12 * s, (x, y) => {
    return mix(hex(colors.amber), hex('#f0bd62'), (x - 151 * s) / (210 * s));
  });

  drawPerforation(pixels, width, height, 214 * s, 132 * s, 186 * s, 6 * s, hex(colors.ink), 0.2);
  drawPerforation(pixels, width, height, 202 * s, 230 * s, 296 * s, 6 * s, hex(colors.ink), 0.2);
  drawPerforation(pixels, width, height, 215 * s, 349 * s, 397 * s, 6 * s, hex(colors.ink), 0.2);
  strokeLine(pixels, width, height, 181 * s, 159 * s, 331 * s, 159 * s, 10 * s, hex(colors.ink), 0.24);
  strokeLine(pixels, width, height, 157 * s, 264 * s, 355 * s, 264 * s, 11 * s, hex(colors.ink), 0.22);
  strokeLine(pixels, width, height, 186 * s, 373 * s, 326 * s, 373 * s, 10 * s, hex(colors.ink), 0.22);

  return encodePng(width, height, pixels);
}

function backgroundAt(width, x, y) {
  const t = (x + y) / (width + width);
  return mix(hex(colors.ink), hex(colors.teal), Math.pow(t, 1.35));
}

function hex(value) {
  const clean = value.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k)
  };
}

function setPixel(pixels, width, x, y, r, g, b, a = 255) {
  const i = (Math.floor(y) * width + Math.floor(x)) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function blendPixel(pixels, width, x, y, color, alpha = 1) {
  x = Math.floor(x);
  y = Math.floor(y);
  const i = (y * width + x) * 4;
  const inv = 1 - alpha;
  pixels[i] = Math.round(pixels[i] * inv + color.r * alpha);
  pixels[i + 1] = Math.round(pixels[i + 1] * inv + color.g * alpha);
  pixels[i + 2] = Math.round(pixels[i + 2] * inv + color.b * alpha);
  pixels[i + 3] = 255;
}

function insideRoundRect(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2;
}

function roundRect(pixels, width, height, x, y, w, h, r, colorAt) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      if (insideRoundRect(px + 0.5, py + 0.5, x, y, w, h, r)) {
        blendPixel(pixels, width, px, py, colorAt(px, py), 1);
      }
    }
  }
}

function drawTicket(pixels, width, height, x, y, w, h, r, notch, colorAt) {
  roundRect(pixels, width, height, x, y, w, h, r, colorAt);
  circle(pixels, width, height, x, y + h / 2, notch, backgroundAt(width, x, y + h / 2), 0.96);
  circle(pixels, width, height, x + w, y + h / 2, notch, backgroundAt(width, x + w, y + h / 2), 0.96);
}

function drawPerforation(pixels, width, height, x, y1, y2, weight, color, alpha) {
  for (let y = y1; y <= y2; y += 16 * (width / 512)) {
    circle(pixels, width, height, x, y, weight / 2, color, alpha);
  }
}

function circle(pixels, width, height, cx, cy, r, color, alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width, Math.ceil(cx + r));
  const y1 = Math.min(height, Math.ceil(cy + r));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) blendPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function strokeLine(pixels, width, height, x1, y1, x2, y2, weight, color, alpha = 1) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - weight));
  const maxX = Math.min(width, Math.ceil(Math.max(x1, x2) + weight));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - weight));
  const maxY = Math.min(height, Math.ceil(Math.max(y1, y2) + weight));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      if ((x - px) ** 2 + (y - py) ** 2 <= (weight / 2) ** 2) blendPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawArc(pixels, width, height, cx, cy, r, weight, color, alpha) {
  for (let a = 28; a <= 152; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    strokeLine(
      pixels,
      width,
      height,
      cx + Math.cos(rad) * r,
      cy + Math.sin(rad) * r,
      cx + Math.cos(rad + 0.01) * r,
      cy + Math.sin(rad + 0.01) * r,
      weight,
      color,
      alpha
    );
  }
}

function drawCart(pixels, width, height, s) {
  const cream = hex(colors.cream);
  strokeCurve(
    pixels,
    width,
    height,
    104 * s,
    333 * s,
    142 * s,
    430 * s,
    256 * s,
    443 * s,
    370 * s,
    430 * s,
    408 * s,
    333 * s,
    18 * s,
    cream,
    0.88
  );
  strokeLine(pixels, width, height, 116 * s, 325 * s, 396 * s, 325 * s, 12 * s, cream, 0.42);
  circle(pixels, width, height, 184 * s, 424 * s, 15 * s, cream, 1);
  circle(pixels, width, height, 328 * s, 424 * s, 15 * s, cream, 1);
}

function strokeCurve(pixels, width, height, x0, y0, x1, y1, x2, y2, x3, y3, x4, y4, weight, color, alpha) {
  let last = { x: x0, y: y0 };
  for (let i = 1; i <= 96; i++) {
    const t = i / 96;
    const firstHalf = t <= 0.5;
    const localT = firstHalf ? t * 2 : (t - 0.5) * 2;
    const a = firstHalf
      ? quadraticPoint(x0, y0, x1, y1, x2, y2, localT)
      : quadraticPoint(x2, y2, x3, y3, x4, y4, localT);
    strokeLine(pixels, width, height, last.x, last.y, a.x, a.y, weight, color, alpha);
    last = a;
  }
}

function quadraticPoint(x0, y0, x1, y1, x2, y2, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * x0 + 2 * inv * t * x1 + t * t * x2,
    y: inv * inv * y0 + 2 * inv * t * y1 + t * t * y2
  };
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowLength] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, y * rowLength + 1);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function createIco(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header[8] = 0;
  header[9] = 0;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}
