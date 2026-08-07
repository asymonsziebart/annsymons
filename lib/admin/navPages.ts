export type AdminNavPage = {
  href: string;
  label: string;
  description: string;
  keywords?: string[];
};

/** Shared list of admin tools and private pages for the sidebar and dashboard search. */
export const ADMIN_NAV_PAGES: AdminNavPage[] = [
  {
    href: "/admin",
    label: "Admin home",
    description: "Dashboard overview",
    keywords: ["dashboard", "home"],
  },
  {
    href: "/blog",
    label: "Blog",
    description: "Private blog posts",
    keywords: ["posts", "writing"],
  },
  {
    href: "/admin/recipes",
    label: "Recipes",
    description: "Add recipes, photos, ingredients, and steps",
    keywords: ["cooking", "food"],
  },
  {
    href: "/admin/backyard",
    label: "Backyard Plants",
    description: "Map plants on a yard photo",
    keywords: ["garden", "yard", "plants"],
  },
  {
    href: "/admin/garage",
    label: "Garage Inventory",
    description: "Search bins and stored items",
    keywords: ["bins", "storage", "qr"],
  },
  {
    href: "/admin/manuals",
    label: "Manuals",
    description: "Appliance and gear manuals in one place",
    keywords: [
      "brother",
      "sewing",
      "pdf",
      "instructions",
      "ls-2125i",
      "ford",
      "fusion",
      "maverick",
      "hybrid",
      "vehicle",
      "truck",
      "car",
      "macbook",
      "apple",
      "m4",
      "instax",
      "fujifilm",
      "camera",
      "craftsman",
      "m110",
      "lawnmower",
      "mower",
      "ender",
      "ender-3",
      "creality",
      "3d printer",
    ],
  },
  {
    href: "/admin/dogs",
    label: "Puppy Ranch",
    description: "Cozy dog breeding game",
    keywords: ["dogs", "game", "puppies"],
  },
  {
    href: "/admin/movies",
    label: "Movies",
    description: "Private Google Drive movie library",
    keywords: ["film", "watch", "drive"],
  },
  {
    href: "/admin/family-tree",
    label: "Family Tree",
    description: "Private genealogy from your .ftz export",
    keywords: ["genealogy", "relatives", "ftz", "ancestry", "krause", "symons"],
  },
  {
    href: "/admin/voices",
    label: "Voices",
    description: "Things he is not allowed to do",
    keywords: ["rules", "reminders"],
  },
  {
    href: "/admin/requests",
    label: "Purchase Requests",
    description: "Review things to buy",
    keywords: ["shopping", "buy", "orders"],
  },
  {
    href: "/admin/truck-fund",
    label: "Truck Fund",
    description: "Ford Maverick down payment savings and loan estimate",
    keywords: ["maverick", "savings", "loan", "ford"],
  },
  {
    href: "/tasks",
    label: "Tasks",
    description: "Private task board",
    keywords: ["todo", "checklist"],
  },
  {
    href: "/admin/mirror",
    label: "Smart Mirror",
    description: "Black full-screen clock and due tasks",
    keywords: ["clock", "jarvis", "display"],
  },
  {
    href: "/statephotos",
    label: "State Photos",
    description: "Map photo manager",
    keywords: ["map", "travel", "states"],
  },
  {
    href: "/archery",
    label: "Archery",
    description: "Hidden practice page",
    keywords: ["bow", "target"],
  },
  {
    href: "/admin/instagram",
    label: "Instagram",
    description: "Connect account, queue photos and captions, schedule posts",
    keywords: ["social", "post", "caption", "schedule", "photo"],
  },
  {
    href: "/admin/gallery",
    label: "Gallery",
    description: "Manage gallery items",
    keywords: ["photos", "images"],
  },
  {
    href: "/admin/posts/new",
    label: "New blog post",
    description: "Write a new private blog post",
    keywords: ["write", "article"],
  },
  {
    href: "/admin/recipes/new",
    label: "New recipe",
    description: "Add a new recipe",
    keywords: ["cook", "add"],
  },
];

/** Pages shown in the Admin dashboard “Private pages” grid (excludes home and shortcuts). */
export const ADMIN_PRIVATE_PAGES: AdminNavPage[] = ADMIN_NAV_PAGES.filter(
  (page) =>
    page.href !== "/admin" &&
    page.href !== "/admin/truck-fund" &&
    page.href !== "/admin/gallery" &&
    page.href !== "/admin/posts/new" &&
    page.href !== "/admin/recipes/new"
);

export function searchableAdminPageText(page: AdminNavPage): string {
  return [page.label, page.description, ...(page.keywords ?? []), page.href]
    .join(" ")
    .toLowerCase();
}
