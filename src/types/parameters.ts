// Shared parameter types for the REST schema and UI consumers.
// `ParameterEntry` is the canonical record shape returned by the REST API
// (see the parameter registry endpoints). UI components and hooks should
// import this type rather than defining their own local record shapes.

export interface ParameterEntry {
  id: string;
  name: string;
  value: string;
  type: string;
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Backwards-compatible alias. Older code referenced `ParameterRecord`;
// it now resolves to the shared REST schema type so there is a single
// parameter type across the codebase.
export type ParameterRecord = ParameterEntry;

export interface ParameterHistoryEntry {
  id: string;
  parameterId: string;
  value: string;
  changedAt: string;
  changedBy?: string;
}
