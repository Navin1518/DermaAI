/*
 * Purpose: Handle signup, login, logout, and current-user API requests.
 * Controllers receive requests from routes, use the User model, and send
 * safe responses back to the frontend.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const AUTH_COOKIE_NAME = "dermacare_auth";
const ONE_WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

// Return only fields that are safe and useful for the frontend.
function getPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    skinType: user.skinType,
    concerns: user.concerns,
    createdAt: user.createdAt
  };
}

// JWT means JSON Web Token: a signed proof of login that the server can verify.
// The token stays in an httpOnly cookie, which browser JavaScript cannot read.
function setAuthenticationCookie(response, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
  const isProduction = process.env.NODE_ENV === "production";

  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: ONE_WEEK_IN_MILLISECONDS,
    path: "/"
  });
}

// Create a new account, hash the password, save it, and log the user in.
async function registerUser(request, response) {
  try {
    const { name, email, password, skinType, concerns } = request.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return response.status(400).json({
        message: "Name, email, and password are required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return response.status(400).json({
        message: "Please provide a valid email address."
      });
    }

    if (skinType !== undefined && typeof skinType !== "string") {
      return response.status(400).json({
        message: "Skin type must be text."
      });
    }

    if (
      concerns !== undefined &&
      (!Array.isArray(concerns) ||
        !concerns.every((concern) => typeof concern === "string"))
    ) {
      return response.status(400).json({
        message: "Concerns must be a list of text values."
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return response.status(409).json({
        message: "An account with this email already exists."
      });
    }

    // bcrypt adds a salt and a one-way hash, so the original password cannot
    // be recovered if the database is ever exposed.
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      skinType,
      concerns
    });

    setAuthenticationCookie(response, newUser._id.toString());

    return response.status(201).json({
      message: "Account created successfully.",
      user: getPublicUser(newUser)
    });
  } catch (error) {
    // A unique database index also protects against two simultaneous signups.
    if (error.code === 11000) {
      return response.status(409).json({
        message: "An account with this email already exists."
      });
    }

    console.error("Register error:", error);
    return response.status(500).json({
      message: "Could not create the account. Please try again."
    });
  }
}

// Find the account and compare the submitted password with its stored hash.
async function loginUser(request, response) {
  try {
    const { email, password } = request.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return response.status(400).json({
        message: "Email and password are required."
      });
    }

    // passwordHash is normally hidden by the schema, so select it only here.
    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+passwordHash");

    if (!user) {
      return response.status(401).json({
        message: "Email or password is incorrect."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return response.status(401).json({
        message: "Email or password is incorrect."
      });
    }

    setAuthenticationCookie(response, user._id.toString());

    return response.status(200).json({
      message: "Login successful.",
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    return response.status(500).json({
      message: "Could not log in. Please try again."
    });
  }
}

// Remove the browser's authentication cookie to log the user out.
function logoutUser(request, response) {
  const isProduction = process.env.NODE_ENV === "production";

  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
  });

  return response.status(200).json({
    message: "Logout successful."
  });
}

// Return the account identified by the JWT after authMiddleware verifies it.
async function getCurrentUser(request, response) {
  try {
    const user = await User.findById(request.userId);

    if (!user) {
      return response.status(401).json({
        message: "You are not logged in."
      });
    }

    return response.status(200).json({
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return response.status(500).json({
      message: "Could not get the current user. Please try again."
    });
  }
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser
};
