const crypto = require('crypto');
const { loadDB, saveDB, getAuth, send, sendError } = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'PUT') {
        return sendError(res, 405, 'Method not allowed');
    }
    try {
        const db = await loadDB();
        const auth = getAuth(req, db);
        if (!auth || !auth.admin) {
            return sendError(res, 401, 'Unauthorized');
        }
        db.settings.access_key = crypto.randomBytes(24).toString('hex');
        await saveDB(db);
        return send(res, 200, { status: true });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
