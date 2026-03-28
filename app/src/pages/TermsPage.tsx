import LegalMarkdownPage from "./LegalMarkdownPage";

export default function TermsPage() {
  return (
    <LegalMarkdownPage
      markdownPath="/terms.md"
      pageTitle="Terms of Service"
      loadErrorMessage="We couldn’t load the terms. Please try again later."
    />
  );
}
