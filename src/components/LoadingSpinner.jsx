/**
 * LoadingSpinner.jsx
 * Overlay loading animation displayed while the image is
 * being converted to a sketch (can take a moment for large images).
 */

import React from 'react';

const LoadingSpinner = ({ message = 'Processing image…' }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        zIndex: 10,
        gap: '20px',
      }}
    >
      {/* ── Spinning ring ── */}
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        {/* Outer glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid rgba(167,139,250,0.15)',
          }}
        />
        {/* Spinning arc */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#a78bfa',
            borderRightColor: '#38bdf8',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        {/* Inner pencil icon */}
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}
        >
          ✏️
        </div>
      </div>

      {/* ── Message ── */}
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            marginBottom: '4px',
          }}
        >
          {message}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Applying edge detection &amp; generating strokes…
        </p>
      </div>

      {/* ── Shimmer progress bar ── */}
      <div
        className="shimmer"
        style={{
          width: '200px',
          height: '3px',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      />

      {/* Inline keyframe for spin (can't use Tailwind here easily) */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
