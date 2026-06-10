const cfg = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = cfg.url;
const SUPABASE_KEY = cfg.anonKey;
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const btnToggleCompose = document.getElementById('btnToggleCompose');
const COMPOSE_TOGGLE_CLOSED = 'Đăng bài viết';
const BTN_PUBLISH_DEFAULT = 'Xuất bản tin';
const BTN_PUBLISH_PENDING = 'Đang đăng...';

// Filter state
let allPosts = [];
let currentFilter = 'all';
let currentSearchTerm = '';
let useLocalStorage = true;
let currentAuthor = '';

// Valid categories
const VALID_CATEGORIES = [
    'Ngoại giao nước',
    'An ninh toàn cầu',
    'Cải cách Liên Hiệp Quốc',
    'Nhân quyền',
    'Thương mại quốc tế',
    'Môi trường & Khí hậu',
    'Phát triển kinh tế',
    'Y tế toàn cầu',
    'Lao động & Di cư',
    'Công nghệ & Đổi mới',
    'Giáo dục & Văn hóa'
];

// Demo data
const DEMO_POSTS = [];

// LocalStorage functions
function getStoredPosts() {
    try {
        const stored = localStorage.getItem('hanami_posts');
        return stored ? JSON.parse(stored) : DEMO_POSTS.map(p => ({ ...p }));
    } catch (e) {
        return DEMO_POSTS.map(p => ({ ...p }));
    }
}

function saveStoredPosts(posts) {
    try {
        localStorage.setItem('hanami_posts', JSON.stringify(posts));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

// Author functions
function getStoredAuthor() {
    try {
        const author = localStorage.getItem('hanami_author');
        return author || '';
    } catch (e) {
        return '';
    }
}

function saveStoredAuthor(author) {
    try {
        localStorage.setItem('hanami_author', author);
    } catch (e) {
        console.warn('Could not save author:', e);
    }
}

function promptForAuthor() {
    const stored = getStoredAuthor();
    if (stored) {
        currentAuthor = stored;
        return;
    }
    
    const modal = document.getElementById('authorModal');
    const input = document.getElementById('authorInput');
    const btn = document.getElementById('btnConfirmAuthor');
    
    if (!modal || !input || !btn) return;
    
    modal.style.display = 'flex';
    input.focus();
    
    function handleConfirm() {
        const author = input.value.trim();
        if (author) {
            currentAuthor = author;
            saveStoredAuthor(author);
            modal.style.display = 'none';
            input.value = '';
        } else {
            alert('Vui lòng nhập tên của bạn!');
        }
    }
    
    btn.onclick = handleConfirm;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') handleConfirm();
    };
}

window.googleTranslateElementInit = function googleTranslateElementInit() {
    if (typeof window.google === 'undefined' || !window.google.translate) {
        return;
    }
    const run = function runTranslateElement() {
        try {
            const TE = window.google.translate.TranslateElement;
            const options = {
                pageLanguage: 'en',
                multilanguagePage: true,
                autoDisplay: false,
                includedLanguages: 'en,vi,es,fr,de,ja,ko,pt,ar,ru,zh-CN,zh-TW',
            };
            if (TE.InlineLayout) {
                options.layout = TE.InlineLayout.SIMPLE;
            }
            new TE(options, 'google_translate_element');
        } catch (e) {
            console.debug('Google Translate element failed:', e);
        }
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function onFrame() {
            window.setTimeout(run, 0);
        });
    } else {
        window.setTimeout(run, 0);
    }
};

function isValidUuid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
}

function escapeHtml(str) {
    if (str == null) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function setLoadingMessage(message, isError) {
    const loading = document.getElementById('loading');
    if (!loading) {
        return;
    }
    loading.textContent = message;
    loading.classList.toggle('loading--error', Boolean(isError));
    loading.style.display = '';
}

function formatSupabaseError(err, options) {
    if (!err) {
        return 'Unknown error';
    }
    const msg = (err.message || '').toLowerCase();
    const code = err.code;
    if (code === 'PGRST205' || code === '42P01' || msg.includes('schema cache')) {
        return "Database table missing. In Supabase SQL Editor, run supabase/migrations/001_create_posts.sql, then refresh.";
    }
    if (msg.includes('relation') && msg.includes('does not exist')) {
        return "Table 'posts' is missing. Run supabase/migrations/001_create_posts.sql in the SQL Editor, then refresh.";
    }
    if (
        options &&
        options.delete &&
        (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied for table'))
    ) {
        return "Delete blocked by database rules. In Supabase SQL Editor, run supabase/migrations/002_allow_anon_delete_posts.sql, then refresh.";
    }
    return err.message || String(err);
}

async function fetchPosts() {
    const loading = document.getElementById('loading');
    
    // Try Supabase first
    if (SUPABASE_URL && SUPABASE_KEY) {
        try {
            const { data, error } = await _supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                allPosts = data || [];
                useLocalStorage = false;
                if (loading) loading.style.display = 'none';
                populateCategoryTags();
                displayPosts(allPosts);
                return;
            }
        } catch (e) {
            console.debug('Supabase connection failed, using demo mode');
        }
    }
    
    // Fallback to localStorage (Demo Mode)
    console.info('📚 Running in Demo Mode - using local storage');
    useLocalStorage = true;
    allPosts = getStoredPosts();
    if (loading) loading.style.display = 'none';
    populateCategoryTags();
    displayPosts(allPosts);
}

function displayPosts(posts) {
    const feed = document.getElementById('feed');
    if (!feed) {
        return;
    }
    
    // Filter posts based on search and category
    let filteredPosts = posts;
    
    // Apply category filter
    if (currentFilter !== 'all') {
        filteredPosts = filteredPosts.filter(p => p.category === currentFilter);
    }
    
    // Apply search filter
    if (currentSearchTerm) {
        const searchLower = currentSearchTerm.toLowerCase();
        filteredPosts = filteredPosts.filter(p => 
            p.content.toLowerCase().includes(searchLower) ||
            p.category.toLowerCase().includes(searchLower)
        );
    }
    
    // Empty state message
    if (!filteredPosts || filteredPosts.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>${currentSearchTerm || currentFilter !== 'all' ? 'Không tìm thấy bài viết' : 'Chưa có bài viết nào'}</h3>
                <p>${currentSearchTerm ? `Không có bài viết chứa "${currentSearchTerm}"` : 'Hãy là người đầu tiên chia sẻ phân tích ngoại giao của bạn!'}</p>
                <button type="button" id="btnEmptyStateCompose" class="btn-empty-compose">Đăng bài viết đầu tiên</button>
            </div>
        `;
        
        // Add click handler for empty state button
        const emptyBtn = document.getElementById('btnEmptyStateCompose');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', onToggleComposeClick);
        }
        return;
    }
    
    feed.innerHTML = filteredPosts
        .map((p) => {
            const idAttr = p.id != null ? escapeHtml(String(p.id)) : '';
            const d = new Date(p.created_at);
            
            // Format date: "Monday, June 10, 2026"
            const dateStr = d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            
            // Format time: "2:30 PM UTC"
            const timeStr = d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC'
            });
            
            const body = escapeHtml(p.content);
            const isAuthor = currentAuthor && p.author === currentAuthor;
            const deleteDisabled = !isAuthor ? 'disabled' : '';
            const deleteTitle = !isAuthor ? `Chỉ ${escapeHtml(p.author || 'tác giả')} mới có thể xóa bài này` : 'Xóa bài viết';
            
            return `
                <article class="post" data-post-id="${idAttr}">
                    <div class="post-meta">
                        <div class="post-meta-row">
                            <span>📌 <a href="#" class="category-link" data-category="${escapeHtml(p.category)}">${escapeHtml(p.category || 'General')}</a> | Policy Record</span>
                            <span>📅 ${dateStr}</span>
                        </div>
                        <div class="post-meta-row">
                            <span>✍️ Tác giả: <strong>${escapeHtml(p.author || 'Ẩn danh')}</strong></span>
                            <span>⏰ Published: ${timeStr} UTC</span>
                        </div>
                        <div class="post-meta-row">
                            <button type="button" class="btn-delete" data-action="delete" data-post-id="${idAttr}" ${deleteDisabled} title="${deleteTitle}">🗑️ Xóa</button>
                        </div>
                    </div>
                    <div class="post-content">${body}</div>
                </article>
            `;
        })
        .join('');
    
    // Add click handlers for category links
    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.getAttribute('data-category');
            filterByCategory(category);
        });
    });
}

function setComposeOpen(open) {
    const panel = document.getElementById('composePanel');
    if (!panel) {
        return;
    }
    panel.hidden = !open;
    if (btnToggleCompose) {
        btnToggleCompose.setAttribute('aria-expanded', open ? 'true' : 'false');
        btnToggleCompose.style.display = open ? 'none' : 'block';
    }
    if (open) {
        const ta = document.getElementById('statusInput');
        if (ta) {
            window.requestAnimationFrame(function focusTa() {
                ta.focus();
            });
        }
        if (typeof panel.scrollIntoView === 'function') {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else if (toggle) {
        toggle.focus();
    }
}

function onToggleComposeClick() {
    const panel = document.getElementById('composePanel');
    if (!panel) {
        return;
    }
    setComposeOpen(panel.hidden);
}

async function postStatus() {
    const statusInput = document.getElementById('statusInput');
    const categoryInput = document.getElementById('categoryInput');
    const btn = document.getElementById('btnPost');
    if (!statusInput || !categoryInput || !btn) {
        return;
    }
    const content = statusInput.value.trim();
    const category = categoryInput.value;
    
    // ✅ Input Validation
    if (!content) {
        setLoadingMessage('❌ Vui lòng nhập nội dung bài viết', true);
        return;
    }
    
    // ✅ Max length validation (5000 characters)
    if (content.length > 5000) {
        setLoadingMessage('❌ Nội dung quá dài (tối đa 5000 ký tự)', true);
        return;
    }
    
    // ✅ Category validation
    if (!VALID_CATEGORIES.includes(category)) {
        setLoadingMessage('❌ Chủ đề không hợp lệ', true);
        return;
    }
    
    const original = btn.textContent;
    btn.textContent = BTN_PUBLISH_PENDING;
    btn.disabled = true;
    
    // Try Supabase first
    if (SUPABASE_URL && SUPABASE_KEY && !useLocalStorage) {
        try {
            const { error } = await _supabase.from('posts').insert([{ content, category }]);
            
            if (!error) {
                statusInput.value = '';
                setComposeOpen(false);
                await fetchPosts();
                btn.disabled = false;
                btn.textContent = original;
                return;
            }
        } catch (e) {
            console.debug('Supabase insert failed, saving locally');
        }
    }
    
    // Fallback to localStorage
    const newPost = {
        id: Math.random().toString(36).substr(2, 9),
        content: content,
        category: category,
        author: currentAuthor,
        created_at: new Date().toISOString()
    };
    
    allPosts.unshift(newPost);
    saveStoredPosts(allPosts);
    
    btn.disabled = false;
    btn.textContent = original;
    statusInput.value = '';
    setComposeOpen(false);
    populateCategoryTags();
    displayPosts(allPosts);
    setLoadingMessage('✅ Bài viết đã được lưu (Demo Mode)', false);
}

async function deletePost(postId, triggerButton) {
    // Allow numeric IDs for localStorage posts
    
    // Check if user is the author
    const post = allPosts.find(p => String(p.id) === String(postId));
    if (post && post.author !== currentAuthor) {
        setLoadingMessage(`❌ Chỉ ${escapeHtml(post.author || 'tác giả')} mới có thể xóa bài này!`, true);
        return;
    }
    
    if (!window.confirm('Xóa bài này khỏi lưu trữ?')) {
        return;
    }
    if (triggerButton) {
        triggerButton.disabled = true;
    }
    
    // Try Supabase first
    if (isValidUuid(postId) && SUPABASE_URL && SUPABASE_KEY && !useLocalStorage) {
        try {
            const { error } = await _supabase.from('posts').delete().eq('id', postId);
            if (!error) {
                if (triggerButton) triggerButton.disabled = false;
                await fetchPosts();
                return;
            }
        } catch (e) {
            console.debug('Supabase delete failed, removing locally');
        }
    }
    
    // Fallback to localStorage
    allPosts = allPosts.filter(p => String(p.id) !== String(postId));
    saveStoredPosts(allPosts);
    
    if (triggerButton) {
        triggerButton.disabled = false;
    }
    
    populateCategoryTags();
    displayPosts(allPosts);
}

function onFeedClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) {
        return;
    }
    const btn = t.closest('[data-action="delete"]');
    if (!btn) {
        return;
    }
    const id = btn.getAttribute('data-post-id');
    if (id) {
        deletePost(id, btn instanceof HTMLButtonElement ? btn : null);
    }
}

function init() {
    const btnPost = document.getElementById('btnPost');
    const btnCloseCompose = document.getElementById('btnCloseCompose');
    const feed = document.getElementById('feed');
    const searchInput = document.getElementById('searchInput');
    const btnClearFilter = document.getElementById('btnClearFilter');
    
    // Get or prompt for author
    promptForAuthor();
    
    if (btnPost) {
        btnPost.addEventListener('click', postStatus);
    }
    if (btnToggleCompose) {
        btnToggleCompose.addEventListener('click', onToggleComposeClick);
    }
    if (btnCloseCompose) {
        btnCloseCompose.addEventListener('click', function onCloseCompose() {
            setComposeOpen(false);
        });
    }
    if (feed) {
        feed.addEventListener('click', onFeedClick);
    }
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            displayPosts(allPosts);
        });
    }
    if (btnClearFilter) {
        btnClearFilter.addEventListener('click', clearAllFilters);
    }
    fetchPosts();
}

function populateCategoryTags() {
    const categoryTags = document.getElementById('categoryTags');
    if (!categoryTags) return;
    
    // Get unique categories from posts
    const categories = [...new Set(allPosts.map(p => p.category))].sort();
    
    // Create all button (already exists)
    let html = '<button type="button" class="category-tag' + (currentFilter === 'all' ? ' active' : '') + '" data-category="all">Tất cả</button>';
    
    // Add category buttons
    categories.forEach(category => {
        const count = allPosts.filter(p => p.category === category).length;
        html += `<button type="button" class="category-tag${currentFilter === category ? ' active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)} (${count})</button>`;
    });
    
    categoryTags.innerHTML = html;
    
    // Add event listeners
    categoryTags.querySelectorAll('.category-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            filterByCategory(category);
        });
    });
}

function filterByCategory(category) {
    currentFilter = category;
    currentSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Update active state
    document.querySelectorAll('.category-tag').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === category);
    });
    
    displayPosts(allPosts);
}

function clearAllFilters() {
    currentFilter = 'all';
    currentSearchTerm = '';
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    document.querySelectorAll('.category-tag').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === 'all');
    });
    
    displayPosts(allPosts);
}

document.addEventListener('DOMContentLoaded', init);