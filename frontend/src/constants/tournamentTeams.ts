import type { GroupStageGroupInfo, Team } from '../types';

/** WC26 group stage — hardcoded so tournament picks load without DB team lookups. */
export const TOURNAMENT_GROUPS: GroupStageGroupInfo[] = [
  {
    group: 'A',
    teams: [
      { teamId: 'CZE', teamName: 'Czech Republic', countryLogo: 'https://flagcdn.com/w80/cz.png' },
      { teamId: 'KOR', teamName: 'South Korea', countryLogo: 'https://flagcdn.com/w80/kr.png' },
      { teamId: 'MEX', teamName: 'Mexico', countryLogo: 'https://flagcdn.com/w80/mx.png' },
      { teamId: 'RSA', teamName: 'South Africa', countryLogo: 'https://flagcdn.com/w80/za.png' },
    ],
  },
  {
    group: 'B',
    teams: [
      { teamId: 'BIH', teamName: 'Bosnia and Herzegovina', countryLogo: 'https://flagcdn.com/w80/ba.png' },
      { teamId: 'CAN', teamName: 'Canada', countryLogo: 'https://flagcdn.com/w80/ca.png' },
      { teamId: 'QAT', teamName: 'Qatar', countryLogo: 'https://flagcdn.com/w80/qa.png' },
      { teamId: 'SUI', teamName: 'Switzerland', countryLogo: 'https://flagcdn.com/w80/ch.png' },
    ],
  },
  {
    group: 'C',
    teams: [
      { teamId: 'BRA', teamName: 'Brazil', countryLogo: 'https://flagcdn.com/w80/br.png' },
      { teamId: 'HAI', teamName: 'Haiti', countryLogo: 'https://flagcdn.com/w80/ht.png' },
      { teamId: 'MAR', teamName: 'Morocco', countryLogo: 'https://flagcdn.com/w80/ma.png' },
      { teamId: 'SCO', teamName: 'Scotland', countryLogo: 'https://flagcdn.com/w80/gb-sct.png' },
    ],
  },
  {
    group: 'D',
    teams: [
      { teamId: 'AUS', teamName: 'Australia', countryLogo: 'https://flagcdn.com/w80/au.png' },
      { teamId: 'PAR', teamName: 'Paraguay', countryLogo: 'https://flagcdn.com/w80/py.png' },
      { teamId: 'TUR', teamName: 'Turkey', countryLogo: 'https://flagcdn.com/w80/tr.png' },
      { teamId: 'USA', teamName: 'United States', countryLogo: 'https://flagcdn.com/w80/us.png' },
    ],
  },
  {
    group: 'E',
    teams: [
      { teamId: 'CIV', teamName: 'Ivory Coast', countryLogo: 'https://flagcdn.com/w80/ci.png' },
      { teamId: 'CUW', teamName: 'Curacao', countryLogo: 'https://flagcdn.com/w80/cw.png' },
      { teamId: 'ECU', teamName: 'Ecuador', countryLogo: 'https://flagcdn.com/w80/ec.png' },
      { teamId: 'GER', teamName: 'Germany', countryLogo: 'https://flagcdn.com/w80/de.png' },
    ],
  },
  {
    group: 'F',
    teams: [
      { teamId: 'JPN', teamName: 'Japan', countryLogo: 'https://flagcdn.com/w80/jp.png' },
      { teamId: 'NED', teamName: 'Netherlands', countryLogo: 'https://flagcdn.com/w80/nl.png' },
      { teamId: 'SWE', teamName: 'Sweden', countryLogo: 'https://flagcdn.com/w80/se.png' },
      { teamId: 'TUN', teamName: 'Tunisia', countryLogo: 'https://flagcdn.com/w80/tn.png' },
    ],
  },
  {
    group: 'G',
    teams: [
      { teamId: 'BEL', teamName: 'Belgium', countryLogo: 'https://flagcdn.com/w80/be.png' },
      { teamId: 'EGY', teamName: 'Egypt', countryLogo: 'https://flagcdn.com/w80/eg.png' },
      { teamId: 'IRN', teamName: 'Iran', countryLogo: 'https://flagcdn.com/w80/ir.png' },
      { teamId: 'NZL', teamName: 'New Zealand', countryLogo: 'https://flagcdn.com/w80/nz.png' },
    ],
  },
  {
    group: 'H',
    teams: [
      { teamId: 'CPV', teamName: 'Cape Verde', countryLogo: 'https://flagcdn.com/w80/cv.png' },
      { teamId: 'ESP', teamName: 'Spain', countryLogo: 'https://flagcdn.com/w80/es.png' },
      { teamId: 'KSA', teamName: 'Saudi Arabia', countryLogo: 'https://flagcdn.com/w80/sa.png' },
      { teamId: 'URU', teamName: 'Uruguay', countryLogo: 'https://flagcdn.com/w80/uy.png' },
    ],
  },
  {
    group: 'I',
    teams: [
      { teamId: 'FRA', teamName: 'France', countryLogo: 'https://flagcdn.com/w80/fr.png' },
      { teamId: 'IRQ', teamName: 'Iraq', countryLogo: 'https://flagcdn.com/w80/iq.png' },
      { teamId: 'NOR', teamName: 'Norway', countryLogo: 'https://flagcdn.com/w80/no.png' },
      { teamId: 'SEN', teamName: 'Senegal', countryLogo: 'https://flagcdn.com/w80/sn.png' },
    ],
  },
  {
    group: 'J',
    teams: [
      { teamId: 'ALG', teamName: 'Algeria', countryLogo: 'https://flagcdn.com/w80/dz.png' },
      { teamId: 'ARG', teamName: 'Argentina', countryLogo: 'https://flagcdn.com/w80/ar.png' },
      { teamId: 'AUT', teamName: 'Austria', countryLogo: 'https://flagcdn.com/w80/at.png' },
      { teamId: 'JOR', teamName: 'Jordan', countryLogo: 'https://flagcdn.com/w80/jo.png' },
    ],
  },
  {
    group: 'K',
    teams: [
      { teamId: 'COD', teamName: 'DR Congo', countryLogo: 'https://flagcdn.com/w80/cd.png' },
      { teamId: 'COL', teamName: 'Colombia', countryLogo: 'https://flagcdn.com/w80/co.png' },
      { teamId: 'POR', teamName: 'Portugal', countryLogo: 'https://flagcdn.com/w80/pt.png' },
      { teamId: 'UZB', teamName: 'Uzbekistan', countryLogo: 'https://flagcdn.com/w80/uz.png' },
    ],
  },
  {
    group: 'L',
    teams: [
      { teamId: 'CRO', teamName: 'Croatia', countryLogo: 'https://flagcdn.com/w80/hr.png' },
      { teamId: 'ENG', teamName: 'England', countryLogo: 'https://flagcdn.com/w80/gb-eng.png' },
      { teamId: 'GHA', teamName: 'Ghana', countryLogo: 'https://flagcdn.com/w80/gh.png' },
      { teamId: 'PAN', teamName: 'Panama', countryLogo: 'https://flagcdn.com/w80/pa.png' },
    ],
  },
];

export function allTournamentTeams(): Team[] {
  const byId = new Map<string, Team>();
  for (const g of TOURNAMENT_GROUPS) {
    for (const t of g.teams) {
      byId.set(t.teamId, t);
    }
  }
  return [...byId.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
}

export function emptyGroupChampions(): Record<string, string> {
  return Object.fromEntries(TOURNAMENT_GROUPS.map((g) => [g.group, '']));
}
