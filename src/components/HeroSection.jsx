/**
 * HeroSection.jsx
 * Top section with app name, tagline, and animated badge.
 */

import React from 'react';

const HeroSection = () => {
  return (
    <header className="relative text-center py-16 px-4 overflow-hidden">

      {/* ── Decorative floating orbs ── */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />

      {/* ── Badge ── */}
      <div
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 fade-in-up"
        style={{
          background: 'rgba(167,139,250,0.1)',
          border: '1px solid rgba(167,139,250,0.3)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#a78bfa',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {/* Animated pulse dot */}
        <span className="relative flex h-2 w-2">
          <span
            className="pulse-ring absolute inline-flex h-full w-full rounded-full"
            style={{ background: '#a78bfa', opacity: 0.6 }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: '#a78bfa' }}
          />
        </span>
        AI-Powered · Canvas Animation
      </div>

      {/* ── Main Heading ── */}
      <h1
        className="gradient-text glow-text fade-in-up fade-in-up-delay-1"
        style={{
          fontSize: 'clamp(2.4rem, 6vw, 4.5rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          marginBottom: '1rem',
        }}
      >
        SpeedPaint<span style={{ color: '#38bdf8' }}>AI</span>
      </h1>

      {/* ── Subheading ── */}
      <p
        className="fade-in-up fade-in-up-delay-2"
        style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          color: 'var(--text-muted)',
          maxWidth: '560px',
          margin: '0 auto 1.5rem',
          lineHeight: 1.7,
        }}
      >
        Upload any image and watch it come to life as a{' '}
        <span style={{ color: 'var(--accent)' }}>realistic speed painting</span>.
        Powered by canvas magic — no plugins needed.
      </p>

      {/* ── Feature Pills ── */}
      <div
        className="flex flex-wrap justify-center gap-2 fade-in-up fade-in-up-delay-3"
        style={{ marginTop: '0.5rem' }}
      >
        {['✏️ Sketch Effect', '🎞️ Stroke Animation', '⚡ Adjustable Speed', '📱 Mobile Ready'].map((label) => (
          <span
            key={label}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </header>
  );
};

export default HeroSection;
