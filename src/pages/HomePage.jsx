/**
 * HomePage.jsx — owns animation + WebCodecs MP4 export state.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection            from '../components/HeroSection';
import HowItWorks             from '../components/HowItWorks';
import UploadArea             from '../components/UploadArea';
import CanvasPreview          from '../components/CanvasPreview';
import AnimationControls      from '../components/AnimationControls';
import DownloadBar            from '../components/DownloadBar';
import Footer                 from '../components/Footer';
import VideoConverterSection  from '../components/VideoConverterSection';
import { exportToMP4 }        from '../utils/mp4Export';
import { convertToSketch, generateInkPixels } from '../utils/sketchUtils';

// ── Tab definitions ────────────────────────────────────────────────────────
const TABS = [
  { id: 'image', icon: '🖼️', label: 'Image Painter' },
  { id: 'video', icon: '🎬', label: 'Video Converter' },
];

const HomePage = () => {
  const canvasRef  = useRef(null);
  const [activeTab, setActiveTab] = useState('image');

  const [images,             setImages]             = useState([]);
  const [activeIndex,        setActiveIndex]        = useState(-1);
  const [isPlaying,          setIsPlaying]          = useState(false);
  const [speed,              setSpeed]              = useState(3);
  const [command,            setCommand]            = useState(null);
  const [isPlayingAll,       setIsPlayingAll]       = useState(false);
  const [isExportingAll,     setIsExportingAll]     = useState(false);

  // Creator Settings States
  const [aspectRatio,        setAspectRatio]        = useState('16:9');
  const [theme,              setTheme]              = useState('cream');
  const [colorReveal,        setColorReveal]        = useState(false);

  // YouTube Shorts Retention Boosters States
  const [drawingStyle,       setDrawingStyle]       = useState('outline-first');
  const [teaserStyle,        setTeaserStyle]        = useState('completed');
  const [teaserDuration,     setTeaserDuration]     = useState(1.0);
  const [hookTextEnabled,    setHookTextEnabled]    = useState(true);
  const [hookText,           setHookText]           = useState('Wait for the end... 🤫');
  const [hookTextPosition,   setHookTextPosition]   = useState('top');
  const [hookTextDuration,   setHookTextDuration]   = useState(2.0);
  const [speedCurve,         setSpeedCurve]         = useState('fast-start');

  // Derive theme background colors and chalk/pencil defaults
  const paperColor = theme === 'chalkboard' ? '#121214' : theme === 'white' ? '#ffffff' : '#fef8f0';
  const defaultPencilColor = theme === 'chalkboard' ? '#eef2f6' : '#1a0a02';
  const [pencilColor,        setPencilColor]        = useState(defaultPencilColor);

  // Derive aspect ratio dimensions
  const getDimensions = (ratio) => {
    if (ratio === '9:16') return { width: 720, height: 1280 };
    if (ratio === '1:1') return { width: 1080, height: 1080 };
    return { width: 1280, height: 720 };
  };
  const { width: canvasWidth, height: canvasHeight } = getDimensions(aspectRatio);

  // Update default pencil color when theme changes
  useEffect(() => {
    setPencilColor(theme === 'chalkboard' ? '#eef2f6' : '#1a0a02');
  }, [theme]);

  // Clean up object URLs when components unmount or items are cleared
  const clearDownloads = (items) => {
    items.forEach(img => {
      if (img.mp4Download?.url) {
        URL.revokeObjectURL(img.mp4Download.url);
      }
    });
  };

  // Re-process all images in the queue when resolution, background style, or drawing style changes
  const reprocessAllImages = useCallback((ratio, thm, style) => {
    const { width, height } = getDimensions(ratio);
    const paper = thm === 'chalkboard' ? '#121214' : thm === 'white' ? '#ffffff' : '#fef8f0';
    const isChalk = thm === 'chalkboard';

    setImages(prev => prev.map(img => {
      if (img.mp4Download?.url) {
        URL.revokeObjectURL(img.mp4Download.url);
      }
      const { imageData } = convertToSketch(img.imageObj, width, height, paper, isChalk);
      const pixels = generateInkPixels(imageData, width, height, 240, isChalk, style);
      return {
        ...img,
        pixels,
        progress: 0,
        mp4Download: null,
      };
    }));
    setCommand('reset');
  }, []);

  // Trigger re-processing on settings adjustment
  useEffect(() => {
    if (images.length === 0) return;
    reprocessAllImages(aspectRatio, theme, drawingStyle);
  }, [aspectRatio, theme, drawingStyle, reprocessAllImages]);

  // Discard MP4 download links if parameters change (to force new export)
  useEffect(() => {
    setImages(prev => prev.map(img => {
      if (img.mp4Download) {
        URL.revokeObjectURL(img.mp4Download.url);
        return { ...img, mp4Download: null };
      }
      return img;
    }));
  }, [pencilColor, teaserStyle, teaserDuration, hookTextEnabled, hookText, hookTextPosition, hookTextDuration, speedCurve]);

  // Derive active image
  const activeImage = activeIndex !== -1 ? images[activeIndex] : null;

  // Derive current status for DownloadBar from the active image
  const isExporting = activeImage?.isExporting || false;
  const exportProgress = activeImage?.exportProgress || 0;
  const mp4Download = activeImage?.mp4Download || null;
  const progress = activeImage?.progress || 0;

  const handleImagesSelected = useCallback((newItems) => {
    const isChalk = theme === 'chalkboard';

    // Pre-calculate sketch pixels on upload
    const processedItems = newItems.map(item => {
      const { imageData } = convertToSketch(item.imageObj, canvasWidth, canvasHeight, paperColor, isChalk);
      const pixels = generateInkPixels(imageData, canvasWidth, canvasHeight, 240, isChalk, drawingStyle);
      return {
        ...item,
        pixels,
        progress: 0,
        isExporting: false,
        exportProgress: 0,
        mp4Download: null,
      };
    });

    setImages(prev => {
      const updated = [...prev, ...processedItems].slice(0, 10);
      return updated;
    });
    // Set active image to the first uploaded one if none was active
    setActiveIndex(prevIndex => (prevIndex === -1 ? 0 : prevIndex));
  }, [canvasWidth, canvasHeight, paperColor, theme, drawingStyle]);

  const selectImage = (index) => {
    setIsPlaying(false);
    setCommand('reset');
    setActiveIndex(index);
  };

  const handleThumbnailClick = (index) => {
    setIsPlayingAll(false);
    setIsExportingAll(false);
    selectImage(index);
  };

  const removeImage = (index, e) => {
    e.stopPropagation();
    setIsPlaying(false);
    setCommand('reset');
    setIsPlayingAll(false);
    setIsExportingAll(false);
    setImages(prev => {
      const imgToRemove = prev[index];
      if (imgToRemove && imgToRemove.mp4Download?.url) {
        URL.revokeObjectURL(imgToRemove.mp4Download.url);
      }
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setActiveIndex(-1);
      } else if (activeIndex === index) {
        setActiveIndex(0);
      } else if (activeIndex > index) {
        setActiveIndex(activeIndex - 1);
      }
      return updated;
    });
  };

  const clearAllImages = () => {
    setIsPlaying(false);
    setCommand('reset');
    setIsPlayingAll(false);
    setIsExportingAll(false);
    clearDownloads(images);
    setImages([]);
    setActiveIndex(-1);
  };

  const handleReady = useCallback(() => {
    // Done preparing sketch
  }, []);

  const handleCommandConsumed = useCallback(() => setCommand(null), []);

  const handleProgress = useCallback((pct) => {
    if (activeIndex === -1) return;
    setImages(prev => prev.map((img, idx) => idx === activeIndex ? { ...img, progress: pct } : img));
    
    if (pct >= 100) {
      setIsPlaying(false);
      if (isPlayingAll) {
        const nextIdx = activeIndex + 1;
        if (nextIdx < images.length) {
          setTimeout(() => {
            selectImage(nextIdx);
            setTimeout(() => {
              setIsPlaying(true);
              setCommand('play');
            }, 300);
          }, 1000);
        } else {
          setIsPlayingAll(false);
        }
      }
    }
  }, [activeIndex, isPlayingAll, images.length]);

  const triggerExportForImage = (img) => {
    if (!img) return;
    const { width, height } = getDimensions(aspectRatio);
    const inMemoryCanvas = Object.assign(document.createElement('canvas'), { width, height });
    
    setImages(prev => prev.map(item => item.id === img.id ? { ...item, isExporting: true, exportProgress: 0 } : item));
    
    const targetSec = Math.max(0.8, 11 - speed);
    
    exportToMP4(
      inMemoryCanvas,
      img.pixels,
      targetSec,
      paperColor,
      pencilColor,
      colorReveal,
      img.imageObj,
      (p) => {
        setImages(prev => prev.map(item => item.id === img.id ? { ...item, exportProgress: p } : item));
      },
      null, // onFrameDrawn
      {
        teaserStyle,
        teaserDuration,
        hookTextEnabled,
        hookText,
        hookTextPosition,
        hookTextDuration,
        speedCurve,
      }
    ).then(mp4Blob => {
      const url = URL.createObjectURL(mp4Blob);
      const dl = { url, filename: `speedpaint-${img.name.replace(/\.[^/.]+$/, "")}.mp4` };
      setImages(prev => prev.map(item => item.id === img.id ? { ...item, isExporting: false, mp4Download: dl } : item));
    }).catch(err => {
      console.error('MP4 export error:', err);
      alert('Export failed for ' + img.name + ': ' + err.message);
      setImages(prev => prev.map(item => item.id === img.id ? { ...item, isExporting: false } : item));
    });
  };

  const handlePlay    = () => {
    setIsPlayingAll(false);
    setIsPlaying(true);
    setCommand('play');
  };
  
  const handlePause   = () => {
    setIsPlayingAll(false);
    setIsPlaying(false);
    setCommand('pause');
  };
  
  const handleReset   = () => {
    setIsPlayingAll(false);
    setIsPlaying(false);
    if (activeIndex !== -1) {
      setImages(prev => prev.map((img, idx) => idx === activeIndex ? { ...img, progress: 0, mp4Download: null } : img));
    }
    setCommand('reset');
  };
  
  const handleExport  = () => {
    setIsPlayingAll(false);
    setIsPlaying(false);
    if (activeImage) {
      triggerExportForImage(activeImage);
    }
  };
  
  const handleSavePNG = () => canvasRef.current?.savePNG();

  const downloadAllReady = () => {
    images.forEach(img => {
      if (img.mp4Download) {
        const a = Object.assign(document.createElement('a'), {
          href: img.mp4Download.url,
          download: img.mp4Download.filename
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  };

  const startPlayAll = () => {
    setIsExportingAll(false);
    setIsPlayingAll(true);
    if (images.length > 0) {
      selectImage(0);
      setTimeout(() => {
        setIsPlaying(true);
        setCommand('play');
      }, 300);
    }
  };

  const startExportAll = () => {
    setIsPlayingAll(false);
    setIsExportingAll(true);
    let anyExported = false;
    images.forEach(img => {
      if (!img.mp4Download && !img.isExporting) {
        triggerExportForImage(img);
        anyExported = true;
      }
    });
    if (!anyExported) {
      setIsExportingAll(false);
      alert('All videos are already exported or currently exporting!');
    }
  };

  const activeImageObj = activeImage?.imageObj || null;

  return (
    <>
      <main className="bg-grid" style={{ minHeight: '100vh', padding: '0 16px 40px' }}>
        <HeroSection />

        {/* ── Tab Switcher ── */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 0' }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '16px',
              padding: '5px',
              gap: '4px',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 28px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  background: activeTab === tab.id
                    ? 'linear-gradient(135deg, var(--accent), #7c3aed)'
                    : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.id ? '0 4px 16px var(--accent-glow)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
        {/* ── Video Converter Tab ── */}
        {activeTab === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', maxWidth: '780px', margin: '0 auto', paddingTop: '28px' }}>
            <VideoConverterSection />
          </div>
        )}

        {/* ── Image Painter Tab ── */}
        {activeTab === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', maxWidth: '780px', margin: '0 auto' }}>

          {images.length === 0 && (
            <div style={{ width: '100%' }} className="fade-in-up fade-in-up-delay-1">
              <HowItWorks />
            </div>
          )}

          <div style={{ width: '100%' }} className="fade-in-up fade-in-up-delay-2">
            <UploadArea onImagesSelected={handleImagesSelected} imageCount={images.length} />
          </div>

          {/* ── Creator Settings Panel ── */}
          {images.length > 0 && (
            <div className="glass-card fade-in-up" style={{ width: '100%', padding: '24px 28px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ Creator Settings (YouTube &amp; Shorts)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                
                {/* Aspect Ratio */}
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Aspect Ratio
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['16:9', '9:16', '1:1'].map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          borderRadius: '8px',
                          background: aspectRatio === ratio ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                          color: aspectRatio === ratio ? '#fff' : 'var(--text-primary)',
                          border: aspectRatio === ratio ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {ratio === '16:9' ? '📺 16:9' : ratio === '9:16' ? '📱 9:16' : '🟩 1:1'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Selector */}
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Background Theme
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'cream', label: 'Cream', icon: '🏷️' },
                      { id: 'white', label: 'White', icon: '📄' },
                      { id: 'chalkboard', label: 'Chalk', icon: '✏️' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          borderRadius: '8px',
                          background: theme === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                          color: theme === t.id ? '#fff' : 'var(--text-primary)',
                          border: theme === t.id ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '16px' }}>
                
                {/* Pencil Color */}
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Pencil Color
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {theme === 'chalkboard' ? (
                      [
                        { value: '#eef2f6', name: 'White' },
                        { value: '#fef08a', name: 'Yellow' },
                        { value: '#bfdbfe', name: 'Blue' },
                        { value: '#fbcfe8', name: 'Pink' }
                      ].map(c => (
                        <button
                          key={c.value}
                          onClick={() => setPencilColor(c.value)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            fontSize: '0.75rem',
                            borderRadius: '8px',
                            background: pencilColor === c.value ? c.value : 'rgba(255,255,255,0.03)',
                            color: pencilColor === c.value ? '#121214' : 'var(--text-primary)',
                            border: `1px solid ${pencilColor === c.value ? c.value : 'var(--border-glass)'}`,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {c.name}
                        </button>
                      ))
                    ) : (
                      [
                        { value: '#1a0a02', name: 'Charcoal' },
                        { value: '#4b5563', name: 'Graphite' },
                        { value: '#1e3a8a', name: 'Blue' },
                        { value: '#991b1b', name: 'Red' }
                      ].map(c => (
                        <button
                          key={c.value}
                          onClick={() => setPencilColor(c.value)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            fontSize: '0.75rem',
                            borderRadius: '8px',
                            background: pencilColor === c.value ? c.value : 'rgba(255,255,255,0.03)',
                            color: pencilColor === c.value ? '#fff' : 'var(--text-primary)',
                            border: `1px solid ${pencilColor === c.value ? c.value : 'var(--border-glass)'}`,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Color Reveal Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={colorReveal}
                      onChange={(e) => setColorReveal(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    />
                    <span>✨ Fade Color Photo in at End</span>
                  </label>
                </div>

              </div>

              {/* 📈 YouTube Shorts Retention Boosters */}
              <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-secondary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📈 YouTube Shorts Retention Boosters
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  
                  {/* Drawing Stroke Style */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      Pencil Stroke Pattern
                    </label>
                    <select
                      value={drawingStyle}
                      onChange={(e) => setDrawingStyle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '0.82rem',
                        background: '#1a1a20',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        color: '#fff',
                        outline: 'none',
                      }}
                    >
                      <option value="outline-first">Outline First (Human-like) ⭐</option>
                      <option value="center-out">Center Outward (Spiral)</option>
                      <option value="organic">Organic Scatter (Magical)</option>
                      <option value="printer-scan">Printer Sweep (Classic)</option>
                    </select>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                      ⭐ <strong>Outline First</strong> draws recognizable contours in the first 0.5s to hook scrolling viewers.
                    </p>
                  </div>

                  {/* Teaser Style */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      First-Second Visual Teaser
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      {[
                        { id: 'none', label: 'None' },
                        { id: 'completed', label: 'Sketch' },
                        { id: 'color', label: 'Color' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTeaserStyle(t.id)}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            background: teaserStyle === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                            color: teaserStyle === t.id ? '#fff' : 'var(--text-primary)',
                            border: teaserStyle === t.id ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                            cursor: 'pointer',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {teaserStyle !== 'none' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Duration:</span>
                        <select
                          value={teaserDuration}
                          onChange={(e) => setTeaserDuration(parseFloat(e.target.value))}
                          style={{
                            padding: '3px 6px',
                            fontSize: '0.72rem',
                            background: '#1a1a20',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        >
                          <option value="0.5">0.5s</option>
                          <option value="1.0">1.0s</option>
                          <option value="1.5">1.5s</option>
                          <option value="2.0">2.0s</option>
                        </select>
                      </div>
                    )}
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                      Autoplays a completed flash of the artwork first so viewers know what they are waiting for.
                    </p>
                  </div>

                  {/* Speed Pacing / Curve */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      Drawing Pacing (Pacing Curve)
                    </label>
                    <select
                      value={speedCurve}
                      onChange={(e) => setSpeedCurve(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '0.82rem',
                        background: '#1a1a20',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        color: '#fff',
                        outline: 'none',
                      }}
                    >
                      <option value="fast-start">Fast Start (Draws Outlines Fast) ⭐</option>
                      <option value="linear">Steady Pacing (Linear)</option>
                      <option value="waves">Organized Waves (Varying)</option>
                    </select>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                      ⭐ <strong>Fast Start</strong> triggers immediate rapid motion to keep eyes glued before slowing for details.
                    </p>
                  </div>

                </div>

                {/* Text Hook Sub-section */}
                <div style={{ marginTop: '20px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '0.82rem', fontWeight: 600, marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={hookTextEnabled}
                      onChange={(e) => setHookTextEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span>📺 Add Text Hook Overlay (e.g. "Wait for the end... 🤫")</span>
                  </label>

                  {hookTextEnabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                          Hook Message
                        </label>
                        <input
                          type="text"
                          value={hookText}
                          onChange={(e) => setHookText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.78rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '6px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                          Overlay Position
                        </label>
                        <select
                          value={hookTextPosition}
                          onChange={(e) => setHookTextPosition(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.78rem',
                            background: '#1a1a20',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '6px',
                            color: '#fff',
                          }}
                        >
                          <option value="top">Top (15%)</option>
                          <option value="center">Center (50%)</option>
                          <option value="bottom">Bottom (80%)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                          Hook Duration
                        </label>
                        <select
                          value={hookTextDuration}
                          onChange={(e) => setHookTextDuration(parseFloat(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.78rem',
                            background: '#1a1a20',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '6px',
                            color: '#fff',
                          }}
                        >
                          <option value="1.0">First 1s</option>
                          <option value="1.5">First 1.5s</option>
                          <option value="2.0">First 2s</option>
                          <option value="3.0">First 3s</option>
                          <option value="4.0">First 4s</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audio Tip Alert Banner */}
                <div style={{
                  marginTop: '20px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.15)',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>💡</span>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    <strong>Pro-Tip:</strong> Shorts algorithm heavily prioritizes trending sounds. Since exports are silent (no copyright strikes), add a trending YouTube sound/music overlay in the YouTube Shorts App after upload to boost reach by up to 500%!
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ── Multi-Image Queue / Gallery ── */}
          {images.length > 0 && (
            <div className="glass-card fade-in-up" style={{ width: '100%', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📚 Uploaded Queue ({images.length}/10)
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-ghost"
                    onClick={startPlayAll}
                    disabled={isPlayingAll || isExportingAll}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', color: isPlayingAll ? 'var(--accent)' : undefined }}
                  >
                    {isPlayingAll ? '⏳ Playing All...' : '▶ Play All'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={startExportAll}
                    disabled={isPlayingAll || isExportingAll}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', color: isExportingAll ? 'var(--accent)' : undefined }}
                  >
                    {isExportingAll ? '⏳ Exporting All...' : '🎬 Export All'}
                  </button>
                  {images.some(img => img.mp4Download) && (
                    <button
                      className="btn-primary"
                      onClick={downloadAllReady}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', boxShadow: 'none' }}
                    >
                      💾 Download All Ready
                    </button>
                  )}
                  <button
                    className="btn-ghost"
                    onClick={clearAllImages}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                {images.map((img, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={img.id}
                      onClick={() => handleThumbnailClick(idx)}
                      style={{
                        position: 'relative',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: isActive ? '2px solid var(--accent)' : '1px solid var(--border-glass)',
                        borderRadius: '12px',
                        padding: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? '0 0 15px var(--accent-glow)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                      className={isActive ? 'glow-accent' : ''}
                    >
                      {/* Delete button */}
                      <button
                        onClick={(e) => removeImage(idx, e)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.6)',
                          border: 'none',
                          color: '#ff6b6b',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          cursor: 'pointer',
                          zIndex: 10,
                        }}
                        title="Remove image"
                      >
                        ✕
                      </button>

                      {/* Thumbnail */}
                      <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>

                      {/* Name & status */}
                      <div style={{ fontSize: '0.75rem', overflow: 'hidden' }}>
                        <p style={{
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--accent)' : 'var(--text-primary)'
                        }}>
                          {img.name}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          {img.mp4Download ? (
                            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.68rem' }}>
                              🎬 Ready
                            </span>
                          ) : img.isExporting ? (
                            <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.68rem' }}>
                              ⏳ {img.exportProgress}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                              Ready to play
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Individual Download MP4 Button */}
                      {img.mp4Download && (
                        <a
                          href={img.mp4Download.url}
                          download={img.mp4Download.filename}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'block',
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                            color: '#fff',
                            textDecoration: 'none',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '4px 0',
                            borderRadius: '6px',
                            marginTop: '2px',
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          💾 Download MP4
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ width: '100%' }}>
            <CanvasPreview
              ref={canvasRef}
              image={activeImageObj}
              pixels={activeImage?.pixels}
              command={command}
              speed={speed}
              aspectRatio={aspectRatio}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              paperColor={paperColor}
              pencilColor={pencilColor}
              colorRevealEnabled={colorReveal}
              onReady={handleReady}
              onProgress={handleProgress}
              onCommandConsumed={handleCommandConsumed}
              teaserStyle={teaserStyle}
              teaserDuration={teaserDuration}
              hookTextEnabled={hookTextEnabled}
              hookText={hookText}
              hookTextPosition={hookTextPosition}
              hookTextDuration={hookTextDuration}
              speedCurve={speedCurve}
            />
          </div>

          {(isExporting || mp4Download) && (
            <div style={{ width: '100%' }} className="fade-in-up">
              <DownloadBar
                download={mp4Download}
                isConverting={isExporting}
                convertProgress={exportProgress}
                onDismiss={() => {
                  if (activeIndex !== -1) {
                    setImages(prev => prev.map((img, idx) => idx === activeIndex ? { ...img, mp4Download: null } : img));
                  }
                }}
              />
            </div>
          )}

          {activeImageObj && (
            <div style={{ width: '100%' }} className="fade-in-up">
              <AnimationControls
                isPlaying={isPlaying}
                isReady={true}
                isRecording={isExporting}
                progress={progress}
                speed={speed}
                onPlay={handlePlay}
                onPause={handlePause}
                onReset={handleReset}
                onSpeedChange={setSpeed}
                onExport={handleExport}
                onSavePNG={handleSavePNG}
              />
            </div>
          )}

          {images.length === 0 && (
            <p className="fade-in-up fade-in-up-delay-3" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', lineHeight: 1.7 }}>
              ✏️ Upload some photos and select one to watch your sketch come alive.
            </p>
          )}
        </div>
        )}
      </main>
      <Footer />
    </>
  );
};

export default HomePage;
