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

if (import.meta.env.DEV && typeof window !== "undefined") {
  const originalConsoleError = console.error;

  console.error = (...args: unknown[]) => {
    const first = args[0];

    if (
      typeof first === "string" &&
      first.includes("Encountered two children with the same key")
    ) {
      originalConsoleError("[DUPLICATE_KEY_DIAGNOSTIC]", {
        rawArgs: args,
        duplicateKey: args[1],
        maybeComponentStack: args.find(
          (arg) => typeof arg === "string" && String(arg).includes("at ")
        ),
      });

      originalConsoleError("[DUPLICATE_KEY_TRACE]");
      console.trace();
    }

    originalConsoleError(...args);
  };
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
