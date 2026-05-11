import type { Metadata } from 'next'
import { Rajdhani, Share_Tech_Mono } from 'next/font/google'
import './globals.css'

const rajdhani = Rajdhani({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-rajdhani',
})

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-share-tech-mono',
})

export const metadata: Metadata = {
  title: 'ASCEND — Personal Evolution System',
  description: 'The system has found you. Begin your ascension.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${shareTechMono.variable} h-full`}>
      <body className="h-full bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}
