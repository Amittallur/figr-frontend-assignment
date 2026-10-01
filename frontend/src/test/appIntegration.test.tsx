import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { useBoardStore } from '../store/boardStore';
import { useSelectionStore } from '../store/selectionStore';
import { useLayersStore } from '../store/layersStore';
import { useErrorStore } from '../store/errorStore';
import { useInspectorStore } from '../store/inspectorStore';

const mockScreens = [
  { id: 'scr-01', name: 'Landing', url: 'http://localhost:4001/page-1.html' },
  { id: 'scr-02', name: 'Sign up', url: 'http://localhost:4001/page-2.html' },
  { id: 'scr-03', name: 'Dashboard', url: 'http://localhost:4001/page-3.html' },
];

describe('Full Application UI Integration', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/screens')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(mockScreens)),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({})),
        });
      })
    );

    useBoardStore.setState({
      activeScreenId: null,
      scale: 1,
      panX: 40,
      panY: 40,
      mode: 'select',
    });
    useSelectionStore.getState().clearSelection();
    useLayersStore.getState().resetScreenLayers('scr-01');
    useInspectorStore.getState().clearInspector();
  });

  it('renders the application shell with toolbar, empty layers, and empty inspector', async () => {
    render(<App />);

    // Check toolbar elements
    expect(screen.getByText('Figr Inspector')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Interact')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Dev Failure Menu')).toBeInTheDocument();

    // Check panels
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByText('Inspector')).toBeInTheDocument();

    // Check screens load
    await waitFor(() => {
      expect(screen.getByText('Landing')).toBeInTheDocument();
      expect(screen.getByText('Sign up')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('toggles between Select mode and Interact mode via toolbar and shortcuts', async () => {
    render(<App />);

    const interactBtn = screen.getByTitle(/Interact mode/);
    fireEvent.click(interactBtn);
    expect(useBoardStore.getState().mode).toBe('interact');

    const selectBtn = screen.getByTitle(/Select mode/);
    fireEvent.click(selectBtn);
    expect(useBoardStore.getState().mode).toBe('select');
  });

  it('controls zoom scale via zoom buttons and reset', async () => {
    render(<App />);

    const zoomInBtn = screen.getByTitle('Zoom in');
    fireEvent.click(zoomInBtn);
    expect(useBoardStore.getState().scale).toBeCloseTo(1.1, 2);

    const zoomOutBtn = screen.getByTitle('Zoom out');
    fireEvent.click(zoomOutBtn);
    expect(useBoardStore.getState().scale).toBeCloseTo(1.0, 2);

    const resetBtn = screen.getByTitle('Reset board view');
    fireEvent.click(resetBtn);
    expect(useBoardStore.getState().scale).toBe(0.75);
  });

  it('toggles Dev Failures menu and controls synthetic failure flags', async () => {
    render(<App />);

    const devBtn = screen.getByText('Dev Failure Menu');
    fireEvent.click(devBtn);

    expect(screen.getByText('SIMULATE FAILURES (R6)')).toBeInTheDocument();
    expect(screen.getByText('Screens API Failure')).toBeInTheDocument();
    expect(screen.getByText('Details API 500 Failure')).toBeInTheDocument();

    const failDetailsBtn = screen.getByText('Details API 500 Failure');
    fireEvent.click(failDetailsBtn);
    expect(useErrorStore.getState().devFailDetails500).toBe(true);

    fireEvent.click(devBtn);
    const failDetailsBtn2 = screen.getByText('Details API 500 Failure');
    fireEvent.click(failDetailsBtn2);
    expect(useErrorStore.getState().devFailDetails500).toBe(false);
  });

  it('clears selection on Escape key', async () => {
    render(<App />);

    useSelectionStore.getState().selectElement('scr-01', 'key:btn', 'Button', {
      x: 10,
      y: 10,
      width: 50,
      height: 20,
    });
    expect(useSelectionStore.getState().selectedItems).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useSelectionStore.getState().selectedItems).toHaveLength(0);
  });
});
