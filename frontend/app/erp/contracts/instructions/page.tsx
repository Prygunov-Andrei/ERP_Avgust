'use client';

import { MarkdownPage } from '@/components/erp/components/help/MarkdownPage';
import { FeedbackWidget } from '@/components/erp/components/feedback';

export default function ContractsInstructionsPage() {
  return (
    <div>
      <FeedbackWidget section="contracts" />
      <MarkdownPage filePath="contracts/instructions.md" />
    </div>
  );
}
