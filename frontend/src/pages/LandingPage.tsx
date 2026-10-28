import { ArrowRight, CalendarDays, Landmark, Lock, Users, Vote } from 'lucide-react';
import { apiGet } from '../api/client';
import type { PublicInfo } from '../api/types';
import { useLoad } from '../components/ui';
import { LANDING, LANDING_CARDS } from '../config/landing';
import type { LandingCard } from '../config/landing';
import { Skeleton, cn } from '../ui';

const DATE = new Intl.DateTimeFormat('hi-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
const pollDateHi = (iso: string) => DATE.format(new Date(`${iso}T12:00:00+05:30`));
const ICONS: Record<LandingCard['icon'], typeof Vote> = { admin: Landmark, officer: Vote, other: Users };

function RoleCard({ card }: { card: LandingCard }) {
  const Icon = ICONS[card.icon];
  const body = (
    <>
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', card.href ? 'bg-saffron-50 text-saffron-700' : 'bg-slate-100 text-slate-500')}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-snug">{card.titleHi}</span>
        <span className="block text-sm text-slate-600">{card.titleEn}</span>
        <span className="mt-1 block text-sm text-slate-700">{card.descHi}</span>
      </span>
      {card.href ? (
        <ArrowRight className="size-6 shrink-0 text-saffron-700 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      ) : (
        <Lock className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
      )}
    </>
  );
  const base = 'landing-card group flex items-center gap-4 rounded-card p-5 text-left ring-1 transition md:flex-col md:items-start';
  return card.href === null ? (
    <div className={cn(base, 'landing-card-off cursor-not-allowed bg-slate-50 text-slate-600 ring-slate-200')} aria-disabled="true">
      {body}
    </div>
  ) : (
    <a href={`#${card.href}`} className={cn(base, 'bg-surface text-slate-900 shadow-card ring-line hover:-translate-y-0.5 hover:shadow-raised hover:ring-saffron-200')}>
      {body}
    </a>
  );
}

export function LandingPage() {
  const { data } = useLoad(() => apiGet<PublicInfo>('/api/public/info'), []);
  return (
    <div className="min-h-dvh">
      <header className="relative overflow-hidden bg-gradient-to-b from-saffron-50 via-canvas to-canvas">
        <div className="tricolour h-1.5" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 pb-8 pt-10 text-center sm:pt-14">
          <span className="grid size-14 place-items-center rounded-2xl bg-saffron-700 text-white shadow-raised">
            <Vote className="size-7" aria-hidden="true" />
          </span>
          <h1 className="text-display font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {LANDING.titleHi}
            <span className="mt-1 block text-base font-medium text-slate-600 sm:text-lg">{LANDING.titleEn}</span>
          </h1>
          {data ? (
            <>
              <p className="text-lg font-semibold text-saffron-800">
                {data.election.hi}
                <span className="block text-sm font-normal text-slate-600">{data.election.en}</span>
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-card ring-1 ring-line">
                <CalendarDays className="size-4 text-saffron-700" aria-hidden="true" />
                मतदान तिथि: {pollDateHi(data.pollDate)}
                <span className="hidden font-normal text-slate-600 sm:inline">· {data.pollDate}</span>
              </span>
            </>
          ) : (
            <Skeleton className="h-16 w-72" />
          )}
          <p className="max-w-2xl text-sm text-slate-700">
            {LANDING.infoHi}
            <span className="block text-slate-600">{LANDING.infoEn}</span>
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-12">
        <nav className="landing-cards grid gap-4 md:grid-cols-3" aria-label="लॉगिन चुनें">
          {LANDING_CARDS.map((c) => <RoleCard key={c.key} card={c} />)}
        </nav>
        <p className="mt-8 text-center text-xs text-slate-600">जिला निर्वाचन कार्यालय, चूरू · District Election Office, Churu</p>
      </main>
    </div>
  );
}
