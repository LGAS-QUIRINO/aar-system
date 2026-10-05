// Reference data. Mirrors seedData_() in backend/Code.gs.
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Official barangay lists (PSA PSGC names). Only Maddela is loaded for now.
// Names used before the PSA list, renamed to the PSA spelling by "Add Barangays from Official List" (the record and its history stay).
export const OLD_NAMES = { 'lgu-maddela': { 'Sta. Maria': 'Santa Maria', 'Sto. Niño': 'Santo Niño', 'Sto. Tomas': 'Santo Tomas', 'Villa Norte': 'Villa Hermosa Norte', 'Villa Sur': 'Villa Hermosa Sur', 'Villa Ylanan': 'Villa Jose V Ylanan' } };
export const OFFICIAL_BARANGAYS = {
  // Every municipality of Quirino, as in the PSA Philippine Standard Geographic Code (PSGC).
  'lgu-maddela': ['Abbag', 'Balligui', 'Buenavista', 'Cabaruan', 'Cabua-an', 'Cofcaville', 'Diduyon', 'Dipintin', 'Divisoria Norte', 'Divisoria Sur',
    'Dumabato Norte', 'Dumabato Sur', 'Jose Ancheta', 'Lusod', 'Manglad', 'Pedlisan', 'Poblacion Norte', 'Poblacion Sur', 'San Bernabe',
    'San Dionisio I', 'San Martin', 'San Pedro', 'San Salvador', 'Santa Maria', 'Santo Niño', 'Santo Tomas', 'Villa Agullana', 'Villa Gracia',
    'Villa Hermosa Norte', 'Villa Hermosa Sur', 'Villa Jose V Ylanan', 'Ysmael'],
  'lgu-aglipay': ['Alicia', 'Cabugao', 'Dagupan', 'Diodol', 'Dumabel', 'Dungo', 'Guinalbin', 'Ligaya', 'Nagabgaban', 'Palacian', 'Pinaripad Norte', 'Pinaripad Sur',
    'Progreso', 'Ramos', 'Rang-ayan', 'San Antonio', 'San Benigno', 'San Francisco', 'San Leonardo', 'San Manuel', 'San Ramon', 'Victoria', 'Villa Pagaduan',
    'Villa Santiago', 'Villa Ventura'],
  'lgu-cabarroguis': ['Banuar', 'Burgos', 'Calaocan', 'Del Pilar', 'Dibibi', 'Dingasan', 'Eden', 'Gomez', 'Gundaway', 'Mangandingay', 'San Marcos', 'Santo Domingo',
    'Tucod', 'Villa Peña', 'Villamor', 'Villarose', 'Zamora'],
  'lgu-diffun': ['Aklan Village', 'Andres Bonifacio', 'Aurora East', 'Aurora West', 'Baguio Village', 'Balagbag', 'Bannawag', 'Cajel', 'Campamento', 'Diego Silang',
    'Don Faustino Pagaduan', 'Don Mariano Perez Sr.', 'Doña Imelda', 'Dumanisi', 'Gabriela Silang', 'Gregorio Pimentel', 'Gulac', 'Guribang', 'Ifugao Village',
    'Isidro Paredes', 'Liwayway', 'Luttuad', 'Magsaysay', 'Makate', 'Maria Clara', 'Rafael Palma', 'Ricarte Norte', 'Ricarte Sur', 'Rizal', 'San Antonio',
    'San Isidro', 'San Pascual', 'Villa Pascua'],
  'lgu-nagtipunan': ['Anak', 'Asaklat', 'Dipantan', 'Dissimungal', 'Guino', 'La Conwap', 'Landingan', 'Mataddi', 'Matmad', 'Old Gumiad', 'Ponggo', 'San Dionisio II',
    'San Pugo', 'San Ramos', 'Sangbay', 'Wasid'],
  'lgu-saguday': ['Cardenas', 'Dibul', 'Gamis', 'La Paz', 'Magsaysay', 'Rizal', 'Salvacion', 'Santo Tomas', 'Tres Reyes']
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
