import type { Language } from './ReportFilters'

export interface ReportLabels {
  title: string
  period: string
  generated: string
  sourceCutoff: string
  alerts: string
  reach: string
  distinctCitizens: string
  perChannel: string
  reports: string
  verified: string
  rejected: string
  pending: string
  shelters: string
  supplies: string
  percent: string
  noActivity: string
}

export const LABELS: Record<Language, ReportLabels> = {
  EN: {
    title: 'Post-Event Analysis Report',
    period: 'Reporting Period',
    generated: 'Generated',
    sourceCutoff: 'Source Cutoff',
    alerts: 'Alerts',
    reach: 'Reach',
    distinctCitizens: 'Distinct Citizens Reached',
    perChannel: 'Per Channel',
    reports: 'Ground Reports',
    verified: 'Verified',
    rejected: 'Rejected',
    pending: 'Pending',
    shelters: 'Shelters',
    supplies: 'Relief Supplies',
    percent: 'Percent',
    noActivity: 'No activity recorded for this period.',
  },
  SI: {
    title: 'සිද්ධියෙන් පසු විශ්ලේෂණ වාර්තාව',
    period: 'වාර්තාකරණ කාලය',
    generated: 'ජනනය කළ දිනය',
    sourceCutoff: 'මූලාශ්‍ර සීමාව',
    alerts: 'අනතුරු ඇඟවීම්',
    reach: 'ආවරණය',
    distinctCitizens: 'ආවරණයට පත් වූ වෙනස් පුරවැසියන්',
    perChannel: 'නාලිකා අනුව',
    reports: 'භූමි වාර්තා',
    verified: 'සත්‍යාපිතයි',
    rejected: 'ප්‍රතික්ෂේපිතයි',
    pending: 'බලාපොරොත්තුවෙන් පවතී',
    shelters: 'සරණාගත මධ්‍යස්ථාන',
    supplies: 'සැපයුම්',
    percent: 'ප්‍රතිශතය',
    noActivity: 'මෙම කාල සීමාව තුළ ක්‍රියාකාරකම් වාර්තා වී නැත.',
  },
  TA: {
    title: 'நிகழ்வுக்குப்பிந்தைய பகுப்பாய்வு அறிக்கை',
    period: 'அறிக்கைக் காலம்',
    generated: 'உருவாக்கிய நாள்',
    sourceCutoff: 'மூலத் தரவு வெட்டுப்புள்ளி',
    alerts: 'எச்சரிக்கைகள்',
    reach: 'சென்றடைவு',
    distinctCitizens: 'சென்றடைந்த தனித்த குடிமக்கள்',
    perChannel: 'சேனல்வாரியாக',
    reports: 'நில அறிக்கைகள்',
    verified: 'சரிபார்க்கப்பட்டவை',
    rejected: 'நிராகரிக்கப்பட்டவை',
    pending: 'நிலுவையில் உள்ளவை',
    shelters: 'தங்குமிடங்கள்',
    supplies: 'நிவாரணப் பொருட்கள்',
    percent: 'சதவீதம்',
    noActivity: 'இந்தக் காலகட்டத்தில் எந்தச் செயல்பாடும் பதிவுசெய்யப்படவில்லை.',
  },
}
