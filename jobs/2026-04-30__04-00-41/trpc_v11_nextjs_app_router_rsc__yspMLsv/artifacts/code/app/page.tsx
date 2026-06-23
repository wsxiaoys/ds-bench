import ClientComponent from './ClientComponent';
import { caller } from '../server/caller';

export default async function Page() {
  const serverData = await caller.hello({ name: 'Server' });
  return (
    <div>
      <h1 id="server-data">{serverData}</h1>
      <ClientComponent />
    </div>
  );
}
