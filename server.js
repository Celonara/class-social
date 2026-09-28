const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dirs = ['data', 'uploads/photos', 'uploads/videos', 'uploads/avatars'];
dirs.forEach(dir => fs.ensureDirSync(path.join(__dirname, dir)));

const DB = {
    posts: path.join(__dirname, 'data/posts.json'),
    comments: path.join(__dirname, 'data/comments.json'),
    likes: path.join(__dirname, 'data/likes.json')
};

Object.values(DB).forEach(file => {
    if (!fs.existsSync(file)) fs.writeJsonSync(file, []);
});

function readDB(key) { return fs.readJsonSync(DB[key]); }
function writeDB(key, data) { fs.writeJsonSync(DB[key], data, { spaces: 2 }); }

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads/photos';
        if (file.mimetype.startsWith('video/')) folder = 'uploads/videos';
        if (file.fieldname === 'avatar') folder = 'uploads/avatars';
        cb(null, path.join(__dirname, folder));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ============================================
// API
// ============================================

app.get('/api/healthz', (req, res) => {
    res.json({ status: 'ok', name: 'Kelas Social', version: '2.0.0' });
});

app.get('/api/posts', (req, res) => {
    const posts = readDB('posts');
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(posts);
});

app.post('/api/posts', upload.single('media'), (req, res) => {
    const { user_id, display_name, content } = req.body;
    if (!content && !req.file) return res.status(400).json({ error: 'Content required' });

    const posts = readDB('posts');
    const newPost = {
        id: uuidv4(),
        user_id: user_id || 'guest',
        display_name: display_name || user_id || 'Guest',
        content: content || '',
        media_url: req.file ? `/uploads/${req.file.mimetype.startsWith('video/') ? 'videos' : 'photos'}/${req.file.filename}` : null,
        media_type: req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : null,
        likes_count: 0,
        comments_count: 0,
        created_at: new Date().toISOString()
    };

    posts.push(newPost);
    writeDB('posts', posts);
    res.status(201).json(newPost);
});

app.delete('/api/posts/:id', (req, res) => {
    let posts = readDB('posts');
    posts = posts.filter(p => p.id !== req.params.id);
    writeDB('posts', posts);
    res.json({ success: true });
});

app.post('/api/posts/:id/like', (req, res) => {
    const { user_id } = req.body;
    const postId = req.params.id;
    let likes = readDB('likes');
    let posts = readDB('posts');
    const existingLike = likes.find(l => l.post_id === postId && l.user_id === user_id);
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return res.status(404).json({ error: 'Post not found' });

    if (existingLike) {
        likes = likes.filter(l => !(l.post_id === postId && l.user_id === user_id));
        posts[postIndex].likes_count = Math.max(0, (posts[postIndex].likes_count || 0) - 1);
        writeDB('likes', likes);
        writeDB('posts', posts);
        res.json({ liked: false, likes_count: posts[postIndex].likes_count });
    } else {
        likes.push({ id: uuidv4(), post_id: postId, user_id, created_at: new Date().toISOString() });
        posts[postIndex].likes_count = (posts[postIndex].likes_count || 0) + 1;
        writeDB('likes', likes);
        writeDB('posts', posts);
        res.json({ liked: true, likes_count: posts[postIndex].likes_count });
    }
});

app.get('/api/posts/:id/comments', (req, res) => {
    const comments = readDB('comments');
    const postComments = comments
        .filter(c => c.post_id === req.params.id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    res.json(postComments);
});

app.post('/api/posts/:id/comments', (req, res) => {
    const { user_id, display_name, content } = req.body;
    const postId = req.params.id;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const comments = readDB('comments');
    const posts = readDB('posts');
    const newComment = {
        id: uuidv4(),
        post_id: postId,
        user_id: user_id || 'guest',
        display_name: display_name || user_id || 'Guest',
        content,
        created_at: new Date().toISOString()
    };

    comments.push(newComment);
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
        posts[postIndex].comments_count = (posts[postIndex].comments_count || 0) + 1;
        writeDB('posts', posts);
    }
    writeDB('comments', comments);
    res.status(201).json(newComment);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('========================================');
    console.log('   🎓 CLASSROOM SOCIAL v2.0');
    console.log('========================================');
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   Network: http://${getLocalIP()}:${PORT}`);
    console.log('========================================');
    console.log('');
});

function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}
