import { PageHeader } from "@/components/ui/primitives";
import { ReceiptUploader } from "@/components/upload/receipt-uploader";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Upload receipt"
        subtitle="Products are extracted and translated to English, then you review and edit everything before it is saved. The image itself is discarded."
      />
      <ReceiptUploader />
    </div>
  );
}
