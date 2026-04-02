import { useState, useEffect, useCallback } from "react";
import { useQuery } from "wasp/client/operations";
import {
  getForm,
  updateForm,
  publishForm,
  modifyFormWithAI,
  getFormIntegrations,
  upsertFormIntegration,
  getFormAnalytics,
  getFormResponses,
  getAiUsageCalendarStatus,
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
  Play,
  Percent,
  Clock,
  Calendar,
  Smartphone,
  Monitor,
  HelpCircle,
  Lock,
  TrendingUp,
} from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { FormSchema, FormField, FieldType, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { cn } from "../client/utils";
import { useAuth } from "wasp/client/auth";
import { PaymentPlanId, AI_USAGE_LIMITS, hasVoiceInputAccess } from "../payment/plans";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../client/components/ui/dialog";
import { FormSlideshow } from "./FormSlideshow";
import { PricingModal } from "../payment/PricingModal";
import { AiVoicePromptButton } from "../client/components/AiVoicePromptButton";

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
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const { data: user } = useAuth();
  const { data: aiUsageStatus, refetch: refetchAiUsage } = useQuery(
    getAiUsageCalendarStatus,
  );
  const { data: form, isLoading, refetch: refetchForm } = useQuery(
    getForm,
    formId ? { id: formId } : undefined,
  );

  const [schema, setSchema] = useState<FormSchema>(DEFAULT_FORM_SCHEMA);
  
  const userPlan = (user?.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  const aiLimit = AI_USAGE_LIMITS[userPlan];
  const aiUsageCount =
    aiUsageStatus != null && aiUsageStatus.enabled
      ? aiUsageStatus.used
      : user?.aiUsageCount ?? 0;
  const effectiveLimit =
    aiUsageStatus != null && aiUsageStatus.enabled
      ? aiUsageStatus.limit
      : aiLimit.interactionLimit;
  const isAIDisabled =
    !aiLimit.enabled ||
    (aiLimit.enabled && aiUsageCount >= effectiveLimit);

  const mergeAiTranscript = useCallback((text: string) => {
    setAiPrompt((prev) => {
      const t = text.trim();
      if (!t) return prev;
      const merged = prev.trim() ? `${prev.trim()} ${t}` : t;
      return merged.slice(0, 400);
    });
  }, []);

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
      if (!aiLimit.enabled) {
        toast({
          title: "AI Features Not Available",
          description: "AI features are not available on the Free plan. Please upgrade to Starter or Pro to use AI features.",
          variant: "destructive",
        });
      } else {
        const remaining = Math.max(0, effectiveLimit - aiUsageCount);
        toast({
          title: "AI Usage Limit Reached",
          description: `You've reached your AI limit for this billing period (${effectiveLimit} interactions). It resets when your subscription renews. Please upgrade to Pro for more interactions.`,
          variant: "destructive",
        });
      }
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
      const ref = await refetchAiUsage();
      const lim = ref.data?.limit ?? effectiveLimit;
      const usedAfter = ref.data?.used;
      const remaining =
        usedAfter != null && ref.data?.enabled
          ? Math.max(0, lim - usedAfter)
          : 0;
      toast({
        title: "Form updated!",
        description: `Your form has been modified with AI and saved successfully.${remaining > 0 ? ` (${remaining} interactions left this billing period)` : ""}`,
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
        {activeTab === "build" && (
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
        )}

        {/* Center - Build / Integrate / Share / Results Content */}
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
                        <p className="font-semibold text-yellow-900">
                          {!aiLimit.enabled ? "AI Features Not Available" : "AI Usage Limit Reached"}
                        </p>
                        <p className="text-sm text-yellow-700">
                          {!aiLimit.enabled 
                            ? "AI features are not available on the Free plan. Upgrade to Starter or Pro to use AI features."
                            : `You've reached your monthly AI limit (${effectiveLimit} interactions per UTC calendar month). Upgrade to Pro for more interactions.`
                          }
                        </p>
                      </div>
                    </div>
                    <Button variant="default" size="sm" onClick={() => setIsPricingModalOpen(true)}>
                      Upgrade Plan
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => {
                          if (e.target.value.length <= 400) {
                            setAiPrompt(e.target.value);
                          }
                        }}
                        placeholder="Describe changes you want to make to this form... (e.g., 'Add a phone number field', 'Make the email field required')"
                        className={cn(
                          "min-h-[60px] resize-none text-sm",
                          hasVoiceInputAccess(userPlan) && "pr-12",
                        )}
                        disabled={isGenerating || isAIDisabled}
                        maxLength={400}
                      />
                      {hasVoiceInputAccess(userPlan) && (
                        <AiVoicePromptButton
                          disabled={isGenerating || isAIDisabled}
                          onRecordingStart={() => setAiPrompt("")}
                          onTranscript={mergeAiTranscript}
                        />
                      )}
                      <div className="flex items-center justify-between mt-1">
                        {aiLimit.enabled && (
                          <p className="text-xs text-gray-500">
                            {Math.max(0, effectiveLimit - aiUsageCount)} AI interactions remaining this period ({effectiveLimit} per billing period)
                          </p>
                        )}
                        <p className={cn(
                          "text-xs ml-auto",
                          (400 - aiPrompt.length) < 50 ? "text-orange-600 font-medium" : "text-gray-500"
                        )}>
                          {400 - aiPrompt.length} characters remaining (400 character limit)
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleAIFormChange}
                      disabled={!aiPrompt.trim() || aiPrompt.trim().length < 10 || aiPrompt.length > 400 || isGenerating || isAIDisabled}
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
        ) : activeTab === "integrate" ? (
          <IntegrationsTab
            formId={formId}
            formName={form?.name || schema.title || "Untitled Form"}
          />
        ) : activeTab === "share" ? (
          <ShareTab
            formId={formId}
            formName={form?.name || schema.title || "Untitled Form"}
            formStatus={form?.status}
          />
        ) : activeTab === "results" ? (
          <ResultsTab formId={formId} formName={form?.name || schema.title || "Untitled Form"} onOpenPricingModal={() => setIsPricingModalOpen(true)} />
        ) : null}

          {/* Right Sidebar - Properties */}
        {activeTab === "build" && (
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
        )}
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

      <PricingModal open={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
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

type IntegrationProviderKey = "email" | "webhook" | "slack" | "zapier" | "calendly";

const INTEGRATION_DEFINITIONS: Array<{
  key: IntegrationProviderKey;
  title: string;
  description: string;
  placeholderUrl: string;
}> = [
  {
    key: "email",
    title: "Email",
    description:
      "Send new form submissions to your email provider via a webhook (e.g. Zapier, Make, custom API).",
    placeholderUrl: "https://your-email-or-automation-webhook-url",
  },
  {
    key: "webhook",
    title: "Webhooks",
    description:
      "Send a POST request with each submission to any HTTPS endpoint you control.",
    placeholderUrl: "https://your-backend.example.com/webhooks/forms",
  },
  {
    key: "slack",
    title: "Slack",
    description:
      "Post new submissions into a Slack channel using a Slack incoming webhook URL.",
    placeholderUrl: "https://hooks.slack.com/services/XXX/YYY/ZZZ",
  },
  {
    key: "zapier",
    title: "Zapier",
    description:
      "Trigger a Zap whenever you get a new submission using a Zapier Catch Hook URL.",
    placeholderUrl: "https://hooks.zapier.com/hooks/catch/...",
  },
  {
    key: "calendly",
    title: "Calendly",
    description:
      "Send submissions to Calendly or workflows that react to a webhook payload.",
    placeholderUrl: "https://your-calendly-or-workflow-webhook-url",
  },
];

function IntegrationsTab({
  formId,
  formName,
}: {
  formId: string | undefined;
  formName: string;
}) {
  const { toast } = useToast();

  const {
    data: integrations,
    isLoading,
    error,
    refetch,
  } = useQuery(
    getFormIntegrations,
    formId ? { formId } : undefined,
  );

  const [localConfigs, setLocalConfigs] = useState<
    Record<IntegrationProviderKey, { enabled: boolean; url: string }>
  >({
    email: { enabled: false, url: "" },
    webhook: { enabled: false, url: "" },
    slack: { enabled: false, url: "" },
    zapier: { enabled: false, url: "" },
    calendly: { enabled: false, url: "" },
  });

  useEffect(() => {
    if (!integrations) return;

    setLocalConfigs((prev) => {
      const next = { ...prev };
      for (const integration of integrations as Array<{
        provider: string;
        isEnabled: boolean;
        configJson: any;
      }>) {
        const key = integration.provider as IntegrationProviderKey;
        if (!INTEGRATION_DEFINITIONS.find((def) => def.key === key)) continue;
        const cfg = integration.configJson || {};
        next[key] = {
          enabled: integration.isEnabled,
          url: typeof cfg.url === "string" ? cfg.url : "",
        };
      }
      return next;
    });
  }, [integrations]);

  if (!formId) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Integrations</p>
          <p className="text-sm">
            Form ID is missing. Please reload the page and try again.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = (key: IntegrationProviderKey, enabled: boolean) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { url: "" }),
        enabled,
      },
    }));
  };

  const handleUrlChange = (key: IntegrationProviderKey, url: string) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { enabled: false }),
        url,
      },
    }));
  };

  const handleSave = async (key: IntegrationProviderKey) => {
    const cfg = localConfigs[key];
    if (!cfg) return;

    try {
      await upsertFormIntegration({
        formId,
        provider: key,
        isEnabled: cfg.enabled && !!cfg.url,
        config: {
          url: cfg.url,
        },
      });

      toast({
        title: "Integration saved",
        description: `${
          INTEGRATION_DEFINITIONS.find((d) => d.key === key)?.title ??
          "Integration"
        } updated for “${formName}”.`,
      });

      refetch();
    } catch (_error) {
      toast({
        title: "Error saving integration",
        description: "Please try again, or check your network connection.",
        variant: "destructive",
      } as any);
    }
  };

  return (
    <div className="flex-1 bg-white overflow-y-auto w-full">
      <div className="max-w-7xl mx-auto py-8 px-6 sm:px-8 xl:px-12">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Integrations
          </h2>
          <p className="text-sm text-gray-600">
            Connect <span className="font-medium">{formName}</span> to email,
            webhooks, Slack, Zapier, Calendly, and more using outgoing
            webhooks. Each submission will be sent as a JSON payload.
          </p>
        </div>

        {isLoading && (
          <div className="text-sm text-gray-500 mb-4">
            Loading integrations…
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 mb-4">
            Unable to load integrations. Please refresh the page.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INTEGRATION_DEFINITIONS.map((def) => {
            const cfg = localConfigs[def.key];
            return (
              <div
                key={def.key}
                className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {def.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {def.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {cfg?.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                      checked={cfg?.enabled || false}
                      onCheckedChange={(value) =>
                        handleToggle(def.key, Boolean(value))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-700">Webhook URL</Label>
                  <Input
                    value={cfg?.url || ""}
                    onChange={(e) => handleUrlChange(def.key, e.target.value)}
                    placeholder={def.placeholderUrl}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-gray-500">
                    On each submission we send a{" "}
                    <code className="font-mono">POST</code> request with JSON
                    containing <code>formId</code>, <code>responseId</code>,{" "}
                    <code>provider</code> and <code>payload</code>.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(def.key)}
                    disabled={!cfg?.url}
                  >
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShareTab({
  formId,
  formName,
  formStatus,
}: {
  formId: string | undefined;
  formName: string;
  formStatus?: string;
}) {
  const { toast } = useToast();
  const [embedType, setEmbedType] = useState<"inline" | "popup">("inline");
  const [embedMethod, setEmbedMethod] = useState<"js" | "iframe">("js");
  const [embedWidth, setEmbedWidth] = useState("100%");
  const [embedHeight, setEmbedHeight] = useState("700");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSnippet1, setCopiedSnippet1] = useState(false);
  const [copiedSnippet2, setCopiedSnippet2] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const formUrl = formId ? `${baseUrl}/f/${formId}` : "";

  const embedDivSnippet = formId
    ? `<div data-youform-embed data-form='${formId}' data-base-url='${baseUrl}' data-width='${embedWidth}' data-height='${embedHeight}'></div>`
    : "";
  const embedScriptSnippet = baseUrl ? `<script src="${baseUrl}/embed.js"></script>` : "";

  const handleCopyLink = () => {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl);
    setCopiedLink(true);
    toast({ title: "Link copied", description: "Form link copied to clipboard." });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySnippet1 = () => {
    if (!embedDivSnippet) return;
    navigator.clipboard.writeText(embedDivSnippet);
    setCopiedSnippet1(true);
    toast({ title: "Code copied", description: "Embed snippet copied to clipboard." });
    setTimeout(() => setCopiedSnippet1(false), 2000);
  };

  const handleCopySnippet2 = () => {
    if (!embedScriptSnippet) return;
    navigator.clipboard.writeText(embedScriptSnippet);
    setCopiedSnippet2(true);
    toast({ title: "Code copied", description: "Script tag copied to clipboard." });
    setTimeout(() => setCopiedSnippet2(false), 2000);
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
    if (url) window.open(url, "_blank", "width=600,height=400");
  };

  const handleConfigureEmbed = () => {
    toast({ title: "Configure", description: "Embed configuration options coming soon." });
  };

  if (!formId) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Share</p>
          <p className="text-sm">Form ID is missing. Please reload the page and try again.</p>
        </div>
      </div>
    );
  }

  const isPublished = formStatus === "PUBLISHED";

  return (
    <div className="flex-1 bg-white overflow-y-auto w-full">
      <div className="max-w-5xl mx-auto py-8 px-6 space-y-8 sm:px-8 xl:px-12">
        {!isPublished && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
            Your form is not published yet. Publish it from the top bar before sharing.
          </div>
        )}
        {/* Direct Form Link */}
        <div>
          <div className="flex gap-2 mb-2">
            <Input
              value={formUrl}
              readOnly
              className="flex-1 bg-gray-50 border-gray-200 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copiedLink ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copiedLink ? "Copied" : "Copy Link"}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Make sure your form is published before you share it to the world.
          </p>
        </div>

        {/* Social sharing icons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.open(formUrl, "_blank")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Open in new tab"
          >
            <Share2 className="h-5 w-5 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={() => handleShare("facebook")}
            className="p-2 rounded-lg hover:bg-blue-50 transition-colors text-blue-600 font-semibold text-sm"
            title="Share on Facebook"
          >
            f
          </button>
          <button
            type="button"
            onClick={() => handleShare("twitter")}
            className="p-2 rounded-lg hover:bg-sky-50 transition-colors text-sky-600 font-semibold text-sm"
            title="Share on X / Twitter"
          >
            𝕏
          </button>
          <button
            type="button"
            onClick={() => handleShare("linkedin")}
            className="p-2 rounded-lg hover:bg-blue-50 transition-colors text-blue-700 font-semibold text-sm"
            title="Share on LinkedIn"
          >
            in
          </button>
          <button
            type="button"
            onClick={() => toast({ title: "QR Code", description: "QR code feature coming soon." })}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Generate QR code"
          >
            <QrCode className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Embed in your website */}
        <div className="border-t border-gray-200 pt-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Embed in your website as</h3>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Select value={embedType} onValueChange={(v: "inline" | "popup") => setEmbedType(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">Inline embed</SelectItem>
                <SelectItem value="popup">Popup embed</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">of type</span>
            <Select value={embedMethod} onValueChange={(v: "js" | "iframe") => setEmbedMethod(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="js">JS embed</SelectItem>
                <SelectItem value="iframe">iframe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Works with WordPress, Squarespace, Wix, Shopify, Webflow, Carrd, and all other website builders.
          </p>
          <div className="flex justify-end mb-4">
            <Button variant="default" size="sm" onClick={handleConfigureEmbed}>
              <Plus className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">
            Paste the below code snippet in your page where you want to show it:
          </p>
          <div className="relative rounded-lg bg-gray-900 p-4 pr-12 font-mono text-sm text-gray-100 overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">{embedDivSnippet}</pre>
            <button
              type="button"
              onClick={handleCopySnippet1}
              className="absolute top-3 right-3 p-2 rounded hover:bg-gray-700 transition-colors"
              title="Copy"
            >
              {copiedSnippet1 ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 mb-4">
            You can configure the embed settings above. Learn more about the{" "}
            <a href="#" className="text-blue-600 hover:underline">embed code here</a>.
          </p>

          <p className="text-sm font-medium text-gray-700 mb-2">
            Then include the following script tag below the above tag:
          </p>
          <div className="relative rounded-lg bg-gray-900 p-4 pr-12 font-mono text-sm text-gray-100 overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">{embedScriptSnippet}</pre>
            <button
              type="button"
              onClick={handleCopySnippet2}
              className="absolute top-3 right-3 p-2 rounded hover:bg-gray-700 transition-colors"
              title="Copy"
            >
              {copiedSnippet2 ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Custom Domain - PRO */}
        <div className="border-t border-gray-200 pt-8">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Custom Domain</h3>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">
              PRO
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Please buy a PRO plan to add your own custom domain.
          </p>
        </div>

        {/* Link Settings footer */}
        <p className="text-sm text-gray-500 border-t border-gray-200 pt-6">
          To change form Title, share image or favicon go to{" "}
          <a href="#" className="text-blue-600 hover:underline">Link Settings</a>.
        </p>
      </div>
    </div>
  );
}

type ResultsSubTab = "submissions" | "summary" | "analytics";

function ResultsTab({
  formId,
  formName,
  onOpenPricingModal,
}: {
  formId: string | undefined;
  formName: string;
  onOpenPricingModal?: () => void;
}) {
  const [resultsSubTab, setResultsSubTab] = useState<ResultsSubTab>("analytics");
  const [timeRange, setTimeRange] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [trendsMetric, setTrendsMetric] = useState<"views" | "submissions" | "completion">("views");

  const { data: analytics, isLoading: analyticsLoading } = useQuery(
    getFormAnalytics,
    formId ? { formId } : undefined,
  );
  const { data: responses, isLoading: responsesLoading } = useQuery(
    getFormResponses,
    formId ? { formId } : undefined,
  );

  const views = analytics?.views ?? 0;
  const submissions = analytics?.submissions ?? 0;
  const completionRate = analytics?.completionRate ?? 0;
  const starts = views; // "Starts" can match views for now
  const completionTime = "--"; // Not tracked yet

  const kpiCards = [
    {
      label: "Views",
      value: String(views),
      icon: Eye,
      className: "bg-purple-50 border-purple-200 text-purple-900",
      iconClassName: "text-purple-600",
    },
    {
      label: "Starts",
      value: String(views),
      icon: Play,
      className: "bg-blue-50 border-blue-200 text-blue-900",
      iconClassName: "text-blue-600",
    },
    {
      label: "Submissions",
      value: String(submissions),
      icon: Check,
      className: "bg-green-50 border-green-200 text-green-900",
      iconClassName: "text-green-600",
    },
    {
      label: "% Completion Rate",
      value: views > 0 ? `${completionRate.toFixed(1)}%` : "--",
      icon: Percent,
      className: "bg-orange-50 border-orange-200 text-orange-900",
      iconClassName: "text-orange-600",
    },
    {
      label: "Completion Time",
      value: completionTime,
      icon: Clock,
      className: "bg-gray-50 border-gray-200 text-gray-900",
      iconClassName: "text-gray-600",
    },
  ];

  if (!formId) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Results</p>
          <p className="text-sm">Form ID is missing. Please reload the page and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto flex flex-col w-full">
      <div className="w-full mx-auto py-6 px-6 sm:px-8 xl:px-12">
        {/* Sub-tabs: Submissions | Summary | Analytics */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-6">
          <div className="flex items-center gap-1">
            {(["submissions", "summary", "analytics"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setResultsSubTab(tab)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-[11px] transition-colors",
                  resultsSubTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <a
            href="#"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <HelpCircle className="h-4 w-4" />
            Help
          </a>
        </div>

        {resultsSubTab === "submissions" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Submissions</h3>
            {responsesLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : !responses?.length ? (
              <p className="text-sm text-gray-500">No submissions yet.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-end gap-3 border-b border-gray-200 px-4 py-3 bg-white">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      const toCsvCell = (v: unknown): string => {
                        const s = v === null || v === undefined ? "" : String(v);
                        // Quote cells when they contain CSV-special characters.
                        if (/["\n\r,]/.test(s)) {
                          return `"${s.replace(/"/g, '""')}"`;
                        }
                        return s;
                      };

                      const headers = ["id", "createdAt", "responseJson"];
                      const rows = (responses ?? []).map((r: any) => {
                        let responseJsonStr = "";
                        try {
                          responseJsonStr = JSON.stringify(r.responseJson ?? null);
                        } catch {
                          responseJsonStr = String(r.responseJson ?? "");
                        }

                        return [
                          toCsvCell(r.id),
                          toCsvCell(new Date(r.createdAt).toISOString()),
                          toCsvCell(responseJsonStr),
                        ];
                      });

                      const csv = [
                        headers.join(","),
                        ...rows.map((row) => row.join(",")),
                      ].join("\n");

                      const blob = new Blob([csv], {
                        type: "text/csv;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${formName || "form"}-submissions.csv`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download CSV
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Submitted</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.slice(0, 50).map((r: { id: string; createdAt: Date; responseJson: any }) => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-gray-900 font-mono text-xs truncate max-w-[200px]">
                          {typeof r.responseJson === "object"
                            ? JSON.stringify(r.responseJson).slice(0, 60) + "..."
                            : String(r.responseJson)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {resultsSubTab === "summary" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
            <p className="text-sm text-gray-500">
              Overview of responses and field-level stats. More summary options coming soon.
            </p>
          </div>
        )}

        {resultsSubTab === "analytics" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 mb-6">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-[140px]">
                  <Smartphone className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {kpiCards.map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-lg border p-4 flex flex-col gap-2",
                    card.className
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium opacity-90">{card.label}</span>
                    <card.icon className={cn("h-4 w-4", card.iconClassName)} />
                  </div>
                  <span className="text-xl font-semibold">{card.value}</span>
                </div>
              ))}
            </div>

            {/* Pink banner - Analytics limited */}
            <div className="rounded-lg bg-pink-50 border border-pink-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-pink-900">Analytics are limited</p>
                  <p className="text-sm text-pink-700">
                    See trends and the drop-off rate for each question in your form.{" "}
                    <a href="#" className="underline">Learn more</a>.
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white shrink-0" onClick={() => onOpenPricingModal?.()}>
                Buy VinForms PRO →
              </Button>
            </div>

            {/* Trends */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Trends</h3>
                <Select
                  value={trendsMetric}
                  onValueChange={(v: "views" | "submissions" | "completion") => setTrendsMetric(v)}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Views</SelectItem>
                    <SelectItem value="submissions">Submissions</SelectItem>
                    <SelectItem value="completion">Completion Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 min-h-[280px] flex items-center justify-center">
                {/* Placeholder chart - simple line/shade visual */}
                <div className="absolute inset-0 flex items-end justify-around px-4 pb-8 pt-4 gap-1">
                  {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 max-w-[40px] rounded-t bg-purple-200/60"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                {/* PRO overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg z-10">
                  <Button
                    size="sm"
                    className="bg-gray-900 hover:bg-gray-800 text-white gap-2"
                    onClick={() => onOpenPricingModal?.()}
                  >
                    <Lock className="h-4 w-4" />
                    Buy PRO
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
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
