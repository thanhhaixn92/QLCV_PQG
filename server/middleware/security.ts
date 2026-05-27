import cors from "cors";
import helmet from "helmet";
import express from "express";

export function setupSecurity(app: express.Application) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Disable origin check for development
        if (process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // If production and ALLOWED_ORIGINS is NOT set, warn and BLOCK
        if (
          process.env.NODE_ENV === "production" &&
          allowedOrigins.length === 0
        ) {
          console.warn(
            `[CORS Blocked] ALLOWED_ORIGINS is not set. Blocking origin: ${origin}`,
          );
          return callback(new Error("CORS origin not allowed"));
        }

        // Detailed warning for CORS troubleshooting
        console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
        return callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: false,
    }),
  );

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        xFrameOptions: false,
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Vite chunks if any
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
            fontSrc: ["'self'", "https:", "data:", "blob:"],
            frameAncestors: [
              "'self'",
              "https://ai.studio",
              "https://*.ai.studio",
              "https://*.google.com",
            ],
          },
        },
      }),
    );
  } else {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        xFrameOptions: false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      }),
    );
  }
}
