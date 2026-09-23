// Фон с плавающими волнами в фирменном синем (#3185FC) — один на все страницы.
// Каждый слой — повторяющаяся волна шириной 2 экрана, которая бесконечно сдвигается на половину,
// поэтому шов не виден. Слои движутся с разной скоростью и слегка «покачиваются» по вертикали.
import "./waves.css";

// Период волны 720; путь и viewBox — 2880 (4 периода) при ширине SVG 200%, сдвиг на -50% = 2 периода — шва нет.
function wavePath(amplitude: number, baseline: number): string {
  const a = amplitude;
  let d = `M0 ${baseline}`;
  for (let x = 0; x < 2880; x += 720) {
    d += ` C${x + 180} ${baseline - a} ${x + 360} ${baseline - a} ${x + 360} ${baseline}`;
    d += ` S${x + 540} ${baseline + a} ${x + 720} ${baseline}`;
  }
  return `${d} V400 H0 Z`;
}

const LAYERS = [
  { amp: 34, base: 150, opacity: 0.1, duration: 38, bob: 9 },
  { amp: 26, base: 200, opacity: 0.08, duration: 26, bob: 7 },
  { amp: 20, base: 250, opacity: 0.11, duration: 18, bob: 5 },
];

export default function Waves() {
  return (
    <div className="waves" aria-hidden="true">
      <div className="waves-glow" />
      <div className="waves-band waves-band-top">
        {LAYERS.slice(0, 2).map((l, i) => (
          <svg key={i} className="wave" viewBox="0 0 2880 400" preserveAspectRatio="none" style={{ animationDuration: `${l.duration * 1.3}s, ${l.bob}s` }}>
            <path d={wavePath(l.amp, l.base)} fill="#3185FC" fillOpacity={l.opacity * 0.6} />
          </svg>
        ))}
      </div>
      <div className="waves-band waves-band-bottom">
        {LAYERS.map((l, i) => (
          <svg key={i} className="wave" viewBox="0 0 2880 400" preserveAspectRatio="none" style={{ animationDuration: `${l.duration}s, ${l.bob}s` }}>
            <path d={wavePath(l.amp, l.base)} fill="#3185FC" fillOpacity={l.opacity} />
          </svg>
        ))}
      </div>
    </div>
  );
}
