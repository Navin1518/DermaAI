/*
 * Purpose: Connect the Express backend to MongoDB through Mongoose.
 * MongoDB stores the application data, and Mongoose helps JavaScript work with
 * that data using models such as the User model.
 */

const mongoose = require("mongoose");

// Open one database connection before the server starts accepting requests.
async function connectToDatabase() {
  // MONGO_URI is kept in .env so database credentials are not written in code.
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

  // Older versions required every user to have an email. Replace that index
  // with sparse indexes so a user can instead register with a phone number.
  const usersCollection = mongoose.connection.collection("users");
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: "users" })
    .hasNext();

  // A new MongoDB database has no users collection until its first user is saved.
  if (!collectionExists) {
    await usersCollection.createCollection();
  }

  const existingIndexes = await usersCollection.indexes();
  const oldEmailIndex = existingIndexes.find(
    (index) =>
      index.key.email === 1 &&
      index.unique &&
      !index.sparse &&
      !index.partialFilterExpression
  );

  if (oldEmailIndex) {
    await usersCollection.dropIndex(oldEmailIndex.name);
  }

  // Sparse unique indexes enforce uniqueness when a user has that contact,
  // while allowing many phone-only users or many email-only users.
  await usersCollection.createIndex(
    { email: 1 },
    { unique: true, sparse: true }
  );
  await usersCollection.createIndex(
    { phone: 1 },
    { unique: true, sparse: true }
  );

  console.log("Connected to MongoDB.");
}

module.exports = connectToDatabase;
