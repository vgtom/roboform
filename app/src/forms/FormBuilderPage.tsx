import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import {
  getForm,
  updateForm,
  publishForm,
} from "wasp/client/operations";
import { Link, useParams } from "react-router-dom";
import { Button } from "../client/components/ui/button";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { Textarea } from "../client/components/ui/textarea";
import { Switch } from "../client/components/ui/switch";
import { Card, CardContent } from "../client/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../client/components/ui/breadcrumb";
import {
  Plus,
  GripVertical,
  Trash2,
  Eye,
  Save,
  Send,
  X,
} from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { FormSchema, FormField, FieldType, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: form, isLoading } = useQuery(
    getForm,
    formId ? { id: formId } : undefined,
  );

  const [schema, setSchema] = useState<FormSchema>(DEFAULT_FORM_SCHEMA);

  useEffect(() => {
    if (form?.schemaJson) {
      setSchema(form.schemaJson as FormSchema);
    }
  }, [form]);

  const handleSave = async () => {
    if (!formId) return;
    setIsSaving(true);
    try {
      await updateForm({
        id: formId,
        schemaJson: schema,
      });
      toast({
        title: "Saved",
        description: "Form has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save form",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!formId) return;
    try {
      await publishForm({
        id: formId,
        status: form?.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
      });
      toast({
        title: form?.status === "PUBLISHED" ? "Unpublished" : "Published",
        description: `Form has been ${form?.status === "PUBLISHED" ? "unpublished" : "published"} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to publish form",
        variant: "destructive",
      });
    }
  };

  const addField = () => {
    const newField: FormField = {
      id: generateId(),
      type: "text",
      label: "New Field",
      required: false,
    };
    setSchema({
      ...schema,
      fields: [...schema.fields, newField],
    });
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setSchema({
      ...schema,
      fields: schema.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f,
      ),
    });
  };

  const deleteField = (fieldId: string) => {
    setSchema({
      ...schema,
      fields: schema.fields.filter((f) => f.id !== fieldId),
    });
  };

  const moveField = (fieldId: string, direction: "up" | "down") => {
    const index = schema.fields.findIndex((f) => f.id === fieldId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= schema.fields.length) return;

    const newFields = [...schema.fields];
    [newFields[index], newFields[newIndex]] = [
      newFields[newIndex],
      newFields[index],
    ];
    setSchema({ ...schema, fields: newFields });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Form not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/workspaces">Workspaces</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/workspaces/${form.workspaceId}`}>Workspace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/workspaces/${form.workspaceId}`}>{form.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Edit</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{form.name}</h1>
          <p className="text-muted-foreground mt-1">
            {form.status === "PUBLISHED" ? "Published" : "Draft"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? "Edit" : "Preview"}
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button onClick={handlePublish}>
            <Send className="mr-2 h-4 w-4" />
            {form.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <FormPreview schema={schema} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="form-title">Form Title</Label>
                  <Input
                    id="form-title"
                    value={schema.title}
                    onChange={(e) =>
                      setSchema({ ...schema, title: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="form-description">Description (optional)</Label>
                  <Textarea
                    id="form-description"
                    value={schema.description || ""}
                    onChange={(e) =>
                      setSchema({ ...schema, description: e.target.value })
                    }
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {schema.fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={index}
                totalFields={schema.fields.length}
                onUpdate={(updates) => updateField(field.id, updates)}
                onDelete={() => deleteField(field.id)}
                onMove={(direction) => moveField(field.id, direction)}
              />
            ))}
          </div>

          <Button onClick={addField} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  index,
  totalFields,
  onUpdate,
  onDelete,
  onMove,
}: {
  field: FormField;
  index: number;
  totalFields: number;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMove("up")}
              disabled={index === 0}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMove("down")}
              disabled={index === totalFields - 1}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Field Label</Label>
                <Input
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Field Type</Label>
                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    onUpdate({ type: value as FieldType })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="textarea">Textarea</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="multiselect">Multi-select</SelectItem>
                    <SelectItem value="radio">Radio</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Placeholder (optional)</Label>
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                className="mt-1"
              />
            </div>

            {(field.type === "select" ||
              field.type === "multiselect" ||
              field.type === "radio") && (
              <div>
                <Label>Options (one per line)</Label>
                <Textarea
                  value={field.options?.join("\n") || ""}
                  onChange={(e) =>
                    onUpdate({
                      options: e.target.value
                        .split("\n")
                        .filter((o) => o.trim()),
                    })
                  }
                  className="mt-1"
                  rows={4}
                />
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.required || false}
                  onCheckedChange={(checked) => onUpdate({ required: checked })}
                />
                <Label>Required</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormPreview({ schema }: { schema: FormSchema }) {
  return (
    <Card>
      <CardContent className="p-8">
        <h2 className="text-2xl font-bold mb-2">{schema.title}</h2>
        {schema.description && (
          <p className="text-muted-foreground mb-6">{schema.description}</p>
        )}
        <div className="space-y-4">
          {schema.fields.map((field) => (
            <div key={field.id}>
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderFieldPreview(field)}
            </div>
          ))}
        </div>
        <Button className="mt-6 w-full">Submit</Button>
      </CardContent>
    </Card>
  );
}

function renderFieldPreview(field: FormField) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder}
          className="mt-1"
          rows={4}
          disabled
        />
      );
    case "email":
    case "text":
    case "number":
    case "date":
      return (
        <Input
          type={field.type}
          placeholder={field.placeholder}
          className="mt-1"
          disabled
        />
      );
    case "select":
      return (
        <Select disabled>
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
    case "radio":
      return (
        <div className="mt-2 space-y-2">
          {field.options?.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <input type="radio" disabled />
              <Label>{opt}</Label>
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="mt-2 flex items-center gap-2">
          <input type="checkbox" disabled />
          <Label>{field.label}</Label>
        </div>
      );
    default:
      return (
        <Input
          placeholder={field.placeholder}
          className="mt-1"
          disabled
        />
      );
  }
}

