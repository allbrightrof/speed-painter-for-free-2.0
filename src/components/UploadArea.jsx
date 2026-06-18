/**
 * UploadArea.jsx
 * Drag-and-drop / click-to-upload area for the user's images.
 * Accepts multiple images (up to 10 at once).
 */

import React, { useRef, useState, useCallback } from 'react';

const UploadArea = ({ onImagesSelected, imageCount = 0 }) => {
  const inputRef        = useRef(null);
  const [dragging, setDragging]   = useState(false);

  const handleFiles = useCallback((filesList) => {
    if (!filesList || filesList.length === 0) return;

    const files = Array.from(filesList).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    if (imageCount + files.length > 10) {
      alert(`You can only upload up to 10 images. Current count: ${imageCount}. Attempted to add: ${files.length}.`);
    }

    const allowedFiles = files.slice(0, Math.max(0, 10 - imageCount));
    if (allowedFiles.length === 0) return;

    let loadedCount = 0;
    const items = [];

    allowedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          items.push({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            dataUrl: dataUrl,
            imageObj: img,
          });
          loadedCount++;
          if (loadedCount === allowedFiles.length) {
            onImagesSelected(items);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }, [onImagesSelected, imageCount]);

  const onInputChange = (e) => {
    handleFiles(e.target.files);
    // Reset file input value so same files can be re-uploaded
    if (e.target) e.target.value = '';
  };

  const onDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = ()  => setDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <section style={{ width: '100%', maxWidth: '680px', margin: '0 auto' }}>
      <div
        className={`glass-card ${dragging ? 'glow-accent' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          cursor: 'pointer',
          padding: '40px 32px',
          textAlign: 'center',
          transition: 'all 0.25s ease',
          borderColor: dragging ? 'rgba(167,139,250,0.5)' : undefined,
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {dragging && (
          <div
            className="shimmer"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '20px',
              opacity: 0.3,
            }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(167,139,250,0.1)',
              border: '2px dashed rgba(167,139,250,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              transition: 'all 0.2s ease',
              transform: dragging ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {dragging ? '🎯' : '🖼️'}
          </div>

          <div>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>
              {dragging ? 'Drop them here!' : 'Upload up to 10 images'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Drag &amp; drop or{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>browse files</span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
              PNG, JPG, WEBP · Select multiple files at once · Current: {imageCount}/10
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={onInputChange}
          id="image-upload-input"
        />
      </div>
    </section>
  );
};

export default UploadArea;
