import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Transient Preview Error Guard
function isTransientPreviewSocketError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : (() => {
            try { return JSON.stringify(reason || ""); }
            catch { return String(reason); }
          })();

  return /WebSocket closed without opened|failed to connect to websocket|WebChannelConnection|transport errored|Could not reach Cloud Firestore backend/i.test(message);
}

window.addEventListener("unhandledrejection", (event) => {
  if (isTransientPreviewSocketError(event.reason)) {
    console.warn("[NETWORK] Transient preview websocket warning. This does not block API requests.", event.reason);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
