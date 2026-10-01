import { create } from 'zustand';
import { AppMode } from '../types/protocol';

interface BoardState {
  panX: number;
  panY: number;
  scale: number;
  mode: AppMode;
  activeScreenId: string | null;

  setPan: (x: number, y: number) => void;
  updatePan: (dx: number, dy: number) => void;
  setScale: (scale: number) => void;
  zoomAt: (deltaY: number, pointerX: number, pointerY: number) => void;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  setActiveScreenId: (id: string | null) => void;
  resetBoard: () => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4.0;

export const useBoardStore = create<BoardState>((set) => ({
  panX: 40,
  panY: 40,
  scale: 0.75,
  mode: 'select',
  activeScreenId: null,

  setPan: (x, y) => set({ panX: x, panY: y }),

  updatePan: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),

  setScale: (scale) =>
    set({ scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) }),

  zoomAt: (deltaY, pointerX, pointerY) =>
    set((state) => {
      // Figma / DevTools style smooth zoom sensitivity
      const zoomFactor = Math.exp(-deltaY * 0.0025);
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, state.scale * zoomFactor)
      );

      if (newScale === state.scale) return state;

      // Zoom centered on pointer position:
      // newPan = pointer - (pointer - oldPan) * (newScale / oldScale)
      const ratio = newScale / state.scale;
      const newPanX = pointerX - (pointerX - state.panX) * ratio;
      const newPanY = pointerY - (pointerY - state.panY) * ratio;

      return {
        scale: newScale,
        panX: newPanX,
        panY: newPanY,
      };
    }),

  setMode: (mode) => set({ mode }),

  toggleMode: () =>
    set((s) => ({ mode: s.mode === 'select' ? 'interact' : 'select' })),

  setActiveScreenId: (id) => set({ activeScreenId: id }),

  resetBoard: () => set({ panX: 40, panY: 40, scale: 0.75 }),
}));
