import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Drovio : Unduh Video & Kompres Berkas Online',
  description: 'Layanan mudah dan cepat untuk mengunduh media dari berbagai platform sosial dan mengompres berkas gambar, PDF, video, serta audio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('drovio_theme');
                  if (saved === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="bg-obsidian-canvas text-white antialiased selection:bg-violet-accent selection:text-obsidian-canvas font-sans">
        {children}
      </body>
    </html>
  );
}
