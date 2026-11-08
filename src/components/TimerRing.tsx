export function TimerRing({ fraction, small = false }: { fraction: number; small?: boolean }) {
  return (
    <svg
      className={`timer-ring${small ? ' timer-ring--small' : ''}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle className="timer-ring-track" cx="60" cy="60" r="52" />
      <circle
        className="timer-ring-progress"
        cx="60"
        cy="60"
        r="52"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={100 * (1 - fraction)}
      />
    </svg>
  );
}
