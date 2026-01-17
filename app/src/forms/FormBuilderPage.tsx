import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import {
  getForm,
  updateForm,
  publishForm,
  modifyFormWithAI,
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
  Sparkles,
  Loader2,
  Workflow,
  Palette,
  Crown,
  Rocket,
  Copy,
  Check,
  Share2,
  Code,
  Settings,
  Link2,
  QrCode,
  X,
} from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { FormSchema, FormField, FieldType, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { cn } from "../client/utils";
import { useAuth } from "wasp/client/auth";
import { PaymentPlanId } from "../payment/plans";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../client/components/ui/dialog";
import { FormSlideshow } from "./FormSlideshow";

export default function FormBuilderPage() {
  const { formId, workspaceId } = useParams<{ formId: string; workspaceId: string }>();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"build" | "integrate" | "share" | "results">("build");
  const [buildSubTab, setBuildSubTab] = useState<"logic" | "design" | "preview" | "upgrade">("design");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFormData, setPreviewFormData] = useState<Record<string, any>>({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishSuccessOpen, setIsPublishSuccessOpen] = useState(false);

  const { data: user } = useAuth();
  const { data: form, isLoading, refetch: refetchForm } = useQuery(
    getForm,
    formId ? { id: formId } : undefined,
  );

  const [schema, setSchema] = useState<FormSchema>(DEFAULT_FORM_SCHEMA);
  
  const isPro = user?.subscriptionPlan === PaymentPlanId.Pro;
  const aiUsageCount = user?.aiUsageCount || 0;
  const FREE_TIER_AI_LIMIT = 2;
  const isAIDisabled = !isPro && aiUsageCount >= FREE_TIER_AI_LIMIT;

  useEffect(() => {
    if (form?.schemaJson) {
      setSchema(form.schemaJson as FormSchema);
      if (form.schemaJson.fields && form.schemaJson.fields.length > 0 && !selectedFieldId) {
        setSelectedFieldId(form.schemaJson.fields[0].id);
      }
    }
  }, [form]);

  // Ensure form has a slug - if not, generate one
  useEffect(() => {
    if (form && !form.slug && formId) {
      // Form doesn't have a slug, update it
      updateForm({
        id: formId,
        name: form.name,
      }).then(() => {
        refetchForm();
      }).catch(() => {
        // Silent fail
      });
    }
  }, [form, formId, refetchForm]);

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
    const wasPublished = form?.status === "PUBLISHED";
    try {
      await publishForm({
        id: formId,
        status: wasPublished ? "DRAFT" : "PUBLISHED",
      });
      
      // Refetch form to get updated status
      refetchForm();
      
      if (!wasPublished) {
        // Show success modal only when publishing (not unpublishing)
        setIsPublishSuccessOpen(true);
      } else {
        toast({
          title: "Unpublished",
          description: "Form has been unpublished successfully.",
        });
      }
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

  const handleAIFormChange = async () => {
    if (isAIDisabled) {
      toast({
        title: "AI Features Disabled",
        description: `You've reached the free tier limit of ${FREE_TIER_AI_LIMIT} AI requests. Upgrade to PRO for unlimited AI features.`,
        variant: "destructive",
      });
      return;
    }

    if (!aiPrompt.trim() || aiPrompt.trim().length < 10) {
      toast({
        title: "Error",
        description: "Please enter a prompt with at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    if (!formId) {
      toast({
        title: "Error",
        description: "Form ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Use modifyFormWithAI to modify the existing form based on the prompt
      const modifiedSchema = await modifyFormWithAI({
        currentSchema: schema,
        modificationPrompt: aiPrompt.trim(),
      });

      // Update the form with the modified schema
      setSchema(modifiedSchema as FormSchema);
      
      // Auto-save the changes to the database
      await updateForm({
        id: formId,
        schemaJson: modifiedSchema,
      });

      setAiPrompt("");
      const remainingUses = isPro ? "unlimited" : `${FREE_TIER_AI_LIMIT - (aiUsageCount + 1)} remaining`;
      toast({
        title: "Form updated!",
        description: `Your form has been modified with AI and saved successfully. ${!isPro ? `(${remainingUses} free uses)` : ""}`,
      });
    } catch (error: any) {
      if (error.message?.includes("AI features are disabled")) {
        toast({
          title: "AI Features Disabled",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to modify form with AI",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar with Tabs and Breadcrumbs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Left: Back Button + Form Name */}
          <div className="flex items-center gap-2">
            <Link to="/workspaces">
              <ArrowLeft className="h-5 w-5 text-gray-600 hover:text-gray-900" />
            </Link>
            <Link to="/workspaces" className="text-gray-900 hover:text-gray-700 font-medium">
              {form.name}
            </Link>
          </div>

          {/* Center: Main Tabs */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1">
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

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setPreviewFormData({});
                setIsPreviewOpen(true);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            {form.status === "PUBLISHED" && form.id && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const url = `${window.location.origin}/f/${form.id}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: "Link copied", description: "Form link copied to clipboard" });
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Link
              </Button>
            )}
            <Button onClick={handlePublish} size="sm">
              <Send className="h-4 w-4 mr-2" />
              {form.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </Button>
          </div>
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

        {/* Center - Build Page Content */}
        {activeTab === "build" ? (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Build Sub-Tabs: Logic, Design, Preview, Upgrade */}
            <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-1">
              <button
                onClick={() => setBuildSubTab("logic")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  buildSubTab === "logic"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                )}
              >
                <Workflow className="h-3.5 w-3.5" />
                Logic
              </button>
              <button
                onClick={() => setBuildSubTab("design")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  buildSubTab === "design"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                )}
              >
                <Palette className="h-3.5 w-3.5" />
                Design
              </button>
              <button
                onClick={() => setBuildSubTab("preview")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  buildSubTab === "preview"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={() => setBuildSubTab("upgrade")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  buildSubTab === "upgrade"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                )}
              >
                <Crown className="h-3.5 w-3.5" />
                Upgrade
              </button>
            </div>

            {/* AI Prompt Box for Form Changes */}
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              {isAIDisabled ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-semibold text-yellow-900">AI Features Disabled</p>
                        <p className="text-sm text-yellow-700">
                          You've reached the free tier limit. Upgrade to PRO for unlimited AI features.
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="default" size="sm">
                      <Link to="/pricing">Upgrade to PRO</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe changes you want to make to this form... (e.g., 'Add a phone number field', 'Make the email field required')"
                        className="min-h-[60px] resize-none text-sm"
                        disabled={isGenerating || isAIDisabled}
                      />
                      {!isPro && (
                        <p className="text-xs text-gray-500 mt-1">
                          {FREE_TIER_AI_LIMIT - aiUsageCount} free AI uses remaining
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleAIFormChange}
                      disabled={!aiPrompt.trim() || aiPrompt.trim().length < 10 || isGenerating || isAIDisabled}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-4 h-[60px] whitespace-nowrap"
                      size="sm"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Apply AI
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Selected Question/Block Display */}
            <div className="flex-1 bg-gradient-to-br from-blue-500 to-blue-600 overflow-y-auto mb-4">
              <div className="min-h-full flex items-center justify-center px-8 pt-8 pb-4">
                {selectedField ? (
                  <div className="w-full max-w-2xl text-center text-white">
                    <h2 className="text-3xl font-bold mb-2">{selectedField.label || "Untitled Question"}</h2>
                    {selectedField.placeholder && (
                      <p className="text-blue-100 mb-8">{selectedField.placeholder}</p>
                    )}
                    <div className="mt-8">
                      {renderPreviewField(selectedField)}
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-2xl text-center text-white">
                    <h2 className="text-3xl font-bold mb-2">{schema.title || "Untitled Form"}</h2>
                    {schema.description && (
                      <p className="text-blue-100 mb-8">{schema.description}</p>
                    )}
                    <p className="text-blue-200">Select a question from the left sidebar to edit</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Other tabs content (Integrate, Share, Results) */
          <div className="flex-1 bg-white flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg font-semibold mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
              <p className="text-sm">This section is coming soon</p>
            </div>
          </div>
        )}

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

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-5xl h-[90vh] p-0">
          <div className="h-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-8 flex flex-col">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-white text-2xl">{schema.title}</DialogTitle>
              {schema.description && (
                <DialogDescription className="text-blue-100 text-base">
                  {schema.description}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <FormSlideshow
                schema={schema}
                formData={previewFormData}
                onFieldChange={(fieldId, value) => {
                  setPreviewFormData({ ...previewFormData, [fieldId]: value });
                }}
                readOnly
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish Success Modal */}
      {form && form.id && (
        <PublishSuccessModal
          formId={form.id}
          formName={form.name}
          isOpen={isPublishSuccessOpen}
          onClose={() => setIsPublishSuccessOpen(false)}
        />
      )}
    </div>
  );
}

function PublishSuccessModal({
  formId,
  formName,
  isOpen,
  onClose,
}: {
  formId: string;
  formName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const formUrl = `${window.location.origin}/f/${formId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Form URL has been copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform: string) => {
    const shareUrl = encodeURIComponent(formUrl);
    const shareText = encodeURIComponent(`Check out this form: ${formName}`);
    let url = "";

    switch (platform) {
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`;
        break;
      case "linkedin":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
        break;
      default:
        return;
    }

    window.open(url, "_blank", "width=600,height=400");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full p-2 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>

          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Your form is now live! 🎉
              </h2>
              <p className="text-gray-600">
                Share your form with the world and start collecting responses
              </p>
            </div>

            {/* Share Section */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">
                Share it with the world:
              </label>
              <div className="flex gap-2 mb-4">
                <Input
                  value={formUrl}
                  readOnly
                  className="flex-1 bg-gray-50 border-gray-200"
                />
                <Button
                  onClick={handleCopy}
                  variant={copied ? "default" : "outline"}
                  className={copied ? "bg-green-500 hover:bg-green-600" : ""}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Social Share Icons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.open(formUrl, "_blank")}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={() => handleShare("facebook")}
                  className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Share on Facebook"
                >
                  <Share2 className="h-5 w-5 text-blue-600" />
                </button>
                <button
                  onClick={() => handleShare("twitter")}
                  className="p-2 rounded-lg hover:bg-sky-50 transition-colors"
                  title="Share on X/Twitter"
                >
                  <Share2 className="h-5 w-5 text-sky-600" />
                </button>
                <button
                  onClick={() => handleShare("linkedin")}
                  className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Share on LinkedIn"
                >
                  <Share2 className="h-5 w-5 text-blue-700" />
                </button>
                <button
                  onClick={() => {
                    toast({
                      title: "QR Code",
                      description: "QR code feature coming soon!",
                    });
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Generate QR code"
                >
                  <QrCode className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Or explore more options:
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col items-center justify-center bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300"
                  onClick={() => {
                    toast({
                      title: "Embed Code",
                      description: "Embed code feature coming soon!",
                    });
                  }}
                >
                  <Code className="h-6 w-6 mb-2 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    Embed in Website
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col items-center justify-center bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
                  onClick={() => {
                    toast({
                      title: "Integrations",
                      description: "Integrations feature coming soon!",
                    });
                  }}
                >
                  <Settings className="h-6 w-6 mb-2 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900">
                    Setup Integrations
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col items-center justify-center bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300"
                  onClick={() => {
                    toast({
                      title: "Customize Link",
                      description: "Customize form link feature coming soon!",
                    });
                  }}
                >
                  <Link2 className="h-6 w-6 mb-2 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">
                    Customize Link
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

function FormPreview({
  schema,
  selectedFieldId,
}: {
  schema: FormSchema;
  selectedFieldId: string | null;
}) {
  if (schema.fields.length === 0) {
    return (
      <div className="w-full max-w-2xl text-center text-white">
        <h2 className="text-3xl font-bold mb-2">{schema.title || "Untitled Form"}</h2>
        {schema.description && (
          <p className="text-blue-100 mb-8">{schema.description}</p>
        )}
        <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg">
          Add your first question
        </Button>
      </div>
    );
  }

  const selectedIndex = selectedFieldId
    ? schema.fields.findIndex((f) => f.id === selectedFieldId)
    : 0;

  const currentField = schema.fields[selectedIndex] || schema.fields[0];

  return (
    <div className="w-full max-w-2xl text-center text-white">
      <h2 className="text-3xl font-bold mb-2">{currentField.label || "Untitled Question"}</h2>
      {currentField.placeholder && (
        <p className="text-blue-100 mb-8">{currentField.placeholder}</p>
      )}
      <div className="mt-8">
        {renderPreviewField(currentField)}
      </div>
      <Button className="mt-8 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg">
        {selectedIndex < schema.fields.length - 1 ? "Continue" : "Submit"}
      </Button>
    </div>
  );
}

function renderPreviewField(field: FormField) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder || "Enter your response..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full"
          rows={4}
          disabled
        />
      );
    case "select":
      return (
        <Select disabled>
          <SelectTrigger className="bg-white/20 border-white/30 text-white w-full">
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
        <div className="space-y-3 w-full">
          {field.options?.map((opt) => (
            <div
              key={opt}
              className="bg-white/20 border border-white/30 rounded-lg p-4 text-left cursor-pointer hover:bg-white/30 transition"
            >
              {opt}
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-3 justify-center">
          <div className="h-5 w-5 border-2 border-white/30 rounded bg-white/20" />
          <span className="text-white">{field.label}</span>
        </div>
      );
    case "multiselect":
      return (
        <div className="space-y-2 w-full text-left">
          {field.options?.map((opt) => (
            <div key={opt} className="flex items-center gap-3">
              <div className="h-5 w-5 border-2 border-white/30 rounded bg-white/20" />
              <span className="text-white">{opt}</span>
            </div>
          ))}
        </div>
      );
    case "email":
      return (
        <Input
          type="email"
          placeholder={field.placeholder || "Enter your email..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full"
          disabled
        />
      );
    case "number":
      return (
        <Input
          type="number"
          placeholder={field.placeholder || "Enter a number..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full"
          disabled
        />
      );
    case "date":
      return (
        <Input
          type="date"
          placeholder={field.placeholder || "Select a date..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full"
          disabled
        />
      );
    default:
      return (
        <Input
          type="text"
          placeholder={field.placeholder || "Enter your answer..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full"
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
