import React from 'react';
import type { TournamentTeamOption } from '../types';

interface TeamSelectProps {
  id: string;
  value: string;
  onChange: (teamId: string) => void;
  teams: TournamentTeamOption[];
  placeholder: string;
  disabled?: boolean;
  excludeIds?: string[];
}

const TeamSelect: React.FC<TeamSelectProps> = ({
  id,
  value,
  onChange,
  teams,
  placeholder,
  disabled,
  excludeIds = [],
}) => {
  const options = teams.filter((t) => !excludeIds.includes(t.teamId) || t.teamId === value);

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((t) => (
        <option key={t.teamId} value={t.teamId}>
          {t.teamName}
        </option>
      ))}
    </select>
  );
};

export default TeamSelect;
