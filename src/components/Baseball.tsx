// A drawn baseball with red stitching. Used for decoration and animations.
interface Props {
  size?: number;
  className?: string;
}

export default function Baseball({ size = 120, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ball-shade" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#f1ece0" />
          <stop offset="100%" stopColor="#c9c1ad" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#ball-shade)" stroke="#bdb39c" strokeWidth="1.5" />
      {/* seams */}
      <path d="M22 12 C 40 32, 40 68, 22 88" fill="none" stroke="#d0202e" strokeWidth="1.6" />
      <path d="M78 12 C 60 32, 60 68, 78 88" fill="none" stroke="#d0202e" strokeWidth="1.6" />
      {/* stitches */}
      <path
        d="M22 12 C 40 32, 40 68, 22 88"
        fill="none"
        stroke="#d0202e"
        strokeWidth="6"
        strokeDasharray="1.4 4.6"
        opacity="0.9"
      />
      <path
        d="M78 12 C 60 32, 60 68, 78 88"
        fill="none"
        stroke="#d0202e"
        strokeWidth="6"
        strokeDasharray="1.4 4.6"
        opacity="0.9"
      />
    </svg>
  );
}