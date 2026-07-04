import { PageHeader } from "@/components/ui/primitives";
import { UploadWorkspace } from "@/components/upload/upload-workspace";
import {
  listPendingReceipts,
  purgeOldPending,
} from "@/db/mutations/pending-receipts";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  await purgeOldPending().catch(() => {});
  const pending = await listPendingReceipts();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Upload receipt"
        subtitle="Products are extracted and translated to English, then you review and edit everything before it is saved. Images are deleted the moment data is saved."
      />
      <UploadWorkspace
        pending={pending.map((p) => ({
          id: p.id,
          sourceFilename: p.sourceFilename,
          sizeBytes: p.sizeBytes,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
