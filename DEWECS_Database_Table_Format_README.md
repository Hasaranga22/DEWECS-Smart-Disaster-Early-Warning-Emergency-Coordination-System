# DEWECS Database Table Format

**Project:** Disaster/Emergency Warning and Emergency Coordination System (DEWECS)  
**Database:** PostgreSQL  
**ORM:** Prisma 7  
**Total proposed PostgreSQL tables:** 24

## 1. Shared Tables

### district
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique district identifier |
| name | VARCHAR(100) | UNIQUE, NOT NULL | District name |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |

### river_basin
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique river basin identifier |
| name | VARCHAR(150) | UNIQUE, NOT NULL | River basin name |
| description | TEXT | NULL | Basin description |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |

### basin_district
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| basin_id | UUID | PK, FK | References river_basin.id |
| district_id | UUID | PK, FK | References district.id |

**Primary Key:** `(basin_id, district_id)`

### citizen
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Citizen identifier |
| name | VARCHAR(150) | NOT NULL | Citizen name |
| national_id | VARCHAR(20) | UNIQUE | National ID |
| phone | VARCHAR(20) | NULL | Contact number |
| push_token | TEXT | NULL | Push notification token |
| address | TEXT | NULL | Address |
| district_id | UUID | FK | Citizen district |
| is_volunteer | BOOLEAN | NOT NULL | Volunteer status |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |

### officer
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Officer identifier |
| name | VARCHAR(150) | NOT NULL | Officer name |
| role | ENUM | NOT NULL | Officer role |
| district_id | UUID | FK, NULL | Assigned district |
| phone | VARCHAR(20) | NULL | Contact number |
| email | VARCHAR(150) | NULL | Email |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |

### organization
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Organization identifier |
| name | VARCHAR(200) | UNIQUE, NOT NULL | Organization name |
| type | ENUM | NOT NULL | GOVERNMENT, ARMED_FORCES, NGO, PRIVATE_DONOR |
| coordinator_name | VARCHAR(150) | NULL | Coordinator |
| coordinator_phone | VARCHAR(20) | NULL | Coordinator phone |
| coordinator_email | VARCHAR(150) | NULL | Coordinator email |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |

## 2. UC1 – Hazard Warning

### hazard_alert
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Alert identifier |
| hazard_type | ENUM | NOT NULL | FLOOD, LANDSLIDE, CYCLONE, DROUGHT |
| severity | ENUM | NOT NULL | ADVISORY, WATCH, WARNING, EMERGENCY |
| status | ENUM | NOT NULL | ACTIVE, ESCALATED, CANCELLED, EXPIRED |
| message | TEXT | NOT NULL | Warning message |
| issued_by | UUID | FK, NOT NULL | Issuing officer |
| occurred_at | TIMESTAMPTZ | NOT NULL | Occurrence time |
| expires_at | TIMESTAMPTZ | NULL | Expiry time |
| cancelled_at | TIMESTAMPTZ | NULL | Cancellation time |
| cancellation_reason | TEXT | NULL | Cancellation reason |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |

### alert_target_district
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| alert_id | UUID | PK, FK | References hazard_alert.id |
| district_id | UUID | PK, FK | References district.id |

### alert_target_basin
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| alert_id | UUID | PK, FK | References hazard_alert.id |
| basin_id | UUID | PK, FK | References river_basin.id |

### alert_escalation
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Escalation identifier |
| alert_id | UUID | FK, NOT NULL | Related alert |
| from_severity | ENUM | NOT NULL | Previous severity |
| to_severity | ENUM | NOT NULL | New severity |
| occurred_at | TIMESTAMPTZ | NOT NULL | Escalation time |
| by_officer_id | UUID | FK, NOT NULL | Officer |
| reason | TEXT | NULL | Reason |

### notification_attempt
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Attempt identifier |
| alert_id | UUID | FK, NOT NULL | Related alert |
| citizen_id | UUID | FK, NOT NULL | Recipient |
| district_id | UUID | FK, NOT NULL | Recipient district |
| hazard_type | ENUM | NOT NULL | Hazard type |
| channel | ENUM | NOT NULL | PUSH, SMS |
| status | ENUM | NOT NULL | QUEUED, SENT, DELIVERED, FAILED |
| kind | ENUM | NOT NULL | ISSUE, ESCALATION, CANCELLATION |
| occurred_at | TIMESTAMPTZ | NOT NULL | Attempt time |
| sent_at | TIMESTAMPTZ | NULL | Sent time |
| delivered_at | TIMESTAMPTZ | NULL | Delivery time |
| failure_reason | TEXT | NULL | Failure reason |

### district_notification
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Notification identifier |
| alert_id | UUID | FK, NOT NULL | Alert |
| district_id | UUID | FK, NOT NULL | Target district |
| kind | ENUM | NOT NULL | ISSUED, ESCALATED |
| occurred_at | TIMESTAMPTZ | NOT NULL | Notification time |
| read_at | TIMESTAMPTZ | NULL | Read time |

## 3. UC2 – Ground Reports

### ground_report
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Report identifier |
| local_id | VARCHAR(100) | UNIQUE, NOT NULL | Offline/client ID |
| reporter_id | UUID | FK, NOT NULL | Reporting citizen |
| district_id | UUID | FK, NOT NULL | Report district |
| hazard_type | ENUM | NOT NULL | Hazard |
| description | TEXT | NOT NULL | Report details |
| latitude | DECIMAL(9,6) | NOT NULL | Latitude |
| longitude | DECIMAL(9,6) | NOT NULL | Longitude |
| location_source | ENUM | NOT NULL | GPS, MANUAL_PIN |
| gps_accuracy_m | DECIMAL(8,2) | NULL | GPS accuracy |
| photo | TEXT | NULL | Photo reference/data |
| confidence | ENUM | NOT NULL | FULL, REDUCED |
| review_status | ENUM | NOT NULL | PENDING_REVIEW, NEEDS_INFO, VERIFIED, REJECTED |
| severity_indication | ENUM | NULL | LOW, MEDIUM, HIGH |
| linked_to_report_id | UUID | FK, NULL | Related report |
| capture_time | TIMESTAMPTZ | NOT NULL | Capture time |
| sync_time | TIMESTAMPTZ | NULL | Synchronization time |
| version | INTEGER | NOT NULL | Optimistic locking version |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update |

### report_audit_entry
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Audit identifier |
| report_id | UUID | FK, NOT NULL | Ground report |
| action | ENUM | NOT NULL | VERIFIED, REJECTED, NEEDS_INFO, CLARIFIED |
| officer_id | UUID | FK, NULL | Reviewing officer |
| reason | TEXT | NULL | Reason |
| note | TEXT | NULL | Review note |
| occurred_at | TIMESTAMPTZ | NOT NULL | Audit time |
| district_id | UUID | FK, NOT NULL | District |
| hazard_type | ENUM | NOT NULL | Hazard |

## 4. UC3 – Emergency Resources

### shelter
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Shelter identifier |
| district_id | UUID | FK, NOT NULL | District |
| organization_id | UUID | FK, NOT NULL | Responsible organization |
| name | VARCHAR(200) | NOT NULL | Shelter name |
| address | TEXT | NOT NULL | Address |
| latitude | DECIMAL(9,6) | NULL | Latitude |
| longitude | DECIMAL(9,6) | NULL | Longitude |
| capacity | INTEGER | NOT NULL | Maximum capacity |
| occupancy | INTEGER | NOT NULL | Current occupancy |
| status | ENUM | NOT NULL | OPEN, FULL |
| version | INTEGER | NOT NULL | Optimistic locking version |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update |

**Constraints:** `capacity > 0`, `0 <= occupancy <= capacity`.

### rescue_team
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Team identifier |
| district_id | UUID | FK, NOT NULL | Team district |
| organization_id | UUID | FK, NOT NULL | Organization |
| name | VARCHAR(200) | NOT NULL | Team name |
| capability | TEXT | NOT NULL | Capabilities |
| status | ENUM | NOT NULL | AVAILABLE, EN_ROUTE, ON_SITE, RETURNING |
| current_latitude | DECIMAL(9,6) | NULL | Current latitude |
| current_longitude | DECIMAL(9,6) | NULL | Current longitude |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update |

### supply_stock
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Stock identifier |
| organization_id | UUID | FK, NOT NULL | Organization |
| district_id | UUID | FK, NOT NULL | District |
| supply_type | VARCHAR(100) | NOT NULL | Supply type |
| on_hand | INTEGER | NOT NULL | Available quantity |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update |

### occupancy_event
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Event identifier |
| shelter_id | UUID | FK, NOT NULL | Shelter |
| district_id | UUID | FK, NOT NULL | District |
| previous_count | INTEGER | NOT NULL | Previous occupancy |
| new_count | INTEGER | NOT NULL | New occupancy |
| actor_id | UUID | FK, NOT NULL | Actor |
| occurred_at | TIMESTAMPTZ | NOT NULL | Event time |
| action_id | VARCHAR(100) | NOT NULL | Idempotency ID |

### distribution
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Distribution identifier |
| stock_id | UUID | FK, NOT NULL | Source stock |
| destination_shelter_id | UUID | FK, NOT NULL | Destination shelter |
| organization_id | UUID | FK, NOT NULL | Organization |
| district_id | UUID | FK, NOT NULL | District |
| quantity | INTEGER | NOT NULL | Quantity |
| actor_id | UUID | FK, NOT NULL | Actor |
| occurred_at | TIMESTAMPTZ | NOT NULL | Distribution time |
| action_id | VARCHAR(100) | NOT NULL | Idempotency ID |

### team_status_event
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Event identifier |
| team_id | UUID | FK, NOT NULL | Rescue team |
| from_status | ENUM | NOT NULL | Previous status |
| to_status | ENUM | NOT NULL | New status |
| actor_id | UUID | FK, NOT NULL | Actor |
| occurred_at | TIMESTAMPTZ | NOT NULL | Event time |
| incident | TEXT | NULL | Incident |
| location | TEXT | NULL | Location |

### processed_action
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| action_id | VARCHAR(100) | PK | Unique action ID |
| type | VARCHAR(50) | NOT NULL | Action type |
| result_ref | VARCHAR(100) | NULL | Result reference |
| processed_at | TIMESTAMPTZ | NOT NULL | Processing time |

### conflict_queue_item
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Conflict identifier |
| action_type | VARCHAR(100) | NOT NULL | Action type |
| payload | JSONB | NOT NULL | Original payload |
| expected_version | INTEGER | NOT NULL | Expected version |
| actual_version | INTEGER | NOT NULL | Actual server version |
| status | ENUM | NOT NULL | OPEN, RESOLVED |
| created_at | TIMESTAMPTZ | NOT NULL | Conflict time |
| resolved_at | TIMESTAMPTZ | NULL | Resolution time |
| resolved_by | UUID | FK, NULL | Resolving officer |

## 5. UC4 – Post-Event Analysis

### analysis_report
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Report identifier |
| filters | JSONB | NOT NULL | Applied filters |
| source_cutoff | TIMESTAMPTZ | NOT NULL | Historical cutoff |
| generated_at | TIMESTAMPTZ | NOT NULL | Generation time |
| metrics | JSONB | NOT NULL | Calculated metrics |
| generated_by | UUID | FK, NOT NULL | Generating officer |

**Rule:** Analysis reports are immutable historical snapshots.

### report_share
| Column | Data Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Share attempt identifier |
| report_id | UUID | FK, NOT NULL | Analysis report |
| organization_id | UUID | FK, NOT NULL | Partner organization |
| status | ENUM | NOT NULL | SENT, FAILED |
| attempted_at | TIMESTAMPTZ | NOT NULL | Attempt time |
| actor_id | UUID | FK, NOT NULL | Actor |
| failure_reason | TEXT | NULL | Failure reason |

**Rule:** Keep one row per sharing attempt so retries remain in history.

## 6. Table Count

| Module | Tables |
|---|---:|
| Shared | 6 |
| UC1 – Hazard Warning | 6 |
| UC2 – Ground Reports | 2 |
| UC3 – Emergency Resources | 8 |
| UC4 – Post-Event Analysis | 2 |
| **Total** | **24** |

## 7. Core Relationships

- `river_basin` ↔ `district` through `basin_district`
- `district` → `citizen`, `officer`, `ground_report`, `shelter`, `rescue_team`, `supply_stock`
- `hazard_alert` → `alert_target_district`, `alert_target_basin`, `alert_escalation`, `notification_attempt`, `district_notification`
- `ground_report` → `report_audit_entry` and self-reference for corroboration
- `shelter` → `occupancy_event`
- `rescue_team` → `team_status_event`
- `supply_stock` → `distribution`
- `analysis_report` → `report_share`
- `organization` → `shelter`, `rescue_team`, `supply_stock`, `report_share`

## 8. Important Design Rules

1. Do not store multiple district IDs as comma-separated values.
2. Keep notification history in `notification_attempt`.
3. Keep escalation history in `alert_escalation`.
4. Keep report review history in `report_audit_entry`.
5. Keep shelter occupancy history in `occupancy_event`.
6. Keep rescue-team status history in `team_status_event`.
7. Use `processed_action` to prevent duplicate offline actions.
8. Use optimistic-locking `version` fields where concurrent updates are possible.
9. Use `conflict_queue_item` for version conflicts instead of silent overwrites.
10. Keep `analysis_report` immutable.
11. Keep every `report_share` attempt as a historical row.
12. `LocalOutboxEntry` belongs to browser IndexedDB and is not a PostgreSQL table.
13. The documented role-switcher approach does not require a password/authentication table.
