/**
 * HomePage.jsx — owns animation + WebCodecs MP4 export state.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection       from '../components/HeroSection';
import HowItWorks        from '../components/HowItWorks';
import UploadArea        from '../components/UploadArea';
import CanvasPreview     from '../components/CanvasPreview';
import AnimationControls from '../components/AnimationControls';
import DownloadBar       from '../components/DownloadBar';
import Footer            from '../components/Footer';
import { exportToMP4 }   from '../utils/mp4Export';
import { convertToSketch, generateInkPixels } from '../utils/sketchUtils';

const HomePage = () => {
  const canvasRef = useRef(null);

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

  // Re-process all images in the queue when resolution or background style changes
  const reprocessAllImages = useCallback((ratio, thm) => {
    const { width, height } = getDimensions(ratio);
    const paper = thm === 'chalkboard' ? '#121214' : thm === 'white' ? '#ffffff' : '#fef8f0';
    const isChalk = thm === 'chalkboard';

    setImages(prev => prev.map(img => {
      if (img.mp4Download?.url) {
        URL.revokeObjectURL(img.mp4Download.url);
      }
      const { imageData } = convertToSketch(img.imageObj, width, height, paper, isChalk);
      const pixels = generateInkPixels(imageData, width, height, 240, isChalk);
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
    reprocessAllImages(aspectRatio, theme);
  }, [aspectRatio, theme, reprocessAllImages]);

  // Discard MP4 download links if line color alone changes (to force new export)
  useEffect(() => {
    setImages(prev => prev.map(img => {
      if (img.mp4Download) {
        URL.revokeObjectURL(img.mp4Download.url);
        return { ...img, mp4Download: null };
      }
      return img;
    }));
  }, [pencilColor]);

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
      const pixels = generateInkPixels(imageData, canvasWidth, canvasHeight, 240, isChalk);
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
  }, [canvasWidth, canvasHeight, paperColor, theme]);

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
      </main>
      <Footer />
    </>
  );
};

export default HomePage;
