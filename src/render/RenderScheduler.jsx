import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Render scheduler — controls render pacing from the performance settings.
 * Canvas must use `frameloop="never"`; this component drives R3F's
 * `advance()` manually so the frame limit actually changes when frames are
 * produced, not just what the FPS counter shows.
 *
 * - vsync on: requestAnimationFrame loop (browser-synchronized frames).
 * - vsync off: setTimeout-paced loop (app-controlled pacing). Browsers and
 *   Tauri webviews may still synchronize presentation to the monitor, so
 *   this is best-effort rather than a hard guarantee.
 * - frameLimit 0 = uncapped (every tick renders).
 *
 * Simulation is delta-time based, so train speed, smoke, water and camera
 * movement stay identical at every limit.
 */
export default function RenderScheduler({ frameLimit, vsync, paused = false }) {
  const advance = useThree((state) => state.advance);
  const limitRef = useRef(frameLimit);
  const vsyncRef = useRef(vsync);

  limitRef.current = frameLimit;
  vsyncRef.current = vsync;

  useEffect(() => {
    if (paused) return undefined;
    let rafId = 0;
    let timerId = 0;
    let lastFrame = performance.now();

    const renderIfDue = () => {
      const now = performance.now();
      const step = limitRef.current > 0 ? 1000 / limitRef.current : 0;
      if (now - lastFrame >= step - 0.5) {
        lastFrame = now;
        // R3F's clock is in seconds — advance() must receive seconds or the
        // simulation delta gets inflated by ~1000x.
        advance(now / 1000, true);
      }
    };

    const loop = () => {
      rafId = 0;
      timerId = 0;
      renderIfDue();
      schedule();
    };

    const schedule = () => {
      if (vsyncRef.current) {
        rafId = requestAnimationFrame(loop);
      } else {
        const step = limitRef.current > 0 ? 1000 / limitRef.current : 0;
        if (step <= 0) {
          timerId = setTimeout(loop, 0);
          return;
        }
        // Target-time scheduling: aim at the next frame slot instead of
        // "sleep for a step", so late-firing timers self-correct instead
        // of accumulating lag.
        const next = lastFrame + step;
        timerId = setTimeout(loop, Math.max(0, next - performance.now()));
      }
    };

    schedule();
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [advance, paused]);

  return null;
}
