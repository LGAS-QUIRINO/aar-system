// Reference data. Mirrors seedData_() in backend/Code.gs.
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Official barangay lists (PSA PSGC names). Only Maddela is loaded for now.
export const OFFICIAL_BARANGAYS = {
  'lgu-maddela': ['Abbag', 'Balligui', 'Buenavista', 'Cabaruan', 'Cabua-an', 'Cofcaville', 'Diduyon', 'Dipintin', 'Divisoria Norte', 'Divisoria Sur',
    'Dumabato Norte', 'Dumabato Sur', 'Jose Ancheta', 'Lusod', 'Manglad', 'Pedlisan', 'Poblacion Norte', 'Poblacion Sur', 'San Bernabe',
    'San Dionisio I', 'San Martin', 'San Pedro', 'San Salvador', 'Sta. Maria', 'Sto. Niño', 'Sto. Tomas', 'Villa Agullana', 'Villa Gracia',
    'Villa Norte', 'Villa Sur', 'Villa Ylanan', 'Ysmael']
};

export function seedData() {
  const teams = [
    { id: 'team-1', name: 'Team 1', officeCode: '', atlUserId: '', saUserId: '', history: [] },
    { id: 'team-2', name: 'Team 2', officeCode: 'R2-02', atlUserId: '', saUserId: '', history: [] }
  ];
  const lgus = [{ id: 'lgu-quirino', kind: 'province', name: 'Quirino', parentId: '', teamId: 'team-1', active: true, loaded: true, funds: [] }];
  [['Aglipay', 'team-2'], ['Cabarroguis', 'team-2'], ['Diffun', 'team-1'], ['Maddela', 'team-2'], ['Nagtipunan', 'team-2'], ['Saguday', 'team-2']]
    .forEach(([n, t]) => lgus.push({ id: 'lgu-' + slug(n), kind: 'municipality', name: n, parentId: 'lgu-quirino', teamId: t, active: true, loaded: n === 'Maddela', funds: [] }));
  OFFICIAL_BARANGAYS['lgu-maddela'].forEach((b, i) => lgus.push({
    id: 'brgy-maddela-' + slug(b), kind: 'barangay', name: b, parentId: 'lgu-maddela', teamId: 'team-2', active: true,
    code: 'BRGY-' + String(i + 1).padStart(3, '0'), funds: ['GF', 'BDRRMF'], lastOfficials: null
  }));
  return { teams, lgus };
}

// Demo users (Demo Mode only)
export const DEMO_USERS = [
  { id: 'user-cess', email: 'cess@demo.local', name: 'PRINCESS CHARLENE G. LACADEN', nickname: 'Cess', position: 'State Auditor I', designation: '', roles: ['member', 'admin'], teamIds: ['team-2'], status: 'active' },
  { id: 'user-gringo', email: 'gringo@demo.local', name: 'GRINGO A. BARROGA', position: 'State Auditor III', designation: 'OIC-Audit Team Leader', roles: ['atl'], teamIds: ['team-2'], status: 'active' },
  { id: 'user-masangcay', email: 'masangcay@demo.local', name: 'ATTY. FREDERICK P. MASANGCAY', position: 'State Auditor IV', designation: 'OIC-Supervising Auditor', roles: ['sa'], teamIds: ['team-1', 'team-2'], status: 'active' }
];
