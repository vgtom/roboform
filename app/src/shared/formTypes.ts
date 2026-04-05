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
  | "file"
  | "star_rating";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** Star rating: max selectable stars (1–10). Default 10. */
  maxStars?: number;
  /** HTTPS or data URL shown as-is on slides */
  image?: string;
  /** When true, a JPEG/PNG is stored in Postgres (BYTEA) for this field */
  coverInDb?: boolean;
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

