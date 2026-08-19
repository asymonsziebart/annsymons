import type { Metadata, Viewport } from "next";
import "./pokemon-cards.css";

export const metadata: Metadata = {
  title: "Pokemon Cards | Admin",
  robots: "noindex, nofollow",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function PokemonCardsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="pokemon-cards-page">{children}</div>;
}
