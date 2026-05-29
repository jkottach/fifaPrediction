import React from 'react';
import { Link } from 'react-router-dom';
import {
  MATCH_POINTS,
  TOURNAMENT_GROUP_COUNT,
  TOURNAMENT_POINTS,
  maxTournamentPoints,
} from '../constants/points';
import { useAuth } from '../hooks/useAuth';
import { HERO_BG, HERO_GRID_STYLE } from '../theme';

const steps = [
  {
    number: '01',
    title: 'Sign in',
    description: 'Join with Google.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0114.998 0" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Predict scores',
    description: 'Pick scores before the deadline.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Win prizes',
    description: 'Climb the leaderboard and win prizes.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108 1.14 3.957 2.833 4.952M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972" />
      </svg>
    ),
  },
];

const Home: React.FC = () => {
  const { isLoggedIn } = useAuth();

  return (
    <div className="min-h-full bg-slate-50">
      {/* Hero — inline background so it always renders */}
      <section
        className="relative overflow-hidden px-5 pt-10 pb-12 text-white"
        style={{ background: HERO_BG }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={HERO_GRID_STYLE}
        />

        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white">
              Official prediction league
            </span>
          </div>

          <h1 className="mb-4 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-white">
            Mandrake Worldcup 26
          </h1>

          <p className="mb-8 max-w-sm text-[15px] font-medium leading-relaxed text-slate-300">
            Predict scores. Earn points. Win prizes.
          </p>

          <div className="flex flex-col gap-3">
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[15px] font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98] transition-all"
              >
                Open dashboard
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[15px] font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98] transition-all"
              >
                Sign in to predict
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            )}
            <Link
              to="/leaderboard"
              className="flex min-h-[52px] items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 text-[15px] font-semibold text-white hover:bg-white/20 active:scale-[0.98] transition-all"
            >
              View leaderboard
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 pt-6 pb-6">
        <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Get started</h2>
        <div className="space-y-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-emerald-600">
                {step.icon}
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-display text-[10px] font-bold tracking-wider text-slate-400">
                    {step.number}
                  </span>
                  <h3 className="font-display text-[15px] font-bold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-6">
        <h2 className="font-display text-lg font-bold text-slate-900 mb-3">How points work</h2>
        <div className="space-y-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-display text-[15px] font-bold text-slate-900 mb-2">
              Match score predictions
            </h3>
            <p className="text-[13px] leading-relaxed text-slate-600 mb-3">
              For each match, enter the full-time score before the deadline. Points add up when the
              final result is known:
            </p>
            <ul className="space-y-1.5 text-[13px] text-slate-700">
              <li className="flex justify-between gap-3">
                <span>Correct result (win / draw / loss)</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{MATCH_POINTS.correctResult}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Exact Team 1 score</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{MATCH_POINTS.correctTeam1Score}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Exact Team 2 score</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{MATCH_POINTS.correctTeam2Score}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Correct goal difference</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{MATCH_POINTS.correctGoalDifference}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[12px] text-slate-500">
              Up to {MATCH_POINTS.maxPerMatch} points per match if you get everything right.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-display text-[15px] font-bold text-slate-900 mb-2">
              Tournament predictions
            </h3>
            <p className="text-[13px] leading-relaxed text-slate-600 mb-3">
              On your dashboard, submit group winners and your knockout bracket once before the
              tournament deadline. Points apply when official results are in:
            </p>
            <ul className="space-y-1.5 text-[13px] text-slate-700">
              <li className="flex justify-between gap-3">
                <span>Each correct group winner</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{TOURNAMENT_POINTS.groupChampion}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Each correct semifinalist</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{TOURNAMENT_POINTS.semifinalist}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Each correct finalist</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{TOURNAMENT_POINTS.finalist}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Correct tournament champion</span>
                <span className="font-semibold text-emerald-700 shrink-0">
                  +{TOURNAMENT_POINTS.champion}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[12px] text-slate-500">
              {TOURNAMENT_GROUP_COUNT} groups, 4 semifinalists, 2 finalists, 1 champion — up to{' '}
              {maxTournamentPoints()} tournament points. Leaderboard totals include match and
              tournament points together.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-5 pb-10 pt-6">
        <p className="text-center text-[11px] font-medium text-slate-400">
          Mandrake Worldcup 26
        </p>
      </footer>
    </div>
  );
};

export default Home;
