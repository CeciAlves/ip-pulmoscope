/**
 * main.tsx
 * Ponto de entrada da aplicação. Carrega o tema global (CSS) e
 * monta o componente <App /> na div #root do index.html.
 */

import './theme/global.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// StrictMode ativa avisos extras em desenvolvimento (não afeta a build final!)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);