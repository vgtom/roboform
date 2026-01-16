import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import { getFormBySlug, submitFormResponse, trackFormView } from "wasp/client/operations";
import { useParams } from "react-router-dom";
import { Button } from "../client/components/ui/button";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Textarea } from "../client/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { Card, CardContent } from "../client/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { FormSchema, FormField } from "../shared/formTypes";

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: form, isLoading } = useQuery(
    getFormBySlug,
    slug ? { slug } : undefined,
  );

  useEffect(() => {
    if (form?.id) {
      trackFormView({ formId: form.id });
    }
  }, [form?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.id) return;

    setIsSubmitting(true);
    try {
      await submitFormResponse({
        formId: form.id,
        responseJson: formData,
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      });
      setSubmitted(true);
    } catch (error: any) {
      alert(error.message || "Failed to submit form");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (fieldId: string, value: any) => {
    setFormData({ ...formData, [fieldId]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Form not found</div>
      </div>
    );
  }

  const schema = form.schemaJson as FormSchema;

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
            <p className="text-muted-foreground">
              Your response has been submitted successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-3xl font-bold mb-2">{schema.title}</h1>
            {schema.description && (
              <p className="text-muted-foreground mb-8">{schema.description}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {schema.fields.map((field) => (
                <div key={field.id}>
                  <Label htmlFor={field.id} className="mb-2 block">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  {renderField(field, formData[field.id], (value) =>
                    updateField(field.id, value),
                  )}
                </div>
              ))}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function renderField(
  field: FormField,
  value: any,
  onChange: (value: any) => void,
) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          id={field.id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
          className="mt-1"
        />
      );
    case "email":
    case "text":
    case "number":
    case "date":
      return (
        <Input
          id={field.id}
          type={field.type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className="mt-1"
        />
      );
    case "select":
      return (
        <Select value={value || ""} onValueChange={onChange} required={field.required}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={field.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <div className="mt-1 space-y-2">
          {field.options?.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${field.id}-${opt}`}
                checked={Array.isArray(value) && value.includes(opt)}
                onChange={(e) => {
                  const current = Array.isArray(value) ? value : [];
                  if (e.target.checked) {
                    onChange([...current, opt]);
                  } else {
                    onChange(current.filter((v) => v !== opt));
                  }
                }}
              />
              <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
            </div>
          ))}
        </div>
      );
    case "radio":
      return (
        <div className="mt-2 space-y-2">
          {field.options?.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <input
                type="radio"
                id={`${field.id}-${opt}`}
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
                required={field.required}
              />
              <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            id={field.id}
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            required={field.required}
          />
          <Label htmlFor={field.id}>{field.label}</Label>
        </div>
      );
    default:
      return (
        <Input
          id={field.id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className="mt-1"
        />
      );
  }
}

