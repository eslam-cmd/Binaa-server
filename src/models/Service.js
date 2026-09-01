const pool = require("../config/database");

class Service {
  static async findAll() {
    const result = await pool.query("SELECT * FROM services ORDER BY id");
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query("SELECT * FROM services WHERE id = $1", [
      id,
    ]);
    return result.rows[0];
  }

  static async update(id, data) {
    const { name, description, price, features, category, emoji, isActive } =
      data;
    const values = [name, description, price, features, isActive, id];
    let sql = `UPDATE services 
       SET name = $1, description = $2, price = $3, 
           features = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP`;

    if (emoji !== undefined) {
      sql += `, emoji = $${values.length + 1}`;
      values.push(emoji);
    }

    if (category !== undefined) {
      sql += `, category = $${values.length + 1}`;
      values.push(category);
    }

    sql += ` WHERE id = $${values.length}`;

    const result = await pool.query(`${sql} RETURNING *`, values);
    return result.rows[0];
  }
}

module.exports = Service;
