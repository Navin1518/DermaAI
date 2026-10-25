/*
 * Purpose: Connect the Express backend to MongoDB through Mongoose.
 * MongoDB stores the application data, and Mongoose helps JavaScript work with
 * that data using models such as the User model.
 */

const mongoose = require("mongoose");

// Open one database connection before the server starts accepting requests.
async function connectToDatabase() {
  // MONGO_URI is kept in .env so database credentials are not written in code.
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
}

module.exports = connectToDatabase;
