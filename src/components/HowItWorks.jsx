/**
 * HowItWorks.jsx
 * Three-step explainer card shown between Upload and Canvas sections.
 */

import React from 'react';

const STEPS = [
  {
    emoji: '🖼️',
    title: 'Upload',
    desc: 'Drop any photo — portrait, landscape, logo, anything.',
    color: '#a78bfa',
  },
  {
    emoji: '⚙️',
    title: 'Process',
    desc: 'Sobel edge detection converts it to a clean sketch outline.',
    color: '#38bdf8',
  },
  {
    emoji: '✏️',
    title: 'Animate',
    desc: 'Watch every stroke appear live on canvas like a real artist.',
    color: '#4ade80',
  },
];

const HowItWorks = () => (
  <section style={{ width: '100%', maxWidth: '680px', margin: '0 auto' }}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
      }}
    >
      {STEPS.map((step, i) => (
        <div
          key={step.title}
          className="glass-card"
          style={{
            padding: '20px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Step number */}
          <span
            style={{
              position: 'absolute',
              top: '10px',
              right: '14px',
              fontSize: '0.65rem',
              fontWeight: 800,
              color: step.color,
              opacity: 0.6,
              letterSpacing: '0.1em',
            }}
          >
            0{i + 1}
          </span>

          {/* Icon */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: `${step.color}18`,
              border: `1px solid ${step.color}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              margin: '0 auto 12px',
            }}
          >
            {step.emoji}
          </div>

          <h3
            style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              marginBottom: '6px',
              color: step.color,
            }}
          >
            {step.title}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {step.desc}
          </p>
        </div>
      ))}
    </div>
  </section>
);

export default HowItWorks;
