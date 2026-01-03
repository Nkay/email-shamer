import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DMARC Portal',
  description: 'Check and validate DMARC configurations for domains',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-900">
                    DMARC Portal
                  </h1>
                </div>
                <nav className="flex space-x-8">
                  <a
                    href="/"
                    className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Check Domain
                  </a>
                  <a
                    href="/registry"
                    className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Registry
                  </a>
                  <a
                    href="/education"
                    className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Learn DMARC
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}