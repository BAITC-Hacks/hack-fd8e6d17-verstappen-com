// Общие элементы интерфейса: бейджи уровней, кольцо рейтинга, расшифровка баллов.
// Их можно использовать и в экранах бизнеса.
import { useEffect, useState } from "react";
import { LEVEL_LABELS, STATUS_LABELS, type Level, type ScoreResult, type TaskStatus } from "../api";

export function LevelBadge({ level }: { level: Level }) {
  return <span className={`tm-level tm-level-${level}`}>{LEVEL_LABELS[level]}</span>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`tm-status tm-status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="tm-ring" style={{ width: size, height: size }} aria-label={`Рейтинг ${score} из 100`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className="tm-ring-track" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="tm-ring-value"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <strong>{score}</strong>
    </div>
  );
}

export function ScoreBreakdown({ detail }: { detail: ScoreResult }) {
  return (
    <div className="tm-breakdown">
      {detail.breakdown.map((c) => (
        <div key={c.key} className="tm-crit">
          <div className="tm-crit-head">
            <span>{c.label}</span>
            <b>
              {c.points}/{c.weight}
            </b>
          </div>
          <div className="tm-bar">
            <i style={{ width: `${(c.points / c.weight) * 100}%` }} />
          </div>
          {c.points < c.weight && <small>{c.reason}</small>}
        </div>
      ))}
    </div>
  );
}

export function Loader({ text = "Загрузка…" }: { text?: string }) {
  return <div className="tm-empty">{text}</div>;
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="tm-error" role="alert">
      {error}
      {onRetry && (
        <button className="tm-link" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

// Простой хук загрузки данных: { data, error, loading, reload }
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
