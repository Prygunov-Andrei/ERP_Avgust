import { useState } from 'react';
import { useSearchParams } from '@/hooks/erp-router';
import { Estimates } from './Estimates';
import { MountingEstimates } from './MountingEstimates';

type Tab = 'estimates' | 'mounting';

export function EstimatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'estimates';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'estimates' ? {} : { tab });
  };

  return (
    <div>
      <div className="border-b border-border mb-4">
        <nav className="flex gap-4 -mb-px" aria-label="Tabs">
          <button
            onClick={() => handleTabChange('estimates')}
            className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'estimates'
                ? 'border-blue-500 text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
            aria-label="Сметы"
            tabIndex={0}
          >
            Сметы
          </button>
          <button
            onClick={() => handleTabChange('mounting')}
            className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'mounting'
                ? 'border-blue-500 text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
            aria-label="Монтажные сметы"
            tabIndex={0}
          >
            Монтажные сметы
          </button>
        </nav>
      </div>
      {activeTab === 'estimates' ? <Estimates /> : <MountingEstimates />}
    </div>
  );
}
