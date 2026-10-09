const mongoose = require('mongoose');

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is not configured. Copy .env.example to .env.');
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };