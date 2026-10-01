export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}

export interface ElementIdentity {
  raw: string;
  key?: string;
  id?: string;
  anchor?: string;
  tag: string;
  firstClass?: string;
  dataName?: string;
  textSnippet?: string;
  ordinal?: number;
}

export interface LiveInfo {
  name: string;
  tag: string;
  id: string;
  classes: string[];
  width: number;
  height: number;
  pageX: number;
  pageY: number;
  text: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
}

export interface ElementDetails {
  component: string;
  description: string;
  status: 'stable' | 'beta' | 'deprecated' | string;
  owner: string;
}

export interface SelectionItem {
  screenId: string;
  elementId: string;
  name: string;
  dataKey?: string;
  selectedAt: number;
  isMissing?: boolean;
}
