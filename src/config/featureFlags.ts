export const FEATURE_FLAGS = {
  PROPOSAL_MODULE: false,
  PROPOSAL_MENU: false,
  PROPOSAL_CHAT_CONTEXT: false,
  PROPOSAL_BACKEND_API: false,

  GOOGLE_AUTH_ENABLED: import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true",
  ANONYMOUS_AUTH_ENABLED: import.meta.env.VITE_ENABLE_ANONYMOUS_AUTH === "true",
} as const;
