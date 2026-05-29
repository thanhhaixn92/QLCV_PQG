import rateLimit from "express-rate-limit";

const baseLimitConfig = {
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    errorType: "RATE_LIMITED",
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
};

export const apiLimiter = rateLimit({
  ...baseLimitConfig,
  skip: (req) => req.path === "/health" || process.env.NODE_ENV !== "production",
});

export const aiApiLimiter = rateLimit({
  ...baseLimitConfig,
  max: 100,
  message: {
    success: false,
    errorType: "too_many_requests",
    message: "Vượt quá số lượng yêu cầu AI cho phép. Vui lòng thử lại sau.",
  },
});
