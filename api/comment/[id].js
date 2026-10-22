const crypto = require('crypto');
const {
    loadDB, saveDB, getAuth, send, sendError, readBody, clientIp,
    filterBadWords, findComment, findByOwn, removeSubtree, formatDate,
} = require('../_lib');

module.exports = async (req, res) => {
    try {
        const db = await loadDB();
        const auth = getAuth(req, db);
        if (!auth) {
            return sendError(res, 401, 'Invalid access key');
        }
        const isAdmin = Boolean(auth.admin);
        const id = String(req.query.id || '');

        // Show one comment (used by the edit form).
        if (req.method === 'GET') {
            const comment = findComment(db, id);
            if (!comment) {
                return sendError(res, 404, 'Komentar tidak ditemukan.');
            }
            return send(res, 200, {
                name: comment.name,
                presence: comment.presence,
                comment: comment.comment,
                is_admin: comment.is_admin,
                created_at: formatDate(comment.created_at),
            });
        }

        // Like a comment. The id is the comment's public uuid.
        if (req.method === 'POST') {
            const comment = findComment(db, id);
            if (!comment) {
                return sendError(res, 404, 'Komentar tidak ditemukan.');
            }
            const like = {
                uuid: crypto.randomUUID(),
                ip: clientIp(req),
                created_at: new Date().toISOString(),
            };
            comment.likes = comment.likes || [];
            comment.likes.push(like);
            await saveDB(db);
            return send(res, 201, { uuid: like.uuid });
        }

        // Unlike. The id is the like uuid returned when liking.
        if (req.method === 'PATCH') {
            let removed = false;
            for (const comment of db.comments) {
                const idx = (comment.likes || []).findIndex((l) => l.uuid === id);
                if (idx >= 0) {
                    comment.likes.splice(idx, 1);
                    removed = true;
                    break;
                }
            }
            if (removed) {
                await saveDB(db);
            }
            return send(res, 200, { status: removed });
        }

        // Edit / delete resolve by the secret "own" token; admins may use the public uuid.
        const target = findByOwn(db, id) || (isAdmin ? findComment(db, id) : null);

        if (req.method === 'PUT') {
            if (!target) {
                return send(res, 200, { status: false });
            }
            if (!db.settings.can_edit && !isAdmin) {
                return send(res, 200, { status: false });
            }
            const body = await readBody(req);
            let text = String(body.comment ?? target.comment).trim();
            if (text.length === 0) {
                return send(res, 200, { status: false });
            }
            if (db.settings.is_filter) {
                text = filterBadWords(text);
            }
            target.comment = text;
            if (body.presence !== null && body.presence !== undefined) {
                target.presence = Boolean(body.presence);
            }
            await saveDB(db);
            return send(res, 200, { status: true });
        }

        if (req.method === 'DELETE') {
            if (!target) {
                return send(res, 200, { status: false });
            }
            if (!db.settings.can_delete && !isAdmin) {
                return send(res, 200, { status: false });
            }
            removeSubtree(db, target.uuid);
            await saveDB(db);
            return send(res, 200, { status: true });
        }

        return sendError(res, 405, 'Method not allowed');
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
