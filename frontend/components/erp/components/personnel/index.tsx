import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Briefcase } from 'lucide-react';
import { EmployeesList } from './EmployeesList';
import { OrgChart } from '../OrgChart';

export function PersonnelTab() {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'hierarchy'>('employees');

  return (
    <div>
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'employees' | 'hierarchy')}>
        <TabsList className="mb-4">
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Сотрудники
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Иерархия
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeesList />
        </TabsContent>

        <TabsContent value="hierarchy">
          <OrgChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
