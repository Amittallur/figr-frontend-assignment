import { describe, it, expect, beforeEach } from 'vitest';
import { useInspectorStore } from '../store/inspectorStore';

describe('Async Race Conditions & Multi-Select (R5)', () => {
  beforeEach(() => {
    useInspectorStore.getState().clearInspector();
  });

  it('discards late live info responses from older selection versions', () => {
    const store = useInspectorStore.getState();

    const initialVersion = store.activeVersion;
    // User selects Element A (version 1)
    const ver1 = store.nextVersion();
    expect(ver1).toBe(initialVersion + 1);

    // User quickly selects Element B (version 2)
    const ver2 = store.nextVersion();
    expect(ver2).toBe(initialVersion + 2);

    // Stale response from Element A arrives for version 1
    store.setLiveInfo(
      {
        name: 'Element A',
        tag: 'div',
        id: 'a',
        classes: [],
        width: 100,
        height: 100,
        pageX: 0,
        pageY: 0,
        text: 'Old A',
        textColor: '#000',
        backgroundColor: '#fff',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontWeight: '400',
      },
      ver1
    );

    // Inspector state must NOT show Element A!
    expect(useInspectorStore.getState().liveInfo).toBeNull();

    // Response for version 2 arrives
    store.setLiveInfo(
      {
        name: 'Element B',
        tag: 'button',
        id: 'b',
        classes: [],
        width: 120,
        height: 40,
        pageX: 10,
        pageY: 10,
        text: 'Current B',
        textColor: '#fff',
        backgroundColor: '#000',
        fontFamily: 'sans-serif',
        fontSize: '16px',
        fontWeight: '600',
      },
      ver2
    );

    expect(useInspectorStore.getState().liveInfo?.name).toBe('Element B');
  });

  it('computes multi-selection Live fields as shared value or Mixed', () => {
    const store = useInspectorStore.getState();
    const ver = store.nextVersion();

    // Two buttons selected: same tag ('button'), different font sizes (14px vs 16px)
    const multiComputed = {
      tag: { value: 'button', isMixed: false },
      fontSize: { value: '14px', isMixed: true },
    };

    store.setMultiLive(multiComputed, 2, ver);

    const state = useInspectorStore.getState();
    expect(state.multiCount).toBe(2);
    expect(state.multiLive?.tag.value).toBe('button');
    expect(state.multiLive?.tag.isMixed).toBe(false);
    expect(state.multiLive?.fontSize.isMixed).toBe(true);
  });
});
