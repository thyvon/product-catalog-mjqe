import rateLimit from "express-rate-limit";

// Strict rate limiting for credential endpoints (brute-force protection).
// Applied per-route on login endpoints only.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
