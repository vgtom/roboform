import { useQuery, getFormFieldCoverImage } from "wasp/client/operations";
import type { FormField } from "../shared/formTypes";

export function FieldCoverImage({
  field,
  formId,
}: {
  field: FormField;
  formId?: string;
}) {
  const directUrl = field.image?.trim();
  const isDirectUrl =
    typeof directUrl === "string" &&
    (directUrl.startsWith("http://") ||
      directUrl.startsWith("https://") ||
      directUrl.startsWith("data:image/"));

  const { data, isLoading } = useQuery(
    getFormFieldCoverImage,
    { formId: formId!, fieldId: field.id },
    {
      enabled:
        Boolean(formId) && Boolean(field.coverInDb) && !isDirectUrl,
    },
  );

  const src = isDirectUrl
    ? directUrl
    : data
      ? `data:${data.mimeType};base64,${data.dataBase64}`
      : undefined;

  if (!src && !isLoading) {
    return null;
  }

  if (!src && isLoading) {
    return (
      <div className="mb-6 flex w-full justify-center">
        <div className="h-32 w-full max-w-md animate-pulse rounded-lg bg-white/10" />
      </div>
    );
  }

  if (!src) {
    return null;
  }

  return (
    <div className="mb-6 flex w-full justify-center">
      <img
        src={src}
        alt=""
        className="max-h-48 w-auto max-w-full rounded-lg object-contain shadow-md"
      />
    </div>
  );
}
