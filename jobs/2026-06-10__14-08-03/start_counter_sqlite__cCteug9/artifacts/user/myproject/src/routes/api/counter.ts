import { createFileRoute } from '@tanstack/react-router';
import { getCount } from '../../counterFn';

export const Route = createFileRoute('/api/counter')({
  loader: async () => {
    return getCount();
  },
});
