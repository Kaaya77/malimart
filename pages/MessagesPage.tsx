// MessagesPage.tsx — legacy /messages route, now a role-aware redirect.
// The dashboard inboxes (MessagingHub) are the single messaging surface:
// buyer → /buyer?tab=inbox · seller → /seller?tab=messages · admin → /admin?tab=messages.
// Kept as a route (incl. /messages/:peerId) so old links and notifications keep working.
import { Navigate, useParams } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { Skeleton } from '../components/UI';

export const MessagesPage = () => {
  const { peerId } = useParams();
  const { user, isLoading } = useAppState();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="w-72 h-24 rounded-3xl" />
      </div>
    );
  }

  if (!user) {
    const target = peerId ? `/messages/${peerId}` : '/messages';
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />;
  }

  if (user.role === 'seller') {
    return <Navigate to={`/seller?tab=messages${peerId ? `&chat=${peerId}` : ''}`} replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to={`/admin?tab=messages${peerId ? `&chat=${peerId}` : ''}`} replace />;
  }
  return <Navigate to={`/buyer?tab=inbox${peerId ? `&sellerId=${peerId}` : ''}`} replace />;
};
