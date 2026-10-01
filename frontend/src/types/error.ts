export type ErrorRegion =
  | 'board'
  | 'preview'
  | 'layers'
  | 'layers-row'
  | 'details'
  | 'inspector';

export interface ReportContext {
  region: ErrorRegion;
  screenId: string | null;
  elementKey?: string;
}

export interface FailureState {
  region: ErrorRegion;
  screenId: string | null;
  elementKey?: string;
  error: Error | string;
  timestamp: number;
}
