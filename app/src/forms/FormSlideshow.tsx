import { useState } from "react";
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
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { FormSchema, FormField } from "../shared/formTypes";

interface FormSlideshowProps {
  schema: FormSchema;
  formData: Record<string, any>;
  onFieldChange: (fieldId: string, value: any) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  submitted?: boolean;
  readOnly?: boolean;
}

export function FormSlideshow({
  schema,
  formData,
  onFieldChange,
  onSubmit,
  isSubmitting = false,
  submitted = false,
  readOnly = false,
}: FormSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fields = schema.fields || [];

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2 text-white">Thank you!</h2>
          <p className="text-blue-100">
            Your response has been submitted successfully.
          </p>
        </div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-white text-center">
          <h2 className="text-3xl font-bold mb-2">{schema.title || "Untitled Form"}</h2>
          {schema.description && (
            <p className="text-blue-100">{schema.description}</p>
          )}
          <p className="text-blue-200 mt-4">This form has no questions yet.</p>
        </div>
      </div>
    );
  }

  const isFirstSlide = currentIndex === 0;
  const isLastSlide = currentIndex === fields.length - 1;
  const currentField = fields[currentIndex];

  const handleNext = () => {
    if (currentIndex < fields.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const canProceed = () => {
    if (readOnly) return true; // Allow navigation in preview mode
    const value = formData[currentField.id];
    if (currentField.required) {
      if (currentField.type === "checkbox") {
        return value === true;
      }
      if (currentField.type === "multiselect") {
        return Array.isArray(value) && value.length > 0;
      }
      return value !== undefined && value !== null && value !== "";
    }
    return true;
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-white/70">
            Question {currentIndex + 1} of {fields.length}
          </span>
          <span className="text-sm text-white/70">
            {Math.round(((currentIndex + 1) / fields.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div
            className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / fields.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-2 text-white">
            {currentField.label || "Untitled Question"}
          </h2>
          {currentField.placeholder && (
            <p className="text-blue-100 mb-8">{currentField.placeholder}</p>
          )}
          <div className="mt-8 flex justify-center">
            {renderField(currentField, formData[currentField.id] || "", (value) =>
              onFieldChange(currentField.id, value),
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="ghost"
          onClick={handlePrevious}
          disabled={isFirstSlide}
          className="text-white hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Previous
        </Button>

        {isLastSlide ? (
          <Button
            onClick={onSubmit}
            disabled={!canProceed() || isSubmitting}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg disabled:opacity-50"
          >
            Continue
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

function renderField(field: FormField, value: any, onChange: (value: any) => void) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full"
          rows={4}
          required={field.required}
        />
      );
    case "select":
      return (
        <Select value={value} onValueChange={onChange} required={field.required}>
          <SelectTrigger className="bg-white/20 border-white/30 text-white w-full max-w-md">
            <SelectValue placeholder={field.placeholder || "Select an option..."} />
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
    case "radio":
      return (
        <div className="space-y-3 w-full max-w-md mx-auto">
          {field.options?.map((opt) => (
            <div
              key={opt}
              onClick={() => onChange(opt)}
              className={`bg-white/20 border border-white/30 rounded-lg p-4 text-left cursor-pointer hover:bg-white/30 transition ${
                value === opt ? "bg-white/30 border-white/50" : ""
              }`}
            >
              {opt}
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-3 justify-center">
          <input
            type="checkbox"
            id={field.id}
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            required={field.required}
            className="w-5 h-5 rounded border-white/30 bg-white/20 text-yellow-400 focus:ring-yellow-400"
          />
          <Label htmlFor={field.id} className="text-white cursor-pointer">
            {field.label}
          </Label>
        </div>
      );
    case "multiselect":
      return (
        <div className="space-y-2 w-full max-w-md mx-auto text-left">
          {field.options?.map((opt) => (
            <div key={opt} className="flex items-center gap-3">
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
                className="w-5 h-5 rounded border-white/30 bg-white/20 text-yellow-400 focus:ring-yellow-400"
              />
              <Label htmlFor={`${field.id}-${opt}`} className="text-white cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      );
    case "email":
      return (
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Enter your email..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full max-w-md"
          required={field.required}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Enter a number..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full max-w-md"
          required={field.required}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Select a date..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full max-w-md"
          required={field.required}
        />
      );
    default:
      return (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Enter your answer..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full max-w-md"
          required={field.required}
        />
      );
  }
}

