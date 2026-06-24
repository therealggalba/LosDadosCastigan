import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Configuración básica local de i18n para desarrollo independiente
i18n.use(initReactI18next).init({
  resources: {
    es: {
      translation: {
        // Teclas locales básicas para que no falle el renderizado independiente
        "common": {
          "player": "Jugador",
          "aiPlayer": "IA"
        },
        "gameHub": {
          "losDadosCastigan": {
            "playerTypeHuman": "Humano",
            "playerTypeAi": "IA",
            "playerLabel": "Jugador",
            "aiLabel": "IA"
          }
        }
      }
    }
  },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
