import LegalMarkdownPage from "./LegalMarkdownPage";

export default function AboutPage() {
  return (
    <LegalMarkdownPage
      markdownPath="/about.md"
      pageTitle="About VinForms"
      loadErrorMessage="We couldn’t load this page. Please try again later."
    />
  );
}
