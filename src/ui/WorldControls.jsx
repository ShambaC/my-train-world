import { useState, useEffect } from 'react';
import { cameraBus } from '../utils/cameraBus';
import { hasRecoverySnapshot, recoverySnapshotTime } from '../utils/worldSave';

/**
 * World QoL controls — undo/redo, save/load/recover, camera framing.
 * Save/Load use real user-picked files (.world = JSON); autosave/recovery
 * stay quiet in localStorage. Advisory + reversible only, no blockers.
 */
export default function WorldControls({
  history,
  terrainSize,
  onSave,
  onLoad,
  onRecover,
  onUndo,
  onRedo,
  status,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(history.canUndo());
  const [canRedo, setCanRedo] = useState(history.canRedo());
  const [recovery, setRecovery] = useState(hasRecoverySnapshot() ? recoverySnapshotTime() : null);

  // Keep button states in sync (history pushes/undo/redo happen elsewhere).
  useEffect(() => {
    const refresh = () => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
      setRecovery(hasRecoverySnapshot() ? recoverySnapshotTime() : null);
    };
    history.onChange = refresh;
    refresh();
    return () => { history.onChange = null; };
  }, [history]);

  const timeStr = (t) => (t ? new Date(t).toLocaleTimeString() : '');

  const btn = 'px-2 py-1.5 rounded text-xs font-medium transition-all';
  const btnEnabled = `${btn} bg-gray-700 hover:bg-gray-600`;
  const btnDisabled = `${btn} bg-gray-800 text-gray-600 cursor-not-allowed`;
  const btnBlue = `${btn} bg-blue-600 hover:bg-blue-700 text-white`;
  const btnGreen = `${btn} bg-green-700 hover:bg-green-600 text-white`;

  return (
    <div className="mb-4">
      <button
        className="w-full flex justify-between items-center p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-bold">🧰 World Tools</span>
        <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-gray-800 rounded space-y-3">
          {/* Undo / Redo */}
          <div className="grid grid-cols-2 gap-2">
            <button className={canUndo ? btnEnabled : btnDisabled} disabled={!canUndo} onClick={onUndo} title="Ctrl+Z">
              ↩ Undo
            </button>
            <button className={canRedo ? btnEnabled : btnDisabled} disabled={!canRedo} onClick={onRedo} title="Ctrl+Y / Ctrl+Shift+Z">
              ↪ Redo
            </button>
          </div>
          <p className="text-xs text-gray-500 -mt-1">Ctrl+Z undo • Ctrl+Y redo</p>

          {/* Save / Load / Recover */}
          <div className="grid grid-cols-2 gap-2">
            <button className={btnGreen} onClick={onSave} title="Save world to a .world file">
              💾 Save World
            </button>
            <button className={btnBlue} onClick={onLoad} title="Load a .world file">
              📂 Load File
            </button>
          </div>
          <p className="text-xs text-gray-500 -mt-1">Files are JSON with a .world extension.</p>
          {recovery && (
            <button className={btnBlue + ' w-full'} onClick={onRecover} title="Recover the last autosave snapshot">
              🛟 Recover autosave ({timeStr(recovery)})
            </button>
          )}
          {!recovery && (
            <p className="text-xs text-gray-500">Autosave runs after edits; the previous autosave is always kept as a fallback.</p>
          )}

          {/* Camera framing */}
          <div className="grid grid-cols-2 gap-2">
            <button className={btnEnabled} onClick={() => cameraBus.emit({ type: 'reset', terrainSize })}>
              🗺 Reset Overview
            </button>
            <button className={btnEnabled} onClick={() => cameraBus.emit({ type: 'frame', terrainSize })}>
              🛤 Frame Railway
            </button>
          </div>

          {status && (
            <div className="text-xs text-green-400 bg-green-900/40 rounded px-2 py-1">
              {status}
            </div>
          )}

          <p className="text-xs text-gray-500 leading-relaxed">
            Generating new terrain clears tracks, stations, trains and roads —
            the previous world is snapshotted first and stays recoverable.
          </p>
        </div>
      )}
    </div>
  );
}
