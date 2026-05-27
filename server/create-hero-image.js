const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const width = 1200;
const height = 760;
const outputPath = path.join(__dirname, "..", "public", "assets", "dawri-hero.png");
const pixels = Buffer.alloc(width * height * 4);

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function setPixel(x, y, color) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const index = (y * width + x) * 4;
  const alpha = (color[3] ?? 255) / 255;
  const inverse = 1 - alpha;
  pixels[index] = clamp(color[0] * alpha + pixels[index] * inverse);
  pixels[index + 1] = clamp(color[1] * alpha + pixels[index + 1] * inverse);
  pixels[index + 2] = clamp(color[2] * alpha + pixels[index + 2] * inverse);
  pixels[index + 3] = 255;
}

function rect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setPixel(xx, yy, color);
  }
}

function roundedRect(x, y, w, h, radius, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const rx = xx < x + radius ? x + radius : xx > x + w - radius ? x + w - radius : xx;
      const ry = yy < y + radius ? y + radius : yy > y + h - radius ? y + h - radius : yy;
      const dx = xx - rx;
      const dy = yy - ry;
      if (dx * dx + dy * dy <= radius * radius) setPixel(xx, yy, color);
    }
  }
}

function circle(cx, cy, radius, color) {
  const radiusSquared = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radiusSquared) setPixel(x, y, color);
    }
  }
}

function line(x1, y1, x2, y2, color, thickness = 2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;

  while (true) {
    circle(x, y, thickness, color);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawBackground() {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx = x / width;
      const gy = y / height;
      const base = [
        214 - 40 * gy,
        242 - 25 * gx,
        247 - 34 * gy
      ];
      setPixel(x, y, [base[0], base[1], base[2], 255]);
    }
  }

  circle(935, 90, 230, [201, 241, 235, 185]);
  circle(1060, 530, 300, [207, 230, 252, 150]);
  rect(0, 606, width, 154, [238, 247, 250, 255]);
}

function drawClinic() {
  roundedRect(470, 250, 480, 360, 22, [255, 255, 255, 245]);
  rect(470, 548, 480, 62, [219, 235, 242, 255]);
  roundedRect(520, 302, 150, 90, 10, [230, 247, 250, 255]);
  roundedRect(748, 302, 150, 90, 10, [230, 247, 250, 255]);
  roundedRect(520, 430, 150, 90, 10, [230, 247, 250, 255]);
  roundedRect(748, 430, 150, 90, 10, [230, 247, 250, 255]);
  roundedRect(650, 520, 120, 90, 12, [17, 127, 149, 255]);
  rect(701, 520, 18, 90, [255, 255, 255, 80]);

  roundedRect(620, 196, 180, 92, 18, [13, 127, 149, 255]);
  rect(690, 216, 40, 52, [255, 255, 255, 255]);
  rect(684, 222, 52, 40, [255, 255, 255, 255]);
}

function drawPhoneQueue() {
  roundedRect(165, 210, 250, 392, 32, [255, 255, 255, 246]);
  roundedRect(188, 245, 204, 298, 16, [239, 249, 250, 255]);
  circle(290, 568, 14, [219, 231, 238, 255]);

  roundedRect(212, 276, 158, 58, 12, [13, 127, 149, 255]);
  roundedRect(218, 360, 146, 62, 12, [232, 248, 240, 255]);
  roundedRect(218, 442, 146, 62, 12, [234, 244, 255, 255]);
  circle(246, 392, 17, [15, 159, 116, 255]);
  circle(246, 474, 17, [22, 119, 198, 255]);
  rect(275, 386, 72, 8, [15, 159, 116, 145]);
  rect(275, 405, 56, 8, [15, 159, 116, 100]);
  rect(275, 468, 72, 8, [22, 119, 198, 145]);
  rect(275, 487, 56, 8, [22, 119, 198, 100]);
}

function drawCalendarCards() {
  roundedRect(835, 138, 210, 120, 18, [255, 255, 255, 235]);
  rect(835, 138, 210, 36, [15, 159, 116, 255]);
  circle(888, 212, 22, [232, 248, 240, 255]);
  circle(950, 212, 22, [232, 248, 240, 255]);
  circle(1012, 212, 22, [255, 247, 223, 255]);

  roundedRect(840, 452, 210, 120, 18, [255, 255, 255, 235]);
  rect(874, 498, 132, 14, [13, 127, 149, 145]);
  rect(874, 526, 92, 14, [15, 159, 116, 130]);
  circle(882, 510, 42, [234, 244, 255, 210]);
}

function drawPeopleAndFlow() {
  circle(458, 570, 30, [16, 42, 67, 210]);
  rect(432, 602, 52, 78, [13, 127, 149, 220]);
  circle(1002, 584, 28, [16, 42, 67, 210]);
  rect(978, 614, 48, 70, [15, 159, 116, 220]);
  line(420, 190, 830, 162, [13, 127, 149, 85], 3);
  line(390, 540, 838, 500, [15, 159, 116, 70], 3);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng() {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, png);
}

drawBackground();
drawClinic();
drawPhoneQueue();
drawCalendarCards();
drawPeopleAndFlow();
writePng();

console.log(`Created ${outputPath}`);
