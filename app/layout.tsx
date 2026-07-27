import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { PersonaProvider } from "./components/PersonaProvider";
import PersonaSwitcher from "./components/PersonaSwitcher";
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = {
  title: "Jataka Dashboard",
  description: "Developer Context & Guardrails",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body className="bg-[var(--bg-base)] text-[var(--text-primary)] antialiased">
          <PersonaProvider>
            <PersonaSwitcher />
            {children}
          </PersonaProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
