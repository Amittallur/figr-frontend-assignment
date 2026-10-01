import { create } from 'zustand';
import { ScreenLayers, TreeNode } from '../types/layers';

interface LayersState {
  screens: Record<string, ScreenLayers>;
  hoveredRowId: { screenId: string; nodeId: string } | null;

  getScreenLayers: (screenId: string) => ScreenLayers | undefined;
  initScreenLayers: (screenId: string, rootNodes: TreeNode[]) => void;
  resetScreenLayers: (screenId: string) => void;

  setNodeChildren: (
    screenId: string,
    parentId: string,
    children: TreeNode[],
    version?: number
  ) => void;

  toggleExpandNode: (screenId: string, nodeId: string) => void;
  setNodeExpanded: (screenId: string, nodeId: string, isExpanded: boolean) => void;

  setNodeLoading: (screenId: string, nodeId: string, isLoading: boolean) => void;
  setNodeFailed: (screenId: string, nodeId: string, isFailed: boolean) => void;
  retryNode: (screenId: string, nodeId: string) => number; // returns next version

  expandAncestors: (screenId: string, ancestorIds: string[]) => void;

  setScrollPos: (screenId: string, pos: number) => void;

  setSearch: (
    screenId: string,
    query: string,
    matchingIds: string[],
    ancestorIds: string[]
  ) => void;
  clearSearch: (screenId: string) => void;

  setHoveredRow: (screenId: string | null, nodeId: string | null) => void;
  incrementNodeVersion: (screenId: string, nodeId: string) => number;
}

const defaultScreenLayers = (screenId: string): ScreenLayers => ({
  screenId,
  nodes: {},
  rootIds: [],
  expandedIds: [],
  loadingIds: [],
  failedIds: [],
  scrollPos: 0,
  nodeVersions: {},
});

export const useLayersStore = create<LayersState>((set, get) => ({
  screens: {},
  hoveredRowId: null,

  getScreenLayers: (screenId) => get().screens[screenId],

  initScreenLayers: (screenId, rootNodes) => {
    set((s) => {
      const existing = s.screens[screenId] || defaultScreenLayers(screenId);
      const nextNodes = { ...existing.nodes };

      for (const node of rootNodes) {
        nextNodes[node.id] = {
          ...node,
          // Preserve children if already loaded
          children: nextNodes[node.id]?.children || node.children,
        };
      }

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...existing,
            nodes: nextNodes,
            rootIds: rootNodes.map((n) => n.id),
          },
        },
      };
    });
  },

  resetScreenLayers: (screenId) => {
    set((s) => ({
      screens: {
        ...s.screens,
        [screenId]: defaultScreenLayers(screenId),
      },
    }));
  },

  setNodeChildren: (screenId, parentId, children, version) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      // Reject responses from older generations/retries
      if (
        version !== undefined &&
        screen.nodeVersions[parentId] !== undefined &&
        version < screen.nodeVersions[parentId]
      ) {
        return s;
      }

      const nextNodes = { ...screen.nodes };
      const childIds: string[] = [];

      for (const child of children) {
        childIds.push(child.id);
        nextNodes[child.id] = {
          ...child,
          children: nextNodes[child.id]?.children || child.children,
        };
      }

      if (nextNodes[parentId]) {
        nextNodes[parentId] = {
          ...nextNodes[parentId],
          children: childIds,
          hasChildren: childIds.length > 0,
        };
      }

      const nextLoading = screen.loadingIds.filter((id) => id !== parentId);
      const nextFailed = screen.failedIds.filter((id) => id !== parentId);

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            nodes: nextNodes,
            loadingIds: nextLoading,
            failedIds: nextFailed,
          },
        },
      };
    });
  },

  toggleExpandNode: (screenId, nodeId) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      const isExpanded = screen.expandedIds.includes(nodeId);
      const nextExpanded = isExpanded
        ? screen.expandedIds.filter((id) => id !== nodeId)
        : [...screen.expandedIds, nodeId];

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            expandedIds: nextExpanded,
          },
        },
      };
    });
  },

  setNodeExpanded: (screenId, nodeId, isExpanded) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      const has = screen.expandedIds.includes(nodeId);
      if (has === isExpanded) return s;

      const nextExpanded = isExpanded
        ? [...screen.expandedIds, nodeId]
        : screen.expandedIds.filter((id) => id !== nodeId);

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            expandedIds: nextExpanded,
          },
        },
      };
    });
  },

  setNodeLoading: (screenId, nodeId, isLoading) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      const has = screen.loadingIds.includes(nodeId);
      if (has === isLoading) return s;

      const nextLoading = isLoading
        ? [...screen.loadingIds, nodeId]
        : screen.loadingIds.filter((id) => id !== nodeId);

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            loadingIds: nextLoading,
          },
        },
      };
    });
  },

  setNodeFailed: (screenId, nodeId, isFailed) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      const has = screen.failedIds.includes(nodeId);
      if (has === isFailed) return s;

      const nextFailed = isFailed
        ? [...screen.failedIds, nodeId]
        : screen.failedIds.filter((id) => id !== nodeId);

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            failedIds: nextFailed,
            loadingIds: screen.loadingIds.filter((id) => id !== nodeId),
          },
        },
      };
    });
  },

  retryNode: (screenId, nodeId) => {
    const nextVer = get().incrementNodeVersion(screenId, nodeId);
    get().setNodeFailed(screenId, nodeId, false);
    get().setNodeLoading(screenId, nodeId, true);
    return nextVer;
  },

  expandAncestors: (screenId, ancestorIds) => {
    if (!ancestorIds || ancestorIds.length === 0) return;
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      const setExp = new Set(screen.expandedIds);
      for (const id of ancestorIds) {
        setExp.add(id);
      }

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            expandedIds: Array.from(setExp),
          },
        },
      };
    });
  },

  setScrollPos: (screenId, pos) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;
      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            scrollPos: pos,
          },
        },
      };
    });
  },

  setSearch: (screenId, _query, matchingIds, ancestorIds) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      // Preserve normal expansion state before first search
      const normalExpanded = screen.normalExpandedIds || screen.expandedIds;
      const combinedToExpand = Array.from(new Set([...matchingIds, ...ancestorIds]));

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            normalExpandedIds: normalExpanded,
            searchExpandedIds: combinedToExpand,
            expandedIds: combinedToExpand,
          },
        },
      };
    });
  },

  clearSearch: (screenId) => {
    set((s) => {
      const screen = s.screens[screenId];
      if (!screen) return s;

      // Restore exact normal expanded state from before search
      const restoredExpanded = screen.normalExpandedIds || screen.expandedIds;

      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            expandedIds: restoredExpanded,
            normalExpandedIds: undefined,
            searchExpandedIds: undefined,
          },
        },
      };
    });
  },

  setHoveredRow: (screenId, nodeId) => {
    if (!screenId || !nodeId) {
      set({ hoveredRowId: null });
    } else {
      set({ hoveredRowId: { screenId, nodeId } });
    }
  },

  incrementNodeVersion: (screenId, nodeId) => {
    let nextVer = 1;
    set((s) => {
      const screen = s.screens[screenId] || defaultScreenLayers(screenId);
      const current = screen.nodeVersions[nodeId] || 0;
      nextVer = current + 1;
      return {
        screens: {
          ...s.screens,
          [screenId]: {
            ...screen,
            nodeVersions: {
              ...screen.nodeVersions,
              [nodeId]: nextVer,
            },
          },
        },
      };
    });
    return nextVer;
  },
}));
