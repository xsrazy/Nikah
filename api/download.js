const { loadDB, getAuth, sendError, formatDate } = require('./_lib');

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
    }
    try {
        const db = await loadDB();
        const auth = getAuth(req, db);
        if (!auth || !auth.admin) {
            return sendError(res, 401, 'Unauthorized');
        }
        const rows = [['uuid', 'parent', 'name', 'presence', 'comment', 'likes', 'is_admin', 'ip', 'user_agent', 'created_at']];
        const sorted = db.comments.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        for (const c of sorted) {
            rows.push([c.uuid, c.parent || '', c.name, c.presence ? 'Datang' : 'Berhalangan',
                c.comment, (c.likes || []).length, c.is_admin ? '1' : '0', c.ip || '',
                c.user_agent || '', formatDate(c.created_at)]);
        }
        const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="comments.csv"');
        return res.status(200).send(csv);
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
