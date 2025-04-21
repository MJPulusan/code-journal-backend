export type Entry = {
  entryId?: number;
  title: string;
  notes: string;
  photoUrl: string;
};

import { User } from '../components/UserContext';

const authKey = 'um.auth';

type Auth = {
  user: User;
  token: string;
};

export function saveAuth(user: User, token: string): void {
  const auth: Auth = { user, token };
  localStorage.setItem(authKey, JSON.stringify(auth));
}

export function removeAuth(): void {
  localStorage.removeItem(authKey);
}

export function readToken(): string | undefined {
  const auth = localStorage.getItem(authKey);
  if (!auth) return undefined;
  return (JSON.parse(auth) as Auth).token;
}

export async function readEntries(): Promise<Entry[]> {
  const token = readToken();
  const res = await fetch(`/api/entries`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!res.ok) throw new Error('Failed to load entries');
  return res.json();
}

export async function readEntry(entryId: number): Promise<Entry | undefined> {
  const token = readToken();
  const res = await fetch(`/api/entries/${entryId}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!res.ok) throw new Error('Failed to load entry');
  return res.json();
}

export async function addEntry(entry: Entry): Promise<Entry> {
  const token = readToken();
  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },

    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to load entry');
  return res.json();
}

export async function updateEntry(entry: Entry): Promise<Entry> {
  const token = readToken();
  const res = await fetch(`/api/entries/${entry.entryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

export async function removeEntry(entryId: number): Promise<void> {
  const token = readToken();
  const res = await fetch(`/api/entries/${entryId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to delete entry');
}
