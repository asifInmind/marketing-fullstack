import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import shopifyRoutes from './routes/shopify.js';

// Load Environment Variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5001;

// Global Middlewares
const allowedOrigins = [
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);

    // Allow configured production origin
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow all local development origins on any port
    const isLocalhost = origin.startsWith('http://localhost:') || origin === 'http://localhost' ||
                        origin.startsWith('http://127.0.0.1:') || origin === 'http://127.0.0.1';
    const isLocalNetwork = origin.startsWith('http://192.168.') || 
                           origin.startsWith('http://172.') || 
                           origin.startsWith('http://10.');

    if (isLocalhost || isLocalNetwork) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AdManager backend is running smoothly.' });
});

// Disable browser caching for API routes to ensure filter switches fetch fresh DB data
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});

// Mount Routes
app.use('/api', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/shopify', shopifyRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Prevent crashes from unhandled promise rejections or uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] caught:', err);
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 AdManager backend server running on port ${PORT}`);
});
