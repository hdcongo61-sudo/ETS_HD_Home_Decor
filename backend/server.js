const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middlewares/errorMiddleware');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const path = require('path');

// ── Global tenant isolation ──
// Register BEFORE any model is compiled (i.e. before the route requires
// below) so every tenant-scoped schema gets automatic query scoping.
const mongoose = require('mongoose');
mongoose.plugin(require('./utils/tenantGuardPlugin'));

// Route files
const productRoutes = require('./routes/productRoutes');
const clientRoutes = require('./routes/clientRoutes');
const saleRoutes = require('./routes/saleRoutes');
const proformaRoutes = require('./routes/proformaRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const searchRoutes = require("./routes/searchRoutes");
const pdfRoutes = require('./routes/pdfRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const bankRoutes = require('./routes/bankRoutes');
const documentRoutes = require('./routes/documentRoutes');
const lookupRoutes = require('./routes/lookupRoutes');
const appSettingsRoutes = require('./routes/appSettingsRoutes');
const adminRequestRoutes = require('./routes/adminRequestRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const supportRoutes = require('./routes/supportRoutes');

const app = express();

app.disable('x-powered-by');

// 1. Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Let the frontend build handle CSP
}));

// ✅ Trust proxy (important for Render)
app.set('trust proxy', 1);

// ✅ CORS setup
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://www.hdgestion.co',
  'https://hdgestion.co',
]
  .flatMap((origin) => String(origin || '').split(','))
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 204,
}));

// Lightweight health check — no auth, no DB, not rate-limited. Used by uptime
// pingers (cron-job.org / UptimeRobot) to keep the host warm, and by the
// frontend to detect a cold start and show a "waking up" indicator.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});


// 3. Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again after 15 minutes',
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/password-update-request', authLimiter);

// 4. Body parser with size limit
// Bulk product import carries many rows in one JSON body, so it needs a larger
// limit than the default endpoints. This route-specific parser runs first and
// sets req.body; the global 10kb parser below then skips the already-read body.
app.use('/api/products/import', express.json({ limit: '5mb' }));
// Bulk product edits can carry a large list of ids.
app.use('/api/products/bulk', express.json({ limit: '1mb' }));
// Editable super-admin documents can exceed the tiny default body limit.
app.use('/api/export/doc', express.json({ limit: '256kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 5. Cookie parser
app.use(cookieParser());

// 6. Data sanitization against NoSQL injection
app.use(mongoSanitize());

// 7. Data sanitization against XSS
app.use(xss());

// 8. Prevent parameter pollution
app.use(hpp({
  whitelist: ['sort', 'page', 'limit', 'fields'] // allow these for pagination
}));

// 9. Mount routers
app.use('/api/products', productRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/proformas', proformaRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exports', exportRoutes);
app.use("/api/search", searchRoutes);
app.use('/api/export', pdfRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/app-settings', appSettingsRoutes);
app.use('/api/admin-requests', adminRequestRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/support', supportRoutes);

// 10. Serve frontend build (production)
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath));

// 11. SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API route not found' });
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// 12. Error handler middleware
app.use(errorHandler);

// 13. Handle 404 for unknown API routes
app.use('/api/*', (req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found'
  });
});

const port = process.env.PORT;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} is busy, trying port ${Number(port) + 1}`);
    app.listen(Number(port) + 1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});
