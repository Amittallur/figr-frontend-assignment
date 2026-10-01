import { create } from 'zustand';
import { ElementDetails, LiveInfo } from '../types/element';

export interface MultiLiveProperty {
  value: any;
  isMixed: boolean;
}

interface InspectorState {
  liveInfo: LiveInfo | null;
  multiLive: Record<string, MultiLiveProperty> | null;
  multiCount: number;
  details: ElementDetails | null;
  loadingDetails: boolean;
  detailsError: string | null;
  details404: boolean;
  activeVersion: number;

  setLiveInfo: (info: LiveInfo | null, version: number) => void;
  setMultiLive: (
    multi: Record<string, MultiLiveProperty> | null,
    count: number,
    version: number
  ) => void;
  setDetails: (details: ElementDetails | null, version: number) => void;
  setLoadingDetails: (isLoading: boolean, version: number) => void;
  setDetailsError: (err: string | null, version: number) => void;
  setDetails404: (is404: boolean, version: number) => void;
  clearInspector: () => void;
  nextVersion: () => number;
}

export const useInspectorStore = create<InspectorState>((set, get) => ({
  liveInfo: null,
  multiLive: null,
  multiCount: 0,
  details: null,
  loadingDetails: false,
  detailsError: null,
  details404: false,
  activeVersion: 0,

  setLiveInfo: (info, version) => {
    // Only accept if version matches or exceeds activeVersion
    if (version < get().activeVersion) return;
    set({
      liveInfo: info,
      multiLive: null,
      multiCount: 0,
      activeVersion: version,
    });
  },

  setMultiLive: (multi, count, version) => {
    if (version < get().activeVersion) return;
    set({
      multiLive: multi,
      multiCount: count,
      liveInfo: null,
      details: null,
      loadingDetails: false,
      detailsError: null,
      details404: false,
      activeVersion: version,
    });
  },

  setDetails: (details, version) => {
    if (version < get().activeVersion) return;
    set({
      details,
      loadingDetails: false,
      detailsError: null,
      details404: false,
      activeVersion: version,
    });
  },

  setLoadingDetails: (isLoading, version) => {
    if (version < get().activeVersion) return;
    set({
      loadingDetails: isLoading,
      detailsError: null,
      details404: false,
      activeVersion: version,
    });
  },

  setDetailsError: (err, version) => {
    if (version < get().activeVersion) return;
    set({
      detailsError: err,
      loadingDetails: false,
      details: null,
      details404: false,
      activeVersion: version,
    });
  },

  setDetails404: (is404, version) => {
    if (version < get().activeVersion) return;
    set({
      details404: is404,
      details: null,
      loadingDetails: false,
      detailsError: null,
      activeVersion: version,
    });
  },

  clearInspector: () =>
    set((s) => ({
      liveInfo: null,
      multiLive: null,
      multiCount: 0,
      details: null,
      loadingDetails: false,
      detailsError: null,
      details404: false,
      activeVersion: s.activeVersion + 1,
    })),

  nextVersion: () => {
    let next = 1;
    set((s) => {
      next = s.activeVersion + 1;
      return { activeVersion: next };
    });
    return next;
  },
}));
