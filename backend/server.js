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

// Route files
const productRoutes = require('./routes/productRoutes');
const clientRoutes = require('./routes/clientRoutes');
const saleRoutes = require('./routes/saleRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const searchRoutes = require("./routes/searchRoutes");
const pdfRoutes = require('./routes/pdfRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// 1. Set security HTTP headers
app.use(helmet());

// ✅ Trust proxy (important for Render)
app.set('trust proxy', 1);

// ✅ CORS setup
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://www.hdgestion.co'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
}));


// 3. Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// 4. Body parser with size limit
app.use(express.json({ limit: '10kb' }));

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
app.use('/api/employees', employeeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exports', exportRoutes);
app.use("/api/search", searchRoutes);
app.use('/api/export', pdfRoutes);
app.use('/api/notifications', notificationRoutes);


// 10. Error handler middleware
app.use(errorHandler);

// 11. Handle 404 errors
app.use((req, res, next) => {
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
