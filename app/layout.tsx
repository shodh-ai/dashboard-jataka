import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"] });
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = {
  title: "Kamikaze Dashboard",
  description: "Connect your Central Brain to VS Code",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!publishableKey) {
    return (
      <html lang="en">
        <body className={`${inter.className} bg-slate-950 text-slate-200 antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body className={`${inter.className} bg-slate-950 text-slate-200 antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
