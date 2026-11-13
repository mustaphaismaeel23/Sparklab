import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPARKLAB CREATIVITY AND INNOVATION HUB | Attendance',
  description: 'Attendance management for SPARKLAB CREATIVITY AND INNOVATION HUB.',
  applicationName: 'SPARKLAB CREATIVITY AND INNOVATION HUB'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
