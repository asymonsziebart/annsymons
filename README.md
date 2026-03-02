# annsymons.com

Custom site for **annsymons.com** so you have full control (no GoDaddy website builder limits).

## Tech stack
- **Next.js** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** for styling
- **Neon** (Postgres) for any data you need
- **Vercel** for hosting (then point GoDaddy domain here)

## What you can control
- Design and layout (every section, font, color, spacing)
- Pages and navigation (as many as you want)
- Contact forms, mailing list, or other forms
- Blog or portfolio if you want
- SEO (titles, descriptions, Open Graph)
- Future features (booking, shop, etc.) without changing platform

## Next steps we can do together
1. **Define the site** – What pages do you want? (e.g. Home, About, Services, Contact, Blog?)
2. **Content & design** – Copy, photos, colors, and style you like.
3. **Build page by page** – We add routes and components so you can preview as we go.
4. **Go live** – Deploy to Vercel, then in GoDaddy set the domain to point to Vercel (DNS).

## Run locally
```bash
npm install
# Add .env with DATABASE_URL (from Neon) if you need the DB
npm run dev
```
Open http://localhost:3000

## Deploy (when ready)
- Push to GitHub (optional), connect repo to Vercel, add `DATABASE_URL` in Vercel env.
- In GoDaddy: DNS → point annsymons.com (and www) to Vercel (they’ll show the records).

---

*This repo is the source of truth for annsymons.com; you own the code and the design.*
