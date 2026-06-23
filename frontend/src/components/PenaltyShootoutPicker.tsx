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
  isDark?: boolean;
  selected?: boolean;
}> = ({ src, alt, isDark = true, selected = false }) => {
  const [err, setErr] = React.useState(false);

  if (!src || err) {
    return (
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border-2 ${
          selected
            ? isDark
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-100'
              : 'bg-emerald-100 border-emerald-500 text-emerald-800'
            : isDark
            ? 'bg-white/10 border-white/15 text-white/60'
            : 'bg-slate-100 border-slate-200 text-slate-500'
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
      className={`w-11 h-11 rounded-full object-cover border-2 shrink-0 transition-all duration-200 ${
        selected
          ? isDark
            ? 'border-emerald-400 ring-2 ring-emerald-400/30'
            : 'border-emerald-500 ring-2 ring-emerald-500/20'
          : isDark
          ? 'border-white/20 opacity-75'
          : 'border-slate-200'
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

  const renderSegment = (team: PenaltyTeamOption) => {
    const selected = selectedTeamId === team.teamId;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(team.teamId)}
        className={`group relative flex flex-1 flex-col items-center gap-2 px-2 py-3.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          selected
            ? isDark
              ? 'bg-emerald-500/12'
              : 'bg-emerald-50'
            : isDark
            ? 'hover:bg-white/[0.03]'
            : 'hover:bg-slate-50'
        }`}
        aria-pressed={selected}
        aria-label={`${team.teamName} wins on penalties`}
      >
        <Flag
          src={team.countryLogo}
          alt={team.teamId}
          isDark={isDark}
          selected={selected}
        />
        <span
          className={`text-center text-[11px] font-semibold leading-tight line-clamp-2 max-w-[88px] ${
            selected
              ? isDark
                ? 'text-emerald-200'
                : 'text-emerald-800'
              : isDark
              ? 'text-white/60 group-hover:text-white/80'
              : 'text-slate-500 group-hover:text-slate-700'
          }`}
        >
          {team.teamName}
        </span>
        {selected && (
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          >
            Advances
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className={`fade-in rounded-xl border overflow-hidden ${
        isDark
          ? 'border-white/10 bg-white/[0.03]'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div
        className={`px-3 py-2 text-center border-b ${
          isDark ? 'border-white/[0.06]' : 'border-slate-200'
        }`}
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
            isDark ? 'text-emerald-400/90' : 'text-emerald-700'
          }`}
        >
          Penalty shootout
        </p>
        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
          Tied score — pick who advances
        </p>
      </div>

      <div className={`flex divide-x ${isDark ? 'divide-white/[0.06]' : 'divide-slate-200'}`}>
        {renderSegment(team1)}
        {renderSegment(team2)}
      </div>

      {!selectedTeamId && (
        <p
          className={`text-center text-[10px] py-1.5 border-t ${
            isDark
              ? 'border-white/[0.06] text-white/25'
              : 'border-slate-200 text-slate-400'
          }`}
        >
          Required to submit
        </p>
      )}
    </div>
  );
};

export default PenaltyShootoutPicker;
