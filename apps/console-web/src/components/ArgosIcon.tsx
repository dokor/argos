import React from "react";

/**
 * Argos logo icon — stylized eye with scan arc.
 * Uses currentColor so it inherits the parent's text color.
 */
export default function ArgosIcon({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Eyelid outline */}
      <path
        d="M2 12C4.5 7 8 5 12 5C16 5 19.5 7 22 12C19.5 17 16 19 12 19C8 19 4.5 17 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Iris */}
      <circle
        cx="12"
        cy="12"
        r="3.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* Pupil dot */}
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
      {/* Scan arc (top-right) */}
      <path
        d="M15.5 8.5 Q17 7 18.5 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
