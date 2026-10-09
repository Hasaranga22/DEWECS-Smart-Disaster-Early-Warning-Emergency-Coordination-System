import { beforeEach, describe, expect, it } from 'vitest';
import { POST as cancelRoute } from '@/app/api/warnings/[id]/cancel/route';
import { POST as escalateRoute } from '@/app/api/warnings/[id]/escalate/route';
import { POST as retryRoute } from '@/app/api/warnings/[id]/retry/route';
import { GET as getAlertRoute } from '@/app/api/warnings/[id]/route';
import { POST as previewRoute } from '@/app/api/warnings/preview/route';
import { GET as getWarningsRoute, POST as issueRoute } from '@/app/api/warnings/route';
import { resetUc1ModuleForTesting } from '@/modules/uc1-warning/container';
import { D } from '@/shared/seed';

describe('UC1 API Routes', () => {
  beforeEach(() => {
    resetUc1ModuleForTesting();
  });

  const dmcCookie = 'dewecs_role=DMC_OFFICIAL';
  const dutyOfficerCookie = 'dewecs_role=DUTY_OFFICER';
  const citizenCookie = 'dewecs_role=CITIZEN';

  it('POST /api/warnings/preview: 403 for unauthorized roles', async () => {
    const req = new Request('http://localhost:3000/api/warnings/preview', {
      method: 'POST',
      headers: { cookie: dutyOfficerCookie },
      body: JSON.stringify({ districtIds: [D.COLOMBO] }),
    });

    const res = await previewRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Access denied');
  });

  it('POST /api/warnings/preview: 400 on invalid input', async () => {
    const req = new Request('http://localhost:3000/api/warnings/preview', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({}),
    });

    const res = await previewRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('POST /api/warnings/preview: 200 with preview estimates for DMC Official', async () => {
    const req = new Request('http://localhost:3000/api/warnings/preview', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({ districtIds: [D.COLOMBO] }),
    });

    const res = await previewRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.estimatedRecipients).toBeGreaterThan(0);
    expect(data.distinctCitizens).toBeGreaterThan(0);
  });

  it('POST /api/warnings: 403 for Duty Officer or Citizen', async () => {
    const req = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: citizenCookie },
      body: JSON.stringify({
        hazardType: 'FLOOD',
        severity: 'WARNING',
        message: 'Severe flood',
        target: { districtIds: [D.COLOMBO] },
      }),
    });

    const res = await issueRoute(req);
    expect(res.status).toBe(403);
  });

  it('POST /api/warnings: 422 when zero recipients not confirmed', async () => {
    const req = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        hazardType: 'FLOOD',
        severity: 'WARNING',
        message: 'Flood in uninhabited area',
        target: { districtIds: ['non-existent-district'] },
      }),
    });

    const res = await issueRoute(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('ZeroRecipientsNotConfirmedError');
  });

  it('POST /api/warnings: 201 when issued by DMC Official', async () => {
    const req = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        hazardType: 'FLOOD',
        severity: 'WATCH',
        message: 'Flood watch for Colombo',
        target: { districtIds: [D.COLOMBO] },
      }),
    });

    const res = await issueRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.alert.id).toBeDefined();
    expect(data.alert.status).toBe('ACTIVE');
    expect(data.distinctCitizensReached).toBeGreaterThan(0);
  });

  it('GET /api/warnings: allows DMC, Duty Officer and District Officer; forbids Citizen', async () => {
    const citizenReq = new Request('http://localhost:3000/api/warnings', {
      headers: { cookie: citizenCookie },
    });
    const citizenRes = await getWarningsRoute(citizenReq);
    expect(citizenRes.status).toBe(403);

    const dutyReq = new Request('http://localhost:3000/api/warnings', {
      headers: { cookie: dutyOfficerCookie },
    });
    const dutyRes = await getWarningsRoute(dutyReq);
    expect(dutyRes.status).toBe(200);
    const data = await dutyRes.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/warnings/[id]: returns 404 for unknown ID and 200 for existing alert', async () => {
    const notFoundReq = new Request('http://localhost:3000/api/warnings/unknown-id', {
      headers: { cookie: dmcCookie },
    });
    const notFoundRes = await getAlertRoute(notFoundReq, {
      params: Promise.resolve({ id: 'unknown-id' }),
    });
    expect(notFoundRes.status).toBe(404);

    // Create an alert
    const issueReq = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        hazardType: 'LANDSLIDE',
        severity: 'ADVISORY',
        message: 'Landslide warning',
        target: { districtIds: [D.KEGALLE] },
      }),
    });
    const issueRes = await issueRoute(issueReq);
    const created = await issueRes.json();

    const getReq = new Request(`http://localhost:3000/api/warnings/${created.alert.id}`, {
      headers: { cookie: dmcCookie },
    });
    const getRes = await getAlertRoute(getReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(getRes.status).toBe(200);
    const alertData = await getRes.json();
    expect(alertData.alert.id).toBe(created.alert.id);
  });

  it('POST /api/warnings/[id]/escalate: 422 on invalid transition and 200 on success', async () => {
    // Issue alert at WATCH
    const issueReq = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        hazardType: 'FLOOD',
        severity: 'WATCH',
        message: 'Flood watch',
        target: { districtIds: [D.COLOMBO] },
      }),
    });
    const issueRes = await issueRoute(issueReq);
    const created = await issueRes.json();

    // 1. Invalid downgrade to ADVISORY -> 422
    const downgradeReq = new Request(`http://localhost:3000/api/warnings/${created.alert.id}/escalate`, {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({ newSeverity: 'ADVISORY' }),
    });
    const downgradeRes = await escalateRoute(downgradeReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(downgradeRes.status).toBe(422);

    // 2. Valid escalation to WARNING -> 200
    const escalateReq = new Request(`http://localhost:3000/api/warnings/${created.alert.id}/escalate`, {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({ newSeverity: 'WARNING', reason: 'High rainfall' }),
    });
    const escalateRes = await escalateRoute(escalateReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(escalateRes.status).toBe(200);
    const escalatedData = await escalateRes.json();
    expect(escalatedData.alert.status).toBe('ESCALATED');
    expect(escalatedData.alert.severity).toBe('WARNING');
  });

  it('POST /api/warnings/[id]/cancel: cancels active alert and rejects on closed alert', async () => {
    const issueReq = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        hazardType: 'CYCLONE',
        severity: 'WARNING',
        message: 'Cyclone warning',
        target: { districtIds: [D.COLOMBO] },
      }),
    });
    const issueRes = await issueRoute(issueReq);
    const created = await issueRes.json();

    // Cancel alert
    const cancelReq = new Request(`http://localhost:3000/api/warnings/${created.alert.id}/cancel`, {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({ reason: 'Cyclone dissipated' }),
    });
    const cancelRes = await cancelRoute(cancelReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(cancelRes.status).toBe(200);
    const cancelled = await cancelRes.json();
    expect(cancelled.alert.status).toBe('CANCELLED');

    // Cancelling again -> 422 (AlertClosedError)
    const duplicateCancelReq = new Request(
      `http://localhost:3000/api/warnings/${created.alert.id}/cancel`,
      {
        method: 'POST',
        headers: { cookie: dmcCookie },
        body: JSON.stringify({ reason: 'Try cancel again' }),
      },
    );
    const duplicateCancelRes = await cancelRoute(duplicateCancelReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(duplicateCancelRes.status).toBe(422);
  });

  it('POST /api/warnings/[id]/retry: retries failed attempts for alert', async () => {
    const issueReq = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        hazardType: 'FLOOD',
        severity: 'ADVISORY',
        message: 'Flood advisory',
        target: { districtIds: [D.COLOMBO] },
      }),
    });
    const issueRes = await issueRoute(issueReq);
    const created = await issueRes.json();

    const retryReq = new Request(`http://localhost:3000/api/warnings/${created.alert.id}/retry`, {
      method: 'POST',
      headers: { cookie: dmcCookie },
    });
    const retryRes = await retryRoute(retryReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(retryRes.status).toBe(200);
  });

  it('stores custom title on issue and returns it in detail and list endpoints', async () => {
    const issueReq = new Request('http://localhost:3000/api/warnings', {
      method: 'POST',
      headers: { cookie: dmcCookie },
      body: JSON.stringify({
        title: 'Kelani Ganga Basin Flash Flood Alert',
        hazardType: 'FLOOD',
        severity: 'WARNING',
        message: 'Severe flood in Kelani basin',
        target: { districtIds: [D.COLOMBO] },
      }),
    });

    const issueRes = await issueRoute(issueReq);
    expect(issueRes.status).toBe(201);
    const created = await issueRes.json();
    expect(created.alert.title).toBe('Kelani Ganga Basin Flash Flood Alert');

    // Check GET by ID
    const getReq = new Request(`http://localhost:3000/api/warnings/${created.alert.id}`, {
      headers: { cookie: dmcCookie },
    });
    const getRes = await getAlertRoute(getReq, {
      params: Promise.resolve({ id: created.alert.id }),
    });
    expect(getRes.status).toBe(200);
    const detailData = await getRes.json();
    expect(detailData.alert.title).toBe('Kelani Ganga Basin Flash Flood Alert');

    // Check GET list
    const listReq = new Request('http://localhost:3000/api/warnings', {
      headers: { cookie: dmcCookie },
    });
    const listRes = await getWarningsRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const found = listData.find((a: { id: string }) => a.id === created.alert.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Kelani Ganga Basin Flash Flood Alert');
  });
});
