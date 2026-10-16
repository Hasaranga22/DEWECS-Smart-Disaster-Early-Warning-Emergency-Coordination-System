export interface Citizen {
  id: string;
  name: string;
  nationalId?: string;
  phone?: string;
  pushToken?: string;
  address?: string;
  districtId: string;
  isVolunteer: boolean;
}