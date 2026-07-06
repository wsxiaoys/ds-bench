import type { User } from './types';

export const initialUsers: User[] = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    role: 'Admin',
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob.smith@example.com',
    role: 'Editor',
  },
  {
    id: 3,
    name: 'Charlie Davis',
    email: 'charlie.davis@example.com',
    role: 'Viewer',
  },
  {
    id: 4,
    name: 'Dana Wright',
    email: 'dana.wright@example.com',
    role: 'Editor',
  },
];

export const ROLES = ['Admin', 'Editor', 'Viewer'] as const;
