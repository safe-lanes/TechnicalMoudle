interface SemiCircleGaugeProps {
  value: number;
  max: number;
  color: string;
  label: string;
  displayValue?: string;
  subtitle?: string;
  statLine?: string;
  onClick?: () => void;
  testId?: string;
}

export function SemiCircleGauge({
  value,
  max,
  color,
  label,
  displayValue,
  subtitle,
  statLine,
  onClick,
  testId,
}: SemiCircleGaugeProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const radius = 70;
  const strokeWidth = 10;
  const cx = 100;
  const cy = 85;
  const startAngle = Math.PI;
  const endAngle = 0;
  const circumference = Math.PI * radius;
  const fillLength = (percentage / 100) * circumference;

  const describeArc = (startA: number, endA: number) => {
    const x1 = cx + radius * Math.cos(startA);
    const y1 = cy - radius * Math.sin(startA);
    const x2 = cx + radius * Math.cos(endA);
    const y2 = cy - radius * Math.sin(endA);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  const trackPath = describeArc(startAngle, endAngle);

  const arcColor = color;
  const valueColor = '#1a2b4a';

  return (
    <div
      className={onClick ? "cursor-pointer" : ""}
      onClick={onClick}
      data-testid={testId}
      style={{ textAlign: 'center', padding: '16px 16px 12px' }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a6eb5', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      <svg width="200" height="110" viewBox="0 0 200 110" style={{ display: 'block', margin: '0 auto' }}>
        <path
          d={trackPath}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={trackPath}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
        />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: '28px', fontWeight: 700, fill: valueColor }}
        >
          {displayValue ?? value.toString()}
        </text>
        <text x={cx - radius - 2} y={cy + 16} textAnchor="start" style={{ fontSize: '10px', fill: '#9E9E9E' }}>0</text>
        <text x={cx + radius + 2} y={cy + 16} textAnchor="end" style={{ fontSize: '10px', fill: '#9E9E9E' }}>{max > 0 ? max : 10}</text>
      </svg>
      {subtitle && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '-4px', marginBottom: '4px' }}>{subtitle}</div>
      )}
      {statLine && (
        <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>{statLine}</div>
      )}
    </div>
  );
}