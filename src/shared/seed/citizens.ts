import type { Citizen } from '../domain';
import { D } from './districts';
import { seedId } from './ids';

const ORIGINAL_6_DISTRICTS = [
  D.COLOMBO,
  D.GAMPAHA,
  D.KEGALLE,
  D.KANDY,
  D.GALLE,
  D.RATNAPURA,
];

const NAMES = [
  'Kasun Perera', 'Nadeesha Fernando', 'Ruwan Silva', 'Sachini Jayasinghe', 'Tharindu Bandara',
  'Dilani Wickramasinghe', 'Chamara Rathnayake', 'Ishara Gunawardena', 'Lahiru Senanayake', 'Menaka Dias',
  'Pasindu Herath', 'Hiruni Karunaratne', 'Supun Abeysekara', 'Thilini Amarasinghe', 'Dinesh Kumara',
  'Anushka Weerasinghe', 'Nuwan Pathirana', 'Sewwandi Liyanage', 'Gayan Madushanka', 'Rashmi De Silva',
  'Isuru Lakmal', 'Kavindi Ekanayake', 'Buddhika Jayawardena', 'Oshadi Samarasinghe', 'Janith Alwis',
  'Yasodha Ranasinghe', 'Charith Mendis', 'Piumi Hettiarachchi', 'Randika Gamage', 'Sanduni Peiris',
];

const NEW_DISTRICT_CITIZENS: Array<{ name: string; districtId: string }> = [
  { name: 'Mahesh Samarawickrama', districtId: D.KALUTARA },
  { name: 'Kumudu Jayawardene', districtId: D.MATALE },
  { name: 'Praveen Rajaratnam', districtId: D.NUWARA_ELIYA },
  { name: 'Sandamali Jayakodi', districtId: D.MATARA },
  { name: 'Ravindu Wijeratne', districtId: D.HAMBANTOTA },
  { name: 'Kandasamy Sivakumar', districtId: D.JAFFNA },
  { name: 'Vithusha Selvarajah', districtId: D.KILINOCHCHI },
  { name: 'Manoj Balachandran', districtId: D.MANNAR },
  { name: 'Tharika Gunasekara', districtId: D.VAVUNIYA },
  { name: 'Sinnathamby Pathmanathan', districtId: D.MULLAITIVU },
  { name: 'Arshad Mohamed', districtId: D.BATTICALOA },
  { name: 'Fathima Rameeza', districtId: D.AMPARA },
  { name: 'Suresh Sivalingam', districtId: D.TRINCOMALEE },
  { name: 'Chaminda Dissanayake', districtId: D.KURUNEGALA },
  { name: 'Harsha Jayatillake', districtId: D.PUTTALAM },
  { name: 'Niroshan Bandara', districtId: D.ANURADHAPURA },
  { name: 'Lalith Wickramasinghe', districtId: D.POLONNARUWA },
  { name: 'Thushari Kaluarachchi', districtId: D.BADULLA },
  { name: 'Gimhani Ranasinghe', districtId: D.MONARAGALA },
];

// First 30 citizens keep exact original assignments
const INITIAL_CITIZENS: Citizen[] = NAMES.map((name, i) => {
  const n = i + 1;
  const smsOnly = i % 5 === 0;
  const pushOnly = i % 4 === 0 && !smsOnly;
  return {
    id: seedId(5, n),
    name,
    nationalId: `2001${String(n).padStart(8, '0')}`,
    phone: pushOnly ? undefined : `+9477${String(1000000 + n)}`,
    pushToken: smsOnly ? undefined : `push-token-${n}`,
    districtId: ORIGINAL_6_DISTRICTS[i % 6],
    isVolunteer: i % 6 === 2,
  };
});

// Appended citizens for newly introduced districts
const APPENDED_CITIZENS: Citizen[] = NEW_DISTRICT_CITIZENS.map((entry, idx) => {
  const n = 31 + idx;
  const smsOnly = idx % 5 === 0;
  const pushOnly = idx % 4 === 0 && !smsOnly;
  return {
    id: seedId(5, n),
    name: entry.name,
    nationalId: `2001${String(n).padStart(8, '0')}`,
    phone: pushOnly ? undefined : `+9477${String(1000000 + n)}`,
    pushToken: smsOnly ? undefined : `push-token-${n}`,
    districtId: entry.districtId,
    isVolunteer: idx % 3 === 0,
  };
});

export const CITIZENS: Citizen[] = [...INITIAL_CITIZENS, ...APPENDED_CITIZENS];