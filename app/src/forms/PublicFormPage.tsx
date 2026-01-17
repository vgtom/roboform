import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import { getPublicForm, submitFormResponse, trackFormView } from "wasp/client/operations";
import { useParams } from "react-router-dom";
import { FormSlideshow } from "./FormSlideshow";
import { FormSchema } from "../shared/formTypes";

export default function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: form, isLoading } = useQuery(
    getPublicForm,
    formId ? { id: formId } : undefined,
  );

  useEffect(() => {
    if (form?.id) {
      trackFormView({ formId: form.id });
    }
  }, [form?.id]);

  const handleSubmit = async () => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-full min-h-[600px] flex flex-col">
        {/* Form Title */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">{schema.title}</h1>
          {schema.description && (
            <p className="text-blue-100 text-lg">{schema.description}</p>
          )}
        </div>

        {/* Slideshow Container */}
        <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20">
          <FormSlideshow
            schema={schema}
            formData={formData}
            onFieldChange={updateField}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitted={submitted}
          />
        </div>
      </div>
    </div>
  );
}

