import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/designTokens.css';
import './styles/layout.css';
import './styles/motion.css';
import './styles/overview.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/SPHCC/">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
