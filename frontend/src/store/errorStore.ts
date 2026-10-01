import { create } from 'zustand';
import { ErrorRegion } from '../types/error';
import { clearRegionFailure, reportRegionFailure } from '../services/errorService';

interface ErrorStoreState {
  boardError: string | null;
  previewErrors: Record<string, string>; // screenId -> error
  pageErrors: Record<string, string>; // screenId -> page error badge message
  layersError: string | null;
  rowErrors: Record<string, string>; // `${screenId}::${nodeId}` -> error
  detailsError: string | null;
  inspectorRenderError: string | null;

  // Dev-only failure triggers
  devFailScreens: boolean;
  devFailPreviewTimeout: string | null;
  devFailLayerTimeout: string | null;
  devFailDetails500: boolean;
  devFailDetailsMalformed: boolean;
  devFailInspectorRender: boolean;

  setBoardError: (err: string | null) => void;
  setPreviewError: (screenId: string, err: string | null) => void;
  setPageError: (screenId: string, err: string) => void;
  clearPageError: (screenId: string) => void;
  setLayersError: (err: string | null) => void;
  setRowError: (screenId: string, nodeId: string, err: string | null) => void;
  setDetailsError: (err: string | null) => void;
  setInspectorRenderError: (err: string | null) => void;

  handleFailure: (
    region: ErrorRegion,
    screenId: string | null,
    elementKey?: string,
    error?: any,
    failureToken?: string
  ) => void;

  retryRegion: (
    region: ErrorRegion,
    screenId: string | null,
    elementKey?: string,
    failureToken?: string
  ) => void;

  // Dev trigger actions
  setDevFailScreens: (v: boolean) => void;
  setDevFailPreviewTimeout: (screenId: string | null) => void;
  setDevFailLayerTimeout: (screenId: string | null) => void;
  setDevFailDetails500: (v: boolean) => void;
  setDevFailDetailsMalformed: (v: boolean) => void;
  setDevFailInspectorRender: (v: boolean) => void;
}

export const useErrorStore = create<ErrorStoreState>((set, get) => ({
  boardError: null,
  previewErrors: {},
  pageErrors: {},
  layersError: null,
  rowErrors: {},
  detailsError: null,
  inspectorRenderError: null,

  devFailScreens: false,
  devFailPreviewTimeout: null,
  devFailLayerTimeout: null,
  devFailDetails500: false,
  devFailDetailsMalformed: false,
  devFailInspectorRender: false,

  setBoardError: (err) => set({ boardError: err }),

  setPreviewError: (screenId, err) =>
    set((s) => {
      const next = { ...s.previewErrors };
      if (err) next[screenId] = err;
      else delete next[screenId];
      return { previewErrors: next };
    }),

  setPageError: (screenId, err) =>
    set((s) => ({
      pageErrors: { ...s.pageErrors, [screenId]: err },
    })),

  clearPageError: (screenId) =>
    set((s) => {
      const next = { ...s.pageErrors };
      delete next[screenId];
      return { pageErrors: next };
    }),

  setLayersError: (err) => set({ layersError: err }),

  setRowError: (screenId, nodeId, err) =>
    set((s) => {
      const key = `${screenId}::${nodeId}`;
      const next = { ...s.rowErrors };
      if (err) next[key] = err;
      else delete next[key];
      return { rowErrors: next };
    }),

  setDetailsError: (err) => set({ detailsError: err }),

  setInspectorRenderError: (err) => set({ inspectorRenderError: err }),

  handleFailure: (region, screenId, elementKey, error, failureToken) => {
    const errObj =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown failure');

    // Report normalized failure exactly once
    reportRegionFailure(
      errObj,
      {
        region,
        screenId,
        elementKey,
      },
      failureToken
    );

    // Update region error state
    switch (region) {
      case 'board':
        get().setBoardError(errObj.message);
        break;
      case 'preview':
        if (screenId) get().setPreviewError(screenId, errObj.message);
        break;
      case 'layers':
        get().setLayersError(errObj.message);
        break;
      case 'layers-row':
        if (screenId && elementKey) {
          get().setRowError(screenId, elementKey, errObj.message);
        }
        break;
      case 'details':
        get().setDetailsError(errObj.message);
        break;
      case 'inspector':
        get().setInspectorRenderError(errObj.message);
        break;
    }
  },

  retryRegion: (region, screenId, elementKey, failureToken) => {
    // Clear failure from deduplicator so subsequent attempt counts as new failure
    clearRegionFailure(region, screenId, elementKey, failureToken);

    // Clear state
    switch (region) {
      case 'board':
        get().setBoardError(null);
        break;
      case 'preview':
        if (screenId) get().setPreviewError(screenId, null);
        break;
      case 'layers':
        get().setLayersError(null);
        break;
      case 'layers-row':
        if (screenId && elementKey) {
          get().setRowError(screenId, elementKey, null);
        }
        break;
      case 'details':
        get().setDetailsError(null);
        break;
      case 'inspector':
        get().setInspectorRenderError(null);
        break;
    }
  },

  setDevFailScreens: (v) => set({ devFailScreens: v }),
  setDevFailPreviewTimeout: (s) => set({ devFailPreviewTimeout: s }),
  setDevFailLayerTimeout: (s) => set({ devFailLayerTimeout: s }),
  setDevFailDetails500: (v) => set({ devFailDetails500: v }),
  setDevFailDetailsMalformed: (v) => set({ devFailDetailsMalformed: v }),
  setDevFailInspectorRender: (v) => set({ devFailInspectorRender: v }),
}));
