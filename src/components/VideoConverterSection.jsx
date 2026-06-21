/**
 * VideoConverterSection.jsx
 *
 * Self-contained section for the Video-to-Painting converter.
 * Users upload a video (≤ 60 s), choose settings, and convert.
 * Every frame of the clip is transformed into a pencil-sketch painting,
 * then downloaded as a silent MP4.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  convertVideoToPainting,
  loadVideoFile,
  getVideoDimensions,
  estimateConversionTime,
  MAX_VIDEO_DURATION,
  VIDEO_OUTPUT_FPS,
} from '../utils/videoConverter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDuration = (sec) => {
  if (!sec || isNaN(sec)) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const THEMES = [
  { id: 'cream',      label: 'Cream',  icon: '🏷️' },
  { id: 'white',      label: 'White',  icon: '📄' },
  { id: 'chalkboard', label: 'Chalk',  icon: '✏️' },
];

const PENCIL_COLORS_NORMAL = [
  { value: '#1a0a02', name: 'Charcoal' },
  { value: '#4b5563', name: 'Graphite' },
  { value: '#1e3a8a', name: 'Blue'     },
  { value: '#991b1b', name: 'Red'      },
];

const PENCIL_COLORS_CHALK = [
  { value: '#eef2f6', name: 'White'  },
  { value: '#fef08a', name: 'Yellow' },
  { value: '#bfdbfe', name: 'Blue'   },
  { value: '#fbcfe8', name: 'Pink'   },
];

// ── Component ─────────────────────────────────────────────────────────────────

const VideoConverterSection = () => {
  // ── File state ──────────────────────────────────────────────────────────────
  const [videoFile,  setVideoFile]  = useState(null);
  const [videoInfo,  setVideoInfo]  = useState(null);   // { name, duration, videoWidth, videoHeight, objectUrl }
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Conversion state ────────────────────────────────────────────────────────
  const [isConverting, setIsConverting] = useState(false);
  const [progress,     setProgress]     = useState({ current: 0, total: 0, percent: 0 });
  const [result,       setResult]       = useState(null);   // { url, filename }
  const [error,        setError]        = useState(null);
  const signalRef = useRef({ cancelled: false });

  // ── Settings state ──────────────────────────────────────────────────────────
  const [theme,       setTheme]       = useState('cream');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const defaultPencil = (t) => t === 'chalkboard' ? '#eef2f6' : '#1a0a02';
  const [pencilColor, setPencilColor] = useState(defaultPencil('cream'));

  // ── Retention Booster Settings ──────────────────────────────────────────────
  const [hookTextEnabled, setHookTextEnabled] = useState(true);
  const [hookText,        setHookText]        = useState('Wait for the end... 🤯');
  const [hookTextPosition, setHookTextPosition] = useState('top');
  const [hookTextDuration, setHookTextDuration] = useState(2.0);

  const inputRef    = useRef(null);
  const prevResultUrl = useRef(null);

  // ── Sync pencil color with theme ────────────────────────────────────────────
  useEffect(() => {
    setPencilColor(defaultPencil(theme));
  }, [theme]);

  // ── Cleanup object URLs on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (videoInfo?.objectUrl) URL.revokeObjectURL(videoInfo.objectUrl);
      if (prevResultUrl.current) URL.revokeObjectURL(prevResultUrl.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ──────────────────────────────────────────────────────────
  const { width: outW, height: outH } = getVideoDimensions(aspectRatio);
  const estimatedSec = videoInfo ? estimateConversionTime(videoInfo.duration, outW, outH) : 0;
  const totalFrames  = videoInfo ? Math.ceil(Math.min(videoInfo.duration, MAX_VIDEO_DURATION) * VIDEO_OUTPUT_FPS) : 0;
  const pencilOptions = theme === 'chalkboard' ? PENCIL_COLORS_CHALK : PENCIL_COLORS_NORMAL;

  // ── File handling ────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please upload a valid video file (MP4, WebM, MOV).');
      return;
    }

    setError(null);
    setResult(null);
    setProgress({ current: 0, total: 0, percent: 0 });

    // Revoke old object URLs
    if (videoInfo?.objectUrl) URL.revokeObjectURL(videoInfo.objectUrl);
    if (prevResultUrl.current) { URL.revokeObjectURL(prevResultUrl.current); prevResultUrl.current = null; }

    try {
      const { video, url } = await loadVideoFile(file);

      if (video.duration > MAX_VIDEO_DURATION) {
        URL.revokeObjectURL(url);
        setError(`Video is ${Math.round(video.duration)}s long. Maximum allowed is ${MAX_VIDEO_DURATION} seconds.`);
        return;
      }

      setVideoFile(file);
      setVideoInfo({
        name:        file.name,
        duration:    video.duration,
        videoWidth:  video.videoWidth,
        videoHeight: video.videoHeight,
        objectUrl:   url,
      });
    } catch (err) {
      setError('Could not load video: ' + err.message);
    }
  }, [videoInfo]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  // ── Conversion ───────────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!videoFile || isConverting) return;

    setIsConverting(true);
    setError(null);
    setResult(null);
    if (prevResultUrl.current) { URL.revokeObjectURL(prevResultUrl.current); prevResultUrl.current = null; }

    signalRef.current = { cancelled: false };

    try {
      const blob = await convertVideoToPainting(
        videoFile,
        {
          theme,
          pencilColor,
          aspectRatio,
          hookTextEnabled,
          hookText,
          hookTextPosition,
          hookTextDuration,
        },
        (current, total, percent) => setProgress({ current, total, percent }),
        signalRef.current,
      );

      if (!blob) return; // cancelled

      const url      = URL.createObjectURL(blob);
      const filename = `painted-${videoFile.name.replace(/\.[^/.]+$/, '')}.mp4`;
      prevResultUrl.current = url;
      setResult({ url, filename });
    } catch (err) {
      console.error('Video conversion error:', err);
      setError('Conversion failed: ' + err.message + '. Make sure you are using Chrome 94+.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleCancel = () => { signalRef.current.cancelled = true; };

  const handleClear = () => {
    if (isConverting) signalRef.current.cancelled = true;
    if (videoInfo?.objectUrl) URL.revokeObjectURL(videoInfo.objectUrl);
    if (prevResultUrl.current) { URL.revokeObjectURL(prevResultUrl.current); prevResultUrl.current = null; }
    setVideoFile(null);
    setVideoInfo(null);
    setResult(null);
    setProgress({ current: 0, total: 0, percent: 0 });
    setError(null);
    setIsConverting(false);
  };

  const handleConvertAgain = () => {
    setResult(null);
    setProgress({ current: 0, total: 0, percent: 0 });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

      {/* ── Info banner ── */}
      <div
        className="glass-card"
        style={{
          padding: '14px 20px',
          borderColor: 'rgba(56, 189, 248, 0.25)',
          background: 'rgba(56, 189, 248, 0.05)',
        }}
      >
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          🎬{' '}
          <strong style={{ color: 'var(--accent-secondary)' }}>
            Video-to-Painting Converter
          </strong>{' '}
          — Every frame of your clip is transformed into a painted sketch.
          Perfect for YouTube intros, cinematic B-roll, or artistic transitions.{' '}
          <span style={{ color: 'var(--warning)' }}>
            🔇 Output is silent
          </span>{' '}
          — add music in your video editor.
          Max {MAX_VIDEO_DURATION}s · Chrome 94+ required.
        </p>
      </div>

      {/* ── Upload zone (only shown before a file is loaded) ── */}
      {!videoInfo && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className="glass-card"
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            border: isDragOver
              ? '2px solid var(--accent-secondary)'
              : '2px dashed rgba(56, 189, 248, 0.3)',
            background: isDragOver ? 'rgba(56, 189, 248, 0.06)' : 'var(--bg-card)',
            transition: 'all 0.25s ease',
            boxShadow: isDragOver ? '0 0 40px rgba(56, 189, 248, 0.15)' : 'none',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
          />

          {/* Animated film icon */}
          <div style={{ marginBottom: '16px', position: 'relative', display: 'inline-block' }}>
            <span style={{ fontSize: '3.5rem', display: 'block' }}>🎬</span>
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-8px',
                fontSize: '1.4rem',
                animation: 'pulse-ring 2s infinite',
              }}
            >
              🖌️
            </span>
          </div>

          <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '8px' }}>
            Drop your video here
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px', lineHeight: 1.6 }}>
            MP4 · WebM · MOV — up to {MAX_VIDEO_DURATION} seconds
          </p>
          <button
            className="btn-ghost"
            style={{ padding: '10px 28px', fontSize: '0.85rem', pointerEvents: 'none' }}
          >
            📂 Browse Files
          </button>
        </div>
      )}

      {/* ── Error message ── */}
      {error && (
        <div
          className="glass-card"
          style={{
            padding: '14px 18px',
            borderColor: 'rgba(255,107,107,0.3)',
            background: 'rgba(255,107,107,0.07)',
          }}
        >
          <p style={{ color: '#ff8a8a', fontSize: '0.85rem' }}>⚠️ {error}</p>
        </div>
      )}

      {/* ── Video loaded: info + preview ── */}
      {videoInfo && (
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {/* Meta */}
            <div>
              <h3
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  wordBreak: 'break-all',
                }}
              >
                🎞️ {videoInfo.name}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {[
                  { icon: '⏱️', label: 'Duration',   value: formatDuration(videoInfo.duration) },
                  { icon: '📐', label: 'Source',      value: `${videoInfo.videoWidth}×${videoInfo.videoHeight}` },
                  { icon: '🖼️', label: 'Output',      value: `${outW}×${outH} @ ${VIDEO_OUTPUT_FPS}fps` },
                  { icon: '📽️', label: 'Frames',      value: `${totalFrames}` },
                  { icon: '⏳', label: 'Est. time',   value: `~${formatDuration(estimatedSec)}`, highlight: true },
                ].map(({ icon, label, value, highlight }) => (
                  <span key={label} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {icon} {label}:{' '}
                    <strong style={{ color: highlight ? 'var(--warning)' : 'var(--text-primary)' }}>
                      {value}
                    </strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Clear button */}
            <button
              onClick={handleClear}
              disabled={isConverting}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-glass)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕ Clear
            </button>
          </div>

          {/* Video preview player */}
          <video
            src={videoInfo.objectUrl}
            controls
            muted
            playsInline
            style={{
              width: '100%',
              maxHeight: '240px',
              borderRadius: '10px',
              background: '#000',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* ── Settings + Convert button (shown when file loaded and not actively converting) ── */}
      {videoInfo && !isConverting && !result && (
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Painting Settings
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '20px',
            }}
          >
            {/* Aspect Ratio */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Output Aspect Ratio
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['16:9', '9:16', '1:1'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: '0.75rem', fontWeight: 600,
                      borderRadius: '8px',
                      background: aspectRatio === r ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                      color: aspectRatio === r ? '#fff' : 'var(--text-primary)',
                      border: aspectRatio === r ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {r === '16:9' ? '📺 16:9' : r === '9:16' ? '📱 9:16' : '🟩 1:1'}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Theme */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Background Theme
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: '0.75rem', fontWeight: 600,
                      borderRadius: '8px',
                      background: theme === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                      color: theme === t.id ? '#fff' : 'var(--text-primary)',
                      border: theme === t.id ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pencil Color */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Pencil Color
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {pencilOptions.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setPencilColor(c.value)}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: '0.72rem', fontWeight: 700,
                      borderRadius: '8px',
                      background: pencilColor === c.value ? c.value : 'rgba(255,255,255,0.03)',
                      color: pencilColor === c.value ? (theme === 'chalkboard' ? '#121214' : '#fff') : 'var(--text-primary)',
                      border: `1px solid ${pencilColor === c.value ? c.value : 'var(--border-glass)'}`,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hook Section (Retention Booster) */}
          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px' }}>
              <input
                type="checkbox"
                checked={hookTextEnabled}
                onChange={(e) => setHookTextEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span>📈 Add Text Hook Overlay (Boosts Shorts Retention)</span>
            </label>
            
            {hookTextEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Hook Text
                  </label>
                  <input
                    type="text"
                    value={hookText}
                    onChange={(e) => setHookText(e.target.value)}
                    placeholder="e.g. Wait for the end... 🤫"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.82rem',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Overlay Position
                  </label>
                  <select
                    value={hookTextPosition}
                    onChange={(e) => setHookTextPosition(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.82rem',
                      background: '#1e1e24',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="top">Top (15%)</option>
                    <option value="center">Center (50%)</option>
                    <option value="bottom">Bottom (80%)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Overlay Duration
                  </label>
                  <select
                    value={hookTextDuration}
                    onChange={(e) => setHookTextDuration(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.82rem',
                      background: '#1e1e24',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="1.0">First 1 second</option>
                    <option value="2.0">First 2 seconds</option>
                    <option value="3.0">First 3 seconds</option>
                    <option value="4.0">First 4 seconds</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Convert CTA */}
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <button
              id="video-convert-btn"
              className="btn-primary"
              onClick={handleConvert}
              style={{ padding: '15px 48px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '10px' }}
            >
              🎨 Convert to Painting
            </button>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '10px', lineHeight: 1.6 }}>
              Estimated: ~{formatDuration(estimatedSec)} for {totalFrames} frames · Runs entirely in your browser · Don't close the tab
            </p>
          </div>
        </div>
      )}

      {/* ── Progress card ── */}
      {isConverting && (
        <div
          className="glass-card"
          style={{ padding: '32px 24px', textAlign: 'center' }}
        >
          {/* Animated paint emoji */}
          <div
            style={{
              fontSize: '2.8rem',
              marginBottom: '14px',
              display: 'inline-block',
              animation: 'fade-in-up 0.4s ease forwards',
            }}
          >
            🖌️
          </div>
          <h3 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>
            Painting your video...
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px', lineHeight: 1.7 }}>
            Frame{' '}
            <strong style={{ color: 'var(--accent)' }}>{progress.current}</strong>
            {' '}of{' '}
            <strong>{progress.total}</strong>
            <br />
            <span style={{ fontSize: '0.75rem' }}>
              Keep this tab open — conversion is running in your browser
            </span>
          </p>

          {/* Progress bar */}
          <div
            className="progress-bar-track"
            style={{ marginBottom: '12px', height: '8px', borderRadius: '4px' }}
          >
            <div
              className="progress-bar-fill"
              style={{ width: `${progress.percent}%`, transition: 'width 0.4s ease', borderRadius: '4px' }}
            />
          </div>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '20px' }}>
            {progress.percent}%
          </p>

          <button
            onClick={handleCancel}
            className="btn-ghost"
            style={{ padding: '9px 24px', fontSize: '0.82rem' }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* ── Result card ── */}
      {result && !isConverting && (
        <div
          className="glass-card"
          style={{
            padding: '36px 24px',
            textAlign: 'center',
            borderColor: 'rgba(74, 222, 128, 0.3)',
            background: 'rgba(74, 222, 128, 0.04)',
          }}
        >
          <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>✅</div>
          <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px', color: 'var(--success)' }}>
            Conversion Complete!
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: 1.6 }}>
            Your painted video is ready. Add music in your editor before uploading!
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              id="video-download-btn"
              href={result.url}
              download={result.filename}
              className="btn-primary"
              style={{
                textDecoration: 'none',
                padding: '13px 32px',
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              💾 Download Painted MP4
            </a>
            <button
              onClick={handleConvertAgain}
              className="btn-ghost"
              style={{ padding: '13px 28px', fontSize: '0.9rem' }}
            >
              🔄 Change Settings
            </button>
            <button
              onClick={handleClear}
              className="btn-ghost"
              style={{ padding: '13px 24px', fontSize: '0.9rem' }}
            >
              📂 New Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoConverterSection;
