import LegalMarkdownPage from "./LegalMarkdownPage";

export default function PrivacyPage() {
  return (
    <LegalMarkdownPage
      markdownPath="/privacy.md"
      pageTitle="Privacy Policy"
      loadErrorMessage="We couldn’t load the privacy policy. Please try again later."
    />
  );
}
