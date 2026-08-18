import { useEffect, useState } from 'react';

function getTone(message) {
  if (/error|failed|unavailable|nothing|not found/i.test(message)) return 'danger';
  if (/recover|warning/i.test(message)) return 'warning';
  if (/saved|loaded|copied|undone|redone/i.test(message)) return 'success';
  return 'info';
}

const toneClasses = {
  danger: 'border-[#ef6b68]/60 bg-[#3a2029] text-[#ffd9d5]',
  warning: 'border-[#e5a94f]/60 bg-[#3d3020] text-[#ffe5b2]',
  success: 'border-[#65c587]/60 bg-[#1e3a2e] text-[#d5ffe2]',
  info: 'border-[#63c9dc]/50 bg-[#18384a] text-[#d9f7ff]',
};

export default function ToastRegion({ message, onDismiss }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
  }, [message]);

  if (!message || !visible) return null;
  const tone = getTone(message);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex justify-center px-4 sm:bottom-28 sm:justify-end sm:px-6" aria-live="polite">
      <div className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md ${toneClasses[tone]}`} role="status">
        <span className="min-w-0 flex-1">{message}</span>
        <button type="button" onClick={() => { setVisible(false); onDismiss?.(); }} aria-label="Dismiss notification" className="min-h-8 min-w-8 rounded-lg bg-black/15 text-lg leading-none hover:bg-black/25">×</button>
      </div>
    </div>
  );
}
