'use client';

import { MarkdownPage } from '@/components/erp/components/help/MarkdownPage';
import { FeedbackWidget } from '@/components/erp/components/feedback';

export default function SettingsInstructionsPage() {
  return (
    <div>
      <FeedbackWidget section="settings" />
      <MarkdownPage filePath="settings/instructions.md" />
    </div>
  );
}
