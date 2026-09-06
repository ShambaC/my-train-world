export default function TrailerOverlay({ card }) {
  if (!card) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-8 text-center text-[#f7f0df]">
      <div className="max-w-3xl drop-shadow-[0_4px_22px_rgba(0,0,0,0.7)]">
        <div className="font-sans text-[clamp(1.6rem,4vw,4rem)] font-black tracking-[0.22em] text-[#fff8e8]">
          {card.title}
        </div>
        {card.subtitle && (
          <div className="mt-4 font-serif text-[clamp(0.85rem,1.8vw,1.35rem)] tracking-[0.12em] text-[#f6dca8]">
            {card.subtitle}
          </div>
        )}
        {card.footer && (
          <div className="mt-8 font-mono text-xs tracking-[0.3em] text-[#f6dca8]/80">
            {card.footer}
          </div>
        )}
      </div>
    </div>
  );
}
