import type { Metadata } from 'next';
import { Poppins, Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'DriftPay — Your wallet, made simple',
  description: 'A simple wallet for sending, receiving, and tracking payments on Stellar.',
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var palette = localStorage.getItem('driftpay:palette');
    var mode = localStorage.getItem('driftpay:mode');
    document.documentElement.dataset.palette = (palette === 'sherbet' || palette === 'mintfog') ? palette : 'mintfog';
    document.documentElement.dataset.mode = (mode === 'day' || mode === 'night') ? mode : 'day';
  } catch (e) {
    document.documentElement.dataset.palette = 'mintfog';
    document.documentElement.dataset.mode = 'day';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable}`}
      data-palette="mintfog"
      data-mode="day"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
