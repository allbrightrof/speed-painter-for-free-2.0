/**
 * DownloadBar.jsx — shows conversion progress and final download link.
 * Accepts a { url, filename } object so the link always saves with the correct extension.
 */
import React from 'react';

const DownloadBar = ({ download, isConverting, convertProgress, onDismiss }) => {
  // download = { url, filename } | null
  if (!isConverting && !download) return null;

  const isMP4 = download?.filename?.endsWith('.mp4');

  return (
    <div className="glass-card fade-in-up" style={{
      width: '100%', maxWidth: '740px', margin: '0 auto',
      padding: '18px 22px',
      border: `1px solid ${download ? 'rgba(74,222,128,0.3)' : 'rgba(167,139,250,0.3)'}`,
      background: download ? 'rgba(74,222,128,0.06)' : 'rgba(167,139,250,0.06)',
      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
    }}>

      {/* Icon */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: download ? 'rgba(74,222,128,0.15)' : 'rgba(167,139,250,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
      }}>
        {isConverting ? '⚙️' : '🎬'}
      </div>

      {/* Status text */}
      <div style={{ flex: 1, minWidth: '160px' }}>
        {isConverting ? (
          <>
            <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#a78bfa', marginBottom: '8px' }}>
              Converting to MP4… {convertProgress > 0 ? `${convertProgress}%` : ''}
            </p>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                background: 'linear-gradient(to right,#a78bfa,#38bdf8)',
                width: convertProgress > 0 ? `${convertProgress}%` : '30%',
                transition: 'width 0.3s ease',
                animation: convertProgress === 0 ? 'shimmer 1.4s infinite' : 'none',
              }} />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>
              Using ffmpeg.wasm · runs entirely in your browser · no upload needed
            </p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4ade80', marginBottom: '3px' }}>
              {isMP4 ? '✅ MP4 ready!' : '✅ Video ready!'}
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {isMP4
                ? 'H.264 · 16:9 · 1280×720 · opens in Windows Explorer, iPhone, YouTube & TikTok'
                : 'WebM format · opens in Chrome, VLC · accepted by YouTube'}
            </p>
          </>
        )}
      </div>

      {/* Download button — uses native <a> tag, never blocked by browser */}
      {download && !isConverting && (
        <a
          href={download.url}
          download={download.filename}
          id="video-download-link"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 22px', borderRadius: '12px', fontWeight: 700,
            fontSize: '0.88rem', textDecoration: 'none', color: '#fff',
            background: 'linear-gradient(135deg,#4ade80,#16a34a)',
            boxShadow: '0 4px 20px rgba(74,222,128,0.3)', flexShrink: 0,
          }}
        >
          ⬇ Save {isMP4 ? 'MP4' : 'Video'}
        </a>
      )}

      {/* Dismiss */}
      {!isConverting && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', flexShrink: 0, lineHeight: 1 }} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
};

export default DownloadBar;
