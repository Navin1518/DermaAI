/*
 * Purpose: Handle signup, one-time-code verification, login, logout, and
 * current-user API requests.
 * Controllers receive requests from routes, use the User model, and send
 * safe responses back to the frontend.
 */

const { createHmac, randomInt, timingSafeEqual } = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendVerificationCode = require("../services/verificationService");

const AUTH_COOKIE_NAME = "dermacare_auth";
const ONE_WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_CODE_LIFETIME = 10 * 60 * 1000;
const RESEND_WAIT_TIME = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

class VerificationDeliveryError extends Error {
  constructor(message) {
    super(message);
    this.name = "VerificationDeliveryError";
  }
}

// Return only fields that are safe and useful for the frontend.
function getPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email || "",
    phone: user.phone || "",
    skinType: user.skinType,
    concerns: user.concerns,
    createdAt: user.createdAt
  };
}

// Read one contact method and normalize it before using it in MongoDB.
function getContactFromRequest(body) {
  const rawEmail = body.email === undefined ? "" : body.email;
  const rawPhone = body.phone === undefined ? "" : body.phone;

  if (typeof rawEmail !== "string" || typeof rawPhone !== "string") {
    return { error: "Email and phone must be text values." };
  }

  const email = rawEmail.trim().toLowerCase();
  const phone = rawPhone.trim();
  const hasEmail = email.length > 0;
  const hasPhone = phone.length > 0;

  if (hasEmail === hasPhone) {
    return { error: "Enter either an email address or a phone number." };
  }

  if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please provide a valid email address." };
  }

  // Phone numbers use the international +country-code format (E.164).
  if (hasPhone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return {
      error: "Enter the phone number with its country code, for example +919876543210."
    };
  }

  return hasEmail
    ? { contactType: "email", contactValue: email }
    : { contactType: "phone", contactValue: phone };
}

function getContactQuery(contactType, contactValue) {
  return { [contactType]: contactValue };
}

// Store a keyed hash instead of the six-digit code itself.
function hashVerificationCode(userId, code) {
  return createHmac("sha256", process.env.JWT_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");
}

function clearVerificationCode(user) {
  user.verificationCodeHash = undefined;
  user.verificationCodeExpiresAt = undefined;
  user.verificationCodeSentAt = undefined;
  user.verificationAttempts = 0;
}

// Generate, save, then deliver a code. Never return the code in the API response.
async function createAndSendVerificationCode(user, contactType, contactValue) {
  const code = randomInt(100000, 1000000).toString();
  const now = new Date();

  user.verificationCodeHash = hashVerificationCode(user._id.toString(), code);
  user.verificationCodeExpiresAt = new Date(
    now.getTime() + VERIFICATION_CODE_LIFETIME
  );
  user.verificationCodeSentAt = now;
  user.verificationAttempts = 0;
  await user.save();

  try {
    await sendVerificationCode(contactType, contactValue, code);
  } catch (error) {
    clearVerificationCode(user);
    await user.save();
    throw new VerificationDeliveryError(error.message);
  }
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

// Start signup by saving an unverified account and sending a code to one contact.
async function registerUser(request, response) {
  try {
    const body = request.body || {};
    const { name, password, skinType, concerns } = body;
    const contact = getContactFromRequest(body);

    if (!contact.contactType) {
      return response.status(400).json({ message: contact.error });
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return response.status(400).json({
        message: "Name and password are required."
      });
    }

    if (skinType !== undefined && typeof skinType !== "string") {
      return response.status(400).json({ message: "Skin type must be text." });
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

    const existingUser = await User.findOne(
      getContactQuery(contact.contactType, contact.contactValue)
    ).select("+verificationCodeSentAt");

    if (existingUser && existingUser.isVerified) {
      return response.status(409).json({
        message: "An account with this contact already exists. Please sign in."
      });
    }

    const now = Date.now();
    if (
      existingUser &&
      existingUser.verificationCodeSentAt &&
      now - existingUser.verificationCodeSentAt.getTime() < RESEND_WAIT_TIME
    ) {
      return response.status(429).json({
        message: "A code was sent recently. Wait one minute before requesting another."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const pendingUser =
      existingUser ||
      new User(getContactQuery(contact.contactType, contact.contactValue));

    pendingUser.name = name.trim();
    pendingUser.passwordHash = passwordHash;
    pendingUser.skinType = skinType || "";
    pendingUser.concerns = concerns || [];
    pendingUser.isVerified = false;

    // Save first so verification codes can be safely tied to a database user ID.
    await pendingUser.save();
    await createAndSendVerificationCode(
      pendingUser,
      contact.contactType,
      contact.contactValue
    );

    return response.status(202).json({
      message: `A verification code was sent to your ${contact.contactType}. It expires in 10 minutes.`,
      contactType: contact.contactType
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        message: "An account with this contact already exists. Please sign in."
      });
    }

    if (error instanceof VerificationDeliveryError) {
      console.error("Register OTP delivery error:", error.message);
      const message = error.message.includes("not configured")
        ? error.message
        : "Could not send the verification code. Check your email/SMS settings and try again.";
      return response.status(503).json({ message });
    }

    console.error("Register error:", error.message);
    return response.status(500).json({
      message: "Could not create the account. Please try again."
    });
  }
}

// Confirm the code, mark the account verified, and sign the user in.
async function verifyRegistrationCode(request, response) {
  try {
    const body = request.body || {};
    const contact = getContactFromRequest(body);
    const { code } = body;

    if (!contact.contactType) {
      return response.status(400).json({ message: contact.error });
    }

    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return response.status(400).json({
        message: "Enter the six-digit verification code."
      });
    }

    const user = await User.findOne(
      getContactQuery(contact.contactType, contact.contactValue)
    ).select(
      "+verificationCodeHash +verificationCodeExpiresAt +verificationAttempts"
    );

    if (!user || user.isVerified) {
      return response.status(400).json({
        message: "No account is waiting for verification. Create an account first."
      });
    }

    if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) {
      return response.status(400).json({
        message: "Your code is missing or expired. Request a new code."
      });
    }

    if (user.verificationCodeExpiresAt.getTime() < Date.now()) {
      clearVerificationCode(user);
      await user.save();
      return response.status(400).json({
        message: "Your code has expired. Request a new code."
      });
    }

    const submittedHash = Buffer.from(
      hashVerificationCode(user._id.toString(), code),
      "hex"
    );
    const savedHash = Buffer.from(user.verificationCodeHash, "hex");
    const codeMatches =
      submittedHash.length === savedHash.length &&
      timingSafeEqual(submittedHash, savedHash);

    if (!codeMatches) {
      user.verificationAttempts += 1;
      const attemptsExceeded =
        user.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS;
      if (attemptsExceeded) clearVerificationCode(user);
      await user.save();

      return response.status(attemptsExceeded ? 429 : 400).json({
        message: attemptsExceeded
          ? "Too many incorrect codes. Request a new verification code."
          : "That code is incorrect. Please try again."
      });
    }

    user.isVerified = true;
    clearVerificationCode(user);
    await user.save();
    setAuthenticationCookie(response, user._id.toString());

    return response.status(200).json({
      message: "Contact verified. Your account is ready.",
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error("Verify OTP error:", error.message);
    return response.status(500).json({
      message: "Could not verify the code. Please try again."
    });
  }
}

// Send another code only to an unverified account and enforce a one-minute wait.
async function resendRegistrationCode(request, response) {
  try {
    const contact = getContactFromRequest(request.body || {});
    if (!contact.contactType) {
      return response.status(400).json({ message: contact.error });
    }

    const user = await User.findOne(
      getContactQuery(contact.contactType, contact.contactValue)
    ).select("+verificationCodeSentAt");

    // Use the same response for missing and already-verified accounts.
    if (!user || user.isVerified) {
      return response.status(200).json({
        message: "If this contact needs verification, a new code has been sent."
      });
    }

    if (
      user.verificationCodeSentAt &&
      Date.now() - user.verificationCodeSentAt.getTime() < RESEND_WAIT_TIME
    ) {
      return response.status(429).json({
        message: "Wait one minute before requesting another code."
      });
    }

    await createAndSendVerificationCode(
      user,
      contact.contactType,
      contact.contactValue
    );

    return response.status(200).json({
      message: `A new verification code was sent to your ${contact.contactType}.`
    });
  } catch (error) {
    if (error instanceof VerificationDeliveryError) {
      console.error("Resend OTP delivery error:", error.message);
      const message = error.message.includes("not configured")
        ? error.message
        : "Could not send a new verification code. Check your email/SMS settings and try again.";
      return response.status(503).json({ message });
    }

    console.error("Resend OTP error:", error.message);
    return response.status(500).json({
      message: "Could not resend the verification code. Please try again."
    });
  }
}

// Find the account and compare the submitted password with its stored hash.
async function loginUser(request, response) {
  try {
    const body = request.body || {};
    const contact = getContactFromRequest(body);
    const { password } = body;

    if (!contact.contactType) {
      return response.status(400).json({ message: contact.error });
    }

    if (typeof password !== "string" || !password) {
      return response.status(400).json({
        message: "Password is required."
      });
    }

    // passwordHash is normally hidden by the schema, so select it only here.
    const user = await User.findOne(
      getContactQuery(contact.contactType, contact.contactValue)
    ).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({
        message: "Contact or password is incorrect."
      });
    }

    if (!user.isVerified) {
      return response.status(403).json({
        message: "Verify your email or phone before signing in. Create your account again to request a new code."
      });
    }

    setAuthenticationCookie(response, user._id.toString());

    return response.status(200).json({
      message: "Login successful.",
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error.message);
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

    if (!user || !user.isVerified) {
      return response.status(401).json({
        message: "You are not logged in."
      });
    }

    return response.status(200).json({
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error("Get current user error:", error.message);
    return response.status(500).json({
      message: "Could not get the current user. Please try again."
    });
  }
}

module.exports = {
  registerUser,
  verifyRegistrationCode,
  resendRegistrationCode,
  loginUser,
  logoutUser,
  getCurrentUser
};
