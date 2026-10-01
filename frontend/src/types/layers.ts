export interface TreeNode {
  id: string; // stable elementId
  name: string;
  tag: string;
  hasChildren: boolean;
  children?: string[]; // child element IDs
  parentId: string | null;
  depth: number;
  dataKey?: string;
}

export interface ScreenLayers {
  screenId: string;
  nodes: Record<string, TreeNode>;
  rootIds: string[];
  expandedIds: string[];
  loadingIds: string[];
  failedIds: string[];
  scrollPos: number;
  searchExpandedIds?: string[];
  normalExpandedIds?: string[];
  nodeVersions: Record<string, number>;
}
