import { useRef, useState } from 'react';

export const PHOTO_LAYOUTS = [
  { key: 'carousel', label: 'Carousel', hint: 'Swipe through photos' },
  { key: 'collage',  label: 'Collage',  hint: 'Instagram style' },
  { key: 'grid',     label: 'Grid',     hint: 'One large + small' },
];

const frame = 'absolute overflow-hidden border-2 border-white shadow-lg bg-muted';

function CollageSlide({ images }) {
  const [bg, a, b] = images;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
      {a && (
        <div className={frame} style={{ left: '43%', top: '11%', width: '46%', aspectRatio: '3/4' }}>
          <img src={a} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}
      {b && (
        <div className={frame} style={{ left: '10%', top: '48%', width: '44%', aspectRatio: '3/4' }}>
          <img src={b} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}
    </div>
  );
}

function GridLayout({ images }) {
  const shown = images.slice(0, 3);
  const extra = images.length - shown.length;
  if (shown.length === 1) {
    return <img src={shown[0]} alt="" className="h-full w-full object-cover" loading="lazy" />;
  }
  return (
    <div className="grid h-full w-full gap-0.5 bg-white" style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: shown.length === 2 ? '1fr' : '1fr 1fr' }}>
      <img src={shown[0]} alt="" className="h-full w-full object-cover" style={{ gridRow: shown.length === 2 ? 'auto' : '1 / span 2' }} loading="lazy" />
      {shown.slice(1).map((src, i) => (
        <div key={src} className="relative h-full w-full">
          <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          {extra > 0 && i === shown.length - 2 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-bold text-white">+{extra}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Shared by the agency "Share package" preview and the Feed so both look the same.
 * layout: 'carousel' | 'collage' | 'grid'.  Collage = Instagram style first slide, then the rest swipe.
 */
export default function PackagePhotoLayout({ images = [], layout = 'carousel', aspect = '4/5', children }) {
  const scroller = useRef(null);
  const [index, setIndex] = useState(0);
  const list = images.filter(Boolean);
  if (!list.length) return null;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (layout === 'grid') {
    return (
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <GridLayout images={list} />
        {children}
      </div>
    );
  }

  const slides = layout === 'collage' && list.length >= 2
    ? [<CollageSlide key="collage" images={list} />, ...list.slice(1).map((src) => <img key={src} src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />)]
    : list.map((src) => <img key={src} src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />);

  return (
    <div className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: layout === 'collage' ? aspect : '4/3' }}>
      <div ref={scroller} onScroll={onScroll} className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-hide" style={{ touchAction: 'pan-x pan-y' }}>
        {slides.map((slide, i) => (
          <div key={i} className="h-full w-full shrink-0 snap-center">{slide}</div>
        ))}
      </div>
      {slides.length > 1 && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
          {index + 1}/{slides.length}
        </span>
      )}
      {children}
    </div>
  );
}
