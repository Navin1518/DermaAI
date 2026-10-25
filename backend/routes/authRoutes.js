/*
 * Purpose: Connect each authentication URL and HTTP method to its controller.
 * Keeping routes in one file makes the API endpoints easy to find.
 */

const express = require("express");
const { rateLimit } = require("express-rate-limit");
const {
  registerUser,
  verifyRegistrationCode,
  resendRegistrationCode,
  loginUser,
  logoutUser,
  getCurrentUser
} = require("../controllers/authController");
const requireAuthentication = require("../middleware/authMiddleware");

const router = express.Router();

// Limit verification requests to reduce spam and prevent guessing codes quickly.
const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many codes requested. Try again in 15 minutes." }
});
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many verification attempts. Try again in 15 minutes." }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again in 15 minutes." }
});

// Signup and resend can send paid email/SMS, so restrict those requests per IP.
router.post("/register", sendCodeLimiter, registerUser);
router.post("/verify-otp", verifyCodeLimiter, verifyRegistrationCode);
router.post("/resend-otp", sendCodeLimiter, resendRegistrationCode);
router.post("/login", loginLimiter, loginUser);
router.post("/logout", logoutUser);
router.get("/me", requireAuthentication, getCurrentUser);

module.exports = router;
