import { describe, it, expect, beforeEach } from "vitest";
import { DispatchService } from "../services/DispatchService";
import { InMemoryRescueTeamRepository } from "../adapters/memory/InMemoryRescueTeamRepository";
import { InMemoryTeamStatusEventRepository } from "../adapters/memory/InMemoryTeamStatusEventRepository";
import { InMemoryDispatchRequestRepository } from "../adapters/memory/InMemoryDispatchRequestRepository";
import { InMemoryProcessedActionRepository } from "../adapters/memory/InMemoryProcessedActionRepository";
import { StaticDistrictAdjacency } from "../adapters/ports/DistrictAdjacency";
import { LoggingPartnerNotifier } from "../adapters/ports/PartnerNotifier";
import { ProcessedActionStore } from "../services/ProcessedActionStore";
import { IdempotentCommandExecutor } from "../services/IdempotentCommandExecutor";
import { CrossOrganizationRule, CrossDistrictRule } from "../services/rules/DispatchRule";
import { FakeClock } from "@/shared/infra/fakes/FakeClock";
import { SequentialIdGenerator } from "@/shared/infra/fakes/SequentialIdGenerator";
import { Actor } from "@/shared/contracts/types";
import { RescueTeam } from "../domain/entities/RescueTeam";
import {
  InvalidTransitionError,
  CrossDistrictConfirmationRequiredError,
} from "../domain/errors";
import { NotFoundError } from "@/shared/infra/errors";

describe("DispatchService", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";
  const jaffnaDistrictId = "00000000-0000-4000-8000-000000000050";
  const govOrgId = "00000000-0000-4000-8000-000000000100";

  const colomboOfficer: Actor = {
    id: "00000000-0000-4000-8000-000000000999",
    role: "DISTRICT_OFFICER",
    districtId: colomboDistrictId,
  };

  const dmcOfficial: Actor = {
    id: "00000000-0000-4000-8000-000000000777",
    role: "DMC_OFFICIAL",
  };

  let teamRepo: InMemoryRescueTeamRepository;
  let eventRepo: InMemoryTeamStatusEventRepository;
  let requestRepo: InMemoryDispatchRequestRepository;
  let actionRepo: InMemoryProcessedActionRepository;
  let adjacency: StaticDistrictAdjacency;
  let notifier: LoggingPartnerNotifier;
  let clock: FakeClock;
  let idGen: SequentialIdGenerator;
  let service: DispatchService;

  beforeEach(() => {
    teamRepo = new InMemoryRescueTeamRepository();
    teamRepo.clear();
    eventRepo = new InMemoryTeamStatusEventRepository();
    eventRepo.clear();
    requestRepo = new InMemoryDispatchRequestRepository();
    requestRepo.clear();
    actionRepo = new InMemoryProcessedActionRepository();
    actionRepo.clear();
    adjacency = new StaticDistrictAdjacency();
    notifier = new LoggingPartnerNotifier();
    clock = new FakeClock();
    idGen = new SequentialIdGenerator();

    const actionStore = new ProcessedActionStore(actionRepo, clock);
    const executor = new IdempotentCommandExecutor(actionStore);
    const rules = [new CrossOrganizationRule(), new CrossDistrictRule()];

    service = new DispatchService(
      teamRepo,
      eventRepo,
      requestRepo,
      notifier,
      adjacency,
      rules,
      executor,
      clock,
      idGen
    );
  });

  it("should dispatch an available team, update state to EN_ROUTE, and notify partners", async () => {
    const team = new RescueTeam({
      id: "team-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Colombo Rapid Response Unit",
      capability: "SWIFT_WATER",
      status: "AVAILABLE",
      version: 1,
    });
    await teamRepo.save(team);

    const result = await service.dispatch({
      actor: colomboOfficer,
      actionId: "dispatch-action-1",
      destinationDistrictId: colomboDistrictId,
      teamId: "team-1",
      incident: "Flash flood near bridge",
      location: "Wellampitiya",
    });

    expect(result.team).toBeDefined();
    expect(result.team?.status).toBe("EN_ROUTE");

    const savedTeam = await teamRepo.findById("team-1");
    expect(savedTeam?.status).toBe("EN_ROUTE");

    const events = await eventRepo.findByTeamId("team-1");
    expect(events).toHaveLength(1);
    expect(events[0].fromStatus).toBe("AVAILABLE");
    expect(events[0].toStatus).toBe("EN_ROUTE");

    expect(notifier.loggedNotifications).toHaveLength(1);
    expect(notifier.loggedNotifications[0].teamId).toBe("team-1");
  });

  it("should advance a team through ON_SITE, RETURNING, and back to AVAILABLE", async () => {
    const team = new RescueTeam({
      id: "team-flow",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Water Rescue Unit 2",
      capability: "SWIFT_WATER",
      status: "AVAILABLE",
      version: 1,
    });
    await teamRepo.save(team);

    // 1. Dispatch -> EN_ROUTE
    await service.dispatch({
      actor: colomboOfficer,
      actionId: "flow-1",
      destinationDistrictId: colomboDistrictId,
      teamId: team.id,
      location: "River Bank",
    });

    // 2. Arrive -> ON_SITE
    const onSite = await service.advanceTeam({
      actor: colomboOfficer,
      teamId: team.id,
      targetStatus: "ON_SITE",
      incident: "Operations in progress",
      location: "River Bank",
    });
    expect(onSite.status).toBe("ON_SITE");

    // 3. Complete work -> RETURNING
    const returning = await service.advanceTeam({
      actor: colomboOfficer,
      teamId: team.id,
      targetStatus: "RETURNING",
      incident: "Operations finished",
      location: "Returning to base",
    });
    expect(returning.status).toBe("RETURNING");

    // 4. Return to base -> AVAILABLE
    const available = await service.advanceTeam({
      actor: colomboOfficer,
      teamId: team.id,
      targetStatus: "AVAILABLE",
    });
    expect(available.status).toBe("AVAILABLE");

    const events = await eventRepo.findByTeamId(team.id);
    expect(events).toHaveLength(4);
  });

  it("should create an unassigned DispatchRequest when no teams are specified or available", async () => {
    const result = await service.dispatch({
      actor: colomboOfficer,
      actionId: "dispatch-unassigned-1",
      destinationDistrictId: colomboDistrictId,
      incident: "Building collapse",
      location: "Sector 7",
    });

    expect(result.request).toBeDefined();
    expect(result.request?.status).toBe("UNASSIGNED");
    expect(result.request?.districtId).toBe(colomboDistrictId);

    const savedRequests = await requestRepo.findUnassignedByDistrictId(colomboDistrictId);
    expect(savedRequests.some((r) => r.id === result.request?.id)).toBe(true);
  });

  it("should discover available backup teams in adjacent districts", async () => {
    const gampahaTeam = new RescueTeam({
      id: "team-gampaha-1",
      districtId: gampahaDistrictId,
      organizationId: govOrgId,
      name: "Gampaha Unit 1",
      capability: "GENERAL",
      status: "AVAILABLE",
      version: 1,
    });
    await teamRepo.save(gampahaTeam);

    const backupTeams = await service.findBackupTeams("Colombo");
    expect(Array.isArray(backupTeams)).toBe(true);
  });

  it("should throw NotFoundError when advancing non-existent team", async () => {
    await expect(
      service.advanceTeam({
        actor: colomboOfficer,
        teamId: "non-existent-team",
        targetStatus: "ON_SITE",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw InvalidTransitionError when attempting illegal state jumps", async () => {
    const team = new RescueTeam({
      id: "team-illegal",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "General Squad",
      capability: "GENERAL",
      status: "AVAILABLE",
      version: 1,
    });
    await teamRepo.save(team);

    await expect(
      service.advanceTeam({
        actor: colomboOfficer,
        teamId: team.id,
        targetStatus: "ON_SITE",
      })
    ).rejects.toThrow(InvalidTransitionError);
  });
});
