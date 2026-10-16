const projects = new Map();
export function setProject(workspace, name = '') {
  const clean =
    String(name)
      .split(/[\\/]/)
      .filter(Boolean)
      .at(-1)
      ?.replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 100) || '';
  if (projects.get(workspace) === clean) return;
  projects.set(workspace, clean);
  window.dispatchEvent(new CustomEvent('ditasha:project', { detail: { workspace, name: clean } }));
}
export const getProject = (workspace) => projects.get(workspace) || '';
