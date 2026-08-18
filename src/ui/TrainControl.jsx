import { useState, useEffect } from 'react';
import { cameraBus } from '../utils/cameraBus';
import { clone } from '../utils/editActions';
import { UI_ICONS } from './iconRegistry';

/**
 * Train Control Panel - Manage individual trains + global speed setting.
 * All controls are permissive: no route, coach-type or network rules.
 */
export default function TrainControl({ trainManager, followTrainId = null, onFollowTrain, history }) {
  const [trains, setTrains] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speed, setSpeed] = useState(trainManager.globalSpeed ?? 0.5);

  // Update trains list periodically
  useEffect(() => {
    const updateTrains = () => {
      setTrains([...trainManager.getAllTrains()]);
    };

    updateTrains();
    const interval = setInterval(updateTrains, 500);
    return () => clearInterval(interval);
  }, [trainManager]);

  const handleToggle = (trainId) => {
    trainManager.toggleTrain(trainId);
    setTrains([...trainManager.getAllTrains()]);
  };

  const handleReverse = (trainId) => {
    trainManager.reverseTrain(trainId);
  };

  const handleDelete = (trainId) => {
    const train = trainManager.getTrain(trainId);
    if (!train) return;
    if (history) {
      const snap = clone(train);
      history.push({
        undo: () => trainManager.restoreTrain(snap),
        redo: () => trainManager.removeTrain(trainId),
      });
    }
    trainManager.removeTrain(trainId);
    setTrains([...trainManager.getAllTrains()]);
  };

  const handleRemoveCoach = (trainId, coachId) => {
    const train = trainManager.getTrain(trainId);
    if (!train) return;
    const idx = train.coaches.findIndex((c) => c.id === coachId);
    const coach = train.coaches[idx];
    if (idx < 0) return;
    if (history) {
      history.push({
        undo: () => trainManager.restoreCoach(trainId, coach, idx),
        redo: () => trainManager.removeCoach(trainId, coachId),
      });
    }
    trainManager.removeCoach(trainId, coachId);
    setTrains([...trainManager.getAllTrains()]);
  };

  const speedSlider = (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-300 mb-1">
         <span className="inline-flex items-center gap-1"><img src={UI_ICONS.trainControls.speedSlow} alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> Train Speed: {speed.toFixed(2)} <img src={UI_ICONS.trainControls.speedFast} alt="" aria-hidden="true" className="h-4 w-4 object-contain" /></span>
      </label>
      <input
        type="range"
        min="0.1"
        max="1.5"
        step="0.05"
        value={speed}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setSpeed(v);
          trainManager.setGlobalSpeed(v);
        }}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Leisurely</span>
        <span>Express</span>
      </div>
    </div>
  );

  if (trains.length === 0) {
    return (
      <div>
        {speedSlider}
        <div className="text-xs text-gray-400 py-2">
          No trains on the map. Use the train tool (key 5) to place trains on tracks.
        </div>
      </div>
    );
  }

  return (
    <div>
      {speedSlider}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-gray-700 px-2 py-1 rounded transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-semibold text-green-400">
           Trains ({trains.length})
        </h3>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
          {trains.map((train, index) => (
            <div key={train.id} className="bg-gray-700 rounded p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-white text-sm font-mono">
                    Train {index + 1}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    train.active
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {train.active ? 'Moving' : 'Stopped'}
                  </span>
                </div>

                <div className="flex gap-1">
                  {/* Focus Camera */}
                  <button
                    onClick={() => cameraBus.emit({ type: 'focus', target: train.position, distance: 3.5 })}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors bg-gray-600 hover:bg-gray-500 text-white"
                    title="Focus camera on this train"
                  >
                     <img src={UI_ICONS.trainControls.focus} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                  </button>

                  {/* Follow Camera Toggle */}
                  <button
                    onClick={() => onFollowTrain && onFollowTrain(followTrainId === train.id ? null : train.id)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      followTrainId === train.id
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-500 text-white'
                    }`}
                    title={followTrainId === train.id ? 'Stop following train' : 'Follow train with camera'}
                  >
                     <img src={UI_ICONS.trainControls.follow} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                  </button>

                  {/* Reverse */}
                  <button
                    onClick={() => handleReverse(train.id)}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors bg-gray-600 hover:bg-gray-500 text-white"
                    title="Reverse direction"
                  >
                     <img src={UI_ICONS.trainControls.reverse} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                  </button>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggle(train.id)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      train.active
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                    title={train.active ? 'Stop train' : 'Start train'}
                  >
                     <img src={train.active ? UI_ICONS.trainControls.stop : UI_ICONS.trainControls.start} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(train.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                    title="Delete train"
                  >
                     <img src={UI_ICONS.trainControls.deleteCoach} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                  </button>
                </div>
              </div>

              {/* Coach list — remove any coach, no route requirements */}
              {(train.coaches || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(train.coaches || []).map((coach) => (
                    <span key={coach.id} className="inline-flex items-center gap-1 bg-gray-800 rounded px-1.5 py-0.5 text-xs text-gray-300">
                      {coach.type}
                      <button
                        onClick={() => handleRemoveCoach(train.id, coach.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove coach"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
