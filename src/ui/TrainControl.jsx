import { useState, useEffect } from 'react';

/**
 * Train Control Panel - Manage individual trains
 */
export default function TrainControl({ trainManager }) {
  const [trains, setTrains] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleDelete = (trainId) => {
    trainManager.removeTrain(trainId);
    setTrains([...trainManager.getAllTrains()]);
  };

  if (trains.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">
        No trains on the map. Use the train tool (key 3) to place trains on tracks.
      </div>
    );
  }

  return (
    <div>
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-gray-700 px-2 py-1 rounded transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-semibold text-green-400">
          🚂 Trains ({trains.length})
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
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
          {trains.map((train, index) => (
            <div 
              key={train.id}
              className="bg-gray-700 rounded p-2 flex items-center justify-between"
            >
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
                  {train.active ? '⏸' : '▶'}
                </button>
                
                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(train.id)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                  title="Delete train"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
