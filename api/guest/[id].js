const { loadDB, saveDB, getAuth, send, sendError } = require('../_lib');

// DELETE /api/guest/:id (admin only) -> { status }
module.exports = async (req, res) => {
    if (req.method !== 'DELETE') {
        return sendError(res, 405, 'Method not allowed');
    }
    try {
        const db = await loadDB();
        const auth = getAuth(req, db);
        if (!auth || !auth.admin) {
            return sendError(res, 401, 'Unauthorized');
        }
        const id = req.query.id;
        const before = db.guests.length;
        db.guests = db.guests.filter((g) => g.id !== id);
        if (db.guests.length === before) {
            return send(res, 200, { status: false });
        }
        await saveDB(db);
        return send(res, 200, { status: true });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
