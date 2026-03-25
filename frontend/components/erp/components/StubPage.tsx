import { Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StubPageProps {
  title: string;
  description?: string;
  parentSection?: string;
}

export const StubPage = ({ title, description, parentSection }: StubPageProps) => (
  <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
    <Construction className="w-16 h-16 text-muted-foreground mb-4" />
    <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
    <p className="text-muted-foreground">Раздел в разработке</p>
    {description && (
      <p className="text-muted-foreground mt-2 text-sm max-w-md text-center">{description}</p>
    )}
    {parentSection && (
      <Badge variant="outline" className="mt-4">{parentSection}</Badge>
    )}
  </div>
);
