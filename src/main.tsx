// Punkt wejścia aplikacji.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/nunito';
import './styles.css';
import App from './App';

// Service worker: zapisuje aplikację w pamięci telefonu, dzięki czemu działa offline,
// i sam pobiera nowe wersje po wdrożeniu.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
