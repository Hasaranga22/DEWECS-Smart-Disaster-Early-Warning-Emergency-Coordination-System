import { Actor } from "@/shared/contracts/types";
import { Shelter } from "../domain/entities/Shelter";
import { OccupancyEvent } from "../domain/entities/OccupancyEvent";
import { ShelterRepository } from "../adapters/repositories/ShelterRepository";
import { OccupancyEventRepository } from "../adapters/repositories/OccupancyEventRepository";
import { ConflictQueue } from "./ConflictQueue";
import { IdempotentCommandExecutor } from "./IdempotentCommandExecutor";
import { Clock } from "@/shared/contracts/Clock";
import { IdGenerator } from "@/shared/contracts/IdGenerator";
import { NotFoundError, VersionConflictError } from "@/shared/infra/errors";

export interface RegisterShelterCommand {
  actor: Actor;
  districtId: string;
  organizationId: string;
  name: string;
  address: string;
  capacity: number;
  latitude?: number;
  longitude?: number;
}

export interface UpdateOccupancyCommand {
  actionId: string;
  actor: Actor;
  shelterId: string;
  expectedVersion: number;
  newCount: number;
}

export class ShelterService {
  constructor(
    private readonly shelterRepo: ShelterRepository,
    private readonly eventRepo: OccupancyEventRepository,
    private readonly conflictQueue: ConflictQueue,
    private readonly executor: IdempotentCommandExecutor,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator
  ) {}

  public async registerShelter(command: RegisterShelterCommand): Promise<Shelter> {
    const shelter = new Shelter({
      id: this.idGen.next(),
      districtId: command.districtId,
      organizationId: command.organizationId,
      name: command.name,
      address: command.address,
      capacity: command.capacity,
      occupancy: 0,
      version: 0,
      latitude: command.latitude,
      longitude: command.longitude,
    });

    await this.shelterRepo.save(shelter);
    return shelter;
  }

  public async updateOccupancy(command: UpdateOccupancyCommand): Promise<Shelter> {
    const targetShelter = await this.shelterRepo.findById(command.shelterId);
    if (!targetShelter) {
      throw new NotFoundError(`Shelter '${command.shelterId}' not found`);
    }

    return this.executor.executeCommand({
      actionId: command.actionId,
      actionType: "UPDATE_SHELTER_OCCUPANCY",
      actor: command.actor,
      districtId: targetShelter.districtId,
      execute: async () => {
        // Optimistic locking version check
        if (targetShelter.version !== command.expectedVersion) {
          await this.conflictQueue.enqueue(
            "UPDATE_SHELTER_OCCUPANCY",
            {
              actionId: command.actionId,
              shelterId: command.shelterId,
              districtId: targetShelter.districtId,
              newCount: command.newCount,
            },
            command.expectedVersion,
            targetShelter.version
          );
          throw new VersionConflictError(
            `Shelter version mismatch: expected ${command.expectedVersion}, actual ${targetShelter.version}`
          );
        }

        // Fetch alternative open shelters for OverCapacityError payload
        const districtShelters = await this.shelterRepo.findByDistrictId(targetShelter.districtId);
        const alternatives = districtShelters
          .filter((s) => s.id !== targetShelter.id && s.status === "OPEN")
          .map((s) => ({ id: s.id, name: s.name, availableCapacity: s.availableCapacity }));

        // Update occupancy on entity (throws OverCapacityError if newCount > capacity)
        const updatedShelter = targetShelter.withOccupancy(command.newCount, alternatives);

        // Record OccupancyEvent
        const event = new OccupancyEvent({
          id: this.idGen.next(),
          shelterId: targetShelter.id,
          districtId: targetShelter.districtId,
          previousCount: targetShelter.occupancy,
          newCount: updatedShelter.occupancy,
          actorId: command.actor.id,
          occurredAt: this.clock.now(),
          actionId: command.actionId,
        });

        await this.shelterRepo.save(updatedShelter);
        await this.eventRepo.save(event);

        return { result: updatedShelter, resultRef: updatedShelter.id };
      },
      onReplay: async () => {
        const current = await this.shelterRepo.findById(command.shelterId);
        return current ?? targetShelter;
      },
    });
  }
}
