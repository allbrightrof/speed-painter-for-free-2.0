/**
 * App.jsx
 * Root component. Renders the single-page layout.
 * Future: add React Router here for multi-page navigation.
 */

import React from 'react';
import HomePage from './pages/HomePage';

function App() {
  return (
    <div id="app-root">
      <HomePage />
    </div>
  );
}

export default App;
