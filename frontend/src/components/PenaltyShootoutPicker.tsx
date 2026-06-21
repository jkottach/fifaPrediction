import React from 'react';

export interface PenaltyTeamOption {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

interface PenaltyShootoutPickerProps {
  team1: PenaltyTeamOption;
  team2: PenaltyTeamOption;
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
  disabled?: boolean;
  variant?: 'dark' | 'light';
}

const Flag: React.FC<{
  src?: string | null;
  alt: string;
  size?: 'sm' | 'lg';
  isDark?: boolean;
}> = ({ src, alt, size = 'lg', isDark = true }) => {
  const [err, setErr] = React.useState(false);
  const dim = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';

  if (!src || err) {
    return (
      <div
        className={`${dim} rounded-full flex items-center justify-center font-bold text-xs shrink-0 border-2 ${
          isDark
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}
      >
        {alt.slice(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className={`${dim} rounded-full object-cover border-2 shrink-0 shadow-lg ${
        isDark ? 'border-white/30' : 'border-slate-200'
      }`}
    />
  );
};

const PenaltyShootoutPicker: React.FC<PenaltyShootoutPickerProps> = ({
  team1,
  team2,
  selectedTeamId,
  onSelect,
  disabled = false,
  variant = 'dark',
}) => {
  const isDark = variant === 'dark';

  const renderTeam = (team: PenaltyTeamOption, side: 'left' | 'right') => {
    const selected = selectedTeamId === team.teamId;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(team.teamId)}
        className={`group relative flex-1 min-w-0 rounded-xl p-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          selected
            ? isDark
              ? 'bg-gradient-to-br from-emerald-500/25 to-emerald-900/40 border-2 border-emerald-400/70 shadow-lg shadow-emerald-500/25 scale-[1.02]'
              : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-500 shadow-md scale-[1.02]'
            : isDark
            ? 'bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25'
            : 'bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white'
        }`}
        aria-pressed={selected}
        aria-label={`${team.teamName} wins on penalties`}
      >
        {selected && (
          <span
            className={`absolute -top-2 ${side === 'left' ? 'left-2' : 'right-2'} px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
              isDark ? 'bg-emerald-500 text-white shadow-lg' : 'bg-emerald-600 text-white'
            }`}
          >
            Advances
          </span>
        )}

        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <div className={`relative ${selected ? 'animate-pulse' : ''}`}>
            <Flag
              src={team.countryLogo}
              alt={team.teamId}
              size="lg"
              isDark={isDark}
            />
            {selected && (
              <span
                className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isDark ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-500 text-white'
                }`}
              >
                ✓
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-bold text-center leading-tight line-clamp-2 ${
              selected
                ? isDark
                  ? 'text-emerald-100'
                  : 'text-emerald-800'
                : isDark
                ? 'text-white/80'
                : 'text-slate-700'
            }`}
          >
            {team.teamName}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-500 ${
        isDark
          ? 'border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-900/90'
          : 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50'
      }`}
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 18px, currentColor 18px, currentColor 19px)',
        }}
      />

      <div className="relative z-10 px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-center gap-2 mb-0.5">
          <span className="text-base" aria-hidden>
            ⚽
          </span>
          <p
            className={`text-[9px] font-bold uppercase tracking-[0.22em] ${
              isDark ? 'text-amber-300/90' : 'text-amber-700'
            }`}
          >
            Penalty shootout
          </p>
          <span className="text-base" aria-hidden>
            🥅
          </span>
        </div>
        <p
          className={`text-center text-[12px] font-semibold mb-2 ${
            isDark ? 'text-white/90' : 'text-slate-800'
          }`}
        >
          Draw after extra time — pick the winner
        </p>

        <div className="flex items-stretch gap-2">
          {renderTeam(team1, 'left')}
          <div
            className={`flex flex-col items-center justify-center shrink-0 px-1 ${
              isDark ? 'text-white/25' : 'text-slate-300'
            }`}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest">vs</span>
            <span className="text-lg font-black leading-none mt-0.5">PK</span>
          </div>
          {renderTeam(team2, 'right')}
        </div>

        {!selectedTeamId && (
          <p
            className={`mt-2 text-center text-[10px] ${
              isDark ? 'text-amber-200/70' : 'text-amber-800/80'
            }`}
          >
            Tap a team to pick the shootout winner
          </p>
        )}
      </div>
    </div>
  );
};

export default PenaltyShootoutPicker;
