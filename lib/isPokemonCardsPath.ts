/** True on the immersive Pokemon / TCG collection admin app. */
export function isPokemonCardsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/admin/pokemon-cards" || pathname.startsWith("/admin/pokemon-cards/");
}
