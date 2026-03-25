'use client';

import { MarkdownPage } from '@/components/erp/components/help/MarkdownPage';
import { FeedbackWidget } from '@/components/erp/components/feedback';

export default function CommercialInstructionsPage() {
  return (
    <div>
      <FeedbackWidget section="commercial" />
      <MarkdownPage filePath="commercial/instructions.md" />
    </div>
  );
}
