/**
 * Footer.jsx
 * Minimal footer with app credits and links.
 */

import React from 'react';

const Footer = () => (
  <footer
    style={{
      textAlign: 'center',
      padding: '32px 16px',
      borderTop: '1px solid var(--border-glass)',
      marginTop: '40px',
    }}
  >
    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.8 }}>
      Built with{' '}
      <span style={{ color: '#a78bfa' }}>React</span> ·{' '}
      <span style={{ color: '#38bdf8' }}>HTML5 Canvas</span> ·{' '}
      <span style={{ color: '#4ade80' }}>Tailwind CSS</span>
      <br />
      <span style={{ opacity: 0.5 }}>
        SpeedPaint AI — No server needed. 100% runs in your browser.
      </span>
    </p>
  </footer>
);

export default Footer;
