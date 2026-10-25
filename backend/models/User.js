/*
 * Purpose: Define the shape and validation rules for a DermaCare AI user.
 * Mongoose uses this model to save and read user documents in MongoDB.
 */

const mongoose = require("mongoose");

// A schema describes which fields each MongoDB user document contains.
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  // Store only a bcrypt hash, never the password entered by the user.
  // select: false also keeps the hash out of normal database queries.
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  skinType: {
    type: String,
    default: ""
  },
  concerns: {
    type: [String],
    default: []
  },
  // A user cannot log in until they prove they can receive a code at this contact.
  isVerified: {
    type: Boolean,
    default: false
  },
  // Keep only a keyed hash of the one-time code; never store or return the code.
  verificationCodeHash: {
    type: String,
    select: false
  },
  verificationCodeExpiresAt: {
    type: Date,
    select: false
  },
  verificationCodeSentAt: {
    type: Date,
    select: false
  },
  verificationAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);
