export const TRAILER_SEED = 1337;

export const TRAILER_SHOTS = ['reveal', 'tracks', 'station', 'assembly', 'run', 'beauty', 'all'];

function parseBoolean(value, fallback) {
  if (value == null) return fallback;
  return value !== '0' && value !== 'false' && value !== 'off';
}

function parseFps(value) {
  const fps = Number(value);
  if (!Number.isFinite(fps)) return 60;
  return Math.max(24, Math.min(120, Math.round(fps)));
}

export function parseTrailerConfig(search = typeof window === 'undefined' ? '' : window.location.search) {
  const params = new URLSearchParams(search);
  const requestedShot = params.get('trailer');
  const enabled = TRAILER_SHOTS.includes(requestedShot);

  return {
    enabled,
    shot: enabled ? requestedShot : null,
    autoplay: parseBoolean(params.get('autoplay'), true),
    fps: parseFps(params.get('fps')),
    debug: parseBoolean(params.get('debug'), false),
    seed: TRAILER_SEED,
  };
}

export const trailerConfig = parseTrailerConfig();
