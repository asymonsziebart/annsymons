import { Fraunces, Nunito } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export default function CallieVallieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${fraunces.variable} ${nunito.variable} relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain`}
    >
      {children}
    </div>
  );
}
