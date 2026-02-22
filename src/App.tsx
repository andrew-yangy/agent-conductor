import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNotifications } from '@/hooks/useNotifications';

function Initializers() {
  useWebSocket();
  useNotifications();
  return null;
}

export default function App() {
  return (
    <>
      <Initializers />
      <RouterProvider router={router} />
    </>
  );
}
