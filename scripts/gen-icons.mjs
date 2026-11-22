// Generuje ikony aplikacji (PNG) z oryginalnej maskotki "Pestka" narysowanej w SVG.
// Uruchom: npm run icons   (wynik trafia do folderu public/)
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

/** Maskotka: żółta pestka z dwoma listkami. `scale` pozwala zostawić margines (ikona maskable). */
const mascot = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 150 C 250 110, 215 80, 170 86 C 180 128, 215 150, 256 150 Z" fill="#2b8a00"/>
    <path d="M256 150 C 262 100, 300 70, 352 78 C 340 126, 300 152, 256 150 Z" fill="#46b800"/>
    <rect x="248" y="120" width="16" height="44" rx="8" fill="#2b8a00"/>
    <ellipse cx="256" cy="300" rx="150" ry="140" fill="#e6a700"/>
    <ellipse cx="256" cy="288" rx="150" ry="136" fill="#ffd43b"/>
    <ellipse cx="200" cy="215" rx="38" ry="22" fill="#fff3bf" transform="rotate(-25 200 215)"/>
    <ellipse cx="205" cy="285" rx="24" ry="30" fill="#1f2a30"/>
    <ellipse cx="307" cy="285" rx="24" ry="30" fill="#1f2a30"/>
    <circle cx="213" cy="274" r="9" fill="#fff"/>
    <circle cx="315" cy="274" r="9" fill="#fff"/>
    <ellipse cx="165" cy="330" rx="22" ry="13" fill="#ff8fa3" opacity=".75"/>
    <ellipse cx="347" cy="330" rx="22" ry="13" fill="#ff8fa3" opacity=".75"/>
    <path d="M226 330 Q256 362 286 330" stroke="#1f2a30" stroke-width="12" stroke-linecap="round" fill="none"/>
  </g>`;

const icon = (scale, rounded = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6fdc14"/><stop offset="1" stop-color="#4fb800"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
  ${mascot(scale)}
</svg>`;

const out = 'public/';
const render = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out + file);

await render(icon(1.05), 180, 'apple-touch-icon.png'); // iOS sam zaokrągla rogi
await render(icon(1.05), 192, 'icon-192.png');
await render(icon(1.05), 512, 'icon-512.png');
await render(icon(0.8), 512, 'icon-maskable-512.png'); // margines bezpieczeństwa dla Androida
await writeFile(out + 'favicon.svg', icon(1.05, true));
console.log('Ikony wygenerowane w public/');
