import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '../store/selectionStore';
import { useBoardStore } from '../store/boardStore';

describe('Selection State Model (R3)', () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
    useBoardStore.getState().setActiveScreenId(null);
  });

  it('single click selects element and replaces previous selection', () => {
    const store = useSelectionStore.getState();
    store.selectElement('scr-01', 'key:btn-1', 'Button 1', { x: 10, y: 10, width: 100, height: 40 });

    let state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(1);
    expect(state.selectedItems[0].elementId).toBe('key:btn-1');
    expect(useBoardStore.getState().activeScreenId).toBe('scr-01');

    // Single click second element on same screen
    state.selectElement('scr-01', 'key:btn-2', 'Button 2', { x: 10, y: 60, width: 100, height: 40 });
    state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(1);
    expect(state.selectedItems[0].elementId).toBe('key:btn-2');
  });

  it('Shift + click in same preview toggles selection', () => {
    const store = useSelectionStore.getState();
    // Select first
    store.selectElement('scr-01', 'key:btn-1', 'Button 1', { x: 10, y: 10, width: 100, height: 40 }, 'btn-1', false);
    // Shift click second in same preview -> adds to selection
    store.selectElement('scr-01', 'key:btn-2', 'Button 2', { x: 10, y: 60, width: 100, height: 40 }, 'btn-2', true);

    let state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(2);
    expect(state.selectedItems.map((s) => s.elementId)).toEqual(['key:btn-1', 'key:btn-2']);

    // Shift click first again -> removes from selection
    store.selectElement('scr-01', 'key:btn-1', 'Button 1', { x: 10, y: 10, width: 100, height: 40 }, 'btn-1', true);
    state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(1);
    expect(state.selectedItems[0].elementId).toBe('key:btn-2');
  });

  it('Shift + click in different preview replaces selection', () => {
    const store = useSelectionStore.getState();
    // Select in scr-01
    store.selectElement('scr-01', 'key:btn-1', 'Button 1', { x: 10, y: 10, width: 100, height: 40 }, 'btn-1', false);
    expect(useBoardStore.getState().activeScreenId).toBe('scr-01');

    // Shift click in scr-02 -> replaces selection and switches active preview!
    store.selectElement('scr-02', 'key:btn-diff', 'Button Diff', { x: 20, y: 20, width: 80, height: 30 }, 'btn-diff', true);

    const state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(1);
    expect(state.selectedItems[0].screenId).toBe('scr-02');
    expect(state.selectedItems[0].elementId).toBe('key:btn-diff');
    expect(useBoardStore.getState().activeScreenId).toBe('scr-02');
  });

  it('clearSelection empties selectedItems but preserves activeScreenId', () => {
    const store = useSelectionStore.getState();
    store.selectElement('scr-01', 'key:btn-1', 'Button 1', { x: 10, y: 10, width: 100, height: 40 });
    expect(useBoardStore.getState().activeScreenId).toBe('scr-01');

    store.clearSelection();

    const state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(0);
    // Active screen preserved so layers panel continues showing scr-01!
    expect(useBoardStore.getState().activeScreenId).toBe('scr-01');
  });

  it('marks elements missing and triggers isMissingSelected when all disappear', () => {
    const store = useSelectionStore.getState();
    store.selectElement('scr-01', 'id:item-1', 'Item 1', { x: 0, y: 0, width: 50, height: 50 });

    expect(useSelectionStore.getState().isMissingSelected).toBe(false);

    // Notify item-1 is missing
    store.markElementsMissing('scr-01', ['id:item-1']);

    const state = useSelectionStore.getState();
    expect(state.isMissingSelected).toBe(true);
    expect(state.selectedItems[0].isMissing).toBe(true);
  });
});
