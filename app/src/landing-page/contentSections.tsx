import { BlogUrl, DocsUrl } from "../shared/common";
import type { GridFeature } from "./components/FeaturesGrid";

export const features: GridFeature[] = [
  {
    name: "AI Form Generation",
    description: "Create forms instantly with AI. Just describe what you need and watch it come to life.",
    emoji: "🤖",
    href: DocsUrl,
    size: "large",
  },
  {
    name: "Beautiful Templates",
    description: "Start with professionally designed templates for surveys, feedback, registrations, and more.",
    emoji: "🎨",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Real-time Analytics",
    description: "Track views, submissions, and completion rates. Understand your audience better.",
    emoji: "📊",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Custom Branding",
    description: "Make forms your own with custom colors, images, and styling options.",
    emoji: "🎯",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Workspace Collaboration",
    description: "Organize forms in workspaces and collaborate with your team.",
    emoji: "👥",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Conditional Logic",
    description: "Create smart forms that adapt based on user responses.",
    emoji: "⚡",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Export Responses",
    description: "Download responses as CSV or JSON. Integrate with your favorite tools.",
    emoji: "📥",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Mobile Responsive",
    description: "Forms look perfect on any device—desktop, tablet, or mobile.",
    emoji: "📱",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Secure & Private",
    description: "Your data is encrypted and secure. We take privacy seriously.",
    emoji: "🔒",
    href: DocsUrl,
    size: "medium",
  },
];

export const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager @ TechCorp",
    avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    socialUrl: "#",
    quote: "We've collected 10x more feedback since switching to this platform. The AI form generation is a game-changer!",
  },
  {
    name: "Michael Rodriguez",
    role: "Founder @ StartupXYZ",
    avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    socialUrl: "#",
    quote: "Creating forms used to take hours. Now it takes minutes. Our team loves how intuitive it is.",
  },
  {
    name: "Emily Johnson",
    role: "Marketing Director @ GrowthCo",
    avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
    socialUrl: "#",
    quote: "The analytics dashboard gives us insights we never had before. Highly recommend!",
  },
];

export const faqs = [
  {
    id: 1,
    question: "Do I need to know how to code?",
    answer: "Not at all! Our form builder is completely visual. You can create beautiful forms by clicking and typing. Our AI can even generate forms from simple descriptions.",
    href: "#",
  },
  {
    id: 2,
    question: "Can I customize the look of my forms?",
    answer: "Yes! You can customize colors, add images, change fonts, and more. Make your forms match your brand perfectly.",
    href: "#",
  },
  {
    id: 3,
    question: "How do I collect responses?",
    answer: "Responses are automatically collected when someone submits your form. You can view them in your dashboard, export them, or set up integrations.",
    href: "#",
  },
  {
    id: 4,
    question: "Is there a free plan?",
    answer: "Yes! We offer a free forever plan so you can get started without any commitment. Upgrade when you need more features.",
    href: "#",
  },
  {
    id: 5,
    question: "Can I embed forms on my website?",
    answer: "Absolutely! You can embed forms anywhere using our embed code, or share them via a simple link.",
    href: "#",
  },
  {
    id: 6,
    question: "What happens to my data?",
    answer: "Your data is encrypted and stored securely. You own all your data and can export it anytime. We never share your information with third parties.",
    href: "#",
  },
];

export const footerNavigation = {
  app: [
    { name: "Documentation", href: DocsUrl },
    { name: "Blog", href: BlogUrl },
    { name: "Templates", href: "#" },
  ],
  company: [
    { name: "About", href: "#" },
    { name: "Privacy", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
};

export const examples = [
  {
    name: "Customer Feedback",
    description: "Collect valuable feedback from your customers with beautiful, engaging forms.",
    imageSrc: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop",
    href: "#",
  },
  {
    name: "Event Registration",
    description: "Create registration forms for events, webinars, and workshops.",
    imageSrc: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=600&fit=crop",
    href: "#",
  },
  {
    name: "Job Applications",
    description: "Streamline your hiring process with professional application forms.",
    imageSrc: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=600&fit=crop",
    href: "#",
  },
  {
    name: "Surveys & Polls",
    description: "Gather insights with customizable survey forms and polls.",
    imageSrc: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    href: "#",
  },
  {
    name: "Contact Forms",
    description: "Simple, elegant contact forms for your website.",
    imageSrc: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop",
    href: "#",
  },
  {
    name: "Lead Generation",
    description: "Capture leads with conversion-optimized forms.",
    imageSrc: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=600&fit=crop",
    href: "#",
  },
  {
    name: "Order Forms",
    description: "Create order and checkout forms for your business.",
    imageSrc: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop",
    href: "#",
  },
];
