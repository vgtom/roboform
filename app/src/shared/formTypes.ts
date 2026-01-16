export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "date"
  | "file";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  image?: string;
  options?: string[]; // For select, multiselect, radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
  [key: string]: any; // Index signature for Wasp Payload compatibility
}

export const DEFAULT_FORM_SCHEMA: FormSchema = {
  title: "Untitled Form",
  description: "",
  fields: [],
};

