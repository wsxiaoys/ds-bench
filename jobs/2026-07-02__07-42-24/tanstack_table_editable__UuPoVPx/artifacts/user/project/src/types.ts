export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const initialUsers: User[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', role: 'Admin' },
  { id: '2', name: 'Bob Jones', email: 'bob@example.com', role: 'Editor' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'User' },
];
