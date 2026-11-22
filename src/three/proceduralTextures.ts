import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  key: string,
  canvas: HTMLCanvasElement,
  options: {
    srgb?: boolean;
    repeat?: [number, number];
    anisotropy?: number;
  } = {}
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (options.repeat) {
    tex.repeat.set(options.repeat[0], options.repeat[1]);
  }
  if (options.anisotropy) {
    tex.anisotropy = Math.min(8, options.anisotropy);
  }
  textureCache.set(key, tex);
  return tex;
}

// Deterministic pseudo-random helper for repeatable organic textures
function seededNoise(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getMeadowTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'meadow_albedo';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(101);

  ctx.fillStyle = '#5D924B';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle organic patches
  for (let i = 0; i < 180; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 6 + rand() * 20;
    const shade = rand();
    ctx.fillStyle =
      shade < 0.33
        ? 'rgba(78, 126, 58, 0.25)'
        : shade < 0.66
        ? 'rgba(112, 165, 86, 0.22)'
        : 'rgba(130, 178, 95, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine grass blade strokes
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 900; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 3 + rand() * 5;
    const tilt = (rand() - 0.5) * 3;
    ctx.strokeStyle =
      rand() > 0.5 ? 'rgba(65, 110, 48, 0.35)' : 'rgba(155, 200, 110, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tilt, y - len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, {
    srgb: true,
    repeat: [1, 1],
    anisotropy: maxAnisotropy,
  });
}

export function getCobbleTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'cobble_albedo';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(202);

  // Mortar base
  ctx.fillStyle = '#9D9586';
  ctx.fillRect(0, 0, 256, 256);

  // Fine mortar grain
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(70,65,55,0.16)' : 'rgba(195,188,172,0.16)';
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }

  // Natural flagstone layout
  const rows = 4;
  const cols = 4;
  const cellW = 256 / cols;
  const cellH = 256 / rows;
  const palette = ['#D8D0C2', '#CFC6B6', '#DFD8CC', '#C7BEAD', '#D4CCB9'];

  for (let r = 0; r < rows; r++) {
    const rowOffset = (r % 2) * (cellW * 0.45);
    for (let c = -1; c <= cols; c++) {
      const sx = c * cellW + rowOffset + 4;
      const sy = r * cellH + 4;
      const sw = cellW - 8 + (rand() - 0.5) * 4;
      const sh = cellH - 8 + (rand() - 0.5) * 4;

      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 10);
      ctx.fill();

      // Subtle bevel highlight & shadow
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(75,68,58,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sx + 1, sy + 1, sw, sh, 10);
      ctx.stroke();

      // Stone speckles
      for (let s = 0; s < 14; s++) {
        ctx.fillStyle = 'rgba(85,80,70,0.12)';
        ctx.fillRect(sx + 6 + rand() * (sw - 12), sy + 6 + rand() * (sh - 12), 2, 2);
      }
    }
  }

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getWoodTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'wood_albedo';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(303);

  ctx.fillStyle = '#8C5E36';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const tone = Math.sin(y * 0.14 + rand() * 0.4) * 14;
    ctx.fillStyle = `rgb(${135 + tone}, ${90 + tone * 0.7}, ${52 + tone * 0.4})`;
    ctx.fillRect(0, y, 256, 2);
  }
  // Fine grain lines
  ctx.strokeStyle = 'rgba(55, 30, 12, 0.28)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 45; i++) {
    const y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y + (rand() - 0.5) * 10, 170, y + (rand() - 0.5) * 10, 256, y);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getBarkTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'bark_albedo';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(309);

  ctx.fillStyle = '#5B3F29';
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 3) {
    const v = (rand() - 0.5) * 26;
    ctx.fillStyle = `rgb(${88 + v}, ${61 + v * 0.7}, ${40 + v * 0.5})`;
    ctx.fillRect(x, 0, 3, 256);
  }
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(35,22,12,0.4)' : 'rgba(130,98,70,0.22)';
    ctx.fillRect(rand() * 256, rand() * 256, 2 + rand() * 4, 18 + rand() * 40);
  }

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getFurBumpTexture(): THREE.CanvasTexture {
  const key = 'fur_bump_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(404);
  ctx.fillStyle = '#787878';
  ctx.fillRect(0, 0, 512, 512);

  // Layered fine individual hair shafts with dark root-to-bright ridge contrast
  for (let i = 0; i < 14000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 7 + rand() * 14;
    const curve = (rand() - 0.5) * 3.2;
    const v = Math.floor(65 + rand() * 175);
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.lineWidth = 0.7 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + curve * 0.5, y + len * 0.5, x + curve, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: false, repeat: [2, 2] });
}

export function getFurCardAlphaTexture(): THREE.CanvasTexture {
  const key = 'fur_card_alpha';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(419);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);

  // Tapered individual hair strands radiating up from base (y=256) to jagged strand tips
  for (let i = 0; i < 240; i++) {
    const baseX = 16 + rand() * 224;
    const tipX = baseX + (rand() - 0.5) * 34;
    const tipY = 12 + rand() * 110;
    const midX = (baseX + tipX) * 0.5 + (rand() - 0.5) * 14;
    const midY = (252 + tipY) * 0.5;
    const w = 1.6 + rand() * 2.8;

    const grad = ctx.createLinearGradient(baseX, 252, tipX, tipY);
    grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.65, 'rgba(245,245,245,0.85)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, 254);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function getWaterRippleTexture(): THREE.CanvasTexture {
  const key = 'water_ripple';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(505);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 90; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 8 + rand() * 24;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(220,220,220,0.45)');
    grad.addColorStop(0.6, 'rgba(110,110,110,0.25)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(key, canvas, { srgb: false, repeat: [2, 2] });
}

export function getGiraffeCoatTexture(): THREE.CanvasTexture {
  const key = 'giraffe_coat';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(601);

  // Cream reticulation network base
  ctx.fillStyle = '#F5E5C0';
  ctx.fillRect(0, 0, 256, 256);

  // Reticulated Voronoi-like irregular chestnut patches
  const pts: Array<[number, number, string]> = [];
  const grid = 6;
  const step = 256 / grid;
  const browns = ['#9B4B1A', '#8C3F14', '#AB5922', '#7E3711'];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      pts.push([
        gx * step + step * (0.2 + rand() * 0.6),
        gy * step + step * (0.2 + rand() * 0.6),
        browns[Math.floor(rand() * browns.length)],
      ]);
    }
  }

  for (const [cx, cy, col] of pts) {
    const sides = 6;
    const radius = step * 0.44;
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let s = 0; s < sides; s++) {
      const ang = (s / sides) * Math.PI * 2 + rand() * 0.25;
      const r = radius * (0.78 + rand() * 0.34);
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Fine short velvet coat hair strokes across giraffe hide
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 2200; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,245,220,0.18)' : 'rgba(68,30,10,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 1.5, y + 3 + rand() * 3);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true, repeat: [1.5, 1.5] });
}

export function getZebraCoatTexture(): THREE.CanvasTexture {
  const key = 'zebra_coat';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(602);

  ctx.fillStyle = '#F7F6F2';
  ctx.fillRect(0, 0, 256, 256);

  // Organic curved tapered stripes
  ctx.fillStyle = '#1E2025';
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    const baseX = (i / stripes) * 256;
    const width = 5 + rand() * 6;
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 16) {
      const wave = Math.sin(y * 0.035 + i * 0.8) * 9 + (rand() - 0.5) * 2;
      const x = baseX + wave;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let y = 256; y >= 0; y -= 16) {
      const wave = Math.sin(y * 0.035 + i * 0.8) * 9;
      const taper = 0.7 + 0.3 * Math.sin((y / 256) * Math.PI);
      ctx.lineTo(baseX + wave + width * taper, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Fine sleek hair sheen over black & white stripes
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(20,22,26,0.16)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 1.4, y + 3 + rand() * 4);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true, repeat: [1.2, 1] });
}

export function getLionFurTexture(): THREE.CanvasTexture {
  const key = 'lion_fur_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(603);
  ctx.fillStyle = '#D49849';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 7 + rand() * 12;
    const sway = (rand() - 0.5) * 4;
    const pick = rand();
    ctx.strokeStyle =
      pick < 0.38
        ? 'rgba(156, 98, 34, 0.44)'
        : pick < 0.76
        ? 'rgba(238, 196, 118, 0.36)'
        : 'rgba(116, 68, 22, 0.28)';
    ctx.lineWidth = 0.9 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.5, y + len * 0.5, x + sway, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getLionManeTexture(): THREE.CanvasTexture {
  const key = 'lion_mane_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(613);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#5E3214');
  grad.addColorStop(0.55, '#78411B');
  grad.addColorStop(1.0, '#A66328');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Coarse dense layered mane hairs with golden highlights & dark roots
  for (let i = 0; i < 8500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 14 + rand() * 26;
    const wave = (rand() - 0.5) * 10;
    const p = rand();
    ctx.strokeStyle =
      p < 0.35
        ? 'rgba(54, 26, 9, 0.55)'
        : p < 0.72
        ? 'rgba(132, 74, 28, 0.48)'
        : 'rgba(209, 140, 62, 0.38)';
    ctx.lineWidth = 1.2 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + wave * 0.5, y + len * 0.5, x + wave, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getPandaFurTexture(variant: 'white' | 'black'): THREE.CanvasTexture {
  const key = `panda_fur_${variant}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(variant === 'white' ? 621 : 622);
  ctx.fillStyle = variant === 'white' ? '#F3EFE5' : '#1E2025';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4200; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 6 + rand() * 9;
    const tilt = (rand() - 0.5) * 3.5;
    if (variant === 'white') {
      ctx.strokeStyle = rand() > 0.45 ? 'rgba(210, 202, 186, 0.48)' : 'rgba(255, 253, 248, 0.55)';
    } else {
      ctx.strokeStyle = rand() > 0.45 ? 'rgba(58, 62, 70, 0.45)' : 'rgba(12, 13, 16, 0.52)';
    }
    ctx.lineWidth = 1.0 + rand() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tilt, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true, repeat: [1.5, 1.5] });
}

export function getKoalaFurTexture(): THREE.CanvasTexture {
  const key = 'koala_fur_256';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(628);
  ctx.fillStyle = '#89909A';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4800; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 5 + rand() * 8;
    const p = rand();
    ctx.strokeStyle =
      p < 0.4
        ? 'rgba(90, 96, 106, 0.45)'
        : p < 0.75
        ? 'rgba(182, 188, 198, 0.45)'
        : 'rgba(232, 236, 242, 0.35)';
    ctx.lineWidth = 1.0 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true, repeat: [1.6, 1.6] });
}

export function getSealCoatTexture(): THREE.CanvasTexture {
  const key = 'seal_coat';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(604);

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#788492');
  grad.addColorStop(0.55, '#9BA5B0');
  grad.addColorStop(1, '#CED5DC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Dappled harbor seal spots & pale rings
  for (let i = 0; i < 85; i++) {
    const x = rand() * 256;
    const y = rand() * 200;
    const r = 3 + rand() * 6;
    ctx.fillStyle = 'rgba(42, 50, 62, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    if (rand() > 0.55) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // Fine slick wet-fur hairs
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 1800; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(30,38,48,0.18)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 4 + rand() * 4);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getRedPandaTailTexture(): THREE.CanvasTexture {
  const key = 'red_panda_tail';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const bands = 8;
  const bandH = 256 / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#C9481A' : '#431D0E';
    ctx.fillRect(0, i * bandH, 256, bandH + 1);
  }
  const rand = seededNoise(605);
  for (let i = 0; i < 3600; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,228,195,0.28)' : 'rgba(28,10,4,0.34)';
    ctx.lineWidth = 1.0 + rand() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y + 6 + rand() * 6);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getCapybaraFurTexture(): THREE.CanvasTexture {
  const key = 'capybara_fur_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(606);
  ctx.fillStyle = '#895834';
  ctx.fillRect(0, 0, 512, 512);

  // Coarse wiry bristled capybara hairs
  for (let i = 0; i < 9500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 10 + rand() * 14;
    const p = rand();
    ctx.strokeStyle =
      p < 0.42
        ? 'rgba(54, 30, 14, 0.5)'
        : p < 0.78
        ? 'rgba(176, 128, 82, 0.42)'
        : 'rgba(218, 174, 126, 0.28)';
    ctx.lineWidth = 1.1 + rand() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3.5, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getToucanBeakTexture(): THREE.CanvasTexture {
  const key = 'toucan_beak';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#FDE047'); // base yellow-gold
  grad.addColorStop(0.28, '#FB923C'); // vibrant orange
  grad.addColorStop(0.75, '#EA580C'); // deep tangerine
  grad.addColorStop(0.88, '#1E293B'); // signature black tip spot
  grad.addColorStop(1.0, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getTouristShirtTexture(): THREE.CanvasTexture {
  const key = 'tourist_shirt';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(128);
  const rand = seededNoise(707);
  ctx.fillStyle = '#3B6B78';
  ctx.fillRect(0, 0, 128, 128);

  const cols = ['#E5D29A', '#D6897A', '#B5D3C4', '#F2EFE9'];
  for (let i = 0; i < 32; i++) {
    ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
    const x = rand() * 128;
    const y = rand() * 128;
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 2.5, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact_shadow';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(15, 25, 18, 0.45)');
  grad.addColorStop(0.55, 'rgba(15, 25, 18, 0.2)');
  grad.addColorStop(1, 'rgba(15, 25, 18, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function getSoftGroundAlphaTexture(): THREE.CanvasTexture {
  const key = 'soft_ground_alpha';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 24, 64, 64, 62);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.68, '#E0E0E0');
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function getBrickFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'floor_brick';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(801);
  ctx.fillStyle = '#8F877D'; // mortar
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const bw = 256 / cols;
  const bh = 256 / rows;
  const reds = ['#9E5242', '#A85C4B', '#8E4639', '#B36854', '#944C3F'];

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = reds[Math.floor(rand() * reds.length)];
      ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, 3);
    }
  }

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getWoodFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'floor_wood';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(802);
  ctx.fillStyle = '#3B2819';
  ctx.fillRect(0, 0, 256, 256);

  const planks = 6;
  const pw = 256 / planks;
  const woods = ['#8B623C', '#805936', '#946B43', '#7A5432'];

  for (let p = 0; p < planks; p++) {
    ctx.fillStyle = woods[Math.floor(rand() * woods.length)];
    ctx.fillRect(p * pw + 2, 0, pw - 4, 256);
    ctx.strokeStyle = 'rgba(45,26,12,0.25)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 12; g++) {
      const gx = p * pw + 4 + rand() * (pw - 8);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + (rand() - 0.5) * 4, 256);
      ctx.stroke();
    }
  }

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getGravelFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'floor_gravel';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(803);
  ctx.fillStyle = '#ABA496';
  ctx.fillRect(0, 0, 256, 256);

  const cols = ['#C4BDB0', '#968F82', '#D4CEC3', '#857F73', '#B3AC9E'];
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 1.5 + rand() * 3.2;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getAsphaltFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'floor_asphalt';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(804);
  ctx.fillStyle = '#4B5056';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2000; i++) {
    const shade = 55 + Math.floor(rand() * 50);
    ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  // Clean plaza expansion joints
  ctx.strokeStyle = 'rgba(30,33,38,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 252);

  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getTigerCoatTexture(): THREE.CanvasTexture {
  const key = 'tiger_coat_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(805);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#C45F1F');
  grad.addColorStop(0.6, '#DC7329');
  grad.addColorStop(1, '#F5ECE2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#1B1816';
  for (let i = 0; i < 16; i++) {
    const bx = (i / 16) * 512;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + 14 + rand() * 8, 0);
    ctx.lineTo(bx + 6 + (rand() - 0.5) * 28, 390 + rand() * 60);
    ctx.lineTo(bx - 4, 390 + rand() * 60);
    ctx.closePath();
    ctx.fill();
  }

  // Strand-by-strand tiger fur hairs over coat & stripes
  for (let i = 0; i < 7500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 7 + rand() * 10;
    ctx.strokeStyle =
      rand() > 0.45 ? 'rgba(255, 224, 180, 0.25)' : 'rgba(35, 22, 12, 0.3)';
    ctx.lineWidth = 0.9 + rand() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y + len);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getElephantSkinTexture(): THREE.CanvasTexture {
  const key = 'elephant_skin';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(806);
  ctx.fillStyle = '#797E84';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(48, 52, 58, 0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 240; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + rand() * 14, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }

  return finalizeTexture(key, canvas, { srgb: true });
}

export function getEntranceBoardTexture(): THREE.CanvasTexture {
  const key = 'entrance_board';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ECEFE9';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 120);

  // Subtle botanical map motif
  ctx.fillStyle = '#BBF7D0';
  ctx.fillRect(18, 18, 210, 92);
  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.arc(80, 64, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(150, 58, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('ZOO MAP · 園內導覽', 248, 58);
  ctx.fillStyle = '#475569';
  ctx.font = '20px sans-serif';
  ctx.fillText('🦁 猛獸區  🐼 熊貓館  🦒 草原區', 248, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function getSavannaGroundTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'ground_savanna';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(901);
  ctx.fillStyle = '#C9AC77';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 160; i++) {
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(168, 130, 76, 0.26)' : 'rgba(218, 194, 136, 0.24)';
    ctx.beginPath();
    ctx.ellipse(rand() * 256, rand() * 256, 8 + rand() * 22, 6 + rand() * 14, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(110,82,46,0.22)' : 'rgba(240,224,180,0.24)';
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getForestFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'ground_forest';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(902);
  ctx.fillStyle = '#536A3A';
  ctx.fillRect(0, 0, 256, 256);

  // Mossy soil patches & fallen bamboo/forest leaves
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle =
      rand() > 0.45 ? 'rgba(66, 98, 44, 0.35)' : 'rgba(102, 82, 54, 0.28)';
    ctx.beginPath();
    ctx.arc(rand() * 256, rand() * 256, 6 + rand() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 420; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const ang = rand() * Math.PI;
    ctx.fillStyle = rand() > 0.4 ? 'rgba(164, 178, 92, 0.42)' : 'rgba(128, 102, 56, 0.38)';
    ctx.beginPath();
    ctx.ellipse(x, y, 4.5, 1.4, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getArcticSnowTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'ground_arctic';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(903);
  ctx.fillStyle = '#E6F2FA';
  ctx.fillRect(0, 0, 256, 256);

  // Wind-swept snow drifts & icy blue crevices
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(186, 220, 245, 0.35)' : 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(rand() * 256, rand() * 256, 12 + rand() * 28, 5 + rand() * 10, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(rand() * 256, rand() * 256, 1.5, 1.5);
  }
  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getWetlandMudTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'ground_wetland';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(904);
  ctx.fillStyle = '#87785E';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 150; i++) {
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(98, 126, 74, 0.28)' : 'rgba(110, 92, 68, 0.32)';
    ctx.beginPath();
    ctx.arc(rand() * 256, rand() * 256, 7 + rand() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(65,54,40,0.22)' : 'rgba(176,162,134,0.24)';
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  return finalizeTexture(key, canvas, { srgb: true, anisotropy: maxAnisotropy });
}

export function getCheetahCoatTexture(): THREE.CanvasTexture {
  const key = 'cheetah_coat_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(911);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#D49E48');
  grad.addColorStop(0.6, '#E4B865');
  grad.addColorStop(1, '#F5E7CC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Solid black round/oval cheetah spots (dense on back/flanks, fading toward belly)
  ctx.fillStyle = '#1E1813';
  for (let i = 0; i < 240; i++) {
    const sx = rand() * 512;
    const sy = rand() * 440;
    const r = 3.5 + rand() * 5.2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.15, r * 0.9, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine fur strands
  for (let i = 0; i < 6500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255, 240, 200, 0.22)' : 'rgba(62, 42, 18, 0.18)';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2.5, y + 6 + rand() * 8);
    ctx.stroke();
  }
  return finalizeTexture(key, canvas, { srgb: true });
}

export function getPolarBearFurTexture(): THREE.CanvasTexture {
  const key = 'polar_bear_fur_256';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(912);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#F5F7F9');
  grad.addColorStop(0.7, '#ECEFF2');
  grad.addColorStop(1, '#DCE5EC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4200; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.45 ? 'rgba(255, 255, 255, 0.48)' : 'rgba(182, 198, 212, 0.28)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2.4, y + 5 + rand() * 8);
    ctx.stroke();
  }
  return finalizeTexture(key, canvas, { srgb: true });
}

export function getPeacockPlumageTexture(): THREE.CanvasTexture {
  const key = 'peacock_plumage_512';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512);
  const rand = seededNoise(913);
  const grad = ctx.createRadialGradient(256, 460, 40, 256, 260, 340);
  grad.addColorStop(0, '#0E7490');
  grad.addColorStop(0.55, '#10B981');
  grad.addColorStop(1, '#065F46');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Delicate feather barbules
  for (let i = 0; i < 3200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(110, 231, 183, 0.26)' : 'rgba(13, 148, 136, 0.3)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 14, y - 10 - rand() * 14);
    ctx.stroke();
  }

  // Iridescent ocellus eye-spots arranged across the train
  const rows = [
    { y: 105, count: 7, r: 22 },
    { y: 185, count: 6, r: 20 },
    { y: 265, count: 5, r: 18 },
    { y: 345, count: 4, r: 16 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const cx = ((i + 0.8) / (row.count + 0.6)) * 512;
      const cy = row.y + (rand() - 0.5) * 14;
      // Bronze-gold outer halo
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.ellipse(cx, cy, row.r * 1.1, row.r * 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
      // Emerald inner ring
      ctx.fillStyle = '#34D399';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, row.r * 0.78, row.r * 0.98, 0, 0, Math.PI * 2);
      ctx.fill();
      // Deep sapphire core
      ctx.fillStyle = '#1E3A8A';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, row.r * 0.45, row.r * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finalizeTexture(key, canvas, { srgb: true });
}

export function getKangarooFurTexture(): THREE.CanvasTexture {
  const key = 'kangaroo_fur_256';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(914);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#B85430');
  grad.addColorStop(0.65, '#C96A42');
  grad.addColorStop(1, '#EED5BC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3600; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(248, 224, 198, 0.22)' : 'rgba(110, 42, 18, 0.22)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2, y + 5 + rand() * 6);
    ctx.stroke();
  }
  return finalizeTexture(key, canvas, { srgb: true });
}

export function getOtterFurTexture(): THREE.CanvasTexture {
  const key = 'otter_fur_256';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(915);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#543A29');
  grad.addColorStop(0.68, '#6B4D38');
  grad.addColorStop(1, '#CEB59C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(232, 210, 186, 0.2)' : 'rgba(42, 26, 16, 0.24)';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2, y + 4 + rand() * 7);
    ctx.stroke();
  }
  return finalizeTexture(key, canvas, { srgb: true });
}

export function getMeerkatCoatTexture(): THREE.CanvasTexture {
  const key = 'meerkat_fur_256';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256);
  const rand = seededNoise(916);
  ctx.fillStyle = '#C9A87C';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle darker dorsal desert bands
  ctx.fillStyle = 'rgba(104, 76, 48, 0.34)';
  for (let y = 36; y < 220; y += 34) {
    ctx.fillRect(0, y, 256, 11);
  }

  for (let i = 0; i < 3200; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(246, 232, 208, 0.24)' : 'rgba(92, 66, 38, 0.22)';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2, y + 4 + rand() * 5);
    ctx.stroke();
  }
  return finalizeTexture(key, canvas, { srgb: true });
}



