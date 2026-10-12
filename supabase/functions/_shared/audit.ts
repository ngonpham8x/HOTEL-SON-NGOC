export interface AuditDetail {
  collection: string;
  id: string;
  reference: string;
  kind: 'CREATED' | 'UPDATED' | 'DELETED';
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}
export interface AuditEntry {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  requestId?: string | null;
  revision?: number | null;
  details: AuditDetail[];
  metadata: { counts?: Record<string, number>; passwordChanged?: boolean };
}
export interface AuditPage {
  entries: AuditEntry[];
  actors: { id: string; name: string; username: string }[];
  actions: string[];
  nextCursor: string | null;
}
