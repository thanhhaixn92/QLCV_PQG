import rateLimit from "express-rate-limit";

export const aiApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    errorType: "too_many_requests",
    message: "Vượt quá số lượng yêu cầu AI cho phép. Vui lòng thử lại sau.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});
