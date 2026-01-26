export interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

export const teams: Record<string, TeamColors> = {
  'Dodgers': { primary: '#005A9C', secondary: '#EF3E42', accent: '#FFFFFF' },
  'Yankees': { primary: '#003087', secondary: '#132448', accent: '#C4CED4' },
  'Red Sox': { primary: '#BD3039', secondary: '#0C2340', accent: '#FFFFFF' },
  'Cubs': { primary: '#0E3386', secondary: '#CC3433', accent: '#FFFFFF' },
  'Giants': { primary: '#FD5A1E', secondary: '#27251F', accent: '#FFFFFF' },
  'Cardinals': { primary: '#C41E3A', secondary: '#0C2340', accent: '#FEDB00' },
  'Mets': { primary: '#002D72', secondary: '#FF5910', accent: '#FFFFFF' },
  'Braves': { primary: '#CE1141', secondary: '#13274F', accent: '#EAAA00' },
  'Astros': { primary: '#002D62', secondary: '#EB6E1F', accent: '#FFFFFF' },
  'Phillies': { primary: '#E81828', secondary: '#002D72', accent: '#FFFFFF' },
  'Padres': { primary: '#2F241D', secondary: '#FFC425', accent: '#FFFFFF' },
  'Mariners': { primary: '#0C2C56', secondary: '#005C5C', accent: '#C4CED4' },
  'Angels': { primary: '#BA0021', secondary: '#003263', accent: '#FFFFFF' },
  'White Sox': { primary: '#27251F', secondary: '#C4CED4', accent: '#FFFFFF' },
  'Rays': { primary: '#092C5C', secondary: '#8FBCE6', accent: '#F5D130' },
  'Blue Jays': { primary: '#134A8E', secondary: '#1D2D5C', accent: '#E8291C' },
  'Twins': { primary: '#002B5C', secondary: '#D31145', accent: '#FFFFFF' },
  'Tigers': { primary: '#0C2340', secondary: '#FA4616', accent: '#FFFFFF' },
  'Guardians': { primary: '#00385D', secondary: '#E50022', accent: '#FFFFFF' },
  'Royals': { primary: '#004687', secondary: '#BD9B60', accent: '#FFFFFF' },
  'Athletics': { primary: '#003831', secondary: '#EFB21E', accent: '#FFFFFF' },
  'Rangers': { primary: '#003278', secondary: '#C0111F', accent: '#FFFFFF' },
  'Orioles': { primary: '#DF4601', secondary: '#27251F', accent: '#FFFFFF' },
  'Nationals': { primary: '#AB0003', secondary: '#14225A', accent: '#FFFFFF' },
  'Marlins': { primary: '#00A3E0', secondary: '#EF3340', accent: '#000000' },
  'Brewers': { primary: '#12284B', secondary: '#B6922E', accent: '#FFFFFF' },
  'Reds': { primary: '#C6011F', secondary: '#000000', accent: '#FFFFFF' },
  'Pirates': { primary: '#27251F', secondary: '#FDB827', accent: '#FFFFFF' },
  'Rockies': { primary: '#33006F', secondary: '#C4CED4', accent: '#000000' },
  'Diamondbacks': { primary: '#A71930', secondary: '#E3D4AD', accent: '#000000' },
};

export const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH'] as const;

export type Position = typeof positions[number];

export interface PlayerStats {
  avg: string;
  hr: string;
  rbi: string;
  runs: string;
  sb: string;
  ops: string;
}

export const defaultStats: PlayerStats = {
  avg: '.312',
  hr: '28',
  rbi: '94',
  runs: '87',
  sb: '12',
  ops: '.921',
};
