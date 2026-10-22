const { loadDB, verifyPassword, signToken, send, sendError, readBody } = require('./_lib');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
    }
    try {
        const db = await loadDB();
        const { email, password } = await readBody(req);
        if (!email || !password ||
            email !== db.settings.email ||
            !verifyPassword(password, db.settings.password)) {
            return sendError(res, 401, 'Email atau password salah');
        }
        const token = signToken({
            sub: 'admin',
            name: db.settings.name,
            email: db.settings.email,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        });
        return send(res, 200, { token });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};
