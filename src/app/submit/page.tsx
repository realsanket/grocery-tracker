import { PageHeader } from "@/components/ui/primitives";
import { PublicSubmitter } from "@/components/submit/public-submitter";

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Submit a receipt"
        subtitle="Help grow the price database. Your photo goes to the site owner for review — after approval its prices join the comparisons, and the photo is deleted."
      />
      <PublicSubmitter />
      <p className="mt-4 text-xs text-ink-faint">
        Only grocery receipts, please. Submissions are rate-limited, reviewed by a human
        before anything is published, and never stored after processing.
      </p>
    </div>
  );
}
