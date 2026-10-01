import { create } from 'zustand';
import { ElementRect, SelectionItem } from '../types/element';
import { useBoardStore } from './boardStore';

interface HoveredItem {
  screenId: string;
  elementId: string;
  name: string;
  dataKey?: string;
  bounds: ElementRect;
}

interface SelectionState {
  selectedItems: SelectionItem[];
  hoveredItem: HoveredItem | null;
  geometryCache: Record<string, ElementRect>;
  selectionVersion: number;
  isMissingSelected: boolean;

  selectElement: (
    screenId: string,
    elementId: string,
    name: string,
    bounds: ElementRect,
    dataKey?: string,
    isShift?: boolean
  ) => void;

  replaceSelection: (
    screenId: string,
    elementId: string,
    name: string,
    bounds: ElementRect,
    dataKey?: string
  ) => void;

  toggleSelectionItem: (
    screenId: string,
    elementId: string,
    name: string,
    bounds: ElementRect,
    dataKey?: string
  ) => void;

  clearSelection: () => void;
  clearPreviewSelection: (screenId: string) => void;

  setHoveredItem: (hovered: HoveredItem | null) => void;
  clearHover: () => void;

  updateGeometry: (
    screenId: string,
    elementId: string,
    bounds: ElementRect,
    name?: string
  ) => void;

  markElementsMissing: (screenId: string, missingIds: string[]) => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedItems: [],
  hoveredItem: null,
  geometryCache: {},
  selectionVersion: 0,
  isMissingSelected: false,

  selectElement: (screenId, elementId, name, bounds, dataKey, isShift = false) => {
    const currentActiveScreenId = useBoardStore.getState().activeScreenId;

    if (!isShift) {
      // Single selection: replace entire selection
      useBoardStore.getState().setActiveScreenId(screenId);

      const newItem: SelectionItem = {
        screenId,
        elementId,
        name,
        dataKey,
        selectedAt: Date.now(),
        isMissing: false,
      };

      set((s) => ({
        selectedItems: [newItem],
        geometryCache: {
          ...s.geometryCache,
          [`${screenId}::${elementId}`]: bounds,
        },
        selectionVersion: s.selectionVersion + 1,
        isMissingSelected: false,
      }));
    } else {
      // Shift + click
      if (currentActiveScreenId && currentActiveScreenId !== screenId) {
        // Different preview: replace selection entirely
        useBoardStore.getState().setActiveScreenId(screenId);
        const newItem: SelectionItem = {
          screenId,
          elementId,
          name,
          dataKey,
          selectedAt: Date.now(),
          isMissing: false,
        };

        set((s) => ({
          selectedItems: [newItem],
          geometryCache: {
            ...s.geometryCache,
            [`${screenId}::${elementId}`]: bounds,
          },
          selectionVersion: s.selectionVersion + 1,
          isMissingSelected: false,
        }));
      } else {
        // Same preview: toggle item in selection
        useBoardStore.getState().setActiveScreenId(screenId);
        get().toggleSelectionItem(screenId, elementId, name, bounds, dataKey);
      }
    }
  },

  replaceSelection: (screenId, elementId, name, bounds, dataKey) => {
    useBoardStore.getState().setActiveScreenId(screenId);
    const newItem: SelectionItem = {
      screenId,
      elementId,
      name,
      dataKey,
      selectedAt: Date.now(),
      isMissing: false,
    };

    set((s) => ({
      selectedItems: [newItem],
      geometryCache: {
        ...s.geometryCache,
        [`${screenId}::${elementId}`]: bounds,
      },
      selectionVersion: s.selectionVersion + 1,
      isMissingSelected: false,
    }));
  },

  toggleSelectionItem: (screenId, elementId, name, bounds, dataKey) => {
    set((s) => {
      const existsIndex = s.selectedItems.findIndex(
        (it) => it.screenId === screenId && it.elementId === elementId
      );

      let nextItems: SelectionItem[];
      if (existsIndex >= 0) {
        // Remove item
        nextItems = s.selectedItems.filter((_, i) => i !== existsIndex);
      } else {
        // Add item
        nextItems = [
          ...s.selectedItems,
          {
            screenId,
            elementId,
            name,
            dataKey,
            selectedAt: Date.now(),
            isMissing: false,
          },
        ];
      }

      return {
        selectedItems: nextItems,
        geometryCache: {
          ...s.geometryCache,
          [`${screenId}::${elementId}`]: bounds,
        },
        selectionVersion: s.selectionVersion + 1,
        isMissingSelected: false,
      };
    });
  },

  clearSelection: () => {
    set((s) => ({
      selectedItems: [],
      selectionVersion: s.selectionVersion + 1,
      isMissingSelected: false,
    }));
  },

  clearPreviewSelection: (screenId) => {
    set((s) => {
      const nextItems = s.selectedItems.filter((it) => it.screenId !== screenId);
      return {
        selectedItems: nextItems,
        selectionVersion: s.selectionVersion + 1,
        isMissingSelected: false,
      };
    });
  },

  setHoveredItem: (hovered) => set({ hoveredItem: hovered }),

  clearHover: () => set({ hoveredItem: null }),

  updateGeometry: (screenId, elementId, bounds, name) => {
    set((s) => {
      const key = `${screenId}::${elementId}`;
      const nextGeo = { ...s.geometryCache, [key]: bounds };

      let nextItems = s.selectedItems;
      if (name) {
        nextItems = s.selectedItems.map((it) =>
          it.screenId === screenId && it.elementId === elementId
            ? { ...it, name, isMissing: false }
            : it
        );
      }

      return {
        geometryCache: nextGeo,
        selectedItems: nextItems,
      };
    });
  },

  markElementsMissing: (screenId, missingIds) => {
    if (!missingIds || missingIds.length === 0) return;
    const missingSet = new Set(missingIds);

    set((s) => {
      let changed = false;
      const nextItems = s.selectedItems.map((it) => {
        if (it.screenId === screenId && missingSet.has(it.elementId)) {
          changed = true;
          return { ...it, isMissing: true };
        }
        return it;
      });

      if (!changed) return s;

      const allMissing = nextItems.length > 0 && nextItems.every((it) => it.isMissing);

      return {
        selectedItems: nextItems,
        isMissingSelected: allMissing,
      };
    });
  },
}));
