import { UI_ICONS } from './ui/iconRegistry';

export default function LoadingScreen({ progress }) {
  const display = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Logo/Title */}
        <div className="mb-8">
          <img
            src={UI_ICONS.brandMark}
            alt=""
            aria-hidden="true"
            className="w-24 h-24 object-contain mx-auto mb-3 animate-pulse"
            draggable={false}
          />
          <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">
            MyTrainWorld
          </h1>
          <p className="text-xl text-gray-300">
            Building your railway empire...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-96 mx-auto">
          <div className="bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${display}%` }}
            />
          </div>
          <p className="text-gray-400 mt-3 text-sm">
            {display}% Complete
          </p>
        </div>

        {/* Loading Tips */}
        <div className="mt-8 text-gray-400 text-sm max-w-md mx-auto">
          <p className="italic">
            {display >= 100
              ? 'Models loaded — entering the world...'
              : 'Loading models and scenery...'}
          </p>
        </div>
      </div>
    </div>
  );
}
