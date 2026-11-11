// The five murals of the sea-fort, in story order. Each is a simple original picture (inline SVG,
// 400 x 220) with one short caption. The last one is the twist of the whole story:
// the Chandramoti pearl was never treasure, it was the light of the Diya-Ghar.

const sea = '<rect width="400" height="220" fill="#17364a"/><path d="M0 150 Q50 138 100 150 T200 150 T300 150 T400 150 V220 H0Z" fill="#1f5a70"/>';
const ship = (x, y, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30 0 H30 L20 14 H-20Z" fill="${c}"/><rect x="-1.5" y="-34" width="3" height="34" fill="${c}"/><path d="M2 -32 L24 -6 H2Z" fill="${c}"/></g>`;
const hut = (x, y, c) => `<g transform="translate(${x} ${y})"><rect x="-10" y="-10" width="20" height="12" fill="${c}"/><path d="M-13 -10 L0 -22 L13 -10Z" fill="#7a3f2a"/></g>`;
const queen = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-9 30 L-6 -4 H6 L9 30Z" fill="#e8a33d"/><circle cy="-11" r="7" fill="#b9805a"/><path d="M-8 -17 L-5 -25 L0 -19 L5 -25 L8 -17Z" fill="#ffd27a"/></g>`;

export const MURALS = [
  { caption: "Rani Chandravati's ships guarded this coast.",
    svg: `${sea}<path d="M0 150 L0 110 Q60 96 120 118 L150 150Z" fill="#3f6a4a"/>${hut(40, 122, '#d9c7a3')}${hut(72, 128, '#d9c7a3')}${ship(210, 140, '#e8d9b0', 1.2)}${ship(300, 146, '#e8d9b0', 0.9)}${queen(110, 96)}` },
  { caption: 'Foreign ships came to loot the villages.',
    svg: `${sea}<path d="M0 150 L0 110 Q60 96 120 118 L150 150Z" fill="#3f6a4a"/>${hut(40, 122, '#d9c7a3')}${hut(72, 128, '#d9c7a3')}<path d="M36 100 Q42 84 40 70 Q52 86 46 104Z" fill="#ff8a2f"/><path d="M70 106 Q78 92 74 80 Q86 94 80 110Z" fill="#ff8a2f"/>${ship(250, 138, '#14161b', 1.5)}${ship(340, 146, '#14161b', 1.1)}` },
  { caption: 'She stopped them and made them pay a toll.',
    svg: `${sea}${ship(120, 140, '#e8d9b0', 1.3)}${ship(290, 142, '#14161b', 1.3)}<path d="M160 120 H250" stroke="#ffd27a" stroke-width="3" stroke-dasharray="8 6"/><circle cx="205" cy="104" r="9" fill="#ffd27a"/><circle cx="222" cy="98" r="6" fill="#ffd27a"/>${queen(120, 86)}` },
  { caption: 'So they called her a pirate.',
    svg: `<rect width="400" height="220" fill="#241a22"/>${queen(200, 100)}<path d="M40 40 H150 V90 H40Z" fill="#e8d9b0"/><path d="M52 56 H138 M52 68 H120 M52 80 H130" stroke="#3a2a12" stroke-width="3"/><path d="M250 40 H360 V90 H250Z" fill="#e8d9b0"/><path d="M262 56 H348 M262 68 H330 M262 80 H340" stroke="#3a2a12" stroke-width="3"/><path d="M150 65 L185 86 M250 65 L215 86" stroke="#8f3a2e" stroke-width="3"/>` },
  { twist: true, caption: 'The Chandramoti was never treasure. It was the light of the Diya-Ghar.',
    svg: `<rect width="400" height="220" fill="#0b1826"/><path d="M0 170 Q100 158 200 170 T400 170 V220 H0Z" fill="#12344a"/><path d="M188 170 L194 70 H206 L212 170Z" fill="#d8d4c8"/><rect x="186" y="52" width="28" height="20" fill="#3a3f47"/><path d="M182 52 L200 36 L218 52Z" fill="#7a2f25"/><circle cx="200" cy="62" r="8" fill="#fff6e0"/><circle cx="200" cy="62" r="20" fill="#ffd27a" opacity=".35"/><path d="M208 60 L400 20 V96Z" fill="#ffe9a8" opacity=".3"/><path d="M192 60 L0 20 V96Z" fill="#ffe9a8" opacity=".3"/>${queen(150, 136)}${ship(320, 164, '#e8d9b0', 0.8)}` },
];
