const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const path = require('path');
const jwt = require('jsonwebtoken');
const { addSseClient, broadcastEvent } = require('./utils/realtime');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Local ingest logger helper (disabled in production by default)
// Ingest/debug posts are disabled in source by default to avoid local external calls
const _INGEST_URL = 'http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c';
const shouldSendIngest = false;
function sendIngest(/* payload */) {
  // no-op in source; enable via environment changes if needed
  return;
}

// Render Postgres requires SSL for external connections.
// Enable SSL automatically when connecting to a Render-hosted database.
const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;

// Middleware - CORS Configuration
// Allow multiple origins for production and development
// Set allowed origins for CORS. Add all frontend URLs (Cloudflare Pages, custom domain, localhost, etc.)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : (() => {
    // Production default origins (conservative)
    if (process.env.NODE_ENV === 'production') {
      return [
        'https://agricatch.store',
        'https://www.agricatch.store',
        'https://agricatch.onrender.com',
        'https://api.agricatch.store'
      ];
    }

    // Development defaults
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:7242',
      'http://127.0.0.1:7242',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
  })();

// CORS configuration
if (process.env.PERMISSIVE_CORS === 'true') {
  // Opt-in permissive mode: echo origin and allow credentials
  console.warn('⚠️ PERMISSIVE_CORS enabled - allowing any origin (use only for short-term debugging)');
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) return callback(null, true);

      // In development allow any origin (useful for local testing)
      if (process.env.NODE_ENV !== 'production') return callback(null, true);

      // In production only allow explicit origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Not allowed
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      return callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agriculture_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: pgSsl,
});

// DB migrations (best-effort)
// Ensure OTP table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        purpose VARCHAR(50) NOT NULL DEFAULT 'login',
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_otps_email_purpose ON otps(email, purpose)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at)`);
    console.log('✅ OTP table verified/created');
  } catch (error) {
    console.error('⚠️ OTP table creation check failed:', error.message);
  }
})();

// Test database connection
pool.connect((err, client, release) => {
  // #region agent log (only in development)
  sendIngest({location:'server.js:36',message:'Database connection test started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'});
  // #endregion

  if (err) {
    console.error('Error connecting to database:', err);
    // #region agent log (only in development)
    sendIngest({location:'server.js:37',message:'Database connection failed',data:{error:err.message,code:err.code},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'});
    // #endregion
  } else {
    console.log('Connected to PostgreSQL database');
    // #region agent log (only in development)
    sendIngest({location:'server.js:40',message:'Database connection successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'});
    // #endregion
    release();
  }
});

// Routes
// #region agent log
sendIngest({location:'server.js:47',message:'Loading routes',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
// #endregion

try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ /api/auth mounted');
  // #region agent log
  sendIngest({location:'server.js:49',message:'Auth route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  console.error('❌ Failed to mount /api/auth:', error);
  // #region agent log
  sendIngest({location:'server.js:49',message:'Auth route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/otp', require('./routes/otp'));
  console.log('✅ OTP route loaded successfully');
} catch (error) {
  console.error('❌ OTP route failed to load:', error);
}

try {
  app.use('/api/products', require('./routes/products'));
  // #region agent log
  sendIngest({location:'server.js:51',message:'Products route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:51',message:'Products route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api', require('./routes/reviews'));
  // #region agent log
  sendIngest({location:'server.js:52',message:'Reviews route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:52',message:'Reviews route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/cart', require('./routes/cart'));
  // #region agent log
  sendIngest({location:'server.js:53',message:'Cart route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:53',message:'Cart route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/wishlist', require('./routes/wishlist'));
  // #region agent log
  sendIngest({location:'server.js:54',message:'Wishlist route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:54',message:'Wishlist route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/orders', require('./routes/orders'));
  // #region agent log
  sendIngest({location:'server.js:55',message:'Orders route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:55',message:'Orders route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/notifications', require('./routes/notifications'));
  // #region agent log
  sendIngest({location:'server.js:56',message:'Notifications route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:56',message:'Notifications route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/messages', require('./routes/messages'));
  // #region agent log
  sendIngest({location:'server.js:57',message:'Messages route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:57',message:'Messages route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/addresses', require('./routes/addresses'));
  // #region agent log
  sendIngest({location:'server.js:58',message:'Addresses route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:58',message:'Addresses route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/admin', require('./routes/admin'));
  // #region agent log
  sendIngest({location:'server.js:57',message:'Admin route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:57',message:'Admin route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/upload', require('./routes/upload'));
  // #region agent log
  sendIngest({location:'server.js:59',message:'Upload route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:59',message:'Upload route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/contact', require('./routes/contact'));
  // #region agent log
  sendIngest({location:'server.js:58',message:'Contact route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:58',message:'Contact route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/farmers', require('./routes/farmers'));
  // #region agent log
  sendIngest({location:'server.js:58',message:'Farmers route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:58',message:'Farmers route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

// Test database connection route
app.get('/api/test-db', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
            ssl: pgSsl,
        });

        const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
        const users = await pool.query('SELECT username, email, role FROM users LIMIT 3');

        pool.end();

        res.json({
            status: '✅ Database Connected Successfully!',
            user_count: result.rows[0].user_count,
            sample_users: users.rows,
            message: 'Your login system is connected to PostgreSQL database!'
        });
    } catch (error) {
        res.status(500).json({
            status: '❌ Database Connection Failed',
            error: error.message,
            message: 'Check your PostgreSQL connection and .env file'
        });
    }
});

// Server-Sent Events (SSE) endpoint for real-time updates
// Note: EventSource cannot send Authorization headers reliably, so we accept token via query param.
app.get('/api/events', (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).end();

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write('retry: 3000\n\n');
    addSseClient(res, decoded);

    // Initial handshake event
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ user_id: decoded.id })}\n\n`);

    // Heartbeat (keeps proxies from closing the stream)
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch (_) {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  } catch (err) {
    res.status(401).end();
  }
});

// Serve specific HTML pages BEFORE static middleware
// This ensures these routes take precedence
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

app.get('/farmer.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'farmer.html'));
});

app.get('/orders.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'orders.html'));
});

app.get('/addresses.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'addresses.html'));
});

app.get('/clear_cache.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'clear_cache.html'));
});

app.get('/clear_ui_orders.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'clear_ui_orders.html'));
});

// Serve static files
// #region agent log
sendIngest({location:'server.js:148',message:'Setting up static file serving',data:{path:'../public'},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'});
// #endregion
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Additional CORS headers (backup - main CORS is handled above)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // If no origin (server-to-server or same-origin), allow by default
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (process.env.NODE_ENV !== 'production') {
    // Development: echo origin
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes(origin)) {
    // Production: only allow explicit origins
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Do not set CORS header for disallowed origins; client will see CORS error
    console.warn('Blocked CORS request from origin:', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Root route
app.get('/', (req, res) => {
  const fs = require('fs');
  const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>AgriCatch</title></head>
      <body>
        <h1>Welcome to AgriCatch! 🛒</h1>
        <p>Your website is almost ready!</p>
        <p>Server is running on port 3000.</p>
        <p>Frontend file path: ${indexPath}</p>
        <h2>Available Features:</h2>
        <ul>
          <li>✅ Browse Agricultural Products (Vegetables, Fruits, Grains)</li>
          <!-- Fishery/Seafood category removed -->
          <li>✅ Guest shopping cart</li>
          <li>✅ User registration and login</li>
          <li>✅ Cash on delivery payment</li>
        </ul>
        <h2>Test Accounts:</h2>
        <ul>
          <li>Email: juan@farm.ph | Password: password123 (Farmer)</li>
          <!-- Fishery/Seafood user removed -->
        </ul>
        <p><strong>Note:</strong> If you see this page, the frontend file couldn't be found. Please check the file path.</p>
      </body>
      </html>
    `);
  }
});

// Start server
// #region agent log
sendIngest({location:'server.js:210',message:'Starting server',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'});
// #endregion

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // #region agent log
  sendIngest({location:'server.js:212',message:'Server started successfully',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'});
  // #endregion
});

// Self-ping to prevent Render free tier from sleeping (random interval 1-13 min)
if (process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL) {
  const https = require('https');
  const url = process.env.RENDER_EXTERNAL_URL || 'https://api.agricatch.store';

  function schedulePing() {
    // Random interval between 1 and 13 minutes (in ms)
    const min = 1 * 60 * 1000;
    const max = 13 * 60 * 1000;
    const interval = Math.floor(Math.random() * (max - min + 1)) + min;

    setTimeout(() => {
      https.get(url + '/api/test-db', (res) => {
        console.log(`[Self-ping] Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('[Self-ping] Error:', err.message);
      });
      schedulePing();
    }, interval);
  }

  schedulePing();
}

module.exports = app;