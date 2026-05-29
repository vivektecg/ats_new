import { getSuperUserProfile, getUsers, resolveSession, type CallingProvider } from './auth';

export type CurrentCallingSettings = {
  userId: string;
  name: string;
  provider: CallingProvider;
  number: string;
  extension: string;
  connected: boolean;
};

export function currentCallingSettings(): CurrentCallingSettings | null {
  const session = resolveSession();
  if (!session) return null;

  if (session.role === 'SuperUser') {
    const profile = getSuperUserProfile();
    return {
      userId: 'SuperUser',
      name: profile.name,
      provider: profile.callingProvider || 'Manual Dialer',
      number: profile.callingNumber || profile.phone || '',
      extension: profile.callingExtension || '',
      connected: Boolean(profile.callingConnected && (profile.callingNumber || profile.phone)),
    };
  }

  const user = getUsers().find(row => row.id === session.id);
  return {
    userId: session.id,
    name: user?.name ?? session.name,
    provider: user?.callingProvider || 'Manual Dialer',
    number: user?.callingNumber || '',
    extension: user?.callingExtension || '',
    connected: Boolean(user?.callingConnected && user?.callingNumber),
  };
}
