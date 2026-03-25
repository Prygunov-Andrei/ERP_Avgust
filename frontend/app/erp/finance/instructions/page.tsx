'use client';

import { MarkdownPage } from '@/components/erp/components/help/MarkdownPage';
import { FeedbackWidget } from '@/components/erp/components/feedback';

export default function FinanceInstructionsPage() {
  return (
    <div>
      <FeedbackWidget section="finance" />
      <MarkdownPage filePath="finance.md" />
    </div>
  );
}
