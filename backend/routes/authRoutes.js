/*
 * Purpose: Connect each authentication URL and HTTP method to its controller.
 * Keeping routes in one file makes the API endpoints easy to find.
 */

const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser
} = require("../controllers/authController");
const requireAuthentication = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes create a session; /me requires a verified login cookie.
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/me", requireAuthentication, getCurrentUser);

module.exports = router;
