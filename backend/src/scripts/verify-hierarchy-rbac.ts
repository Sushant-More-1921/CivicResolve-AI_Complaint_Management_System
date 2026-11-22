import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const BASE_URL = process.env.BACKEND_VERIFY_URL || 'http://127.0.0.1:5000/api/v1';

// Minimal valid 1x1 PNG buffer as base64
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

interface HttpResult {
  status: number;
  json: any;
}

async function api(
  method: string,
  route: string,
  token?: string,
  body?: unknown
): Promise<HttpResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function authData(res: HttpResult): { token: string; user: any; redirectTo?: string } {
  const payload = res.json?.data?.token ? res.json.data : res.json;
  return { token: payload?.token, user: payload?.user, redirectTo: payload?.redirectTo };
}

async function loginStaff(phoneNumber: string) {
  await api('POST', '/auth/admin/send-otp', undefined, { phoneNumber }).catch(() => {});
  const res = await api('POST', '/auth/admin/verify-otp', undefined, {
    phoneNumber,
    otp: '123456',
  });
  return res;
}

async function loginCitizen(phoneNumber: string, name: string) {
  await api('POST', '/auth/register', undefined, {
    phoneNumber,
    name,
    district: 'Kolhapur',
  }).catch(() => {});
  await api('POST', '/auth/send-otp', undefined, { phoneNumber }).catch(() => {});
  const res = await api('POST', '/auth/verify-otp', undefined, {
    phoneNumber,
    otp: '123456',
  });
  const data = authData(res);
  assert(res.status === 200 && data?.token && data?.user, `Citizen login failed: ${JSON.stringify(res.json)}`);
  return data;
}

async function main() {
  const createdComplaintIds: string[] = [];
  const createdTempUserIds: string[] = [];
  const createdFieldWorkerIds: string[] = [];

  try {
    console.log('1) Authenticating hierarchy test accounts...');
    const superLogin = await loginStaff('8380934906');
    const superAuth = authData(superLogin);
    assert(superLogin.status === 200 && superAuth.token, `Super Admin login status=${superLogin.status} body=${JSON.stringify(superLogin.json)}`);
    const superToken = superAuth.token;
    assert(superAuth.user.role === 'SUPER_ADMIN', `Expected SUPER_ADMIN role, got ${superAuth.user?.role}`);

    const wasteAdminLogin = await loginStaff('9822011101');
    const wasteAdminAuth = authData(wasteAdminLogin);
    assert(wasteAdminLogin.status === 200 && wasteAdminAuth.token, `Waste Dept Admin login failed: ${JSON.stringify(wasteAdminLogin.json)}`);
    const wasteAdminToken = wasteAdminAuth.token;
    const wasteDeptId = wasteAdminAuth.user.departmentId as string;
    assert(wasteAdminAuth.user.role === 'DEPARTMENT_ADMIN', `Expected DEPARTMENT_ADMIN, got ${wasteAdminAuth.user?.role}`);
    assert(Boolean(wasteDeptId), 'Waste Dept Admin missing departmentId');

    const roadsAdminLogin = await loginStaff('9822011102');
    const roadsAdminAuth = authData(roadsAdminLogin);
    assert(roadsAdminLogin.status === 200 && roadsAdminAuth.token, 'Roads Dept Admin login failed');
    const roadsAdminToken = roadsAdminAuth.token;
    const roadsDeptId = roadsAdminAuth.user.departmentId as string;

    const wasteOff1Login = await loginStaff('9822011225');
    const wasteOff1Auth = authData(wasteOff1Login);
    assert(wasteOff1Login.status === 200 && wasteOff1Auth.token, 'Waste Officer 1 login failed');
    const wasteOff1Token = wasteOff1Auth.token;
    const wasteOff1User = wasteOff1Auth.user;

    const wasteOff2Login = await loginStaff('8483300940');
    const wasteOff2Auth = authData(wasteOff2Login);
    assert(wasteOff2Login.status === 200 && wasteOff2Auth.token, 'Waste Officer 2 login failed');
    const wasteOff2Token = wasteOff2Auth.token;

    const roadsOff1Login = await loginStaff('9822011223');
    const roadsOff1Auth = authData(roadsOff1Login);
    assert(roadsOff1Login.status === 200 && roadsOff1Auth.token, 'Roads Officer 1 login failed');

    // Unified single-endpoint login checks + officer-cannot-become-citizen guards
    for (const [phone, expectedRole, expectedRedirect] of [
      ['9822011225', 'OFFICER', '/admin/dashboard'],
      ['9822011101', 'DEPARTMENT_ADMIN', '/admin/dashboard'],
      ['8380934906', 'SUPER_ADMIN', '/admin/dashboard'],
    ] as const) {
      await api('POST', '/auth/send-otp', undefined, { phoneNumber: phone }).catch(() => {});
      const uRes = await api('POST', '/auth/verify-otp', undefined, { phoneNumber: phone, otp: '123456' });
      const uAuth = authData(uRes);
      assert(uRes.status === 200 && uAuth.token, `Unified login failed for ${expectedRole}`);
      assert(uAuth.user.role === expectedRole, `Unified login altered ${expectedRole} role to ${uAuth.user.role}`);
      assert(uAuth.redirectTo === expectedRedirect, `Expected redirectTo=${expectedRedirect}, got ${uAuth.redirectTo}`);
    }
    const officerRegisterAttempt = await api('POST', '/auth/register', undefined, { phoneNumber: '9822011225', name: 'Spoof Citizen' });
    assert(officerRegisterAttempt.status === 403, `Officer /auth/register MUST be 403, got ${officerRegisterAttempt.status}`);
    const officerMyComplaints = await api('GET', '/complaints/my', wasteOff1Token);
    assert(officerMyComplaints.status === 403, `Officer GET /complaints/my MUST be 403, got ${officerMyComplaints.status}`);
    const officerCreateComplaint = await api('POST', '/complaints', wasteOff1Token, {
      description: 'Officer trying to submit complaint as citizen',
      category: 'GARBAGE',
      location: 'Main Road',
      latitude: 16.7,
      longitude: 74.2,
    });
    assert(officerCreateComplaint.status === 403, `Officer POST /complaints MUST be 403, got ${officerCreateComplaint.status}`);
    const roadsOff1Token = roadsOff1Auth.token;

    const citizen = await loginCitizen('9876598765', 'Verification Citizen');

    console.log('2) Verifying Single Active SUPER_ADMIN & Non-Login FieldWorker rules...');
    // Attempt creating 2nd SUPER_ADMIN via role promotion -> must fail (409 or 400)
    const promoRes = await api('PATCH', `/admin/users/${wasteOff1User.id}/role`, superToken, {
      role: 'SUPER_ADMIN',
    });
    assert(promoRes.status === 409 || promoRes.status === 400, `Expected 409/400 promoting 2nd SUPER_ADMIN, got ${promoRes.status}`);

    // Grab seeded FieldWorker phone and confirm they CANNOT login via OTP
    const anyWorker = await prisma.fieldWorker.findFirst({ where: { departmentId: wasteDeptId } });
    assert(anyWorker && anyWorker.phone, 'Expected seeded FieldWorker with phone in SOLID_WASTE');
    const fwLoginAttempt = await loginStaff(anyWorker!.phone!);
    assert(fwLoginAttempt.status === 403 || fwLoginAttempt.status === 404, `FieldWorker login must be denied, got ${fwLoginAttempt.status}`);

    // Reject login/credential fields when creating a FieldWorker record
    const invalidFwRes = await api('POST', '/admin/field-workers', wasteAdminToken, {
      name: 'Invalid Auth Worker',
      role: 'FIELD_WORKER',
      password: 'secret',
    });
    assert(invalidFwRes.status === 400, `Expected 400 rejecting login fields on FieldWorker, got ${invalidFwRes.status}`);

    console.log('3) Verifying Single Active Primary DEPARTMENT_ADMIN & Atomic Replace...');
    const dupAdminRes = await api('POST', '/admin/department-admins', superToken, {
      departmentId: wasteDeptId,
      name: 'Duplicate Admin',
      phoneNumber: '9899000112',
    });
    assert(dupAdminRes.status === 409, `Expected 409 for 2nd primary Dept Admin, got ${dupAdminRes.status}`);

    const tempAdminPhone = '9899000111';
    const replaceOk = await api('POST', `/admin/departments/${wasteDeptId}/replace-admin`, superToken, {
      name: 'Temp Replacement Admin',
      phoneNumber: tempAdminPhone,
      designation: 'Acting Head',
    });
    assert(replaceOk.status === 200 || replaceOk.status === 201, `Replace primary admin failed: ${JSON.stringify(replaceOk.json)}`);
    if (replaceOk.json?.data?.id) createdTempUserIds.push(replaceOk.json.data.id);

    // Old primary admin token must now be rejected (isActive = false)
    const oldTokenCheck = await api('GET', '/admin/officers', wasteAdminToken);
    assert(oldTokenCheck.status === 403, `Deactivated Dept Admin token must return 403, got ${oldTokenCheck.status}`);

    // Restore original primary admin back to SOLID_WASTE
    const restoreRes = await api('POST', `/admin/departments/${wasteDeptId}/replace-admin`, superToken, {
      name: wasteAdminAuth.user.name || 'Waste Dept Admin',
      phoneNumber: '9822011101',
      designation: 'Department Head (Solid Waste)',
    });
    assert(restoreRes.status === 200 || restoreRes.status === 201, `Restore primary admin failed: ${JSON.stringify(restoreRes.json)}`);
    const reLoginWasteAdmin = await loginStaff('9822011101');
    assert(reLoginWasteAdmin.status === 200, 'Restored Dept Admin failed to re-login');
    const activeWasteAdminToken = authData(reLoginWasteAdmin).token;

    console.log('4) Verifying ALL 6 Canonical Categories Auto-Routing + Spoofed departmentId ignored + AI Priority...');
    const categoryCases = [
      { category: 'Solid Waste / Garbage Disposal', expectedCode: 'SOLID_WASTE', desc: 'Large decomposing garbage dump blocking main hospital road for 4 days causing severe stench.' },
      { category: 'Potholes & Road Maintenance', expectedCode: 'PWD_ROADS', desc: 'Deep dangerous collapsed manhole pothole causing multiple two wheeler accidents near railway station.' },
      { category: 'Water Supply & Leakage', expectedCode: 'WATER_SUPPLY', desc: 'Burst drinking water main pipeline flooding entire street and cutting water supply to 400 homes.' },
      { category: 'Sewage & Drainage Overflow', expectedCode: 'DRAINAGE_SEWERAGE', desc: 'Raw sewage drain overflowing into school compound causing urgent public health emergency.' },
      { category: 'Streetlight Malfunction', expectedCode: 'ELECTRICAL', desc: 'Eight consecutive streetlights completely dark along highway crossing creating accident hazard.' },
      { category: 'Other Civic Issue', expectedCode: 'OTHER_CIVIC', desc: 'Fallen hazardous tree branch blocking municipal park entrance and overhead cables.' },
    ];

    const deptCodeMap = new Map<string, string>();
    const allDepts = await api('GET', '/admin/departments', superToken);
    for (const d of allDepts.json?.data || []) {
      deptCodeMap.set(d.code, d.id);
    }

    const createdByCode = new Map<string, any>();
    for (const item of categoryCases) {
      const createRes = await api('POST', '/complaints', citizen.token, {
        title: `Verify ${item.expectedCode} routing`,
        description: item.desc,
        category: item.category,
        location: 'Tarabai Park, Kolhapur',
        latitude: 16.705 + Math.random() * 0.005,
        longitude: 74.243 + Math.random() * 0.005,
        departmentId: roadsDeptId, // Spoofed departmentId must be ignored by backend!
      });
      assert(createRes.status === 201, `Complaint creation failed for ${item.category}: ${JSON.stringify(createRes.json)}`);
      const comp = createRes.json.data;
      createdComplaintIds.push(comp.id);
      createdByCode.set(item.expectedCode, comp);

      const expectedDeptId = deptCodeMap.get(item.expectedCode);
      assert(comp.departmentId === expectedDeptId, `${item.category} routed to ${comp.departmentId}, expected ${expectedDeptId}`);
      assert(Boolean(comp.assignedOfficerId), `Auto-assignment did not assign officer for ${item.expectedCode}`);
      assert(Boolean(comp.priority), `Priority missing on created complaint ${comp.id}`);
      assert(Boolean(comp.priorityModelVersion) && Boolean(comp.priorityPredictedAt), `Missing AI priority metadata on ${comp.id}`);
    }

    const wasteComplaint = createdByCode.get('SOLID_WASTE');
    const roadsComplaint = createdByCode.get('PWD_ROADS');

    console.log('5) Verifying strict cross-department & cross-officer 403 RBAC isolation...');
    assert((await api('GET', `/complaints/${roadsComplaint.id}`, activeWasteAdminToken)).status === 403, 'Waste Admin accessed Roads complaint');
    assert((await api('GET', `/admin/officers?departmentId=${roadsDeptId}`, activeWasteAdminToken)).status === 403, 'Waste Admin accessed Roads officers');
    assert((await api('GET', `/admin/field-workers?departmentId=${roadsDeptId}`, activeWasteAdminToken)).status === 403, 'Waste Admin accessed Roads field workers');
    assert((await api('GET', `/complaints/admin/stats?departmentId=${roadsDeptId}`, activeWasteAdminToken)).status === 403, 'Waste Admin accessed Roads stats');
    assert((await api('GET', `/maps/geointelligence?departmentId=${roadsDeptId}`, activeWasteAdminToken)).status === 403, 'Waste Admin accessed Roads map geointelligence');
    assert((await api('GET', '/admin/users', activeWasteAdminToken)).status === 403, 'Dept Admin must not list global users');

    const wasteListRes = await api('GET', '/complaints', activeWasteAdminToken);
    assert(wasteListRes.status === 200, 'Waste Admin complaint list failed');
    const leakedNonWaste = (wasteListRes.json.data || []).find((c: any) => c.departmentId !== wasteDeptId);
    assert(!leakedNonWaste, `Waste Admin complaint list leaked other dept complaint: ${leakedNonWaste?.id}`);

    // Reassign wasteComplaint explicitly to wasteOff1 so we control officer ownership precisely
    const wasteOff1Record = await prisma.officer.findFirst({ where: { userId: wasteOff1User.id } });
    assert(wasteOff1Record, 'Officer record missing for wasteOff1');
    const assignRes = await api('PATCH', `/complaints/${wasteComplaint.id}/assign`, activeWasteAdminToken, {
      officerId: wasteOff1Record!.id,
    });
    assert(assignRes.status === 200, `Assign to wasteOff1 failed: ${JSON.stringify(assignRes.json)}`);

    // Officer 2 (same dept) & Roads Officer 1 MUST receive 403 accessing wasteComplaint
    assert((await api('GET', `/complaints/${wasteComplaint.id}`, wasteOff2Token)).status === 403, 'Unassigned same-dept Officer 2 accessed complaint');
    assert((await api('GET', `/complaints/${wasteComplaint.id}`, roadsOff1Token)).status === 403, 'Other-dept Officer accessed complaint');
    assert((await api('GET', `/maps/geointelligence?departmentId=${roadsDeptId}`, wasteOff1Token)).status === 403, 'Officer accessed other dept map geointelligence');

    console.log('6) Verifying Priority Override RBAC & Audit Logs...');
    assert(
      (await api('PATCH', `/complaints/${wasteComplaint.id}/priority`, wasteOff1Token, { priority: 'LOW', reason: 'Officer should be forbidden' })).status === 403,
      'Officer must receive 403 on priority override'
    );
    assert(
      (await api('PATCH', `/complaints/${wasteComplaint.id}/priority`, roadsAdminToken, { priority: 'LOW', reason: 'Cross-dept admin should be forbidden' })).status === 403,
      'Cross-dept admin must receive 403 on priority override'
    );
    const deptOverrideRes = await api('PATCH', `/complaints/${wasteComplaint.id}/priority`, activeWasteAdminToken, {
      priority: 'HIGH',
      reason: 'Field supervisor confirmed priority adjustment',
    });
    assert(deptOverrideRes.status === 200 && deptOverrideRes.json?.data?.priority === 'HIGH', 'Own Dept Admin priority override failed');

    console.log('7) Verifying FieldWorker Task Assignment Guards, Officer Worker CRUD & Mandatory AFTER Evidence...');
    const roadsWorker = await prisma.fieldWorker.findFirst({ where: { departmentId: roadsDeptId, status: 'ACTIVE' } });
    assert(roadsWorker, 'Need seeded active Roads FieldWorker');

    // Officer own-department Field Worker Add / Update / Remove + cross-department 403
    const officerCreatedFw = await api('POST', '/admin/field-workers', wasteOff1Token, {
      name: 'Officer Added Worker',
      phone: '9822098765',
      designation: 'Sanitation Mate',
      skills: 'Compactor Crew',
      departmentId: wasteDeptId,
    });
    assert(officerCreatedFw.status === 201 && officerCreatedFw.json?.data?.id, `Officer failed to add own-dept FieldWorker: ${JSON.stringify(officerCreatedFw.json)}`);
    const officerFwId = officerCreatedFw.json.data.id as string;
    createdFieldWorkerIds.push(officerFwId);

    const officerUpdatedFw = await api('PATCH', `/admin/field-workers/${officerFwId}`, wasteOff1Token, {
      name: 'Officer Updated Worker',
      designation: 'Senior Sanitation Supervisor',
      availabilityStatus: 'ON_TASK',
    });
    assert(
      officerUpdatedFw.status === 200 && officerUpdatedFw.json?.data?.name === 'Officer Updated Worker',
      `Officer failed to update own-dept FieldWorker: ${JSON.stringify(officerUpdatedFw.json)}`
    );

    assert(
      (await api('POST', '/admin/field-workers', wasteOff1Token, { name: 'Cross Dept Attempt', departmentId: roadsDeptId })).status === 403,
      'Officer MUST receive 403 creating cross-dept FieldWorker'
    );
    assert(
      (await api('PATCH', `/admin/field-workers/${roadsWorker!.id}`, wasteOff1Token, { name: 'Tamper' })).status === 403,
      'Officer MUST receive 403 updating cross-dept FieldWorker'
    );
    assert(
      (await api('DELETE', `/admin/field-workers/${roadsWorker!.id}`, wasteOff1Token)).status === 403,
      'Officer MUST receive 403 deleting cross-dept FieldWorker'
    );

    const officerDeletedFw = await api('DELETE', `/admin/field-workers/${officerFwId}`, wasteOff1Token);
    assert(officerDeletedFw.status === 200, `Officer failed to remove own-dept FieldWorker: ${JSON.stringify(officerDeletedFw.json)}`);

    // Cross-department FieldWorker -> 403
    const crossFwTaskRes = await api('POST', '/officer/tasks', wasteOff1Token, {
      complaintId: wasteComplaint.id,
      title: 'Cross-dept test task',
      workerIds: [roadsWorker!.id],
    });
    assert(crossFwTaskRes.status === 403, `Expected 403 assigning cross-dept FieldWorker, got ${crossFwTaskRes.status}`);

    // Inactive FieldWorker -> 400
    const inactiveFwCreate = await api('POST', '/admin/field-workers', activeWasteAdminToken, {
      name: 'Temp Inactive Worker',
      designation: 'Crew',
      departmentId: wasteDeptId,
    });
    assert(inactiveFwCreate.status === 201, 'Failed creating temp field worker');
    const tempFwId = inactiveFwCreate.json.data.id as string;
    createdFieldWorkerIds.push(tempFwId);

    await api('PATCH', `/admin/field-workers/${tempFwId}`, activeWasteAdminToken, { status: 'INACTIVE' });
    const inactiveFwTaskRes = await api('POST', '/officer/tasks', wasteOff1Token, {
      complaintId: wasteComplaint.id,
      title: 'Inactive worker task attempt',
      workerIds: [tempFwId],
    });
    assert(inactiveFwTaskRes.status === 400, `Expected 400 assigning INACTIVE FieldWorker, got ${inactiveFwTaskRes.status}`);

    // Active same-dept FieldWorker -> 201
    const activeWasteWorker = await prisma.fieldWorker.findFirst({ where: { departmentId: wasteDeptId, status: 'ACTIVE' } });
    assert(activeWasteWorker, 'Need active SOLID_WASTE FieldWorker');
    const validTaskRes = await api('POST', '/officer/tasks', wasteOff1Token, {
      complaintId: wasteComplaint.id,
      title: 'Clear garbage pile & sanitize lane',
      instructions: 'Deploy compactor truck and bleaching powder',
      workerIds: [activeWasteWorker!.id],
    });
    assert(validTaskRes.status === 201 || validTaskRes.status === 200, `Task creation failed: ${JSON.stringify(validTaskRes.json)}`);
    const taskId = validTaskRes.json.data.id as string;

    // Resolving BEFORE uploading AFTER evidence -> 400
    const prematureResolve = await api('PATCH', `/complaints/${wasteComplaint.id}/status`, wasteOff1Token, {
      status: 'RESOLVED',
      resolutionRemarks: 'Attempting early resolve',
    });
    assert(prematureResolve.status === 400, `Expected 400 resolving without AFTER photo, got ${prematureResolve.status}`);

    // Upload BEFORE & AFTER photo evidence -> then resolve -> 200
    const beforeEv = await api('POST', `/officer/complaints/${wasteComplaint.id}/evidence`, wasteOff1Token, {
      taskId,
      stage: 'BEFORE',
      imageBase64: TINY_PNG_BASE64,
      imageContentType: 'image/png',
      caption: 'Before cleanup inspection',
    });
    assert(beforeEv.status === 201 || beforeEv.status === 200, `BEFORE evidence upload failed: ${JSON.stringify(beforeEv.json)}`);

    const afterEv = await api('POST', `/officer/complaints/${wasteComplaint.id}/evidence`, wasteOff1Token, {
      taskId,
      stage: 'AFTER',
      imageBase64: TINY_PNG_BASE64,
      imageContentType: 'image/png',
      caption: 'After cleanup & sanitization complete',
    });
    assert(afterEv.status === 201 || afterEv.status === 200, `AFTER evidence upload failed: ${JSON.stringify(afterEv.json)}`);

    await api('PATCH', `/officer/tasks/${taskId}`, wasteOff1Token, {
      status: 'COMPLETED',
      progressNote: 'Cleared and swept cleanly.',
    });

    const resolvedOk = await api('PATCH', `/complaints/${wasteComplaint.id}/status`, wasteOff1Token, {
      status: 'RESOLVED',
      resolutionRemarks: 'Site cleared, disinfected, and verified by assigned officer.',
    });
    assert(resolvedOk.status === 200 && resolvedOk.json?.data?.status === 'RESOLVED', `Expected RESOLVED status, got ${JSON.stringify(resolvedOk.json)}`);

    console.log('8) Verifying Super Admin cross-department transfer & Notification persistence...');
    const transferRes = await api('PATCH', `/complaints/${roadsComplaint.id}/reassign-department`, superToken, {
      departmentId: wasteDeptId,
      reason: 'Misrouted roadside debris belongs to Solid Waste',
    });
    assert(transferRes.status === 200 && transferRes.json?.data?.departmentId === wasteDeptId, 'Super Admin department reassignment failed');

    const citizenNotifs = await api('GET', '/users/notifications', citizen.token);
    assert(citizenNotifs.status === 200 && (citizenNotifs.json?.data || []).length > 0, 'Expected citizen notifications persisted');

    const officerNotifs = await api('GET', '/users/notifications', wasteOff1Token);
    assert(officerNotifs.status === 200 && (officerNotifs.json?.data || []).length > 0, 'Expected officer notifications persisted');

    console.log('\nALL HIERARCHY, RBAC, AUTO-ROUTING, FIELD-WORKER, AND EVIDENCE CHECKS PASSED.');
  } catch (err) {
    console.error('\nCHECK FAILURE DETAILS:', err);
    throw err;
  } finally {
    console.log('Cleaning up temporary verification records...');
    const testCitizen = await prisma.user.findUnique({ where: { phoneNumber: '9876598765' } });
    const citizenComplaints = testCitizen
      ? await prisma.complaint.findMany({ where: { citizenId: testCitizen.id }, select: { id: true } })
      : [];
    const allComplaintIds = Array.from(new Set([...createdComplaintIds, ...citizenComplaints.map((c) => c.id)]));

    if (allComplaintIds.length > 0) {
      await prisma.evidence.deleteMany({ where: { complaintId: { in: allComplaintIds } } });
      await prisma.taskWorker.deleteMany({
        where: { task: { complaintId: { in: allComplaintIds } } },
      });
      await prisma.task.deleteMany({ where: { complaintId: { in: allComplaintIds } } });
      await prisma.auditLog.deleteMany({ where: { complaintId: { in: allComplaintIds } } });
      await prisma.complaintAttachment.deleteMany({ where: { complaintId: { in: allComplaintIds } } });
      await prisma.citizenFeedback.deleteMany({ where: { complaintId: { in: allComplaintIds } } });
      await prisma.complaintTimeline.deleteMany({ where: { complaintId: { in: allComplaintIds } } });
      await prisma.complaint.deleteMany({ where: { id: { in: allComplaintIds } } });
    }
    if (createdFieldWorkerIds.length > 0) {
      await prisma.fieldWorker.deleteMany({ where: { id: { in: createdFieldWorkerIds } } });
    }
    if (createdTempUserIds.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: createdTempUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdTempUserIds } } });
    }
    if (testCitizen) {
      await prisma.notification.deleteMany({ where: { userId: testCitizen.id } });
      await prisma.user.delete({ where: { id: testCitizen.id } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
