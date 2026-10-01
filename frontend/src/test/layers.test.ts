import { describe, it, expect, beforeEach } from 'vitest';
import { useLayersStore } from '../store/layersStore';
import { TreeNode } from '../types/layers';

describe('Layers Tree State Model (R4)', () => {
  const mockRoots: TreeNode[] = [
    {
      id: 'id:nav',
      name: 'nav.top',
      tag: 'nav',
      hasChildren: true,
      parentId: null,
      depth: 0,
    },
    {
      id: 'id:hero',
      name: 'section#hero',
      tag: 'section',
      hasChildren: true,
      parentId: null,
      depth: 0,
    },
  ];

  beforeEach(() => {
    useLayersStore.getState().resetScreenLayers('scr-01');
  });

  it('initializes root nodes for a screen', () => {
    const store = useLayersStore.getState();
    store.initScreenLayers('scr-01', mockRoots);

    const screenLayers = useLayersStore.getState().screens['scr-01'];
    expect(screenLayers).toBeDefined();
    expect(screenLayers.rootIds).toEqual(['id:nav', 'id:hero']);
    expect(screenLayers.nodes['id:nav'].name).toBe('nav.top');
  });

  it('lazy loads children into parent node on expand', () => {
    const store = useLayersStore.getState();
    store.initScreenLayers('scr-01', mockRoots);

    const heroChildren: TreeNode[] = [
      {
        id: 'key:cta-primary',
        name: 'button.primary',
        tag: 'button',
        hasChildren: false,
        parentId: 'id:hero',
        depth: 1,
      },
    ];

    store.setNodeChildren('scr-01', 'id:hero', heroChildren);

    const screenLayers = useLayersStore.getState().screens['scr-01'];
    expect(screenLayers.nodes['id:hero'].children).toEqual(['key:cta-primary']);
    expect(screenLayers.nodes['key:cta-primary'].name).toBe('button.primary');
  });

  it('preserves and restores exact expansion state on search clear', () => {
    const store = useLayersStore.getState();
    store.initScreenLayers('scr-01', mockRoots);

    // Expand id:nav in normal view
    store.setNodeExpanded('scr-01', 'id:nav', true);
    expect(useLayersStore.getState().screens['scr-01'].expandedIds).toEqual(['id:nav']);

    // Perform search matching 'hero' -> expands id:hero
    store.setSearch('scr-01', 'hero', ['id:hero'], []);
    expect(useLayersStore.getState().screens['scr-01'].expandedIds).toContain('id:hero');

    // Clear search -> restores exact normal expansion (only id:nav)!
    store.clearSearch('scr-01');
    const screenLayers = useLayersStore.getState().screens['scr-01'];
    expect(screenLayers.expandedIds).toEqual(['id:nav']);
  });

  it('materializes unloaded ancestor nodes during search and restores expansion on clear', () => {
    const store = useLayersStore.getState();
    store.initScreenLayers('scr-01', mockRoots);

    // Tree starts with id:hero collapsed, no children loaded
    expect(useLayersStore.getState().screens['scr-01'].nodes['id:hero'].children).toBeUndefined();

    // Search for deeply nested "Target" that was never loaded before:
    // Parent (id:hero) -> Child (id:child) -> Target (id:target)
    const materialized: TreeNode[] = [
      {
        id: 'id:child',
        name: 'div.child',
        tag: 'div',
        hasChildren: true,
        children: ['id:target'],
        parentId: 'id:hero',
        depth: 1,
      },
      {
        id: 'id:target',
        name: 'button.target',
        tag: 'button',
        hasChildren: false,
        parentId: 'id:child',
        depth: 2,
      },
    ];

    store.setSearch('scr-01', 'target', ['id:target'], ['id:hero', 'id:child'], materialized);

    const screenLayers = useLayersStore.getState().screens['scr-01'];
    expect(screenLayers.nodes['id:target']).toBeDefined();
    expect(screenLayers.nodes['id:child']).toBeDefined();
    expect(screenLayers.nodes['id:hero'].children).toContain('id:child');
    expect(screenLayers.expandedIds).toContain('id:hero');
    expect(screenLayers.expandedIds).toContain('id:child');

    // Clearing search restores exact pre-search collapsed state!
    store.clearSearch('scr-01');
    const cleared = useLayersStore.getState().screens['scr-01'];
    expect(cleared.expandedIds).toEqual([]);
  });
});
