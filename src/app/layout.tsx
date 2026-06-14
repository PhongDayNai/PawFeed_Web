import type { Metadata } from 'next';
import { Outfit, Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '../context/AppContext';
import { LanguageProvider } from '../context/LanguageContext';
import { Header } from './Header';
import { ChatbotBubble } from '../components/ChatbotBubble';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PawFeed - Smart Pet Feeder Control',
  description: 'Manage and control your smart pet feeder device. Schedule feeding, view diagnostics, configure WiFi and feed now in real-time.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} suppressHydrationWarning>
        <LanguageProvider>
          <AppProvider>
            <Header />
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
              {children}
            </main>
            <ChatbotBubble />
          </AppProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
