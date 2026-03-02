import { getSql } from "@/lib/db";
import { getAllPosts as getStaticPosts, getPostBySlug as getStaticPostBySlug, type Post } from "@/lib/posts";

export type { Post };

export async function getAllPosts(): Promise<Post[]> {
  const sql = getSql();
  if (!sql) return getStaticPosts();
  try {
    const rows = await sql`
      SELECT slug, title, date::text as date, excerpt, body
      FROM posts
      ORDER BY date DESC
    `;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows as Post[];
    }
  } catch {
    // fallback to static
  }
  return getStaticPosts();
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const sql = getSql();
  if (!sql) return getStaticPostBySlug(slug);
  try {
    const rows = await sql`
      SELECT slug, title, date::text as date, excerpt, body
      FROM posts
      WHERE slug = ${slug}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && typeof row === "object") return row as Post;
  } catch {
    // fallback
  }
  return getStaticPostBySlug(slug);
}
