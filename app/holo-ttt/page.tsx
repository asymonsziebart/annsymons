import type { Metadata, Viewport } from "next";

import HoloTicTacToeApp from "./HoloTicTacToeApp";
import "./holo-ttt.css";

export const metadata: Metadata = {
  title: "Hologram Tic-Tac-Toe — Ann Symons",
  description:
    "Floating holographic tic-tac-toe. Point and pinch to place pieces — works on a laptop, even cooler with an acrylic pyramid.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020308",
};

export default function HoloTicTacToePage() {
  return <HoloTicTacToeApp />;
}
