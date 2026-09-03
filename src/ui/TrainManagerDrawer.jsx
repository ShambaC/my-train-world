import { useEffect, useState } from 'react';
import { cameraBus } from '../utils/cameraBus';
import { clone } from '../utils/editActions';
import { UI_ICONS } from './iconRegistry';
import { trainAudio } from '../audio/trainAudio';
import { MAX_TRAIN_SPEED, MIN_TRAIN_SPEED, TRAIN_SPEED_STEP } from '../trains/TrainManager.js';

const statusFor = (train) => train.dwell ? 'Dwelling' : train.active ? 'Moving' : 'Stopped';

export default function TrainManagerDrawer({
  trainManager,
  followTrainId = null,
  onFollowTrain,
  history,
  onClose,
  onSpeedChange,
}) {
  const [trains, setTrains] = useState([]);

  useEffect(() => {
    const refresh = () => setTrains(trainManager.getAllTrains().map((train) => ({ ...train, coaches: [...(train.coaches || [])] })));
    refresh();
    const interval = setInterval(refresh, 250);
    return () => clearInterval(interval);
  }, [trainManager]);

  const handleToggle = (trainId) => {
    trainManager.toggleTrain(trainId);
    setTrains(trainManager.getAllTrains().map((train) => ({ ...train, coaches: [...(train.coaches || [])] })));
  };

  const handleDelete = (trainId) => {
    const train = trainManager.getTrain(trainId);
    if (!train) return;
    const snap = clone(train);
    history?.push({
      undo: () => trainManager.restoreTrain(clone(snap)),
      redo: () => trainManager.removeTrain(trainId),
    });
    trainManager.removeTrain(trainId);
    if (followTrainId === trainId) onFollowTrain?.(null);
    trainAudio.deleted('train');
  };

  const handleRemoveCoach = (trainId, coachId) => {
    const train = trainManager.getTrain(trainId);
    const index = train?.coaches.findIndex((coach) => coach.id === coachId) ?? -1;
    if (!train || index < 0) return;
    const coach = train.coaches[index];
    history?.push({
      undo: () => trainManager.restoreCoach(trainId, clone(coach), index),
      redo: () => trainManager.removeCoach(trainId, coachId),
    });
    trainManager.removeCoach(trainId, coachId);
    trainAudio.coachRemoved();
  };

  return (
    <aside
      className="pointer-events-auto fixed right-3 top-[5.4rem] z-50 flex max-h-[calc(100dvh-10rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-2xl border border-white/10 bg-[#101a2b]/95 text-[#f7f0df] shadow-2xl backdrop-blur-xl"
      aria-labelledby="train-manager-title"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Live operations</p>
          <h2 id="train-manager-title" className="mt-1 text-xl font-bold">Train management</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close train management" className="min-h-10 min-w-10 rounded-xl bg-white/10 text-2xl leading-none hover:bg-white/20">×</button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {trains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-sm text-[#aebbd0]">
            <p className="font-semibold text-[#f7f0df]">No trains in this world.</p>
            <p className="mt-2">Choose <strong>Trains → Engine</strong> to place one on track.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trains.map((train, index) => {
              const status = statusFor(train);
              return (
                <section key={train.id} className="rounded-xl border border-white/10 bg-[#18263b] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-mono text-sm font-bold">Train {index + 1}</h3>
                      <p className="mt-0.5 text-xs text-[#aebbd0]">{train.engineType}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${status === 'Moving' ? 'bg-[#276f4a] text-white' : status === 'Dwelling' ? 'bg-[#846b2b] text-white' : 'bg-[#34445a] text-[#c5d0df]'}`}>{status}</span>
                  </div>

                  <label className="mt-3 block text-xs font-semibold text-[#c5d0df]" htmlFor={`train-speed-${train.id}`}>
                    Target speed: {Number(train.speedMax ?? 0.5).toFixed(2)}
                  </label>
                  <input
                    id={`train-speed-${train.id}`}
                    type="range"
                    min={MIN_TRAIN_SPEED}
                    max={MAX_TRAIN_SPEED}
                    step={TRAIN_SPEED_STEP}
                    value={train.speedMax ?? 0.5}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (trainManager.setTrainSpeed(train.id, value)) onSpeedChange?.();
                    }}
                    className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-[#63c9dc]"
                  />
                  <div className="flex justify-between text-[10px] text-[#7f90a8]"><span>0.10</span><span>1.50</span></div>

                  <div className="mt-3 grid grid-cols-5 gap-1">
                    <button type="button" onClick={() => cameraBus.emit({ type: 'focus', target: train.position, distance: 3.5 })} aria-label={`Focus Train ${index + 1}`} title="Focus camera" className="rounded-lg bg-[#34445a] p-2 hover:bg-[#465a73]"><img src={UI_ICONS.trainControls.focus} alt="" aria-hidden="true" className="mx-auto h-4 w-4 object-contain" /></button>
                    <button type="button" onClick={() => onFollowTrain?.(followTrainId === train.id ? null : train.id)} aria-label={followTrainId === train.id ? `Unfollow Train ${index + 1}` : `Follow Train ${index + 1}`} title={followTrainId === train.id ? 'Unfollow train' : 'Follow train'} className={`rounded-lg p-2 ${followTrainId === train.id ? 'bg-purple-600' : 'bg-[#34445a] hover:bg-[#465a73]'}`}><img src={UI_ICONS.trainControls.follow} alt="" aria-hidden="true" className="mx-auto h-4 w-4 object-contain" /></button>
                    <button type="button" onClick={() => trainManager.reverseTrain(train.id)} aria-label={`Reverse Train ${index + 1}`} title="Reverse direction" className="rounded-lg bg-[#34445a] p-2 hover:bg-[#465a73]"><img src={UI_ICONS.trainControls.reverse} alt="" aria-hidden="true" className="mx-auto h-4 w-4 object-contain" /></button>
                    <button type="button" onClick={() => handleToggle(train.id)} aria-label={train.active ? `Stop Train ${index + 1}` : `Start Train ${index + 1}`} title={train.active ? 'Stop train' : 'Start train'} className={`rounded-lg p-2 ${train.active ? 'bg-[#846b2b]' : 'bg-[#276f4a]'} hover:brightness-110`}><img src={train.active ? UI_ICONS.trainControls.stop : UI_ICONS.trainControls.start} alt="" aria-hidden="true" className="mx-auto h-4 w-4 object-contain" /></button>
                    <button type="button" onClick={() => handleDelete(train.id)} aria-label={`Delete Train ${index + 1}`} title="Delete train" className="rounded-lg bg-[#8f3b3b] p-2 hover:bg-[#ad4949]"><img src={UI_ICONS.trainControls.deleteCoach} alt="" aria-hidden="true" className="mx-auto h-4 w-4 object-contain" /></button>
                  </div>

                  {(train.coaches || []).length > 0 && <div className="mt-3 flex flex-wrap gap-1"><span className="sr-only">Coaches</span>{train.coaches.map((coach) => <span key={coach.id} className="inline-flex items-center gap-1 rounded bg-[#101a2b] px-2 py-1 text-[10px] text-[#c5d0df]">{coach.type}<button type="button" onClick={() => handleRemoveCoach(train.id, coach.id)} aria-label={`Remove ${coach.type} coach`} className="text-[#ef6b68] hover:text-white">×</button></span>)}</div>}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
