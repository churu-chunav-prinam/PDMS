// Landing page text and cards: the ONE place to rename or enable a card.
export const LANDING = {
  titleHi: 'मतदान दिवस निगरानी प्रणाली · जिला चूरू',
  titleEn: 'Poll Day Monitoring System · District Churu',
  infoHi: 'मतदान दल प्रत्येक चरण की जानकारी यहाँ दर्ज करें। ज़िला नियंत्रण कक्ष सभी बूथों की स्थिति देखता है।',
  infoEn: 'Polling parties report each step here; the district control room watches every booth.',
} as const;

export interface LandingCard {
  key: string;
  titleHi: string;
  titleEn: string;
  /** Hash route of the login page; null while the card is not available yet. */
  href: string | null;
  /** One line under the title. */
  descHi: string;
  icon: 'admin' | 'officer' | 'other';
}

export const LANDING_CARDS: readonly LandingCard[] = [
  { key: 'admin', titleHi: 'जिला प्रशासन लॉगिन', titleEn: 'District Administration', href: '/login/admin', descHi: 'नियंत्रण कक्ष: सभी बूथों की स्थिति, समस्याएँ और रिपोर्ट', icon: 'admin' },
  { key: 'officer', titleHi: 'मतदान अधिकारी लॉगिन', titleEn: 'Polling Officer (PRO)', href: '/login/officer', descHi: 'अपने बूथ के चरण, मतदान प्रतिशत और समस्याएँ दर्ज करें', icon: 'officer' },
  // To enable later: set href (and add its login page in App.tsx).
  { key: 'other', titleHi: 'अन्य अधिकारी — जल्द उपलब्ध', titleEn: 'Other officers — coming soon', href: null, descHi: 'सेक्टर अधिकारी आदि के लिए', icon: 'other' },
];
