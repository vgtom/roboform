import { FormSchema } from "../shared/formTypes";

export const FORM_TEMPLATES: Record<string, FormSchema> = {
  contact: {
    title: "Contact Form",
    description: "Get in touch with us",
    fields: [
      {
        id: "name",
        type: "text",
        label: "Name",
        placeholder: "Enter your name",
        required: true,
      },
      {
        id: "email",
        type: "email",
        label: "Email",
        placeholder: "Enter your email",
        required: true,
      },
      {
        id: "message",
        type: "textarea",
        label: "Message",
        placeholder: "Enter your message",
        required: true,
      },
    ],
  },
  saasOnboarding: {
    title: "SaaS Onboarding Form",
    description: "Welcome! Let's get you set up",
    fields: [
      {
        id: "companyName",
        type: "text",
        label: "Company Name",
        placeholder: "Enter your company name",
        required: true,
      },
      {
        id: "role",
        type: "select",
        label: "What's your role?",
        options: ["Founder", "CTO", "Product Manager", "Developer", "Other"],
        required: true,
      },
      {
        id: "teamSize",
        type: "select",
        label: "Team Size",
        options: ["1-10", "11-50", "51-200", "201-500", "500+"],
        required: true,
      },
      {
        id: "useCase",
        type: "textarea",
        label: "What are you planning to use this for?",
        placeholder: "Describe your use case",
        required: false,
      },
    ],
  },
  eventRegistration: {
    title: "Event Registration",
    description: "Register for our upcoming event",
    fields: [
      {
        id: "fullName",
        type: "text",
        label: "Full Name",
        placeholder: "Enter your full name",
        required: true,
      },
      {
        id: "email",
        type: "email",
        label: "Email",
        placeholder: "Enter your email",
        required: true,
      },
      {
        id: "phone",
        type: "text",
        label: "Phone Number",
        placeholder: "Enter your phone number",
        required: false,
      },
      {
        id: "dietary",
        type: "select",
        label: "Dietary Requirements",
        options: ["None", "Vegetarian", "Vegan", "Gluten-free", "Other"],
        required: false,
      },
      {
        id: "notes",
        type: "textarea",
        label: "Additional Notes",
        placeholder: "Any additional information?",
        required: false,
      },
    ],
  },
  feedback: {
    title: "Feedback Form",
    description: "We'd love to hear your thoughts",
    fields: [
      {
        id: "rating",
        type: "radio",
        label: "How would you rate your experience?",
        options: ["1", "2", "3", "4", "5"],
        required: true,
      },
      {
        id: "feedback",
        type: "textarea",
        label: "Your Feedback",
        placeholder: "Tell us what you think",
        required: true,
      },
      {
        id: "recommend",
        type: "checkbox",
        label: "Would you recommend us to others?",
        required: false,
      },
    ],
  },
};

export function getTemplate(name: string): FormSchema | null {
  return FORM_TEMPLATES[name] || null;
}

export function getAllTemplateNames(): string[] {
  return Object.keys(FORM_TEMPLATES);
}

