import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface BreadcrumbContextValue {
  detailLabel: string | null;
  setDetailLabel: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  detailLabel: null,
  setDetailLabel: () => {},
});

export const BreadcrumbProvider = ({ children }: { children: ReactNode }) => {
  const [detailLabel, setDetailLabelState] = useState<string | null>(null);

  const setDetailLabel = useCallback((label: string | null) => {
    setDetailLabelState(label);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ detailLabel, setDetailLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export const useBreadcrumb = () => useContext(BreadcrumbContext);
