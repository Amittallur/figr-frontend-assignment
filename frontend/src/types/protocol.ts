import { ElementRect, LiveInfo } from './element';

export type AppMode = 'select' | 'interact';

export interface HostToIframeMessage<T = any> {
  figr: true;
  type:
    | 'INIT'
    | 'SET_MODE'
    | 'TRACK_SELECTION'
    | 'GET_ROOT'
    | 'GET_CHILDREN'
    | 'GET_ANCESTORS'
    | 'GET_LIVE_INFO'
    | 'HOVER_BY_ID'
    | 'CLEAR_HOVER'
    | 'SCROLL_TO'
    | 'SEARCH_TREE'
    | 'KEYBOARD_NAV'
    | 'DEV_CRASH';
  screenId: string;
  sessionId?: string;
  requestId?: string;
  version?: number;
  payload?: T;
}

export interface IframeToHostMessage<T = any> {
  figr: true;
  type:
    | 'READY'
    | 'INIT_ACK'
    | 'HOVER'
    | 'SELECTION_CLICK'
    | 'SELECTION_CLEAR'
    | 'ROOT'
    | 'CHILDREN'
    | 'ANCESTORS'
    | 'LIVE_INFO'
    | 'SEARCH_RESULTS'
    | 'KEYBOARD_NAV_RESULT'
    | 'DOM_CHANGED'
    | 'PAGE_SCROLLED'
    | 'BOARD_ZOOM'
    | 'KEYBOARD_SHORTCUT'
    | 'PAGE_ERROR'
    | 'NAVIGATION_START';
  screenId: string;
  sessionId: string;
  requestId?: string;
  version?: number;
  payload?: T;
}

export interface HoverPayload {
  hovered: {
    elementId: string;
    name: string;
    dataKey?: string;
    bounds: ElementRect;
  } | null;
}

export interface SelectionClickPayload {
  elementId: string;
  name: string;
  dataKey?: string;
  bounds: ElementRect;
  shiftKey: boolean;
}

export interface DomChangedPayload {
  updates: Array<{
    elementId: string;
    bounds: ElementRect;
    name: string;
    live?: LiveInfo;
  }>;
  missing: string[];
  hovered: {
    elementId: string;
    name: string;
    bounds: ElementRect;
  } | null;
}

export interface PageScrolledPayload {
  updates: Array<{
    elementId: string;
    bounds: ElementRect;
    name: string;
  }>;
  missing: string[];
}

export interface BoardZoomPayload {
  deltaY: number;
  clientX: number;
  clientY: number;
}

export interface KeyboardShortcutPayload {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface PageErrorPayload {
  message: string;
  filename?: string;
  lineno?: number;
}

export interface SearchMatch {
  id: string;
  name: string;
  tag: string;
  ancestors: string[];
}

export interface SearchResultsPayload {
  query: string;
  matches: SearchMatch[];
}
