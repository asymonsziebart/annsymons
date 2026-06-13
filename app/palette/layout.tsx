export default function PaletteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="procreate-root">{children}</div>;
}
