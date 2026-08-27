import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "../components/Provider";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Marketing Analytics Dashboard",
  description: "Complete analytics dashboard for all your marketing campaigns.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Suppress unsafe pseudo-class warnings in development console to avoid breaking Next.js dev overlays */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var orgError = console.error;
                console.error = function() {
                  var argsStr = '';
                  for (var i = 0; i < arguments.length; i++) {
                    try {
                      argsStr += ' ' + String(arguments[i]);
                    } catch (e) {}
                  }
                  if (argsStr.indexOf('first-child') !== -1) {
                    return;
                  }
                  orgError.apply(console, arguments);
                };
              })();
            `
          }}
        />
      </head>
      <body
        id="__next"
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Facebook Pixel Script */}
        <Script
          id="facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
                !function(f,b,e,v,n,t,s) {
                  if(f.fbq) return;
                  n=f.fbq=function(){
                    n.callMethod ?
                    n.callMethod.apply(n,arguments) :
                    n.queue.push(arguments)
                  };
                  if(!f._fbq) f._fbq=n;
                  n.push=n;
                  n.loaded=!0;
                  n.version='2.0';
                  n.queue=[];
                  t=b.createElement(e);
                  t.async=!0;
                  t.src=v;
                  s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s);
                }(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');

                fbq('init', '978250051055927');
                fbq('track', 'PageView');
              `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=978250051055927&ev=PageView&noscript=1"
          />
        </noscript>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
