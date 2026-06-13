export default function ProcreateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="procreate-root">
      {children}
    </div>
  );
}
