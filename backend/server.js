/*
 * Purpose: Configure and start the DermaCare AI authentication API.
 * This file loads environment settings, connects MongoDB, and registers
 * middleware and routes before opening the HTTP port.
 */

require("dotenv").config();

const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const connectToDatabase = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const app = express();
const port = process.env.PORT || 5000;

// Fail early with a clear message when a required secret or connection is absent.
const requiredEnvironmentVariables = ["MONGO_URI", "JWT_SECRET", "CLIENT_URL"];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (variableName) => !process.env[variableName]
);

if (missingEnvironmentVariables.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvironmentVariables.join(", ")}`
  );
  process.exit(1);
}

// CORS allows the configured frontend to make requests and receive cookies.
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true
  })
);

// Parse JSON request bodies and cookies so controllers can use them.
app.use(express.json());
app.use(cookieParser());

// All four endpoints are grouped below the /api/auth URL prefix.
app.use("/api/auth", authRoutes);

// Connect to the database first so requests are not accepted before it is ready.
async function startServer() {
  try {
    await connectToDatabase();
    app.listen(port, () => {
      console.log(`DermaCare AI backend is running on port ${port}.`);
    });
  } catch (error) {
    console.error("Could not start the backend:", error);
    process.exit(1);
  }
}

startServer();
