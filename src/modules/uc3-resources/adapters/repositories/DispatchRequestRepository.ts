import { DispatchRequest } from "../../domain/entities/DispatchRequest";

export interface DispatchRequestRepository {
  findById(id: string): Promise<DispatchRequest | null>;
  findUnassignedByDistrictId(districtId: string): Promise<DispatchRequest[]>;
  save(request: DispatchRequest): Promise<void>;
}
