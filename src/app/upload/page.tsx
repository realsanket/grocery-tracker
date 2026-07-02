import { PageHeader } from "@/components/ui/primitives";
import { ReceiptUploader } from "@/components/upload/receipt-uploader";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Upload receipt"
        subtitle="Product lines are extracted, translated to English and saved as price observations. The image itself is discarded."
      />
      <ReceiptUploader />
    </div>
  );
}
