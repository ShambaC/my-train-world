const event = (at, action, value = null) => ({ at, action, value });

export function createTrailerSequences(layout) {
  const trackEvents = layout.route.map((_, index) => event(1.1 + index * 0.13, 'add-track', index));

  return {
    reveal: {
      id: 'reveal',
      duration: 5,
      cameraMode: 'reveal',
      card: { title: 'BUILD YOUR RAILWAY', subtitle: 'A tiny world, waiting to move.' },
      events: [event(0, 'environment', 'dawn'), event(3.9, 'card', null)],
    },
    tracks: {
      id: 'tracks',
      duration: 7.5,
      cameraMode: 'tracks',
      card: { title: 'BUILD YOUR RAILWAY', subtitle: 'Lay it piece by piece.' },
      events: [event(0, 'environment', 'dawn'), ...trackEvents, event(6.4, 'card', null)],
    },
    station: {
      id: 'station',
      duration: 6,
      cameraMode: 'station',
      card: { title: 'SHAPE A WORLD', subtitle: 'Give every route a place to stop.' },
      events: [
        event(0, 'environment', 'day'),
        event(1.15, 'add-station'),
        event(5.0, 'card', null),
      ],
    },
    assembly: {
      id: 'assembly',
      duration: 6,
      cameraMode: 'assembly',
      card: { title: 'BUILD THE TRAIN', subtitle: 'Engine, coaches, possibility.' },
      events: [
        event(0, 'environment', 'day'),
        event(1.15, 'add-train'),
        event(1.52, 'add-coach', 'passenger-coach'),
        event(1.82, 'add-coach', 'container-coach'),
        event(2.12, 'add-coach', 'viewdeck-coach'),
        event(2.8, 'start-train'),
        event(5.0, 'card', null),
      ],
    },
    run: {
      id: 'run',
      duration: 10,
      cameraMode: 'run',
      card: { title: 'WATCH IT COME ALIVE', subtitle: 'Build. Connect. Watch it run.' },
      events: [
        event(0, 'environment', 'day'),
        event(1.0, 'start-train'),
        event(8.7, 'card', null),
      ],
    },
    beauty: {
      id: 'beauty',
      duration: 10,
      cameraMode: 'beauty',
      card: null,
      events: [
        event(0, 'environment', 'day'),
        event(0.7, 'start-train'),
        event(3.2, 'environment', 'dusk'),
        event(6.2, 'environment', 'night'),
        event(8.5, 'finale'),
      ],
    },
    all: {
      id: 'all',
      duration: 30,
      cameraMode: 'all',
      card: { title: 'BUILD YOUR RAILWAY', subtitle: 'A 30-second MyTrainWorld preview.' },
      events: [
        event(0, 'environment', 'dawn'),
        ...trackEvents,
        event(7.0, 'add-station'),
        event(8.8, 'card', { title: 'BUILD THE TRAIN', subtitle: 'Engine, coaches, possibility.' }),
        event(9.0, 'add-train'),
        event(9.35, 'add-coach', 'passenger-coach'),
        event(9.65, 'add-coach', 'container-coach'),
        event(9.95, 'add-coach', 'viewdeck-coach'),
        event(10.45, 'add-crossing'),
        event(10.7, 'start-train'),
        event(12.0, 'card', { title: 'WATCH IT COME ALIVE', subtitle: 'Build. Connect. Watch it run.' }),
        event(19.0, 'environment', 'dusk'),
        event(23.0, 'environment', 'night'),
        event(26.5, 'card', null),
        event(28.0, 'finale'),
      ],
    },
  };
}

export const TRAILER_SHOT_ORDER = ['reveal', 'tracks', 'station', 'assembly', 'run', 'beauty'];
