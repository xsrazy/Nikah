// Shared helpers for the nikah-usra invitation API.
// Database = one JSON document stored in a private Vercel Blob store.
const crypto = require('crypto');

const BLOB_API = 'https://vercel.com/api/blob/';
const DB_PREFIX = 'db-';

const blobHeaders = () => ({
    authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    'x-api-version': '11',
});

// The DB is stored as immutable versions (db-<timestamp>-<rand>.json). Reads
// always take the newest version from the list API, so a stale cached copy of
// an overwritten file can never shadow fresh data.
async function blobListVersions() {
    const res = await fetch(`${BLOB_API}?prefix=${DB_PREFIX}&limit=100`, {
        headers: blobHeaders(),
    });
    if (!res.ok) {
        throw new Error(`blob list failed: ${res.status}`);
    }
    const list = await res.json();
    return (list.blobs || [])
        .filter((b) => b.pathname.startsWith(DB_PREFIX))
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

async function blobReadLatest() {
    const versions = await blobListVersions();
    for (const blob of versions) {
        const res = await fetch(blob.url, {
            headers: { ...blobHeaders(), 'cache-control': 'no-cache' },
            cache: 'no-store',
        });
        if (res.ok) {
            return res.text();
        }
    }
    return null;
}

async function blobWriteVersion(text) {
    const pathname = `${DB_PREFIX}${Date.now()}-${crypto.randomBytes(3).toString('hex')}.json`;
    const res = await fetch(`${BLOB_API}?pathname=${encodeURIComponent(pathname)}`, {
        method: 'PUT',
        headers: {
            ...blobHeaders(),
            'x-vercel-blob-access': 'private',
            'x-content-type': 'application/json',
            'x-add-random-suffix': '0',
            'x-cache-control-max-age': '0',
        },
        body: text,
    });
    if (!res.ok) {
        throw new Error(`blob put failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
}

async function blobDelete(urls) {
    if (urls.length === 0) {
        return;
    }
    await fetch(`${BLOB_API}delete`, {
        method: 'POST',
        headers: { ...blobHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ urls }),
    }).catch(() => null);
}

// ---------- database ----------

const hashPassword = (password, salt = crypto.randomBytes(8).toString('hex')) =>
    `${salt}:${crypto.createHash('sha256').update(salt + password).digest('hex')}`;

const verifyPassword = (password, stored) => {
    const [salt, hash] = String(stored || '').split(':');
    if (!salt || !hash) {
        return false;
    }
    const check = crypto.createHash('sha256').update(salt + password).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
};

const defaultDB = () => ({
    settings: {
        name: 'Usra',
        email: process.env.ADMIN_EMAIL || '',
        password: hashPassword(process.env.ADMIN_PASSWORD || ''),
        access_key: process.env.INITIAL_ACCESS_KEY || crypto.randomBytes(24).toString('hex'),
        is_filter: false,
        can_reply: true,
        can_edit: true,
        can_delete: true,
    },
    comments: [],
    guests: [],
});

async function loadDB() {
    const text = await blobReadLatest();
    if (!text) {
        return defaultDB();
    }
    try {
        const db = JSON.parse(text);
        if (!db.settings || !Array.isArray(db.comments)) {
            return defaultDB();
        }
        if (!Array.isArray(db.guests)) {
            db.guests = [];
        }
        return db;
    } catch {
        return defaultDB();
    }
}

const saveDB = async (db) => {
    await blobWriteVersion(JSON.stringify(db));
    // Best-effort cleanup: keep only the two newest versions.
    const versions = await blobListVersions().catch(() => []);
    if (versions.length > 2) {
        await blobDelete(versions.slice(2).map((b) => b.url));
    }
};

// ---------- auth ----------

const b64url = (input) =>
    Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const signToken = (payload) => {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET || 'dev-secret')
        .update(`${header}.${body}`).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${header}.${body}.${sig}`;
};

const verifyToken = (token) => {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) {
        return null;
    }
    const [header, body, sig] = parts;
    const expected = crypto.createHmac('sha256', process.env.AUTH_SECRET || 'dev-secret')
        .update(`${header}.${body}`).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
        if ((payload.exp ?? 0) < Date.now() / 1000) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
};

// Returns { admin: payload } or { guest: true } or null.
const getAuth = (req, db) => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
        const payload = verifyToken(auth.slice(7));
        if (payload) {
            return { admin: payload };
        }
    }
    const key = req.headers['x-access-key'];
    if (key && key === db.settings.access_key) {
        return { guest: true };
    }
    return null;
};

// ---------- http helpers ----------

const send = (res, code, data, httpStatus = code) => {
    res.status(httpStatus).json({ code, data, error: null });
};

const sendError = (res, code, message) => {
    res.status(code).json({ code, data: null, error: [message] });
};

const readBody = async (req) => {
    if (req.body !== undefined && req.body !== null) {
        return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    }
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
};

const clientIp = (req) =>
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

// ---------- comments ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const formatDate = (iso) => {
    const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}.${mm} WIB`;
};

const BAD_WORDS = ['anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'tolol', 'goblok',
    'jancok', 'asu', 'bajingan', 'kampret', 'fuck', 'shit', 'bitch', 'dick', 'pussy'];

const filterBadWords = (text) => {
    let out = String(text);
    for (const word of BAD_WORDS) {
        out = out.replace(new RegExp(`\\b${word}\\b`, 'gi'), '***');
    }
    return out;
};

const toPublic = (comment, byParent, isAdmin) => {
    const replies = (byParent.get(comment.uuid) || [])
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map((c) => toPublic(c, byParent, isAdmin));
    const out = {
        uuid: comment.uuid,
        name: comment.name,
        presence: comment.presence,
        comment: comment.comment,
        is_admin: comment.is_admin,
        created_at: formatDate(comment.created_at),
        comments: replies,
        like: { love: (comment.likes || []).length },
    };
    if (isAdmin) {
        out.own = comment.own;
        out.ip = comment.ip;
        out.user_agent = comment.user_agent;
    }
    return out;
};

const buildTree = (comments, isAdmin) => {
    const byParent = new Map();
    for (const c of comments) {
        const key = c.parent || null;
        if (!byParent.has(key)) {
            byParent.set(key, []);
        }
        byParent.get(key).push(c);
    }
    const roots = (byParent.get(null) || [])
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { roots, byParent };
};

const findComment = (db, uuid) => db.comments.find((c) => c.uuid === uuid) || null;
const findByOwn = (db, own) => db.comments.find((c) => c.own === own) || null;

const removeSubtree = (db, uuid) => {
    const targets = new Set([uuid]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const c of db.comments) {
            if (c.parent && targets.has(c.parent) && !targets.has(c.uuid)) {
                targets.add(c.uuid);
                grew = true;
            }
        }
    }
    db.comments = db.comments.filter((c) => !targets.has(c.uuid));
    return targets.size;
};

const countAll = (db) => db.comments.length;
const countLikes = (db) => db.comments.reduce((n, c) => n + (c.likes || []).length, 0);

module.exports = {
    loadDB, saveDB, hashPassword, verifyPassword,
    signToken, verifyToken, getAuth,
    send, sendError, readBody, clientIp,
    formatDate, filterBadWords, toPublic, buildTree,
    findComment, findByOwn, removeSubtree, countAll, countLikes,
};
