import { getSuperUserProfile, getUsers, resolveSession } from './auth';

export type CurrentEmailSettings = {
  name: string;
  email: string;
  connected: boolean;
  provider: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  signatureText: string;
  signatureImageUrl: string;
  signatureTitle: string;
  signaturePhone: string;
};

export function currentEmailSettings(): CurrentEmailSettings | null {
  const session = resolveSession();
  if (!session) return null;

  if (session.role === 'SuperUser') {
    const profile = getSuperUserProfile();
    return {
      name: profile.name,
      email: profile.outlookEmail || profile.email || session.email,
      connected: Boolean(profile.outlookConnected && (profile.outlookEmail || profile.email || session.email)),
      provider: profile.emailProvider || 'Outlook',
      imapHost: profile.imapHost || 'outlook.office365.com',
      imapPort: profile.imapPort || '993',
      smtpHost: profile.smtpHost || 'smtp.office365.com',
      smtpPort: profile.smtpPort || '587',
      signatureText: profile.signatureText || `Thanks,\n${profile.name}`,
      signatureImageUrl: profile.signatureImageUrl || '',
      signatureTitle: profile.signatureTitle || profile.title || '',
      signaturePhone: profile.signaturePhone || profile.phone || '',
    };
  }

  const user = getUsers().find(row => row.id === session.id);
  return {
    name: user?.name ?? session.name,
    email: user?.outlookEmail || session.email,
    connected: Boolean(user?.outlookConnected && (user.outlookEmail || session.email)),
    provider: user?.emailProvider || 'Outlook',
    imapHost: user?.imapHost || 'outlook.office365.com',
    imapPort: user?.imapPort || '993',
    smtpHost: user?.smtpHost || 'smtp.office365.com',
    smtpPort: user?.smtpPort || '587',
    signatureText: user?.signatureText || `Thanks,\n${user?.name ?? session.name}`,
    signatureImageUrl: user?.signatureImageUrl || '',
    signatureTitle: user?.signatureTitle || '',
    signaturePhone: user?.signaturePhone || '',
  };
}

export function emailSignatureText(settings: CurrentEmailSettings | null) {
  if (!settings) return '';
  return [
    settings.signatureText,
    settings.signatureTitle,
    settings.signaturePhone,
  ].filter(Boolean).join('\n');
}
