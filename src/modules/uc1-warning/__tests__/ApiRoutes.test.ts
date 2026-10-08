import { describe, expect, it } from 'vitest';
import { ROLE_COOKIE } from '@/shared/access';
import { D } from '@/shared/seed';
import { POST as previewHandler } from '@/app/api/warnings/preview/route';
import { GET as getWarningsHandler, POST as issueHandler } from '@/app/api/warnings/route';
import { POST as escalateHandler } from '@/app/api/warnings/[id]/escalate/route';
import { POST as cancelHandler } from '@/app/api/warnings/[id]/cancel/route';
import { GET as getAlertHandler } from '@/app/api/warnings/[id]/route';

describe('UC1 API Route Handlers', () => {
  function makeRequest(
    url: string,
    method: string,
    role: string | null = 'DMC_OFFICIAL',
    body?: unknown,
  ): Request {
    const headers = new Headers();
    if (role) {
      headers.set('cookie', `${ROLE_COOKIE}=${role}`);
    }
    if (body) {
      headers.set('content-type', 'application/json');
    }
    return new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it('rejects issue warning with 403 when called by Duty Officer or Citizen', async () => {
    const dutyOfficerReq = makeRequest('http://localhost/api/warnings', 'POST', 'DUTY_OFFICER', {
      hazardType: 'FLOOD',
      severity: 'WARNING',
      message: 'Flood warning',
      target: { districtIds: [D.COLOMBO] },
    });
    const resDuty = await issueHandler(dutyOfficerReq);
    expect(resDuty.status).toBe(403);

    const citizenReq = makeRequest('http://localhost/api/warnings', 'POST', 'CITIZEN', {
      hazardType: 'FLOOD',
      severity: 'WARNING',
      message: 'Flood warning',
      target: { districtIds: [D.COLOMBO] },
    });
    const resCitizen = await issueHandler(citizenReq);
    expect(resCitizen.status).toBe(403);
  });

  it('allows DMC Official to preview and issue warning', async () => {
    // 1. Preview
    const previewReq = makeRequest('http://localhost/api/warnings/preview', 'POST', 'DMC_OFFICIAL', {
      target: { districtIds: [D.COLOMBO] },
    });
    const previewRes = await previewHandler(previewReq);
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.estimatedRecipients).toBeDefined();

    // 2. Issue
    const issueReq = makeRequest('http://localhost/api/warnings', 'POST', 'DMC_OFFICIAL', {
      hazardType: 'FLOOD',
      severity: 'WATCH',
      message: 'Heavy rain expected in Colombo',
      target: { districtIds: [D.COLOMBO] },
    });
    const issueRes = await issueHandler(issueReq);
    expect(issueRes.status).toBe(201);
    const issueData = await issueRes.json();
    expect(issueData.alert.id).toBeDefined();
    expect(issueData.alert.status).toBe('ACTIVE');

    // 3. Get detail
    const getReq = makeRequest(`http://localhost/api/warnings/${issueData.alert.id}`, 'GET', 'DMC_OFFICIAL');
    const getRes = await getAlertHandler(getReq, { params: Promise.resolve({ id: issueData.alert.id }) });
    expect(getRes.status).toBe(200);
  });

  it('maps invalid input validation to 400', async () => {
    const invalidReq = makeRequest('http://localhost/api/warnings', 'POST', 'DMC_OFFICIAL', {
      hazardType: 'INVALID_TYPE',
      severity: 'WATCH',
      message: '',
      target: {},
    });
    const res = await issueHandler(invalidReq);
    expect(res.status).toBe(400);
  });

  it('maps non-existent alert to 404', async () => {
    const getReq = makeRequest('http://localhost/api/warnings/non-existent-id', 'GET', 'DMC_OFFICIAL');
    const res = await getAlertHandler(getReq, { params: Promise.resolve({ id: 'non-existent-id' }) });
    expect(res.status).toBe(404);
  });

  it('maps business rule violations (e.g. invalid escalation) to 422', async () => {
    // Issue alert with EMERGENCY severity
    const issueReq = makeRequest('http://localhost/api/warnings', 'POST', 'DMC_OFFICIAL', {
      hazardType: 'CYCLONE',
      severity: 'EMERGENCY',
      message: 'Severe emergency alert',
      target: { districtIds: [D.COLOMBO] },
    });
    const issueRes = await issueHandler(issueReq);
    expect(issueRes.status).toBe(201);
    const issueData = await issueRes.json();

    // Attempt to escalate emergency
    const escalateReq = makeRequest(
      `http://localhost/api/warnings/${issueData.alert.id}/escalate`,
      'POST',
      'DMC_OFFICIAL',
      {
        newSeverity: 'EMERGENCY',
      },
    );
    const escRes = await escalateHandler(escalateReq, {
      params: Promise.resolve({ id: issueData.alert.id }),
    });
    expect(escRes.status).toBe(422);

    // List warnings
    const listReq = makeRequest('http://localhost/api/warnings', 'GET', 'DMC_OFFICIAL');
    const listRes = await getWarningsHandler(listReq);
    expect(listRes.status).toBe(200);

    // Cancel warning
    const cancelReq = makeRequest(
      `http://localhost/api/warnings/${issueData.alert.id}/cancel`,
      'POST',
      'DMC_OFFICIAL',
      { reason: 'Cyclone moved away from coast' },
    );
    const cancelRes = await cancelHandler(cancelReq, {
      params: Promise.resolve({ id: issueData.alert.id }),
    });
    expect(cancelRes.status).toBe(200);
  });
});
