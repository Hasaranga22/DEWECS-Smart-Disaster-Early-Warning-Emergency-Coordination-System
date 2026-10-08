import type { Citizen } from '../domain';
import { DISTRICTS } from './districts';
import { seedId } from './ids';

const NAMES = [
  'Kasun Perera', 'Nadeesha Fernando', 'Ruwan Silva', 'Sachini Jayasinghe', 'Tharindu Bandara',
  'Dilani Wickramasinghe', 'Chamara Rathnayake', 'Ishara Gunawardena', 'Lahiru Senanayake', 'Menaka Dias',
  'Pasindu Herath', 'Hiruni Karunaratne', 'Supun Abeysekara', 'Thilini Amarasinghe', 'Dinesh Kumara',
  'Anushka Weerasinghe', 'Nuwan Pathirana', 'Sewwandi Liyanage', 'Gayan Madushanka', 'Rashmi De Silva',
  'Isuru Lakmal', 'Kavindi Ekanayake', 'Buddhika Jayawardena', 'Oshadi Samarasinghe', 'Janith Alwis',
  'Yasodha Ranasinghe', 'Charith Mendis', 'Piumi Hettiarachchi', 'Randika Gamage', 'Sanduni Peiris',
];

// Mix of reachability so partial-failure paths can be tested:
//  every 5th citizen has no push token (SMS only)
//  every 4th citizen (not already SMS-only) has no phone (push only)
export const CITIZENS: Citizen[] = NAMES.map((name, i) => {
  const n = i + 1;
  const smsOnly = i % 5 === 0;
  const pushOnly = i % 4 === 0 && !smsOnly;
  return {
    id: seedId(5, n),
    name,
    nationalId: `2001${String(n).padStart(8, '0')}`,
    phone: pushOnly ? undefined : `+9477${String(1000000 + n)}`,
    pushToken: smsOnly ? undefined : `push-token-${n}`,
    districtId: DISTRICTS[i % DISTRICTS.length].id,
    isVolunteer: i % 6 === 2,
  };
});