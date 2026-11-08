// Visual themes per world (levels 1-10 -> world 0, 11-20 -> world 1, ... repeating every 6 worlds).
export const PALETTES = [
  { name: 'Dusk',   bg: 0x0e1424, base: 0x182036, floorA: 0x26324f, floorB: 0x2c3a5c, wall: 0x7aa2ff, goal: 0x4ade80, stripe: '#3b82f6' },
  { name: 'Ember',  bg: 0x1a0f12, base: 0x2a1519, floorA: 0x3a2128, floorB: 0x442a32, wall: 0xff8a5c, goal: 0x5eead4, stripe: '#f97316' },
  { name: 'Forest', bg: 0x0b1712, base: 0x13261d, floorA: 0x1f3a2c, floorB: 0x254434, wall: 0x8be28b, goal: 0xfde047, stripe: '#22c55e' },
  { name: 'Candy',  bg: 0x1a1024, base: 0x2a1838, floorA: 0x3b2450, floorB: 0x442b5c, wall: 0xff7ad9, goal: 0x67e8f9, stripe: '#ec4899' },
  { name: 'Ocean',  bg: 0x07181f, base: 0x0e2a35, floorA: 0x16414f, floorB: 0x1b4a5a, wall: 0x5ee0e6, goal: 0xfb923c, stripe: '#06b6d4' },
  { name: 'Slate',  bg: 0x14161a, base: 0x1f2329, floorA: 0x2e343d, floorB: 0x353c46, wall: 0xe5e7eb, goal: 0xf472b6, stripe: '#a3a3a3' },
];
export const paletteFor = world => PALETTES[((world % PALETTES.length) + PALETTES.length) % PALETTES.length];
