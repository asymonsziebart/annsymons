export type Post = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  body: string;
  image?: string;
};

export const posts: Post[] = [
  {
    slug: "motor-city-comic-con-costume-contest",
    title: "Winning the Motor City Comic Con costume contest",
    date: "2018-05-20",
    excerpt: "How I built my costume and what it was like to take home the win at Motor City Comic Con.",
    body: `I've been going to Motor City Comic Con for years, but this was the first time I entered the costume contest. I spent months on the build—a mix of sewing, 3D-printed pieces, and a lot of hot glue.

The judges seemed to really like the detail work and the fact that so much of it was handmade. I didn't expect to win; I was just there to have fun and show off something I was proud of. When they called my name, I was honestly shocked.

If you're thinking about entering a con contest, my advice: pick something you love, start early, and don't be afraid to mix techniques. Sewing, foam, 3D printing—it all works together. And even if you don't win, you'll have a costume you made yourself and a room full of people who get it.`,
  },
  {
    slug: "training-my-dog-rat-hunting",
    title: "Training my dog for rat hunting",
    date: "2025-10-11",
    excerpt: "Copper placed in the rat hunt competition at the Novi Pet Expo. What I've learned about teaching a dog to hunt rats safely and effectively.",
    body: `In October 2025, Copper and I competed in the rat hunt at the Novi Pet Expo—and he placed. I was so proud of him. We'd been training for a while, and it was great to see it pay off in a real competition setting.

I got into rat hunting with my dog partly for pest control and partly because it's a real job for a terrier—they're bred for it, and they're good at it. But "natural instinct" doesn't mean you skip training.

We started with basic obedience and recall. That's non-negotiable. You need a dog that will stop when you say stop and come back when called, especially around other animals and people. Then we worked on scent and focus: finding the rat, indicating, and only going in when I give the cue.

It's been a learning curve for both of us. The biggest thing I've learned is patience. Some days he's dialed in; other days he's a goofball. We keep sessions short and end on a good note. If you're curious about getting started, find someone with experience—there's a lot of nuance to doing it safely and ethically.`,
    image: "/blog/rathunt.jpg",
  },
  {
    slug: "new-puppy-copper",
    title: "Got a new puppy—meet Copper",
    date: "2023-12-08",
    excerpt: "Welcome home, Copper. A new puppy and the start of a lot of adventures.",
    body: `December 8, 2023—I brought home a new puppy and named him Copper. He's been a handful in the best way: curious, energetic, and already part of the family.

We're working on the basics: house training, simple commands, and getting him used to his new routine. It's only been a short time but it already feels like he's been here forever. Looking forward to all the adventures ahead with him.`,
    image: "/blog/puppycopper.jpg",
  },
  {
    slug: "3d-printing-costumes-and-useful-stuff",
    title: "3D printing for costumes and useful things",
    date: "2025-01-28",
    excerpt: "Using a 3D printer for cosplay pieces and everyday fixes.",
    body: `My 3D printer has become one of my most-used tools—for costumes and for random useful things around the house.

For cosplay, I use it for armor bits, props, buckles, and details that would be a pain to sculpt by hand. I design in Tinkercad or Fusion 360, then print in PLA or PETG depending on whether it needs to bend or stay rigid. Sanding, primer, and paint make the prints look like real armor or props. The key is designing with print orientation in mind so you don't get weak layers where stress will be.

Outside of costumes, I've printed cable organizers, drawer dividers, replacement knobs, and little brackets for things that don't quite fit. It's satisfying to fix a problem in an afternoon instead of hunting for a product that doesn't exist.

If you're on the fence about getting a printer: start with a simple machine and a few rolls of filament. The learning curve is real but not huge, and once you're comfortable, the possibilities are endless.`,
  },
  {
    slug: "python-and-vercel-for-side-projects",
    title: "Using Python and Vercel for side projects",
    date: "2025-01-12",
    excerpt: "How I use Python on the backend and Vercel to ship small tools and sites quickly.",
    body: `I do a lot of internal tools at work in Python—scripting, APIs, little web apps with FastAPI or Flask. For personal stuff and side projects, I've been pairing Python with Vercel so I can deploy without managing servers.

Vercel supports Python serverless functions, so you can keep your API logic in Python even when the front end is Next.js or static. I'll often build a small Next.js app for the UI and use Vercel serverless functions (or a separate Python API) for the heavy lifting. Deploy is just a git push; no SSH, no config files on a box.

For quick one-off tools—something that processes a file, hits an API, or generates a report—I'll sometimes do the whole thing in a single Python file and deploy it as one serverless function. It's not fancy, but it works and it's free or cheap on Vercel's tier.

If you're already comfortable with Python and want to put something on the web without learning a whole new stack, the Python + Vercel combo is worth a look.`,
  },
  {
    slug: "welcome",
    title: "Welcome to my blog",
    date: "2025-03-01",
    excerpt: "A short intro to what you'll find here.",
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
