import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'QA Test Management',
};

export default function JiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        AC.js bridges the iframe to the JIRA host page.
        It handles resize, dialog, and context APIs.
        Must load before app scripts.
      */}
      <Script
        src="https://connect-cdn.atl-paas.net/all.js"
        strategy="beforeInteractive"
        data-options="resize:true"
      />
      <div className="min-h-screen bg-white text-sm font-sans antialiased p-0">
        {children}
      </div>
    </>
  );
}
