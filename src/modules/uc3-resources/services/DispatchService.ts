import { Actor } from "@/shared/contracts/types";
import { RescueTeam } from "../domain/entities/RescueTeam";
import { TeamStatusEvent } from "../domain/entities/TeamStatusEvent";
import { DispatchRequest } from "../domain/entities/DispatchRequest";
import { RescueTeamRepository } from "../adapters/repositories/RescueTeamRepository";
import { TeamStatusEventRepository } from "../adapters/repositories/TeamStatusEventRepository";
import { DispatchRequestRepository } from "../adapters/repositories/DispatchRequestRepository";
import { PartnerNotifier } from "../adapters/ports/PartnerNotifier";
import { DistrictAdjacency } from "../adapters/ports/DistrictAdjacency";
import { DispatchRule } from "./rules/DispatchRule";
import { IdempotentCommandExecutor } from "./IdempotentCommandExecutor";
import { Clock } from "@/shared/contracts/Clock";
import { IdGenerator } from "@/shared/contracts/IdGenerator";
import { NotFoundError } from "@/shared/infra/errors";

export interface DispatchTeamCommand {
  actionId: string;
  actor: Actor;
  destinationDistrictId: string;
  teamId?: string;
  incident?: string;
  location: string;
  isConfirmed?: boolean;
}

export interface AdvanceTeamCommand {
  actor: Actor;
  teamId: string;
  targetStatus: "ON_SITE" | "RETURNING" | "AVAILABLE";
  incident?: string;
  location?: string;
}

export interface DispatchResult {
  team?: RescueTeam;
  request?: DispatchRequest;
}

export class DispatchService {
  constructor(
    private readonly teamRepo: RescueTeamRepository,
    private readonly eventRepo: TeamStatusEventRepository,
    private readonly requestRepo: DispatchRequestRepository,
    private readonly partnerNotifier: PartnerNotifier,
    private readonly adjacency: DistrictAdjacency,
    private readonly dispatchRules: DispatchRule[],
    private readonly executor: IdempotentCommandExecutor,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator
  ) {}

  public async dispatch(command: DispatchTeamCommand): Promise<DispatchResult> {
    return this.executor.executeCommand<DispatchResult>({
      actionId: command.actionId,
      actionType: "DISPATCH_RESCUE_TEAM",
      actor: command.actor,
      districtId: command.destinationDistrictId,
      execute: async () => {
        let teamToDispatch: RescueTeam | null = null;

        if (command.teamId) {
          teamToDispatch = await this.teamRepo.findById(command.teamId);
          if (!teamToDispatch) {
            throw new NotFoundError(`Rescue team '${command.teamId}' not found`);
          }
        } else {
          // Find available team in home district
          const homeTeams = await this.teamRepo.findByDistrictId(command.destinationDistrictId);
          teamToDispatch = homeTeams.find((t) => t.status === "AVAILABLE") ?? null;

          if (!teamToDispatch) {
            // Find available backup team in adjacent districts
            const backupTeams = await this.findBackupTeams(command.destinationDistrictId);
            if (backupTeams.length > 0) {
              teamToDispatch = backupTeams[0];
            }
          }
        }

        // Exception E2: If no team is available anywhere, record UNASSIGNED DispatchRequest
        if (!teamToDispatch) {
          const request = new DispatchRequest({
            id: this.idGen.next(),
            districtId: command.destinationDistrictId,
            incident: command.incident,
            location: command.location,
            requestedBy: command.actor.id,
            status: "UNASSIGNED",
            actionId: command.actionId,
            occurredAt: this.clock.now(),
          });
          await this.requestRepo.save(request);
          const result: DispatchResult = { request };
          return { result, resultRef: request.id };
        }

        // Validate state & rules (CrossOrganizationRule, CrossDistrictRule)
        this.dispatchRules.forEach((rule) => rule.validate(teamToDispatch!, command.destinationDistrictId, command.isConfirmed));

        // State transition AVAILABLE -> EN_ROUTE
        const dispatchedTeam = teamToDispatch.dispatch();

        // Record status event
        const statusEvent = new TeamStatusEvent({
          id: this.idGen.next(),
          teamId: dispatchedTeam.id,
          fromStatus: teamToDispatch.status,
          toStatus: dispatchedTeam.status,
          actorId: command.actor.id,
          occurredAt: this.clock.now(),
          incident: command.incident,
          location: command.location,
        });

        await this.teamRepo.save(dispatchedTeam);
        await this.eventRepo.save(statusEvent);

        // Notify owning organization coordinator
        await this.partnerNotifier.notifyPartnerDispatch({
          teamId: dispatchedTeam.id,
          teamName: dispatchedTeam.name,
          organizationId: dispatchedTeam.organizationId,
          destinationDistrictId: command.destinationDistrictId,
          incident: command.incident,
          actorId: command.actor.id,
          timestamp: this.clock.now(),
        });

        const result: DispatchResult = { team: dispatchedTeam };
        return { result, resultRef: dispatchedTeam.id };
      },
      onReplay: async (resultRef) => {
        if (resultRef) {
          const team = await this.teamRepo.findById(resultRef);
          if (team) return { team };
          const request = await this.requestRepo.findById(resultRef);
          if (request) return { request };
        }
        return {};
      },
    });
  }

  public async findBackupTeams(districtId: string): Promise<RescueTeam[]> {
    const adjacentDistrictIds = await this.adjacency.getAdjacentDistrictIds(districtId);
    const allTeams = await this.teamRepo.findAll();
    return allTeams.filter((t) => t.status === "AVAILABLE" && adjacentDistrictIds.includes(t.districtId));
  }

  public async advanceTeam(command: AdvanceTeamCommand): Promise<RescueTeam> {
    const team = await this.teamRepo.findById(command.teamId);
    if (!team) {
      throw new NotFoundError(`Rescue team '${command.teamId}' not found`);
    }

    let updatedTeam: RescueTeam;
    switch (command.targetStatus) {
      case "ON_SITE":
        updatedTeam = team.arrive();
        break;
      case "RETURNING":
        updatedTeam = team.startReturn();
        break;
      case "AVAILABLE":
        updatedTeam = team.completeReturn();
        break;
    }

    const event = new TeamStatusEvent({
      id: this.idGen.next(),
      teamId: team.id,
      fromStatus: team.status,
      toStatus: updatedTeam.status,
      actorId: command.actor.id,
      occurredAt: this.clock.now(),
      incident: command.incident,
      location: command.location,
    });

    await this.teamRepo.save(updatedTeam);
    await this.eventRepo.save(event);

    return updatedTeam;
  }
}
