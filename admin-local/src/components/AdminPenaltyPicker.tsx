import React from 'react';

interface TeamOption {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

interface AdminPenaltyPickerProps {
  team1: TeamOption;
  team2: TeamOption;
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
  disabled?: boolean;
}

const Flag: React.FC<{
  src?: string | null;
  alt: string;
  selected?: boolean;
}> = ({ src, alt, selected = false }) => {
  const [err, setErr] = React.useState(false);

  if (!src || err) {
    return (
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border-2 ${
          selected
            ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
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
      className={`w-10 h-10 rounded-full object-cover border-2 shrink-0 ${
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
      }`}
    />
  );
};

const AdminPenaltyPicker: React.FC<AdminPenaltyPickerProps> = ({
  team1,
  team2,
  selectedTeamId,
  onSelect,
  disabled = false,
}) => {
  const renderSegment = (team: TeamOption) => {
    const selected = selectedTeamId === team.teamId;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(team.teamId)}
        className={`group relative flex flex-1 flex-col items-center gap-1.5 px-2 py-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${selected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
        aria-pressed={selected}
        aria-label={`${team.teamName} wins on penalties`}
      >
        <Flag src={team.countryLogo} alt={team.teamId} selected={selected} />
        <span
          className={`text-center text-[11px] font-semibold leading-tight line-clamp-2 max-w-[88px] ${
            selected ? 'text-emerald-800' : 'text-slate-500 group-hover:text-slate-700'
          }`}
        >
          {team.teamName}
        </span>
        {selected && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">
            Advances
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="px-3 py-2 text-center border-b border-slate-200 bg-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
          Penalty shootout
        </p>
        <p className="text-[11px] mt-0.5 text-slate-500">Draw — pick who advances</p>
      </div>
      <div className="flex divide-x divide-slate-200">
        {renderSegment(team1)}
        {renderSegment(team2)}
      </div>
    </div>
  );
};

export default AdminPenaltyPicker;
