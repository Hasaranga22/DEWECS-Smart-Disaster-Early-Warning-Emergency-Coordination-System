import type { Citizen, RiverBasin } from '@/shared/domain';
import type { AlertTarget, NotificationChannel } from '../domain';

export interface ResolvedRecipient {
  citizen: Citizen;
  districtId: string;
  channels: NotificationChannel[];
}

export interface CitizenProvider {
  listAll(): Citizen[] | Promise<Citizen[]>;
}

export interface BasinProvider {
  getById(basinId: string): RiverBasin | null | Promise<RiverBasin | null>;
}

export class TargetResolver {
  constructor(
    private readonly citizenProvider: CitizenProvider,
    private readonly basinProvider: BasinProvider,
  ) {}

  /**
   * Resolves target districts and/or river basin to a deduplicated list of recipients
   * and their available delivery channels.
   */
  public async resolve(
    target: AlertTarget,
    excludeCitizenIds: Set<string> | string[] = new Set(),
  ): Promise<ResolvedRecipient[]> {
    const targetDistrictIds = new Set<string>();

    if (target.districtIds) {
      for (const id of target.districtIds) {
        if (id) targetDistrictIds.add(id);
      }
    }

    if (target.basinId) {
      const basin = await this.basinProvider.getById(target.basinId);
      if (basin) {
        for (const id of basin.districtIds) {
          if (id) targetDistrictIds.add(id);
        }
      }
    }

    if (targetDistrictIds.size === 0) {
      return [];
    }

    const allCitizens = await this.citizenProvider.listAll();
    const excludeSet = excludeCitizenIds instanceof Set ? excludeCitizenIds : new Set(excludeCitizenIds);

    const seenCitizenIds = new Set<string>();
    const recipients: ResolvedRecipient[] = [];

    for (const citizen of allCitizens) {
      if (!targetDistrictIds.has(citizen.districtId)) {
        continue;
      }
      if (seenCitizenIds.has(citizen.id) || excludeSet.has(citizen.id)) {
        continue;
      }

      seenCitizenIds.add(citizen.id);

      const channels: NotificationChannel[] = [];
      if (citizen.pushToken && citizen.pushToken.trim().length > 0) {
        channels.push('PUSH');
      }
      if (citizen.phone && citizen.phone.trim().length > 0) {
        channels.push('SMS');
      }

      recipients.push({
        citizen,
        districtId: citizen.districtId,
        channels,
      });
    }

    return recipients;
  }
}
