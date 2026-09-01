const pool = require("../config/database");

class Session {
  static async create(userId, sessionToken, ip, userAgent) {
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + parseInt(process.env.SESSION_EXPIRY_DAYS || 7),
    );

    const result = await pool.query(
      `INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, sessionToken, ip, userAgent, expiresAt],
    );
    return result.rows[0];
  }

  static async findByToken(sessionToken) {
    const result = await pool.query(
      `SELECT s.*, s.user_id AS id, u.email, u.role 
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > NOW()`,
      [sessionToken],
    );
    return result.rows[0];
  }

  static async invalidate(sessionToken) {
    await pool.query(
      "UPDATE sessions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE session_token = $1",
      [sessionToken],
    );
  }

  static async invalidateAll(userId) {
    await pool.query(
      "UPDATE sessions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
      [userId],
    );
  }

  static async cleanupExpired() {
    await pool.query(
      "DELETE FROM sessions WHERE expires_at < NOW() OR is_active = false",
    );
  }

  static async getUserSessions(userId) {
    const result = await pool.query(
      "SELECT id, ip_address, user_agent, created_at, expires_at FROM sessions WHERE user_id = $1 AND is_active = true",
      [userId],
    );
    return result.rows;
  }
}

module.exports = Session;
