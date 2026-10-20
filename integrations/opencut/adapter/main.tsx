import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import Editor from '../source/src/app/editor/[project_id]/page';
import { TooltipProvider } from '../source/src/components/ui/tooltip';
import { Toaster } from '../source/src/components/ui/sonner';
import { EditorCore } from '../source/src/core';
import { useEditor } from '../source/src/editor/use-editor';
import { Route } from './navigation';
import './base.css';
import './theme.css';
function Projects() {
  const editor = useEditor(),
    projects = useEditor((e) => e.project.getSavedProjects());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    editor.project.loadAllProjects().catch((e) => setError(String(e)));
  }, [editor]);
  async function create() {
    setBusy(true);
    setError('');
    try {
      const id = await editor.project.createNewProject({ name: 'Untitled video' });
      location.hash = '/editor/' + id;
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ditasha-projects">
      <header>
        <div>
          <small>DITASHA · VIDEO & MOTION</small>
          <h1>OpenCut</h1>
          <p>Local projects · Timeline, text, audio and video editing</p>
        </div>
        <button onClick={create} disabled={busy} data-testid="new-project">
          {busy ? 'Creating…' : '+ New project'}
        </button>
      </header>
      <p role="alert">{error}</p>
      <section>
        {projects.map((p) => (
          <button key={p.id} onClick={() => (location.hash = '/editor/' + p.id)}>
            <strong>{p.name}</strong>
            <span>Open project →</span>
          </button>
        ))}
      </section>
      {!projects.length && (
        <p>
          Your saved projects will appear here. Create a project, then import media into its
          timeline.
        </p>
      )}
      <footer>
        OpenCut Classic · MIT License · Local edition for DITASHA. Projects and imported media are
        stored on this computer; export finished videos before clearing application data.
      </footer>
    </main>
  );
}
class ErrorBoundary extends React.Component<any, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main className="ditasha-projects">
        <h1>OpenCut could not open</h1>
        <p role="alert">{this.state.error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || '/projects');
  useEffect(() => {
    const fn = () => setRoute(location.hash.slice(1) || '/projects');
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Route.Provider value={route}>
            {/^\/editor\/[\w-]+$/.test(route) ? <Editor key={route} /> : <Projects />}
          </Route.Provider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
(window as any).ditashaOpenCut = { getEditor: () => EditorCore.getInstance() };
createRoot(document.getElementById('root')!).render(<App />);
