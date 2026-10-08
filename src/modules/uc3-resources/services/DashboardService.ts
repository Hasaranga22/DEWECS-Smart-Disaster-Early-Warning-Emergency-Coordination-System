import { Actor, DistrictNotification } from "@/shared/contracts/types";
import { DistrictNotificationStore } from "@/shared/contracts/DistrictNotificationStore";
import { Shelter } from "../domain/entities/Shelter";
import { RescueTeam } from "../domain/entities/RescueTeam";
import { SupplyStock } from "../domain/entities/SupplyStock";
import { ConflictQueueItem } from "../domain/entities/ConflictQueueItem";
import { DispatchRequest } from "../domain/entities/DispatchRequest";
import { ShelterRepository } from "../adapters/repositories/ShelterRepository";
import { RescueTeamRepository } from "../adapters/repositories/RescueTeamRepository";
import { SupplyStockRepository } from "../adapters/repositories/SupplyStockRepository";
import { ConflictQueueRepository } from "../adapters/repositories/ConflictQueueRepository";
import { DispatchRequestRepository } from "../adapters/repositories/DispatchRequestRepository";
import { ResourceAccessPolicy } from "./ResourceAccessPolicy";
import { Clock } from "@/shared/contracts/Clock";

export interface StockByOrganization {
  organizationId: string;
  items: SupplyStock[];
}

export interface DashboardData {
  districtId: string;
  lastRefreshedAt: Date;
  shelters: Shelter[];
  teams: RescueTeam[];
  stockByOrganization: StockByOrganization[];
  openConflicts: ConflictQueueItem[];
  unassignedDispatchRequests: DispatchRequest[];
  preselectedFromAlert?: DistrictNotification;
}

export class DashboardService {
  constructor(
    private readonly shelterRepo: ShelterRepository,
    private readonly teamRepo: RescueTeamRepository,
    private readonly stockRepo: SupplyStockRepository,
    private readonly conflictRepo: ConflictQueueRepository,
    private readonly dispatchReqRepo: DispatchRequestRepository,
    private readonly notificationStore: DistrictNotificationStore,
    private readonly clock: Clock
  ) {}

  public async getDashboard(actor: Actor, districtId: string): Promise<DashboardData> {
    ResourceAccessPolicy.assertDistrictOfficerAccess(actor, districtId);

    const shelters = await this.shelterRepo.findByDistrictId(districtId);
    const teams = await this.teamRepo.findByDistrictId(districtId);
    const stocks = await this.stockRepo.findByDistrictId(districtId);
    const openConflicts = await this.conflictRepo.findOpenByDistrictId(districtId);
    const unassignedRequests = await this.dispatchReqRepo.findUnassignedByDistrictId(districtId);

    // Group supply stock by owning organization
    const orgMap = new Map<string, SupplyStock[]>();
    for (const stock of stocks) {
      if (!orgMap.has(stock.organizationId)) {
        orgMap.set(stock.organizationId, []);
      }
      orgMap.get(stock.organizationId)!.push(stock);
    }
    const stockByOrganization: StockByOrganization[] = Array.from(orgMap.entries()).map(([organizationId, items]) => ({
      organizationId,
      items,
    }));

    // Check preselection from escalated warning via DistrictNotificationStore (A1)
    const notifications = await this.notificationStore.listForDistrict(districtId);
    const preselectedAlert = notifications.find((n) => n.kind === "ESCALATED" || n.kind === "ISSUED");

    return {
      districtId,
      lastRefreshedAt: this.clock.now(),
      shelters,
      teams,
      stockByOrganization,
      openConflicts,
      unassignedDispatchRequests: unassignedRequests,
      preselectedFromAlert: preselectedAlert,
    };
  }
}
