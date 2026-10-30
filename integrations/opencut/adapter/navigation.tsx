import { createContext, useContext } from 'react';
export const Route = createContext('/projects');
function navigate(path: string) {
  if (path === '/projects' || /^\/editor\/[\w-]+$/.test(path)) location.hash = path;
}
const router = { push: navigate, replace: navigate, back: () => history.back(), refresh() {} };
export const useRouter = () => router;
export const useParams = () => ({ project_id: useContext(Route).split('/')[2] });
export const usePathname = () => useContext(Route);
export const notFound = () => {
  throw Error('Page unavailable offline');
};
