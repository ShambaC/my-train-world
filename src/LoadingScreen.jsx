import { UI_ICONS } from './ui/iconRegistry';
import menuArt from './assets/ui/ui-menu-key-art.png';

export default function LoadingScreen({ progress }) {
  const display = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#08101c]">
      <img src={menuArt} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-[#08101c]/65" />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#101a2b]/90 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-7">
          <img
            src={UI_ICONS.brandMark}
            alt=""
            aria-hidden="true"
            className="mx-auto mb-4 h-20 w-20 object-contain"
            draggable={false}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Preparing your railway</p>
          <p className="mt-2 text-lg text-[#f7f0df]">Loading models and scenery</p>
        </div>

        {/* Progress Bar */}
        <div className="mx-auto w-full max-w-md">
          <div className="h-3 overflow-hidden rounded-full bg-[#18263b]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4b8dff] to-[#65c587] transition-all duration-300 ease-out"
              style={{ width: `${display}%` }}
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-[#aebbd0]">
            <img src={UI_ICONS.status.loading} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
            {display}% Complete
          </p>
        </div>

        {/* Loading Tips */}
        <div className="mx-auto mt-7 max-w-md text-sm text-[#aebbd0]">
          <p>
            {display >= 100
              ? 'Models loaded — entering the world...'
              : 'Loading models and scenery...'}
          </p>
        </div>
      </div>
    </div>
  );
}
