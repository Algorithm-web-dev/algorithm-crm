import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Algorithm CRM',
  description: 'Performance-tuned CRM for agencies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-deep-navy text-text-primary antialiased">{children}</body>
    </html>
  );
}
