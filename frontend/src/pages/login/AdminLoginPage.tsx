import { Landmark } from 'lucide-react';
import { UsernameLoginPage } from './UsernameLoginPage';

export function AdminLoginPage() {
  return <UsernameLoginPage titleHi="जिला प्रशासन लॉगिन" titleEn="District Administration" icon={<Landmark className="size-6" aria-hidden="true" />} />;
}
