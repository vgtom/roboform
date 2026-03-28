import LegalMarkdownPage from "./LegalMarkdownPage";

export default function RefundPolicyPage() {
  return (
    <LegalMarkdownPage
      markdownPath="/refund-policy.md"
      pageTitle="Refund Policy"
      loadErrorMessage="We couldn’t load the refund policy. Please try again later."
    />
  );
}
