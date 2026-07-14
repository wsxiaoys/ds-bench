import type { DocumentProps } from "rwsdk/router";

const Shell: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=optional"
        precedence="first"
      />
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body>
      {children}
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);

export const PublicDocument: React.FC<DocumentProps> = ({ children }) => (
  <Shell title="Public Site">{children}</Shell>
);

export const AdminDocument: React.FC<DocumentProps> = ({ children }) => (
  <Shell title="Admin Console">{children}</Shell>
);