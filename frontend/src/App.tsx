import React from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Board } from './components/Board/Board';
import { LayersPanel } from './components/Layers/LayersPanel';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { ErrorBoundary } from './components/Common/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      <Toolbar />

      <main className="workspace">
        <ErrorBoundary region="layers" fallbackTitle="Layers Panel Error">
          <LayersPanel />
        </ErrorBoundary>

        <ErrorBoundary region="board" fallbackTitle="Board Canvas Error">
          <Board />
        </ErrorBoundary>

        <InspectorPanel />
      </main>
    </div>
  );
};

export default App;
