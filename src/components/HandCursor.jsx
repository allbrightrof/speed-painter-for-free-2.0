/**
 * HandCursor.jsx
 * A realistic SVG hand holding a pencil that follows the drawing position.
 * The pencil tip (hotspot) is at SVG coordinate (34, 152) inside a 180×160 viewBox.
 * We offset the div so the tip aligns exactly with the drawing pixel.
 */
import React from 'react';

const TIP_X = 34;  // pencil tip X inside the SVG (px)
const TIP_Y = 152; // pencil tip Y inside the SVG (px)

const HandCursor = ({ x, y, visible }) => (
  <div
    id="hand-cursor"
    style={{
      position: 'fixed',
      left:  x - TIP_X,
      top:   y - TIP_Y,
      opacity:       visible ? 1 : 0,
      transition:    'left 0.07s linear, top 0.07s linear, opacity 0.18s ease',
      pointerEvents: 'none',
      zIndex:        9999,
      filter:        'drop-shadow(3px 6px 10px rgba(0,0,0,0.28))',
      willChange:    'left, top',
    }}
  >
    <svg
      width="180" height="160"
      viewBox="0 0 180 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Pencil (drawn first so hand overlaps it) ── */}
      {/* Pencil body — yellow, angled ~40 deg */}
      <g transform="rotate(-42 90 80)">
        {/* Pencil shaft */}
        <rect x="82" y="10" width="14" height="105" rx="2" fill="#F5C842"/>
        {/* Left face shading */}
        <rect x="82" y="10" width="5"  height="105" rx="1" fill="#D4A800" opacity="0.5"/>
        {/* Ferrule (silver band) */}
        <rect x="81" y="108" width="16" height="10" rx="1" fill="#B8B8B8"/>
        <rect x="81" y="109" width="16" height="3"  fill="#D8D8D8" opacity="0.6"/>
        {/* Eraser (pink) */}
        <rect x="82" y="118" width="14" height="10" rx="2" fill="#E8847A"/>
        {/* Wood tip (cone) */}
        <polygon points="82,10 96,10 89,−18" fill="#E8C49A"/>
        {/* Graphite tip */}
        <polygon points="84,4 94,4 89,−18" fill="#222"/>
        {/* Tip highlight */}
        <line x1="89" y1="−16" x2="89" y2="0" stroke="#555" strokeWidth="1" opacity="0.5"/>
      </g>

      {/* ── Palm ── */}
      <ellipse cx="108" cy="95" rx="42" ry="36"
        fill="#F5C5A3" stroke="#E8B090" strokeWidth="0.8"/>

      {/* ── Thumb ── */}
      <ellipse cx="70" cy="85" rx="14" ry="22"
        fill="#F5C5A3" stroke="#E8B090" strokeWidth="0.7"
        transform="rotate(-35 70 85)"/>
      {/* Thumb nail */}
      <ellipse cx="58" cy="72" rx="5" ry="7"
        fill="#FDE8D8" stroke="#E8B090" strokeWidth="0.5"
        transform="rotate(-35 58 72)"/>

      {/* ── Index finger ── */}
      <ellipse cx="88" cy="54" rx="10" ry="30"
        fill="#F5C5A3" stroke="#E8B090" strokeWidth="0.7"
        transform="rotate(-10 88 54)"/>
      <ellipse cx="87" cy="30" rx="8" ry="10"
        fill="#FDE8D8" stroke="#E8B090" strokeWidth="0.5"
        transform="rotate(-10 87 30)"/>

      {/* ── Middle finger ── */}
      <ellipse cx="108" cy="48" rx="10" ry="33"
        fill="#F5C5A3" stroke="#E8B090" strokeWidth="0.7"/>
      <ellipse cx="108" cy="22" rx="8" ry="10"
        fill="#FDE8D8" stroke="#E8B090" strokeWidth="0.5"/>

      {/* ── Ring finger ── */}
      <ellipse cx="127" cy="53" rx="9" ry="30"
        fill="#F5C5A3" stroke="#E8B090" strokeWidth="0.7"
        transform="rotate(10 127 53)"/>
      <ellipse cx="130" cy="27" rx="7" ry="9"
        fill="#FDE8D8" stroke="#E8B090" strokeWidth="0.5"
        transform="rotate(10 130 27)"/>

      {/* ── Pinky ── */}
      <ellipse cx="144" cy="63" rx="7.5" ry="24"
        fill="#F5C5A3" stroke="#E8B090" strokeWidth="0.7"
        transform="rotate(20 144 63)"/>
      <ellipse cx="150" cy="42" rx="6" ry="8"
        fill="#FDE8D8" stroke="#E8B090" strokeWidth="0.5"
        transform="rotate(20 150 42)"/>

      {/* ── Knuckle lines ── */}
      <line x1="88" y1="68" x2="95" y2="65" stroke="#E0A882" strokeWidth="1" opacity="0.6"/>
      <line x1="108" y1="65" x2="115" y2="62" stroke="#E0A882" strokeWidth="1" opacity="0.6"/>
      <line x1="127" y1="70" x2="134" y2="68" stroke="#E0A882" strokeWidth="1" opacity="0.6"/>
      <line x1="143" y1="78" x2="149" y2="77" stroke="#E0A882" strokeWidth="1" opacity="0.6"/>

      {/* ── Palm creases ── */}
      <path d="M 75 100 Q 108 92 140 102" stroke="#E0A882" strokeWidth="1.2" opacity="0.4" fill="none"/>
      <path d="M 72 108 Q 108 102 138 110" stroke="#E0A882" strokeWidth="1"   opacity="0.3" fill="none"/>
    </svg>
  </div>
);

export default HandCursor;
