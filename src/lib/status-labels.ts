/**
 * Convert application status values to human-readable labels.
 * Examples: "documents_submitted" → "Documents Submitted", "new" → "New"
 */
export function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "New",
    reviewing: "Reviewing",
    approved: "Approved",
    declined: "Declined",
    document_incomplete: "Documents Incomplete",
    documents_submitted: "Documents Submitted",
  };
  return labels[status] ?? status;
}
