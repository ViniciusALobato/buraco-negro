import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buraco Negro Financeiro",
  description: "Controle pessoal de gastos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body style={{ fontFamily: 'sans-serif' }}>{children}</body>
    </html>
  );
}