export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

// What the application supplies; the storage generates id and createdAt
export type NewUser = Omit<User, 'id' | 'createdAt'>
