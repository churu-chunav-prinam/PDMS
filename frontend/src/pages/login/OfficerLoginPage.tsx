import { Vote } from 'lucide-react';
import { UsernameLoginPage } from './UsernameLoginPage';

export function OfficerLoginPage() {
  return <UsernameLoginPage titleHi="मतदान अधिकारी लॉगिन" titleEn="Polling Officer (PRO)" icon={<Vote className="size-6" aria-hidden="true" />} />;
}
