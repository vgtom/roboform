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
import { Separator } from "../client/components/ui/separator";
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
  ArrowLeft,
  ExternalLink,
  FileText,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  Star,
  MoreVertical,
} from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { FormSchema, FormField, FieldType, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { cn } from "../client/utils";

export default function FormBuilderPage() {
  const { formId, workspaceId } = useParams<{ formId: string; workspaceId: string }>();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"build" | "integrate" | "share" | "results">("build");

  const { data: form, isLoading } = useQuery(
    getForm,
    formId ? { id: formId } : undefined,
  );

  const [schema, setSchema] = useState<FormSchema>(DEFAULT_FORM_SCHEMA);

  useEffect(() => {
    if (form?.schemaJson) {
      setSchema(form.schemaJson as FormSchema);
      if (form.schemaJson.fields && form.schemaJson.fields.length > 0) {
        setSelectedFieldId(form.schemaJson.fields[0].id);
      }
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
      label: "New Question",
      required: false,
    };
    const newSchema = {
      ...schema,
      fields: [...schema.fields, newField],
    };
    setSchema(newSchema);
    setSelectedFieldId(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    const newSchema = {
      ...schema,
      fields: schema.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f,
      ),
    };
    setSchema(newSchema);
    // Auto-save
    if (formId) {
      updateForm({
        id: formId,
        schemaJson: newSchema,
      }).catch(() => {
        // Silent fail for auto-save
      });
    }
  };

  const deleteField = (fieldId: string) => {
    const newFields = schema.fields.filter((f) => f.id !== fieldId);
    setSchema({ ...schema, fields: newFields });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(newFields.length > 0 ? newFields[0].id : null);
    }
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

  const selectedField = schema.fields.find((f) => f.id === selectedFieldId);

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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to={`/workspaces/${workspaceId}`}>
              <ArrowLeft className="h-5 w-5 text-gray-600 hover:text-gray-900" />
            </Link>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/workspaces">Workspaces</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to={`/workspaces/${workspaceId}`}>Workspace</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>{form.name}</BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const url = `${window.location.origin}/f/${form.slug}`;
              navigator.clipboard.writeText(url);
              toast({ title: "Link copied", description: "Form link copied to clipboard" });
            }}>
              <ExternalLink className="h-4 w-4 mr-2" />
            </Button>
            <Button onClick={handlePublish} size="sm">
              <Send className="h-4 w-4 mr-2" />
              {form.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 -mb-4">
          <button
            onClick={() => setActiveTab("build")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "build"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            Build
          </button>
          <button
            onClick={() => setActiveTab("integrate")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "integrate"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            Integrate
          </button>
          <button
            onClick={() => setActiveTab("share")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "share"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            Share
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "results"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            Results
          </button>
        </div>
      </div>

      {/* Main Content Area - Three Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Blocks */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Blocks</h3>
              <Button variant="ghost" size="sm" onClick={addField}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {schema.fields.map((field, index) => (
              <BlockItem
                key={field.id}
                field={field}
                index={index}
                isSelected={selectedFieldId === field.id}
                onClick={() => setSelectedFieldId(field.id)}
                onDelete={() => deleteField(field.id)}
                onMove={moveField}
              />
            ))}
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Thank you page</h3>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-sm">
              Thank you! 👋
            </div>
          </div>
        </div>

        {/* Center - Preview */}
        <div className="flex-1 bg-gradient-to-br from-blue-500 to-blue-600 overflow-y-auto relative">
          <div className="min-h-full flex items-center justify-center p-12">
            {selectedField ? (
              <FormBlockPreview field={selectedField} schema={schema} />
            ) : (
              <div className="text-center text-white">
                <h2 className="text-3xl font-bold mb-2">{schema.title || "Untitled Form"}</h2>
                {schema.description && (
                  <p className="text-blue-100 mb-8">{schema.description}</p>
                )}
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg">
                  {schema.fields.length === 0 ? "Add your first question" : "Continue"}
                </Button>
              </div>
            )}
          </div>
        </div>

          {/* Right Sidebar - Properties */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedField ? (
            <PropertiesPanel
              field={selectedField}
              onUpdate={(updates) => updateField(selectedField.id, updates)}
            />
          ) : (
            <FormPropertiesPanel
              schema={schema}
              onUpdate={(updates) => {
                const newSchema = { ...schema, ...updates };
                setSchema(newSchema);
                // Auto-save
                if (formId) {
                  updateForm({
                    id: formId,
                    schemaJson: newSchema,
                  }).catch(() => {
                    // Silent fail for auto-save
                  });
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BlockItem({
  field,
  index,
  isSelected,
  onClick,
  onDelete,
  onMove,
}: {
  field: FormField;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onMove: (fieldId: string, direction: "up" | "down") => void;
}) {
  const getIcon = () => {
    switch (field.type) {
      case "radio":
      case "select":
        return <Star className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div
      className={cn(
        "mb-2 p-3 rounded-lg cursor-pointer transition-colors border",
        isSelected
          ? "bg-pink-50 border-pink-300"
          : "bg-white border-gray-200 hover:border-gray-300"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500">{index + 1}.</span>
            {getIcon()}
            <span className="text-sm font-medium text-gray-900 truncate">
              {field.label || "Untitled"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormBlockPreview({ field, schema }: { field: FormField; schema: FormSchema }) {
  return (
    <div className="w-full max-w-2xl text-center text-white">
      <h2 className="text-3xl font-bold mb-2">{field.label}</h2>
      {field.placeholder && (
        <p className="text-blue-100 mb-8">{field.placeholder}</p>
      )}
      <div className="mt-8">
        {renderPreviewField(field)}
      </div>
      <Button className="mt-8 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg">
        Continue
      </Button>
    </div>
  );
}

function renderPreviewField(field: FormField) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70"
          rows={4}
          disabled
        />
      );
    case "select":
    case "radio":
      return (
        <div className="space-y-3">
          {field.options?.map((opt) => (
            <div
              key={opt}
              className="bg-white/20 border border-white/30 rounded-lg p-4 text-left cursor-pointer hover:bg-white/30"
            >
              {opt}
            </div>
          ))}
        </div>
      );
    default:
      return (
        <Input
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
          placeholder={field.placeholder}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70"
          disabled
        />
      );
  }
}

function PropertiesPanel({
  field,
  onUpdate,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");

  return (
    <div className="p-6 space-y-6">
      <div>
        <Label className="text-sm font-medium mb-2 block">Title</Label>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full"
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Description</Label>
        <div className="flex gap-1 mb-2 border-b border-gray-200 pb-2">
          <Button variant="ghost" size="sm">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Video className="h-4 w-4" />
          </Button>
        </div>
        <Textarea
          value={field.placeholder || ""}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          className="w-full"
          rows={3}
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Field Type</Label>
        <Select
          value={field.type}
          onValueChange={(value) => onUpdate({ type: value as FieldType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="textarea">Textarea</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="select">Select</SelectItem>
            <SelectItem value="radio">Radio</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
            <SelectItem value="date">Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(field.type === "select" || field.type === "radio") && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Options (one per line)</Label>
          <Textarea
            value={field.options?.join("\n") || ""}
            onChange={(e) =>
              onUpdate({
                options: e.target.value.split("\n").filter((o) => o.trim()),
              })
            }
            className="w-full"
            rows={4}
          />
        </div>
      )}

      <div>
        <Label className="text-sm font-medium mb-2 block">Text align</Label>
        <div className="flex gap-2">
          <Button
            variant={textAlign === "left" ? "default" : "outline"}
            size="sm"
            onClick={() => setTextAlign("left")}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={textAlign === "center" ? "default" : "outline"}
            size="sm"
            onClick={() => setTextAlign("center")}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={textAlign === "right" ? "default" : "outline"}
            size="sm"
            onClick={() => setTextAlign("right")}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Button Text</Label>
        <Input value="Continue" className="w-full" disabled />
        <p className="text-xs text-gray-500 mt-1">
          For submit button, set it from settings. Learn more.
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Cover Image</Label>
        <Button variant="outline" className="w-full">
          <ImageIcon className="h-4 w-4 mr-2" />
          Select Image
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={field.required || false}
          onCheckedChange={(checked) => onUpdate({ required: checked })}
        />
        <Label>Required</Label>
      </div>
    </div>
  );
}

function FormPropertiesPanel({
  schema,
  onUpdate,
}: {
  schema: FormSchema;
  onUpdate: (updates: Partial<FormSchema>) => void;
}) {

  return (
    <div className="p-6 space-y-6">
      <div>
        <Label className="text-sm font-medium mb-2 block">Form Title</Label>
        <Input
          value={schema.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full"
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Description</Label>
        <Textarea
          value={schema.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full"
          rows={3}
        />
      </div>
    </div>
  );
}
