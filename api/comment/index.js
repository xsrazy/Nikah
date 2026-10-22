const crypto = require('crypto');
const {
    loadDB, saveDB, getAuth, send, sendError, readBody, clientIp,
    filterBadWords, toPublic, buildTree, findComment, formatDate,
} = require('../_lib');

module.exports = async (req, res) => {
    try {
        const db = await loadDB();
        const auth = getAuth(req, db);
        if (!auth) {
            return sendError(res, 401, 'Invalid access key');
        }
        const isAdmin = Boolean(auth.admin);

        if (req.method === 'GET') {
            const per = Math.max(1, Math.min(100, parseInt(req.query.per, 10) || 10));
            const next = Math.max(0, parseInt(req.query.next, 10) || 0);
            const { roots, byParent } = buildTree(db.comments, isAdmin);
            const page = roots.slice(next, next + per).map((c) => toPublic(c, byParent, isAdmin));
            return send(res, 200, page);
        }

        if (req.method === 'POST') {
            const body = await readBody(req);
            const name = String(body.name || '').trim();
            let text = String(body.comment || '').trim();
            if (name.length === 0) {
                return sendError(res, 400, 'Silakan masukkan nama Anda.');
            }
            if (text.length === 0) {
                return sendError(res, 400, 'Komentar tidak boleh kosong.');
            }

            const parentId = body.id ? String(body.id) : null;
            if (parentId) {
                if (!db.settings.can_reply && !isAdmin) {
                    return sendError(res, 403, 'Balasan komentar sedang dimatikan.');
                }
                if (!findComment(db, parentId)) {
                    return sendError(res, 404, 'Komentar induk tidak ditemukan.');
                }
            }

            if (db.settings.is_filter) {
                text = filterBadWords(text);
            }

            const comment = {
                uuid: crypto.randomUUID(),
                own: crypto.randomUUID(),
                parent: parentId,
                name,
                presence: body.presence === undefined ? true : Boolean(body.presence),
                comment: text,
                is_admin: isAdmin,
                ip: clientIp(req),
                user_agent: String(req.headers['user-agent'] || ''),
                created_at: new Date().toISOString(),
                likes: [],
            };
            db.comments.push(comment);
            await saveDB(db);

            return send(res, 201, {
                uuid: comment.uuid,
                own: comment.own,
                name: comment.name,
                presence: comment.presence,
                comment: comment.comment,
                is_admin: comment.is_admin,
                created_at: formatDate(comment.created_at),
                comments: [],
                like: { love: 0 },
            });
        }

        return sendError(res, 405, 'Method not allowed');
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
