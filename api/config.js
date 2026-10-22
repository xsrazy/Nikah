const { loadDB, getAuth, send, sendError } = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
    }
    try {
        const db = await loadDB();
        if (!getAuth(req, db)) {
            return sendError(res, 401, 'Invalid access key');
        }
        const s = db.settings;
        return send(res, 200, {
            name: s.name,
            can_reply: s.can_reply,
            can_edit: s.can_edit,
            can_delete: s.can_delete,
        });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
