import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PreferencesProvider } from './context/PreferencesContext';
import './index.css';
import './theme.css';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('No se encontró el elemento #root en index.html');
}

ReactDOM.createRoot(raiz).render(
  <React.StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </PreferencesProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
