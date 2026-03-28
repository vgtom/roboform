import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

type LegalMarkdownPageProps = {
  markdownPath: string;
  pageTitle: string;
  loadErrorMessage: string;
};

export default function LegalMarkdownPage({
  markdownPath,
  pageTitle,
  loadErrorMessage,
}: LegalMarkdownPageProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(markdownPath)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch(() => {
        if (!cancelled) {
          setError(loadErrorMessage);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [markdownPath, loadErrorMessage]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">{pageTitle}</h1>
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
        {!error && markdown === null && (
          <p className="text-muted-foreground">Loading…</p>
        )}
        {markdown !== null && (
          <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-primary">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}
