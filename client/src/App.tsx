import { AdminPage } from '@/features/admin/AdminPage'
import { Workspace } from '@/features/workspace/Workspace'

export default function App() {
  // Normalize path so /admin, /admin/, and //admin/ all resolve to the admin page.
  if (window.location.pathname.replace(/\/+$/, '').replace(/\/+/g, '/') === '/admin')
    return <AdminPage />

  return <Workspace />
}
