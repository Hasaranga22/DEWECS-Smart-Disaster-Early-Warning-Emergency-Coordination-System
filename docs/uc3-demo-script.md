# UC3 Live Demo Script & Scenario Click Path

**Owner:** SANDARUWAN H M K (IT23633322)  
**Use Case:** UC3 - Coordinate Emergency Resources

---

## 1. Demo Prerequisites & Initial Environment Setup

1. **Environment:** Ensure `.env` has `DATA_STORE=memory` (or `DATA_STORE=prisma` if database container is running).
2. **Start Dev Server:** `npm run dev` and navigate to `http://localhost:3000/resources`.
3. **Role & Scope:** Ensure the top header displays `COLOMBO DISTRICT COORDINATION` and role `District Officer`.

---

## 2. Step-by-Step Demo Flow & Click Paths

### Screen SA-1: Dashboard (`/resources`)
- **Main Flow Step 1-2:** Observe top KPI tiles showing active shelters count, overall occupancy rate, available teams, and open conflicts.
- **Alternate A1 Notice:** Observe the blue notice banner at the top if an escalated hazard warning preselected Colombo district.
- **Alternate A6 (Activate Shelter):**
  1. Click the blue **"+ Activate Shelter (A6)"** button in the top right.
  2. Enter Shelter Name: `Kelani Relief Secondary Center`.
  3. Address: `250 River Road, Kelaniya`.
  4. Capacity: `350`.
  5. Click **"Activate Shelter"**.
  6. **Result:** Modal closes, success banner appears, and the new shelter is added with `Occupancy: 0/350` and `Version: v0`.

---

### Screen SA-2: Dispatch Teams (`/resources/dispatch`)
- **Main Flow Step 4:**
  1. Click **"Dispatch Teams"** in the sidebar.
  2. Review the list of AVAILABLE rescue teams in Colombo district.
  3. Enter Incident: `Kelani riverbank flood evacuation`.
  4. Enter Destination Location: `Wellampitiya Evacuation Center`.
  5. Click **"Dispatch Team"** on a Government team (`DMC Alpha Rapid Rescue`).
  6. **Result:** Team status updates to `EN_ROUTE`.
- **Alternate A3 & A5 (Combined Confirmation Alert Dialog):**
  1. Click **"Request Backup Dispatch (A5)"** on an adjacent district team (`Armed Forces Air-Sea Rescue Unit 4` from Gampaha district).
  2. **Result:** A combined confirmation alert dialog pops up explaining:
     - *Cross-District Dispatch Confirmation Required (Home District: Gampaha)*
     - *Partner Organization Confirmation Required*
  3. Click **"Confirm & Dispatch"**.
  4. **Result:** Team is dispatched with `Status: EN_ROUTE` while retaining its home `districtId: Gampaha`.
- **Exception E2 (No Team Available &rarr; UNASSIGNED Saved):**
  1. If all teams are deployed, click **"Save UNASSIGNED Request (E2)"**.
  2. **Result:** A dispatch request is saved with status `UNASSIGNED`, and an E2 warning banner appears on the main dashboard.

---

### Screen SA-3: Supply Distribution (`/resources/distribution`)
- **Main Flow Step 6:**
  1. Click **"Supply Distribution"** in the sidebar.
  2. Select Source Inventory: `Food Rations (Packs) — Available: 1500 units` (Grouped under Government Org).
  3. Select Destination Shelter: `Colombo Central Relief Center`.
  4. Enter Quantity: `200`.
  5. **Live Preview:** Observe the "Remaining After" box dynamically update to `1300 units`.
  6. Click **"Record Distribution Transaction"**.
  7. **Result:** Success Transaction Receipt modal pops up displaying transaction ref ID, item, quantity, and timestamp. On-hand inventory is decremented, while shelter occupancy remains unaffected.
- **Exception E3 (Insufficient Stock Shortfall):**
  1. Enter Quantity: `99999` (Exceeds on-hand balance).
  2. **Result:** The submit button is disabled with inline warning *"Insufficient stock! Requested quantity exceeds on-hand balance"*. Submitting via API returns HTTP 422 with message *"Insufficient stock - nothing was recorded"*.

---

### Screen SA-4: Shelter Status & Occupancy Update (`/resources/shelters`)
- **Main Flow Step 3:**
  1. Click **"Shelter Occupancy"** in the sidebar.
  2. Locate `Kelani River Secondary Shelter` (Occupancy `120/250`).
  3. Click **"Update Occupancy"**.
  4. Enter New Count: `180`.
  5. Click **"Save Occupancy Update"**.
  6. **Result:** Occupancy updates to `180/250`, version increments from `v0` to `v1`.
- **Exception E1 (Over Capacity Error & Alternatives):**
  1. Click **"Update Occupancy"** on `Colombo Central Relief Center` (Capacity `400`).
  2. Enter New Count: `450` (Exceeds capacity 400).
  3. Click **"Save Occupancy Update"**.
  4. **Result:** OverCapacityError (E1) banner pops up displaying:
     - *Over Capacity Error: Shelter capacity exceeded*
     - *Suggested Alternative Open Shelters:* lists other open shelters with available beds.
- **Exception E4 (Version Conflict Simulation):**
  1. Open two browser tabs on `/resources/shelters`.
  2. In **Tab 1**, update occupancy on `Colombo Central Relief Center` from `380` to `390` (Version advances `v0` &rarr; `v1`).
  3. In **Tab 2** (still holding stale `v0`), try updating occupancy to `385`.
  4. Click **"Save Occupancy Update"**.
  5. **Result:** HTTP 409 Version Conflict occurs. The shelter value is preserved at `390 (v1)`, and a new item appears in the **Version Conflict Review List (E4)** at the bottom.
  6. Click **"Retry Action"** or **"Discard"** (with confirmation dialog) to resolve the conflict.

---

### Alternate A4 (Offline Action Queue & Simulation)
1. Toggle the **"Offline Mode"** switch in the bottom left sidebar to **ACTIVE**.
2. Perform an occupancy update or dispatch.
3. **Result:** Action is saved in the local browser queue with status `PENDING`.
4. Toggle **"Offline Mode"** switch back to **OFF**.
5. **Result:** Queue automatically replays queued actions. Actions with matching versions mark `CONFIRMED`; stale actions mark `CONFLICT`.
