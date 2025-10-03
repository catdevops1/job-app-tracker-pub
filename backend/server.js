const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jobtracker',
  user: process.env.DB_USER || 'jobuser',
  password: process.env.DB_PASSWORD || 'jobtracker123'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint - BEFORE rate limiting to avoid probe failures
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rate limiting - applied AFTER health endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path === '/health' // Additional safety: skip health checks
});
app.use(limiter);

// Auth rate limiting (stricter for login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Initialize database tables
async function initDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Job applications table (updated with user_id)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        job_title VARCHAR(255) NOT NULL,
        job_url TEXT,
        location VARCHAR(255),
        salary_range VARCHAR(100),
        application_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'applied',
        description TEXT,
        requirements TEXT,
        notes TEXT,
        contact_person VARCHAR(255),
        contact_email VARCHAR(255),
        follow_up_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add user_id to existing job_applications if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='job_applications' AND column_name='user_id') THEN
          ALTER TABLE job_applications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    
    // Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_job_applications_company ON job_applications(company_name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// AUTH ENDPOINTS

// Register new user
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, passwordHash]
    );

    const newUser = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at
      }
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// JOB ENDPOINTS (Updated with authentication)

// Get all job applications for current user
app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const { status, company, page = 1, limit = 20 } = req.query;
    let query = 'SELECT * FROM job_applications WHERE user_id = $1';
    let params = [req.user.userId];
    let whereConditions = [];

    if (status) {
      whereConditions.push('status = $' + (params.length + 1));
      params.push(status);
    }

    if (company) {
      whereConditions.push('company_name ILIKE $' + (params.length + 1));
      params.push(`%${company}%`);
    }

    if (whereConditions.length > 0) {
      query += ' AND ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    
    const offset = (page - 1) * limit;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    let countQuery = 'SELECT COUNT(*) FROM job_applications WHERE user_id = $1';
    let countParams = [req.user.userId];
    
    if (whereConditions.length > 0) {
      countQuery += ' AND ' + whereConditions.join(' AND ');
      countParams = [...countParams, ...params.slice(1, params.length - 2)];
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      jobs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific job application (user-owned only)
app.get('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const result = await pool.query(
      'SELECT * FROM job_applications WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job application not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new job application
app.post('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const {
      company_name,
      job_title,
      job_url,
      location,
      salary_range,
      application_date,
      status = 'applied',
      description,
      requirements,
      notes,
      contact_person,
      contact_email,
      follow_up_date
    } = req.body;

    if (!company_name || !job_title) {
      return res.status(400).json({ error: 'Company name and job title are required' });
    }

    // Convert empty date strings to null
    const app_date = application_date || null;
    const followup_date = follow_up_date || null;

    const result = await pool.query(`
      INSERT INTO job_applications 
      (user_id, company_name, job_title, job_url, location, salary_range, application_date, 
       status, description, requirements, notes, contact_person, contact_email, follow_up_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [req.user.userId, company_name, job_title, job_url, location, salary_range, app_date,
        status, description, requirements, notes, contact_person, contact_email, followup_date]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating job application:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update job application (user-owned only)
app.put('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      job_title,
      job_url,
      location,
      salary_range,
      application_date,
      status,
      description,
      requirements,
      notes,
      contact_person,
      contact_email,
      follow_up_date
    } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    if (!company_name || !job_title) {
      return res.status(400).json({ error: 'Company name and job title are required' });
    }

    // Convert empty date strings to null
    const app_date = application_date || null;
    const followup_date = follow_up_date || null;

    const result = await pool.query(`
      UPDATE job_applications 
      SET company_name = $1, job_title = $2, job_url = $3, location = $4, 
          salary_range = $5, application_date = $6, status = $7, description = $8,
          requirements = $9, notes = $10, contact_person = $11, contact_email = $12,
          follow_up_date = $13, updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND user_id = $15
      RETURNING *
    `, [company_name, job_title, job_url, location, salary_range, app_date,
        status, description, requirements, notes, contact_person, contact_email, 
        followup_date, id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job application not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating job application:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete job application (user-owned only)
app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const result = await pool.query(
      'DELETE FROM job_applications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job application not found' });
    }

    res.json({ message: 'Job application deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting job application:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get application statistics for current user
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
        COUNT(CASE WHEN status = 'interview' THEN 1 END) as interview,
        COUNT(CASE WHEN status = 'offer' THEN 1 END) as offer,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn
      FROM job_applications
      WHERE user_id = $1
    `;
    
    const result = await pool.query(statsQuery, [req.user.userId]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initDatabase();
});
