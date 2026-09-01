const pool = require("../config/database");

class Post {
  static async findAll() {
    const result = await pool.query(
      "SELECT * FROM posts ORDER BY created_at DESC",
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);
    return result.rows[0];
  }

  static async create(data) {
    const { title, excerpt, content, category, tags, coverImage, author } =
      data;
    const result = await pool.query(
      `INSERT INTO posts (title, excerpt, content, category, tags, cover_image, author)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, excerpt, content, category, tags, coverImage, author],
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { title, excerpt, content, category, tags, coverImage, author } =
      data;
    const result = await pool.query(
      `UPDATE posts 
       SET title = $1, excerpt = $2, content = $3, 
           category = $4, tags = $5, cover_image = $6, author = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [title, excerpt, content, category, tags, coverImage, author, id],
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      "DELETE FROM posts WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  }
}

module.exports = Post;
