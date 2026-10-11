require("dotenv").config();

const pool = require("../config/database");
const {
  generateTranslations,
  hasAllTranslations,
} = require("../lib/translate");

async function backfillTranslations() {
  const result = await pool.query(
    `SELECT id, title, excerpt, content, category, tags, author, translations
     FROM posts
     WHERE status = 'published'
     ORDER BY created_at ASC`,
  );
  let translatedCount = 0;

  for (const post of result.rows) {
    if (hasAllTranslations(post.translations)) continue;

    const translations = await generateTranslations({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      tags: post.tags,
      author: post.author,
    });

    await pool.query(
      "UPDATE posts SET translations = $1 WHERE id = $2",
      [JSON.stringify(translations), post.id],
    );
    translatedCount += 1;
    console.info(`Translated post ${post.id}`);
  }

  console.info(`Backfill complete: ${translatedCount} post(s) translated.`);
}

backfillTranslations()
  .catch((error) => {
    console.error("Translation backfill failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
