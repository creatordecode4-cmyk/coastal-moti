// Look-and-feel presets. A level picks one; engine.setEnvironment() applies it.
export const ENV_DAY = {
  zenith: 0x2f7fc4, horizon: 0xf4e2c6, sun: 0xfff1c9, sunDisc: 1,
  hemi: [0xcfe8ff, 0x6b6a4a, 1.1], sunIntensity: 1.7,
  sea: { deep: 0x0b4f6c, shallow: 0x2fa7a0, amp: 0.22, speed: 1 },
  fog: null, rain: 0, lightning: false, ambientSound: null,
};

// Monsoon night. Bright enough to read on a phone screen; the mood comes from colour, rain and fog.
export const ENV_STORM_NIGHT = {
  zenith: 0x060a13, horizon: 0x1d2b3b, sun: 0x9db4d6, sunDisc: 0,
  hemi: [0x8fa6cc, 0x232c3a, 1.0], sunIntensity: 0.75,
  sea: { deep: 0x050f18, shallow: 0x17384c, amp: 0.85, speed: 1.9 },
  fog: { color: 0x1d2b3b, near: 22, far: 150 },
  rain: 1, lightning: true, ambientSound: 'storm',
};

// Open sea at night, same storm but thinner rain and longer sight so searchlights read from far away.
export const ENV_SEA_NIGHT = {
  ...ENV_STORM_NIGHT,
  hemi: [0x8fa6cc, 0x232c3a, 1.05],
  sea: { deep: 0x0a2233, shallow: 0x2c6a84, amp: 0.45, speed: 1.5 },
  fog: { color: 0x1d2b3b, near: 35, far: 210 },
  rain: 0.6,
};

// Dawn after the storm night: low sun in the east, warm haze, a last thin rain.
export const ENV_DAWN = {
  zenith: 0x2b4a78, horizon: 0xf0b07a, sun: 0xffd9a8, sunDisc: 1,
  sunDir: [0.93, 0.2, 0.33],
  hemi: [0xc9d6ea, 0x4f463a, 0.95], sunIntensity: 1.3,
  sea: { deep: 0x123a50, shallow: 0x4a97a0, amp: 0.3, speed: 1.1 },
  fog: { color: 0xe3a878, near: 45, far: 270 },
  rain: 0.15, lightning: false, ambientSound: 'storm',
};
