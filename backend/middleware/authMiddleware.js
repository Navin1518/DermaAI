/*
 * Purpose: Protect routes by checking the JWT in the browser's auth cookie.
 * Middleware runs between a request and its controller, so an unauthenticated
 * request is stopped before it can reach the protected endpoint.
 */

const jwt = require("jsonwebtoken");

const AUTH_COOKIE_NAME = "dermacare_auth";

function requireAuthentication(request, response, next) {
  const token = request.cookies[AUTH_COOKIE_NAME];

  if (!token) {
    return response.status(401).json({
      message: "You are not logged in."
    });
  }

  try {
    // Verify the signature and expiry before trusting the user ID in the token.
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (
      typeof decodedToken !== "object" ||
      typeof decodedToken.userId !== "string"
    ) {
      return response.status(401).json({
        message: "Your login session is invalid. Please log in again."
      });
    }

    request.userId = decodedToken.userId;
    return next();
  } catch (error) {
    return response.status(401).json({
      message: "Your login session is invalid or has expired. Please log in again."
    });
  }
}

module.exports = requireAuthentication;
