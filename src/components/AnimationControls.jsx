/**
 * AnimationControls.jsx
 * Play / Pause / Reset + speed slider + progress bar + Export to Video + Save PNG.
 */

import React from 'react';

const AnimationControls = ({
  isPlaying,
  isReady,
  isRecording,
  progress,
  speed,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onExport,
  onSavePNG,   // ← new: download current canvas as PNG
}) => {
  const pct = Math.min(100, Math.round(progress));

  return (
    <div className="glass-card" style={{ padding: '24px 28px', width: '100%', maxWidth: '740px', margin: '0 auto' }}>

      {/* ── Title row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎛️ Animation Controls
        </h3>

        {/* Status badge */}
        {isRecording ? (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171',
          }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', background: '#f87171',
              animation: 'pulse-ring 1.2s ease-in-out infinite',
            }} />
            RECORDING
          </span>
        ) : (
          <span style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
            background: pct === 100 ? 'rgba(74,222,128,0.12)' : 'rgba(167,139,250,0.1)',
            border: `1px solid ${pct === 100 ? 'rgba(74,222,128,0.3)' : 'rgba(167,139,250,0.22)'}`,
            color: pct === 100 ? '#4ade80' : '#a78bfa',
          }}>
            {pct === 100 ? '✅ Complete' : `${pct}%`}
          </span>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="progress-bar-track" style={{ marginBottom: '22px' }}>
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* ── Playback controls ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>

        <button
          id="btn-play"
          className="btn-primary"
          onClick={onPlay}
          disabled={!isReady || isPlaying || isRecording || pct === 100}
          style={{ flex: 1, minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          ▶ Play
        </button>

        <button
          id="btn-pause"
          className="btn-ghost"
          onClick={onPause}
          disabled={!isPlaying || isRecording}
          style={{ flex: 1, minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          ⏸ Pause
        </button>

        <button
          id="btn-reset"
          className="btn-ghost"
          onClick={onReset}
          disabled={!isReady || isRecording}
          style={{ flex: 1, minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          🔄 Reset
        </button>
      </div>

      {/* ── Speed slider ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label htmlFor="speed-slider" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            ⚡ Drawing Speed
          </label>
          <span style={{
            fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)',
            background: 'rgba(167,139,250,0.1)', padding: '2px 10px', borderRadius: '8px',
          }}>
            {speed}×
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Slow</span>
          <input
            id="speed-slider"
            type="range"
            min={1} max={10} step={1}
            value={speed}
            onChange={e => onSpeedChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fast</span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '1px', background: 'var(--border-glass)', marginBottom: '20px' }} />

      {/* ── Export section ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Row: Save PNG + Export Video */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>

          {/* ── Save PNG (always works, instant) ── */}
          <button
            id="btn-save-png"
            className="btn-ghost"
            onClick={onSavePNG}
            disabled={!isReady || isRecording}
            style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            🖼️ Save as PNG
          </button>

          {/* ── Export Video (MediaRecorder) ── */}
          <button
            id="btn-export"
            className="btn-primary"
            onClick={onExport}
            disabled={!isReady || isRecording || isPlaying}
            style={{
              flex: 2, minWidth: '160px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: isRecording
                ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                : 'linear-gradient(135deg,#0ea5e9,#0369a1)',
              boxShadow: isRecording ? '0 4px 20px rgba(239,68,68,0.3)' : '0 4px 20px rgba(14,165,233,0.3)',
              fontSize: '0.85rem',
            }}
          >
            {isRecording ? '⏺ Recording…' : '🎬 Export Video (WebM)'}
          </button>
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text-primary)' }}>PNG</strong> saves instantly ·
          <strong style={{ color: 'var(--text-primary)' }}> WebM</strong> records the full animation (a download button appears when ready) · YouTube, TikTok &amp; Instagram accept WebM directly.
        </p>
      </div>
    </div>
  );
};

export default AnimationControls;
