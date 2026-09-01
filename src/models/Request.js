const pool = require("../config/database");

class Request {
  static async findAll() {
    const result = await pool.query(
      "SELECT * FROM requests ORDER BY created_at DESC",
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query("SELECT * FROM requests WHERE id = $1", [
      id,
    ]);
    return result.rows[0];
  }

  static async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE requests 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id],
    );
    return result.rows[0];
  }
}

module.exports = Request;
