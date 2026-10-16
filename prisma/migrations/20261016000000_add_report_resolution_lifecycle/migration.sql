-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OfficerRole" AS ENUM ('DUTY_OFFICER', 'DMC_OFFICIAL', 'DISTRICT_OFFICER');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('GOVERNMENT', 'ARMED_FORCES', 'NGO', 'PRIVATE_DONOR');

-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ESCALATED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ISSUE', 'ESCALATION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "DistrictNotificationKind" AS ENUM ('ISSUED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MANUAL_PIN');

-- CreateEnum
CREATE TYPE "ReportConfidence" AS ENUM ('FULL', 'REDUCED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'NEEDS_INFO', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SeverityIndication" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentMapStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('VERIFIED', 'REJECTED', 'NEEDS_INFO', 'CLARIFIED', 'RESOLVED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "ShelterStatus" AS ENUM ('OPEN', 'FULL');

-- CreateEnum
CREATE TYPE "RescueTeamStatus" AS ENUM ('AVAILABLE', 'EN_ROUTE', 'ON_SITE', 'RETURNING');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DispatchRequestStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "district" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "district_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "river_basin" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "river_basin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "basin_district" (
    "basin_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,

    CONSTRAINT "basin_district_pkey" PRIMARY KEY ("basin_id","district_id")
);

-- CreateTable
CREATE TABLE "citizen" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "national_id" VARCHAR(20),
    "phone" VARCHAR(20),
    "push_token" TEXT,
    "address" TEXT,
    "district_id" UUID,
    "is_volunteer" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "citizen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "role" "OfficerRole" NOT NULL,
    "district_id" UUID,
    "phone" VARCHAR(20),
    "email" VARCHAR(150),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "officer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "coordinator_name" VARCHAR(150),
    "coordinator_phone" VARCHAR(20),
    "coordinator_email" VARCHAR(150),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_alert" (
    "id" UUID NOT NULL,
    "title" VARCHAR(80),
    "hazard_type" "HazardType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "issued_by" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hazard_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_target_district" (
    "alert_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,

    CONSTRAINT "alert_target_district_pkey" PRIMARY KEY ("alert_id","district_id")
);

-- CreateTable
CREATE TABLE "alert_target_basin" (
    "alert_id" UUID NOT NULL,
    "basin_id" UUID NOT NULL,

    CONSTRAINT "alert_target_basin_pkey" PRIMARY KEY ("alert_id","basin_id")
);

-- CreateTable
CREATE TABLE "alert_escalation" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "from_severity" "AlertSeverity" NOT NULL,
    "to_severity" "AlertSeverity" NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "by_officer_id" UUID NOT NULL,
    "reason" TEXT,

    CONSTRAINT "alert_escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_attempt" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "citizen_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "hazard_type" "HazardType" NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "failure_reason" TEXT,

    CONSTRAINT "notification_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "district_notification" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "kind" "DistrictNotificationKind" NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "district_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ground_report" (
    "id" UUID NOT NULL,
    "local_id" VARCHAR(100) NOT NULL,
    "reporter_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "hazard_type" "HazardType" NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "location_source" "LocationSource" NOT NULL,
    "gps_accuracy_m" DECIMAL(8,2),
    "photo" TEXT,
    "confidence" "ReportConfidence" NOT NULL,
    "review_status" "ReviewStatus" NOT NULL,
    "severity_indication" "SeverityIndication",
    "map_status" "IncidentMapStatus" NOT NULL DEFAULT 'ACTIVE',
    "map_visible_until" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_officer_id" UUID,
    "linked_to_report_id" UUID,
    "capture_time" TIMESTAMPTZ NOT NULL,
    "sync_time" TIMESTAMPTZ,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ground_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_audit_entry" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "officer_id" UUID,
    "reason" TEXT,
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "district_id" UUID NOT NULL,
    "hazard_type" "HazardType" NOT NULL,

    CONSTRAINT "report_audit_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelter" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "capacity" INTEGER NOT NULL,
    "occupancy" INTEGER NOT NULL,
    "status" "ShelterStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shelter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rescue_team" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "capability" TEXT NOT NULL,
    "status" "RescueTeamStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "current_latitude" DECIMAL(9,6),
    "current_longitude" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rescue_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_stock" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "supply_type" VARCHAR(100) NOT NULL,
    "on_hand" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supply_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupancy_event" (
    "id" UUID NOT NULL,
    "shelter_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "previous_count" INTEGER NOT NULL,
    "new_count" INTEGER NOT NULL,
    "actor_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "action_id" VARCHAR(100) NOT NULL,

    CONSTRAINT "occupancy_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution" (
    "id" UUID NOT NULL,
    "stock_id" UUID NOT NULL,
    "destination_shelter_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "actor_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "action_id" VARCHAR(100) NOT NULL,

    CONSTRAINT "distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_status_event" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "from_status" "RescueTeamStatus" NOT NULL,
    "to_status" "RescueTeamStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "incident" TEXT,
    "location" TEXT,

    CONSTRAINT "team_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_action" (
    "action_id" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "result_ref" VARCHAR(100),
    "processed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "processed_action_pkey" PRIMARY KEY ("action_id")
);

-- CreateTable
CREATE TABLE "conflict_queue_item" (
    "id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "actual_version" INTEGER NOT NULL,
    "status" "ConflictStatus" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by" UUID,

    CONSTRAINT "conflict_queue_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_request" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "incident" TEXT,
    "location" TEXT NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" "DispatchRequestStatus" NOT NULL,
    "team_id" UUID,
    "action_id" VARCHAR(100) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dispatch_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_report" (
    "id" UUID NOT NULL,
    "filters" JSONB NOT NULL,
    "source_cutoff" TIMESTAMPTZ NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL,
    "metrics" JSONB NOT NULL,
    "warning_flag" BOOLEAN NOT NULL DEFAULT false,
    "generated_by" UUID NOT NULL,

    CONSTRAINT "analysis_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_share" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "ShareStatus" NOT NULL,
    "attempted_at" TIMESTAMPTZ NOT NULL,
    "actor_id" UUID NOT NULL,
    "failure_reason" TEXT,

    CONSTRAINT "report_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "district_name_key" ON "district"("name");

-- CreateIndex
CREATE UNIQUE INDEX "river_basin_name_key" ON "river_basin"("name");

-- CreateIndex
CREATE UNIQUE INDEX "citizen_national_id_key" ON "citizen"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_name_key" ON "organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ground_report_local_id_key" ON "ground_report"("local_id");

-- CreateIndex
CREATE INDEX "analysis_report_generated_at_idx" ON "analysis_report"("generated_at");

-- CreateIndex
CREATE INDEX "report_share_report_id_idx" ON "report_share"("report_id");

-- AddForeignKey
ALTER TABLE "basin_district" ADD CONSTRAINT "basin_district_basin_id_fkey" FOREIGN KEY ("basin_id") REFERENCES "river_basin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basin_district" ADD CONSTRAINT "basin_district_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen" ADD CONSTRAINT "citizen_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer" ADD CONSTRAINT "officer_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_alert" ADD CONSTRAINT "hazard_alert_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_target_district" ADD CONSTRAINT "alert_target_district_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "hazard_alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_target_district" ADD CONSTRAINT "alert_target_district_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_target_basin" ADD CONSTRAINT "alert_target_basin_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "hazard_alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_target_basin" ADD CONSTRAINT "alert_target_basin_basin_id_fkey" FOREIGN KEY ("basin_id") REFERENCES "river_basin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_escalation" ADD CONSTRAINT "alert_escalation_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "hazard_alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_escalation" ADD CONSTRAINT "alert_escalation_by_officer_id_fkey" FOREIGN KEY ("by_officer_id") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_attempt" ADD CONSTRAINT "notification_attempt_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "hazard_alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_attempt" ADD CONSTRAINT "notification_attempt_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_attempt" ADD CONSTRAINT "notification_attempt_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_notification" ADD CONSTRAINT "district_notification_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "hazard_alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_notification" ADD CONSTRAINT "district_notification_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ground_report" ADD CONSTRAINT "ground_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ground_report" ADD CONSTRAINT "ground_report_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ground_report" ADD CONSTRAINT "ground_report_resolved_by_officer_id_fkey" FOREIGN KEY ("resolved_by_officer_id") REFERENCES "officer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ground_report" ADD CONSTRAINT "ground_report_linked_to_report_id_fkey" FOREIGN KEY ("linked_to_report_id") REFERENCES "ground_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_audit_entry" ADD CONSTRAINT "report_audit_entry_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "ground_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_audit_entry" ADD CONSTRAINT "report_audit_entry_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_audit_entry" ADD CONSTRAINT "report_audit_entry_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelter" ADD CONSTRAINT "shelter_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelter" ADD CONSTRAINT "shelter_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rescue_team" ADD CONSTRAINT "rescue_team_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rescue_team" ADD CONSTRAINT "rescue_team_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock" ADD CONSTRAINT "supply_stock_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock" ADD CONSTRAINT "supply_stock_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_event" ADD CONSTRAINT "occupancy_event_shelter_id_fkey" FOREIGN KEY ("shelter_id") REFERENCES "shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_event" ADD CONSTRAINT "occupancy_event_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_event" ADD CONSTRAINT "occupancy_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "supply_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_destination_shelter_id_fkey" FOREIGN KEY ("destination_shelter_id") REFERENCES "shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_status_event" ADD CONSTRAINT "team_status_event_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "rescue_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_status_event" ADD CONSTRAINT "team_status_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_queue_item" ADD CONSTRAINT "conflict_queue_item_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "officer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_report" ADD CONSTRAINT "analysis_report_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_share" ADD CONSTRAINT "report_share_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "analysis_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_share" ADD CONSTRAINT "report_share_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_share" ADD CONSTRAINT "report_share_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
