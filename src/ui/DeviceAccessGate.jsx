import { useEffect, useState } from 'react';
import { UI_ICONS } from './iconRegistry';

function detectMobileDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const mobileUA = navigator.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(userAgent);
  const touchDevice = navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrowViewport = Math.min(window.innerWidth, window.innerHeight) < 900;
  return mobileUA || (touchDevice && coarsePointer && narrowViewport);
}

function isPortrait() {
  return typeof window !== 'undefined'
    ? window.matchMedia?.('(orientation: portrait)').matches ?? window.innerHeight > window.innerWidth
    : false;
}

export default function DeviceAccessGate({ children }) {
  const [device, setDevice] = useState(() => ({ mobile: detectMobileDevice(), portrait: isPortrait() }));
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const update = () => setDevice({ mobile: detectMobileDevice(), portrait: isPortrait() });
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!device.mobile || (approved && !device.portrait)) return children;

  const confirmation = !device.portrait;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-y-auto bg-[#0b1422] px-5 py-8 text-[#f7f0df]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(75,141,255,0.24),transparent_45%),linear-gradient(145deg,#0b1422,#18263b)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#101a2b]/95 p-7 text-center shadow-2xl backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="device-gate-title">
        <img src={UI_ICONS.brandMark} alt="" aria-hidden="true" className="mx-auto h-16 w-16 object-contain" draggable={false} />
        <h1 id="device-gate-title" className="mt-4 text-2xl font-bold">
          {confirmation ? 'Continue on mobile?' : 'Rotate device'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#c5d0df]">
          MyTrainWorld is made primarily for keyboard and mouse. Touch controls are limited and mobile play may feel difficult.
        </p>
        {!confirmation ? (
          <p className="mt-3 rounded-xl border border-[#e5a94f]/40 bg-[#244b67]/40 px-4 py-3 text-sm font-semibold text-[#f7f0df]">
            Rotate your device to landscape to continue.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={() => setApproved(true)} className="min-h-12 rounded-xl bg-[#e5a94f] px-5 py-3 font-bold text-[#101a2b] hover:bg-[#f1bd63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7f0df]">
              Continue on mobile
            </button>
            <p className="text-xs text-[#aebbd0]">For full controls, use a keyboard and mouse on a desktop device.</p>
          </div>
        )}
      </section>
    </main>
  );
}
