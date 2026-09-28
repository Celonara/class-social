// ============================================
// CLASSROOM SOCIAL v2.1 — APP.JS
// Fixed: avatar upload, save profile, ui update
// ============================================

const API = window.location.origin + '/api';
let currentUser = null;
let selectedMedia = null;
let activePostId = null;
let allPosts = [];
let currentFilter = 'all';

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Classroom Social v2.1 loaded');
    loadUser();
    loadPosts();
    bindComposeEvents();
    bindModalEvents();
    bindKeyboardShortcuts();
});

// ============================================
// USER MANAGEMENT
// ============================================
function loadUser() {
    const saved = localStorage.getItem('kelas_user_v2');

    if (saved) {
        try {
            const parsed = JSON.parse(saved);

            // Validasi struktur user
            if (parsed && parsed.username && parsed.avatar_url) {
                currentUser = parsed;
                console.log('✅ User loaded from storage:', currentUser.username);
            } else {
                console.warn('⚠️ Invalid user data, creating default');
                createDefaultUser();
            }
        } catch (e) {
            console.error('❌ Parse user error:', e);
            createDefaultUser();
        }
    } else {
        console.log('📝 No user found, creating default');
        createDefaultUser();
    }

    updateUserUI();
}

function createDefaultUser() {
    const uname = 'siswa' + Math.floor(Math.random() * 9000 + 1000);
    currentUser = {
        id: uname,
        username: uname,
        display_name: 'Siswa Baru',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uname}`,
        bio: 'Halo! Saya siswa kelas ini.'
    };
    saveUser();
    console.log('✅ Default user created:', uname);
}

function saveUser() {
    try {
        localStorage.setItem('kelas_user_v2', JSON.stringify(currentUser));
        return true;
    } catch (e) {
        console.error('❌ Save user error:', e);
        if (e.name === 'QuotaExceededError') {
            showToast('❌ Storage penuh! Hapus foto lama.', 'error');
        } else {
            showToast('❌ Gagal menyimpan data', 'error');
        }
        return false;
    }
}

// ============================================
// UPDATE UI — update semua elemen avatar & form
// ============================================
function updateUserUI() {
    if (!currentUser) return;

    const avatar = currentUser.avatar_url;
    const displayName = currentUser.display_name;
    const username = currentUser.username;

    // Update semua avatar di UI
    const avatars = {
        topAvatar: document.getElementById('topAvatar'),
        composeAvatar: document.getElementById('composeAvatar'),
        profileAvatar: document.getElementById('profileAvatar')
    };

    Object.entries(avatars).forEach(([id, el]) => {
        if (el) {
            el.src = avatar;
            el.onerror = () => {
                el.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=fallback`;
            };
        }
    });

    // Update form values
    const u = document.getElementById('profileUsername');
    const d = document.getElementById('profileDisplayName');
    const b = document.getElementById('profileBio');

    if (u) u.value = username || '';
    if (d) d.value = displayName || '';
    if (b) b.value = currentUser.bio || '';

    console.log('✅ UI updated:', { username, displayName });
}

// ============================================
// PROFILE — OPEN / CLOSE / SAVE
// ============================================
function openProfile() {
    console.log('📂 Opening profile...');
    updateUserUI();
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('active');
}

function closeProfile() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('active');
}

function saveProfile() {
    console.log('💾 Saving profile...');

    const usernameEl = document.getElementById('profileUsername');
    const displayEl = document.getElementById('profileDisplayName');
    const bioEl = document.getElementById('profileBio');

    if (!usernameEl || !displayEl || !bioEl) {
        showToast('❌ Form tidak ditemukan', 'error');
        return;
    }

    const username = usernameEl.value.trim();
    const display_name = displayEl.value.trim();
    const bio = bioEl.value.trim();

    // Validasi
    if (!username) {
        showToast('❌ Username wajib diisi!', 'error');
        usernameEl.focus();
        return;
    }

    if (username.length < 3) {
        showToast('❌ Username minimal 3 karakter!', 'error');
        usernameEl.focus();
        return;
    }

    if (username.length > 20) {
        showToast('❌ Username max 20 karakter!', 'error');
        usernameEl.focus();
        return;
    }

    // Cek karakter username (huruf, angka, underscore)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showToast('❌ Username hanya huruf, angka, underscore!', 'error');
        return;
    }

    // Simpan
    currentUser.username = username;
    currentUser.display_name = display_name || username;
    currentUser.bio = bio;

    const ok = saveUser();
    if (!ok) return;

    updateUserUI();
    showToast('✅ Profil berhasil disimpan!', 'success');

    // Close modal setelah delay
    setTimeout(() => closeProfile(), 400);
}

// ============================================
// UPLOAD AVATAR — dengan resize otomatis
// ============================================
function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;

    console.log('📷 Uploading avatar:', file.name, file.size, 'bytes');

    // Validasi tipe
    if (!file.type.startsWith('image/')) {
        showToast('❌ File harus berupa gambar!', 'error');
        input.value = '';
        return;
    }

    // Validasi ukuran (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Ukuran gambar max 5MB!', 'error');
        input.value = '';
        return;
    }

    showToast('⏳ Memproses gambar...', 'info');

    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
            try {
                // Resize ke 200x200 + crop tengah
                const SIZE = 200;
                const canvas = document.createElement('canvas');
                canvas.width = SIZE;
                canvas.height = SIZE;

                const ctx = canvas.getContext('2d');

                // Crop tengah biar kotak
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;

                ctx.drawImage(img, sx, sy, size, size, 0, 0, SIZE, SIZE);

                // Convert ke dataURL (JPEG quality 0.8)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                console.log('✅ Image resized. Size:', dataUrl.length, 'chars');

                // Simpan
                currentUser.avatar_url = dataUrl;
                const ok = saveUser();

                if (ok) {
                    updateUserUI();
                    showToast('✅ Avatar berhasil diupdate!', 'success');
                }
            } catch (err) {
                console.error('❌ Canvas error:', err);
                showToast('❌ Gagal memproses gambar', 'error');
            }
        };

        img.onerror = () => {
            console.error('❌ Image load error');
            showToast('❌ Gagal memuat gambar', 'error');
        };

        img.src = e.target.result;
    };

    reader.onerror = () => {
        console.error('❌ FileReader error');
        showToast('❌ Gagal membaca file', 'error');
    };

    reader.readAsDataURL(file);

    // Reset input biar bisa upload file yang sama lagi
    input.value = '';
}

// ============================================
// COMPOSE — POST
// ============================================
function bindComposeEvents() {
    const textarea = document.getElementById('postContent');
    const charCount = document.getElementById('charCount');
    const postBtn = document.getElementById('postBtn');

    if (!textarea || !charCount || !postBtn) return;

    textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        charCount.textContent = len;
        postBtn.disabled = (len === 0 && !selectedMedia);
    });
}

function focusCompose() {
    setTimeout(() => {
        const t = document.getElementById('postContent');
        if (t) t.focus();
    }, 500);
}

async function createPost() {
    const content = document.getElementById('postContent').value.trim();

    if (!content && !selectedMedia) {
        showToast('❌ Tulis sesuatu atau upload media!', 'error');
        return;
    }

    const btn = document.getElementById('postBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Mengirim...';

    const form = new FormData();
    form.append('user_id', currentUser.id);
    form.append('display_name', currentUser.display_name);
    form.append('content', content);
    if (selectedMedia) form.append('media', selectedMedia);

    try {
        const res = await fetch(`${API}/posts`, { method: 'POST', body: form });
        if (!res.ok) throw new Error('Gagal posting');

        // Reset form
        document.getElementById('postContent').value = '';
        document.getElementById('charCount').textContent = '0';
        clearMedia();

        showToast('✅ Postingan terkirim!', 'success');
        await loadPosts();
    } catch (e) {
        console.error('❌ Post error:', e);
        showToast('❌ Error: ' + e.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = true;
    }
}

function handleMedia(input, type) {
    const file = input.files[0];
    if (!file) return;

    selectedMedia = file;
    const preview = document.getElementById('mediaPreview');
    preview.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = `
            <div style="position:relative; display:inline-block;">
                ${type === 'video'
                    ? `<video src="${e.target.result}" controls></video>`
                    : `<img src="${e.target.result}" alt="preview">`}
                <button onclick="clearMedia()" style="position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(30,41,59,0.85);color:white;cursor:pointer;font-size:14px;">✕</button>
            </div>
        `;
        document.getElementById('postBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearMedia() {
    selectedMedia = null;
    const preview = document.getElementById('mediaPreview');
    preview.innerHTML = '';
    preview.classList.add('hidden');

    const content = document.getElementById('postContent').value.trim();
    document.getElementById('postBtn').disabled = !content;
}

// ============================================
// POSTS — LOAD & RENDER
// ============================================
async function loadPosts() {
    const timeline = document.getElementById('timeline');

    try {
        allPosts = await fetch(`${API}/posts`).then(r => r.json());
        renderTimeline();
        updateStats();
    } catch (e) {
        console.error('❌ Load posts error:', e);
        timeline.innerHTML = '<div class="empty-feed">Gagal memuat feed.</div>';
    }
}

function renderTimeline() {
    const timeline = document.getElementById('timeline');
    let posts = allPosts;

    if (currentFilter === 'media') {
        posts = posts.filter(p => p.media_url);
    } else if (currentFilter === 'text') {
        posts = posts.filter(p => !p.media_url);
    }

    if (posts.length === 0) {
        timeline.innerHTML = '<div class="empty-feed">Belum ada postingan. Jadi yang pertama!</div>';
        return;
    }

    timeline.innerHTML = posts.map(p => renderPost(p)).join('');
}

function renderPost(post) {
    const media = post.media_url ? `
        <div class="post-media">
            ${post.media_type === 'video'
                ? `<video src="${post.media_url}" controls></video>`
                : `<img src="${post.media_url}" alt="post" loading="lazy">`}
        </div>
    ` : '';

    return `
        <article class="post-card" id="post-${post.id}">
            <div class="post-head">
                <img class="post-avatar"
                     src="https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_id}"
                     alt="avatar"
                     onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=guest'">
                <div class="post-author">
                    <span class="post-author-name">${escapeHtml(post.display_name || post.user_id)}</span>
                    <span class="post-author-handle">@${escapeHtml(post.user_id)}</span>
                    <span class="post-time">${timeAgo(post.created_at)}</span>
                </div>
            </div>
            ${post.content ? `<div class="post-content">${formatContent(post.content)}</div>` : ''}
            ${media}
            <div class="post-actions">
                <button class="post-action" onclick="toggleLike('${post.id}')">
                    <span class="like-icon">🤍</span>
                    <span class="like-count">${post.likes_count || 0}</span>
                </button>
                <button class="post-action" onclick="openComments('${post.id}')">
                    💬 <span>${post.comments_count || 0}</span>
                </button>
                <button class="post-action" onclick="sharePost('${post.id}')">
                    🔗 Share
                </button>
            </div>
        </article>
    `;
}

function formatContent(text) {
    return escapeHtml(text).replace(/#(\w+)/g, '<span class="hashtag" onclick="searchTag(\'#$1\')">#$1</span>');
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTimeline();
}

function searchTag(tag) {
    showToast('🔍 Mencari ' + tag, 'info');
}

function updateStats() {
    const posts = allPosts.length;
    const comments = allPosts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const likes = allPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0);

    const sP = document.getElementById('statPosts');
    const sC = document.getElementById('statComments');
    const sL = document.getElementById('statLikes');

    if (sP) animateNumber(sP, posts);
    if (sC) animateNumber(sC, comments);
    if (sL) animateNumber(sL, likes);
}

function animateNumber(el, target) {
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = Math.floor(start + (target - start) * progress);
        el.textContent = value;
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

// ============================================
// LIKE
// ============================================
async function toggleLike(postId) {
    try {
        const res = await fetch(`${API}/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
        });
        const data = await res.json();

        const card = document.getElementById(`post-${postId}`);
        if (!card) return;

        const btn = card.querySelector('.post-action');
        const icon = btn.querySelector('.like-icon');
        const count = btn.querySelector('.like-count');

        icon.textContent = data.liked ? '❤️' : '🤍';
        count.textContent = data.likes_count;
        btn.classList.toggle('liked', data.liked);

        const p = allPosts.find(x => x.id === postId);
        if (p) p.likes_count = data.likes_count;
        updateStats();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================
// COMMENTS
// ============================================
async function openComments(postId) {
    activePostId = postId;
    document.getElementById('commentModal').classList.add('active');
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px 0;">Memuat...</p>';

    try {
        const comments = await fetch(`${API}/posts/${postId}/comments`).then(r => r.json());

        if (comments.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px 0;">Belum ada komentar.</p>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <div class="comment-item">
                <img class="comment-avatar"
                     src="https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}"
                     alt="avatar">
                <div class="comment-body">
                    <div class="comment-head">
                        <strong>${escapeHtml(c.display_name || c.user_id)}</strong>
                        <span>${timeAgo(c.created_at)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(c.content)}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<p style="color:#b91c1c;font-size:13px;text-align:center;padding:16px 0;">Gagal memuat komentar.</p>';
    }
}

function closeComments() {
    document.getElementById('commentModal').classList.remove('active');
}

async function submitComment() {
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content || !activePostId) return;

    try {
        await fetch(`${API}/posts/${activePostId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                display_name: currentUser.display_name,
                content
            })
        });

        input.value = '';
        openComments(activePostId);
        showToast('💬 Komentar dikirim!', 'success');

        const p = allPosts.find(x => x.id === activePostId);
        if (p) p.comments_count = (p.comments_count || 0) + 1;
        renderTimeline();
        updateStats();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================
// SHARE
// ============================================
function sharePost(postId) {
    const url = `${window.location.origin}/#post-${postId}`;
    if (navigator.share) {
        navigator.share({ title: 'Lihat postingan ini', url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => {
            showToast('🔗 Link dicopy!', 'success');
        }).catch(() => showToast(url, 'info'));
    }
}

// ============================================
// NAVIGATION
// ============================================
function scrollTop(e) {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav(0);
}

function scrollToFeed(e) {
    if (e) e.preventDefault();
    document.getElementById('feed').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNav(1);
}

function setActiveNav(index) {
    document.querySelectorAll('.side-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
}

// ============================================
// HELPERS
// ============================================
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const s = Math.floor((now - date) / 1000);
    if (s < 60) return 'baru aja';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'j';
    if (s < 604800) return Math.floor(s / 86400) + 'h';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// MODAL BINDINGS
// ============================================
function bindModalEvents() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC = close modal
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        }

        // CTRL+ENTER = kirim post
        if (e.key === 'Enter' && e.ctrlKey) {
            const ta = document.getElementById('postContent');
            if (document.activeElement === ta) {
                e.preventDefault();
                createPost();
            }
        }
    });
}

// ============================================
// EXPOSE KE GLOBAL
// ============================================
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.saveProfile = saveProfile;
window.uploadAvatar = uploadAvatar;
window.createPost = createPost;
window.handleMedia = handleMedia;
window.clearMedia = clearMedia;
window.toggleLike = toggleLike;
window.openComments = openComments;
window.closeComments = closeComments;
window.submitComment = submitComment;
window.sharePost = sharePost;
window.setFilter = setFilter;
window.searchTag = searchTag;
window.scrollTop = scrollTop;
window.scrollToFeed = scrollToFeed;
window.focusCompose = focusCompose;

console.log('✅ All functions exposed to window');
