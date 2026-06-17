import ClientComponent from './ClientComponent';
import { caller } from '../server/caller';

export default async function Page() {
  const message = await caller.hello({ name: 'Server' });

  return (
    <div>
      <h1 id="server-data">{message}</h1>
      <ClientComponent />
    </div>
  );
}
