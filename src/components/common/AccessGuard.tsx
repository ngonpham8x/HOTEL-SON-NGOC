import type { ReactNode } from 'react';
import { useAccess } from '../../context/AccessContext';
import type { ActionId, ModuleId } from '../../types/access';

export function AccessGuard({ action, view, anyView, children }: { action?: ActionId; view?: ModuleId; anyView?: ModuleId[]; children: ReactNode }) {
  const { canAct, canView } = useAccess();
  if ((action && !canAct(action)) || (view && !canView(view)) || (anyView && !anyView.some(canView))) return null;
  return <>{children}</>;
}
