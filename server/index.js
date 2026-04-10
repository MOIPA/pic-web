const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const session = require('express-session');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Auth Config =====
// Set via environment variables or use defaults
// Usage: GALLERY_USERS='{"admin":"yourpassword"}' node index.js
const USERS = JSON.parse(process.env.GALLERY_USERS || '{"admin":"admin123"}');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const thumbsDir = path.join(uploadsDir, 'thumbnails');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(thumbsDir, { recursive: true });

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax'
  }
}));

// ===== Auth Routes (no auth required) =====
const clientDir = path.join(__dirname, '..', 'client');

// Serve login page (always accessible)
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(clientDir, 'login.html'));
});

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  if (USERS[username] && USERS[username] === password) {
    req.session.user = username;
    return res.json({ success: true, username });
  }

  res.status(401).json({ success: false, error: 'Invalid username or password' });
});

// Auth check API
app.get('/api/auth/check', (req, res) => {
  if (req.session.user) {
    return res.json({ success: true, username: req.session.user });
  }
  res.status(401).json({ success: false });
});

// Logout API
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ===== Auth Middleware =====
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

function requireAuthPage(req, res, next) {
  if (req.session.user) return next();
  if (req.accepts('html')) return res.redirect('/login.html');
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

// Protect uploaded files
app.use('/uploads', requireAuthPage, express.static(uploadsDir));

// Protect all other frontend pages (except login.html, and static assets needed for login)
app.use((req, res, next) => {
  // Allow login page assets
  if (req.path === '/login.html') return next();
  // Don't interfere with API routes (handled separately below)
  if (req.path.startsWith('/api/')) return next();

  // For HTML page requests, check auth
  if (req.path === '/' || req.path === '/index.html') {
    if (!req.session.user) return res.redirect('/login.html');
  }

  next();
});

// Serve frontend (after auth check for index)
app.use(express.static(clientDir));

// Protect all API routes below
app.use('/api', requireAuth);

// ===== Image metadata =====
const metaFile = path.join(uploadsDir, 'meta.json');
let images = [];

function loadMeta() {
  try {
    if (fs.existsSync(metaFile)) {
      images = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    }
  } catch {
    images = [];
  }
}

function saveMeta() {
  fs.writeFileSync(metaFile, JSON.stringify(images, null, 2));
}

loadMeta();

// Multer config
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// POST /api/upload
app.post('/api/upload', upload.array('photos', 20), async (req, res) => {
  try {
    const results = [];
    const category = req.body.category || '';

    for (const file of req.files) {
      const filename = file.filename;
      const originalPath = path.join(uploadsDir, filename);
      const thumbFilename = `thumb_${filename}`;
      const thumbPath = path.join(thumbsDir, thumbFilename);

      const metadata = await sharp(originalPath).metadata();

      await sharp(originalPath)
        .resize({ width: 400, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      const thumbMeta = await sharp(thumbPath).metadata();

      const imageData = {
        id: path.parse(filename).name,
        filename,
        originalName: file.originalname,
        width: metadata.width,
        height: metadata.height,
        thumbWidth: thumbMeta.width,
        thumbHeight: thumbMeta.height,
        size: file.size,
        url: `/uploads/${filename}`,
        thumbUrl: `/uploads/thumbnails/${thumbFilename}`,
        category: category,
        favorite: false,
        uploadedAt: new Date().toISOString()
      };

      images.unshift(imageData);
      results.push(imageData);
    }

    saveMeta();
    res.json({ success: true, images: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/images
app.get('/api/images', (req, res) => {
  let result = images;
  if (req.query.category) {
    result = images.filter(img => img.category === req.query.category);
  }
  res.json({ success: true, images: result });
});

// PATCH /api/images/:id
app.patch('/api/images/:id', (req, res) => {
  const { id } = req.params;
  const image = images.find(img => img.id === id);

  if (!image) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }

  if (req.body.favorite !== undefined) image.favorite = !!req.body.favorite;
  if (req.body.category !== undefined) image.category = req.body.category;

  saveMeta();
  res.json({ success: true, image });
});

// DELETE /api/images/:id
app.delete('/api/images/:id', (req, res) => {
  const { id } = req.params;
  const index = images.findIndex(img => img.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }

  const image = images[index];
  const originalPath = path.join(uploadsDir, image.filename);
  const thumbPath = path.join(thumbsDir, `thumb_${image.filename}`);

  try { fs.unlinkSync(originalPath); } catch {}
  try { fs.unlinkSync(thumbPath); } catch {}

  images.splice(index, 1);
  saveMeta();

  res.json({ success: true });
});

// Error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`\n  Photo Gallery Server is running!`);
  console.log(`  Open http://localhost:${PORT} in your browser`);
  console.log(`  Default login: admin / admin123`);
  console.log(`  Set GALLERY_USERS env to customize, e.g.:`);
  console.log(`  GALLERY_USERS='{"myuser":"mypass"}' node index.js\n`);
});
