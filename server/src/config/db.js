import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/admanager';
    console.log(`Connecting to MongoDB at: ${connStr}`);
    // Set a short timeout so it doesn't hang indefinitely if offline
    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB Connected successfully.`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log(`Server will continue running without database persistence. Please ensure MongoDB is running.`);
  }
};

export default connectDB;
