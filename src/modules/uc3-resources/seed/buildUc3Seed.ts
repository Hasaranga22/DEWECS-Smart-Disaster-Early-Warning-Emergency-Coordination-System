import { Shelter } from "../domain/entities/Shelter";
import { RescueTeam } from "../domain/entities/RescueTeam";
import { SupplyStock } from "../domain/entities/SupplyStock";

export interface BuildSeedOptions {
  districtsByName: Record<string, string>; // e.g. { Colombo: 'uuid-colombo', Gampaha: 'uuid-gampaha', Kegalle: 'uuid-kegalle' }
  organizationsByName: Record<string, string>; // e.g. { Government: 'uuid-gov', RedCross: 'uuid-ngo', ArmedForces: 'uuid-mil', PrivateDonor: 'uuid-priv' }
  idGenerator?: () => string;
}

export interface Uc3SeedData {
  shelters: Shelter[];
  teams: RescueTeam[];
  stocks: SupplyStock[];
}

export function buildUc3Seed(options: BuildSeedOptions): Uc3SeedData {
  const { districtsByName, organizationsByName } = options;
  const genId = options.idGenerator ?? (() => crypto.randomUUID());

  const colomboId = districtsByName.Colombo ?? "00000000-0000-4000-8000-000000000010";
  const gampahaId = districtsByName.Gampaha ?? "00000000-0000-4000-8000-000000000020";

  const govOrgId = organizationsByName.Government ?? "00000000-0000-4000-8000-000000000100";
  const ngoOrgId = organizationsByName.RedCross ?? "00000000-0000-4000-8000-000000000200";
  const milOrgId = organizationsByName.ArmedForces ?? "00000000-0000-4000-8000-000000000300";
  const privOrgId = organizationsByName.PrivateDonor ?? "00000000-0000-4000-8000-000000000400";

  // 4 Shelters (one nearly full: 380/400)
  const shelters: Shelter[] = [
    new Shelter({
      id: genId(),
      districtId: colomboId,
      organizationId: govOrgId,
      name: "Colombo Central Relief Center",
      address: "Main Street, Colombo 01",
      capacity: 400,
      occupancy: 380, // Nearly full (95%)
      version: 0,
    }),
    new Shelter({
      id: genId(),
      districtId: colomboId,
      organizationId: ngoOrgId,
      name: "Kelani River Secondary Shelter",
      address: "River Road, Kelaniya",
      capacity: 250,
      occupancy: 120,
      version: 0,
    }),
    new Shelter({
      id: genId(),
      districtId: colomboId,
      organizationId: govOrgId,
      name: "Colombo Municipal Community Hall",
      address: "Galle Road, Colombo 03",
      capacity: 300,
      occupancy: 50,
      version: 0,
    }),
    new Shelter({
      id: genId(),
      districtId: gampahaId,
      organizationId: milOrgId,
      name: "Gampaha Emergency Base Shelter",
      address: "Station Road, Gampaha",
      capacity: 500,
      occupancy: 150,
      version: 0,
    }),
  ];

  // 4 Rescue Teams (one per organization type, one in adjacent district Gampaha)
  const teams: RescueTeam[] = [
    new RescueTeam({
      id: genId(),
      districtId: colomboId,
      organizationId: govOrgId,
      name: "DMC Alpha Rapid Rescue",
      capability: "Flood Evacuation & Medical Support",
      status: "AVAILABLE",
      version: 0,
    }),
    new RescueTeam({
      id: genId(),
      districtId: colomboId,
      organizationId: ngoOrgId,
      name: "Red Cross First Response Team 1",
      capability: "First Aid & Community Relief",
      status: "AVAILABLE",
      version: 0,
    }),
    new RescueTeam({
      id: genId(),
      districtId: colomboId,
      organizationId: privOrgId,
      name: "Civil Volunteer Taskforce Colombo",
      capability: "Debris Clearing & Logistics",
      status: "AVAILABLE",
      version: 0,
    }),
    new RescueTeam({
      id: genId(),
      districtId: gampahaId, // Adjacent district team
      organizationId: milOrgId,
      name: "Armed Forces Air-Sea Rescue Unit 4",
      capability: "Heavy Helicopter Evacuation",
      status: "AVAILABLE",
      version: 0,
    }),
  ];

  // Supply Stock per organisation (Food, Water, Medicine, ShelterMaterial)
  const stocks: SupplyStock[] = [
    new SupplyStock({
      id: genId(),
      organizationId: govOrgId,
      districtId: colomboId,
      supplyType: "Food Rations (Packs)",
      onHand: 1500,
      version: 0,
    }),
    new SupplyStock({
      id: genId(),
      organizationId: govOrgId,
      districtId: colomboId,
      supplyType: "Clean Drinking Water (Liters)",
      onHand: 5000,
      version: 0,
    }),
    new SupplyStock({
      id: genId(),
      organizationId: ngoOrgId,
      districtId: colomboId,
      supplyType: "First Aid & Medicine Kits",
      onHand: 350,
      version: 0,
    }),
    new SupplyStock({
      id: genId(),
      organizationId: privOrgId,
      districtId: colomboId,
      supplyType: "Tarpaulins & Shelter Kits",
      onHand: 200,
      version: 0,
    }),
  ];

  return { shelters, teams, stocks };
}
