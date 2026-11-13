import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css'; // Ajoute cette ligne
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css';
import './App.css';
import { getCanonicalRedirectUrl } from './utils/canonicalRedirect';

const redirectUrl = typeof window !== 'undefined' ? getCanonicalRedirectUrl(window.location) : null;

if (redirectUrl) {
  window.location.replace(redirectUrl);
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}
