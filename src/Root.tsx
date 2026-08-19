import { useCallback, useEffect, useState } from 'react';
import App from './App';
import SharedView from './components/SharedView';
import { payloadFromHash } from './lib/shareSnapshot';

/**
 * The one fork in the app: your schedule, or someone else's link.
 *
 * A shared link is recognised by its fragment, which is also the only place it
 * could live — a fragment is never sent to the server, so a schedule pasted
 * into a link is not written to a log, a cache or an analytics record on the
 * way to being looked at.
 *
 * This sits above App so that opening a link never touches sign-in, sync or
 * local storage. A visitor with no account should get the picture they were
 * sent and nothing else.
 */
export default function Root() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const leave = useCallback(() => {
    // Replaces rather than pushes: Back should return where the visitor came
    // from, not bounce them into the shared schedule they just closed.
    window.history.replaceState(null, '', window.location.pathname);
    setHash('');
    document.title = 'Skedge';
  }, []);

  const payload = payloadFromHash(hash);
  if (payload) return <SharedView payload={payload} onLeave={leave} />;

  return <App />;
}
