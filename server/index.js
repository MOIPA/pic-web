const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const thumbsDir = path.join(uploadsDir, 'thumbnails');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(thumbsDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'client')));

// Image metadata store (in-memory, persisted to JSON file)
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

// POST /api/upload - Upload images
app.post('/api/upload', upload.array('photos', 20), async (req, res) => {
  try {
    const results = [];
    const category = req.body.category || '';

    for (const file of req.files) {
      const filename = file.filename;
      const originalPath = path.join(uploadsDir, filename);
      const thumbFilename = `thumb_${filename}`;
      const thumbPath = path.join(thumbsDir, thumbFilename);

      // Get image dimensions
      const metadata = await sharp(originalPath).metadata();

      // Generate thumbnail (max width 400px, maintain aspect ratio)
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

// GET /api/images - Get all images (with optional category filter)
app.get('/api/images', (req, res) => {
  let result = images;
  if (req.query.category) {
    result = images.filter(img => img.category === req.query.category);
  }
  res.json({ success: true, images: result });
});

// PATCH /api/images/:id - Update image metadata (favorite, category)
app.patch('/api/images/:id', (req, res) => {
  const { id } = req.params;
  const image = images.find(img => img.id === id);

  if (!image) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }

  if (req.body.favorite !== undefined) {
    image.favorite = !!req.body.favorite;
  }
  if (req.body.category !== undefined) {
    image.category = req.body.category;
  }

  saveMeta();
  res.json({ success: true, image });
});

// DELETE /api/images/:id - Delete an image
app.delete('/api/images/:id', (req, res) => {
  const { id } = req.params;
  const index = images.findIndex(img => img.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }

  const image = images[index];

  // Delete files
  const originalPath = path.join(uploadsDir, image.filename);
  const thumbPath = path.join(thumbsDir, `thumb_${image.filename}`);

  try { fs.unlinkSync(originalPath); } catch {}
  try { fs.unlinkSync(thumbPath); } catch {}

  images.splice(index, 1);
  saveMeta();

  res.json({ success: true });
});

// Error handling for multer
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
  console.log(`  Open http://localhost:${PORT} in your browser\n`);
});
