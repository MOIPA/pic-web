# Photo Gallery

A full-stack photo gallery web app with waterfall/masonry layout, inspired by Unsplash and Pinterest.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-blue)

## Features

- Waterfall/masonry layout with responsive columns (2-4 columns)
- Drag-and-drop & click-to-upload, supports multiple files
- Auto-generated thumbnails for fast loading
- Lightbox viewer with keyboard navigation (arrow keys, Esc)
- Delete photos with hover overlay
- Upload progress bar
- Lazy loading & fade-in animations

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18.x
- npm (comes with Node.js)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/MOIPA/pic-web.git
cd pic-web
```

### 2. Install dependencies

```bash
cd server
npm install
```

### 3. Start the server

```bash
npm start
```

### 4. Open in browser

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
photo-gallery/
├── client/
│   ├── index.html        # Main page
│   ├── style.css         # Waterfall layout styles
│   └── app.js            # Frontend logic (upload, lightbox, etc.)
├── server/
│   ├── index.js          # Express server (API + static files)
│   ├── package.json
│   └── uploads/          # Uploaded images stored here
│       └── thumbnails/   # Auto-generated thumbnails
└── .gitignore
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/images` | Get all images |
| POST | `/api/upload` | Upload images (multipart, field: `photos`) |
| DELETE | `/api/images/:id` | Delete an image |

## Tech Stack

- **Backend**: Node.js, Express, Multer, Sharp
- **Frontend**: Vanilla HTML / CSS / JavaScript
- **Storage**: Local filesystem
