export type Post = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  body: string;
};

export const posts: Post[] = [
  {
    slug: "welcome",
    title: "Welcome to my blog",
    date: "2025-03-01",
    excerpt: "A short intro to what you’ll find here.",
    body: "This is your blog. Edit the content in `lib/posts.ts` or add new posts to the array. You can write about anything you like.",
  },
];

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getAllPosts(): Post[] {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
