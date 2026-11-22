import '../config/env';
import { prisma } from '../config/database';
import { CANONICAL_DEPARTMENTS } from '../modules/complaints/department-routing';

const SUPER_ADMIN_PHONE = '8380934906';

const DEPT_ADMINS = [
  {
    deptCode: 'SOLID_WASTE',
    name: 'Rajesh Kulkarni',
    phoneNumber: '9822011101',
    email: 'admin.solidwaste@kolhapur.gov.in',
    designation: 'Chief Sanitation & Solid Waste Administrator',
  },
  {
    deptCode: 'PWD_ROADS',
    name: 'Nitin Deshmukh',
    phoneNumber: '9822011102',
    email: 'admin.roads@kolhapur.gov.in',
    designation: 'Executive Road Maintenance Administrator',
  },
  {
    deptCode: 'WATER_SUPPLY',
    name: 'Prakash Joshi',
    phoneNumber: '9822011103',
    email: 'admin.water@kolhapur.gov.in',
    designation: 'Chief Hydraulic & Water Supply Administrator',
  },
  {
    deptCode: 'DRAINAGE_SEWERAGE',
    name: 'Sunita Patil',
    phoneNumber: '9822011104',
    email: 'admin.drainage@kolhapur.gov.in',
    designation: 'Drainage & Sewerage Division Administrator',
  },
  {
    deptCode: 'ELECTRICAL',
    name: 'Vikas Chavan',
    phoneNumber: '9822011105',
    email: 'admin.electrical@kolhapur.gov.in',
    designation: 'Chief Electrical & Streetlight Administrator',
  },
  {
    deptCode: 'OTHER_CIVIC',
    name: 'Meera Sawant',
    phoneNumber: '9822011106',
    email: 'admin.civic@kolhapur.gov.in',
    designation: 'General Civic Grievances Administrator',
  },
];

const DEPARTMENT_OFFICERS = [
  {
    deptCode: 'SOLID_WASTE',
    name: 'Dr. Anita Deshmukh',
    phoneNumber: '9822011225',
    email: 'anita.deshmukh@kolhapur.gov.in',
    designation: 'Senior Sanitary Inspector',
    badgeId: 'KMC-SWM-03',
  },
  {
    deptCode: 'SOLID_WASTE',
    name: 'Vaishnavi Mane',
    phoneNumber: '8483300940',
    email: 'vaishnavim@gmail.com',
    designation: 'Ward Solid Waste Officer',
    badgeId: 'MH-ADM-0940',
  },
  {
    deptCode: 'PWD_ROADS',
    name: 'Er. Sandeep Patil',
    phoneNumber: '9822011223',
    email: 'sandeep.patil@kolhapur.gov.in',
    designation: 'Executive Engineer (Roads)',
    badgeId: 'KMC-RDS-01',
  },
  {
    deptCode: 'PWD_ROADS',
    name: 'Er. Rohan Shinde',
    phoneNumber: '9822011229',
    email: 'rohan.shinde@kolhapur.gov.in',
    designation: 'Junior Road Maintenance Engineer',
    badgeId: 'KMC-RDS-02',
  },
  {
    deptCode: 'WATER_SUPPLY',
    name: 'Er. Prakash Shinde',
    phoneNumber: '9822011224',
    email: 'prakash.shinde@kolhapur.gov.in',
    designation: 'Sub-Divisional Officer (Water)',
    badgeId: 'KMC-WTR-02',
  },
  {
    deptCode: 'WATER_SUPPLY',
    name: 'Er. Kavita Naik',
    phoneNumber: '9822011230',
    email: 'kavita.naik@kolhapur.gov.in',
    designation: 'Pipeline Operations Officer',
    badgeId: 'KMC-WTR-05',
  },
  {
    deptCode: 'DRAINAGE_SEWERAGE',
    name: 'Er. Snehal Kadam',
    phoneNumber: '9822011227',
    email: 'snehal.kadam@kolhapur.gov.in',
    designation: 'Sewerage Operations Officer',
    badgeId: 'KMC-DRN-01',
  },
  {
    deptCode: 'ELECTRICAL',
    name: 'Er. Mahesh Jadhav',
    phoneNumber: '9822011226',
    email: 'mahesh.jadhav@kolhapur.gov.in',
    designation: 'Assistant Engineer (Electrical)',
    badgeId: 'KMC-ELE-04',
  },
  {
    deptCode: 'OTHER_CIVIC',
    name: 'Shri Amol Bhosale',
    phoneNumber: '9822011228',
    email: 'amol.bhosale@kolhapur.gov.in',
    designation: 'Civic Inspection Officer',
    badgeId: 'KMC-CIV-01',
  },
];

const FIELD_WORKERS_BY_DEPT: Record<
  string,
  Array<{ name: string; phone: string; designation: string; skills: string }>
> = {
  SOLID_WASTE: [
    { name: 'Ramesh Kamble', phone: '9765001101', designation: 'Sanitation Crew Lead', skills: 'Compactor Ops, Waste Clearance' },
    { name: 'Suresh Gaikwad', phone: '9765001102', designation: 'Sanitation Technician', skills: 'Bin Replacement, Disinfection' },
    { name: 'Lata Pawar', phone: '9765001103', designation: 'Ward Sweeping Supervisor', skills: 'Bio-waste Handling, Street Cleaning' },
  ],
  PWD_ROADS: [
    { name: 'Ganesh Suryawanshi', phone: '9765001201', designation: 'Asphalt Paving Technician', skills: 'Hot-mix Patching, Roller Ops' },
    { name: 'Datta Kore', phone: '9765001202', designation: 'Road Mason', skills: 'Paver Blocks, Curb & Footpath Repair' },
    { name: 'Vijay Magdum', phone: '9765001203', designation: 'Civil Field Technician', skills: 'Barricading, Concrete Cold-Mix' },
  ],
  WATER_SUPPLY: [
    { name: 'Santosh Salokhe', phone: '9765001301', designation: 'Senior Pipeline Fitter', skills: 'Mainline Welding, Valve Replacement' },
    { name: 'Deepak Chougule', phone: '9765001302', designation: 'Plumbing & Leak Technician', skills: 'Pressure Testing, Pipe Sealing' },
    { name: 'Sachin Nikam', phone: '9765001303', designation: 'Water Pump Operator', skills: 'Booster Pump Repair, Chlorination' },
  ],
  DRAINAGE_SEWERAGE: [
    { name: 'Kiran Mane', phone: '9765001401', designation: 'Sewer Jetting Operator', skills: 'High-Pressure Jetting, Desilting' },
    { name: 'Pravin Powar', phone: '9765001402', designation: 'Manhole Maintenance Crew', skills: 'Cover Replacement, Safety Harness' },
    { name: 'Ashok Ghatge', phone: '9765001403', designation: 'Stormwater Technician', skills: 'Gutter Unclogging, Suction Pump' },
  ],
  ELECTRICAL: [
    { name: 'Milind Kulkarni', phone: '9765001501', designation: 'Senior Lineman', skills: 'LED Fixture Replacement, Aerial Ladder' },
    { name: 'Raju More', phone: '9765001502', designation: 'Electrical Safety Technician', skills: 'Cable Fault Tracing, Transformer Safety' },
    { name: 'Nilesh Shelke', phone: '9765001503', designation: 'Streetlight Wireman', skills: 'Timer Panel Repair, Earthing' },
  ],
  OTHER_CIVIC: [
    { name: 'Sanjay Khot', phone: '9765001601', designation: 'Municipal Utility Technician', skills: 'General Maintenance, Signage Repair' },
    { name: 'Anil Yadav', phone: '9765001602', designation: 'Civic Maintenance Crew', skills: 'Park Fixtures, Public Facility Upkeep' },
    { name: 'Tushar Jadhav', phone: '9765001603', designation: 'Field Support Worker', skills: 'Site Clearing, Inspection Support' },
  ],
};

async function runSeed() {
  console.log('===============================================================');
  console.log('CivicResolve Hierarchy, RBAC & 6-Department Canonical Migration');
  console.log('===============================================================');

  // 1. Ensure PostgreSQL partial unique indexes are in place
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_single_active_super_admin
    ON "User" (role)
    WHERE role = 'SUPER_ADMIN' AND "isActive" = true;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_single_active_dept_admin_per_dept
    ON "User" ("departmentId")
    WHERE role = 'DEPARTMENT_ADMIN' AND "isActive" = true AND "departmentId" IS NOT NULL;
  `);

  // 2. Ensure exactly ONE active SUPER_ADMIN
  await prisma.user.updateMany({
    where: { role: 'SUPER_ADMIN', phoneNumber: { not: SUPER_ADMIN_PHONE } },
    data: { role: 'DEPARTMENT_ADMIN', isActive: false },
  });

  const superAdmin = await prisma.user.upsert({
    where: { phoneNumber: SUPER_ADMIN_PHONE },
    create: {
      phoneNumber: SUPER_ADMIN_PHONE,
      name: 'Sushant More',
      email: 'moresushant600@gmail.com',
      designation: 'Chief Municipal Super Administrator',
      role: 'SUPER_ADMIN',
      departmentId: null,
      district: 'Kolhapur',
      isActive: true,
    },
    update: {
      role: 'SUPER_ADMIN',
      departmentId: null,
      isActive: true,
      designation: 'Chief Municipal Super Administrator',
    },
  });
  console.log(`[1/5] Single Active SUPER_ADMIN ready: ${superAdmin.name} (${superAdmin.phoneNumber})`);

  // 3. Migrate/Upsert the exact 6 municipal departments (preserving existing FK IDs!)
  const deptMap = new Map<string, string>(); // canonical code -> dept.id
  for (const spec of CANONICAL_DEPARTMENTS) {
    const existingByName = await prisma.department.findFirst({
      where: { name: { equals: spec.name, mode: 'insensitive' } },
    });
    const existingByCode = await prisma.department.findFirst({
      where: { code: { in: [spec.code, ...spec.fallbackCodes] } },
    });
    const existing = existingByName || existingByCode;

    if (existing) {
      const updated = await prisma.department.update({
        where: { id: existing.id },
        data: {
          name: spec.name,
          code: spec.code,
          description: spec.description,
          status: 'ACTIVE',
        },
      });
      deptMap.set(spec.code, updated.id);
    } else {
      const created = await prisma.department.create({
        data: {
          name: spec.name,
          code: spec.code,
          description: spec.description,
          status: 'ACTIVE',
        },
      });
      deptMap.set(spec.code, created.id);
    }
  }
  console.log(`[2/5] 6 Canonical Municipal Departments ready: ${Array.from(deptMap.keys()).join(', ')}`);

  // Re-route any historical Drainage/Sewage complaints to Drainage & Sewerage Department
  const drainageDeptId = deptMap.get('DRAINAGE_SEWERAGE');
  if (drainageDeptId) {
    const movedDrainage = await prisma.complaint.updateMany({
      where: {
        OR: [
          { category: { contains: 'drain', mode: 'insensitive' } },
          { category: { contains: 'sew', mode: 'insensitive' } },
        ],
      },
      data: { departmentId: drainageDeptId },
    });
    console.log(`    -> Synchronized ${movedDrainage.count} Drainage/Sewerage complaint(s) to Drainage & Sewerage Department.`);
  }

  // 4. Seed exactly ONE active Primary Department Admin per department
  for (const adm of DEPT_ADMINS) {
    const deptId = deptMap.get(adm.deptCode);
    if (!deptId) continue;

    // Deactivate any other conflicting active DEPT_ADMIN in this dept cleanly
    await prisma.user.updateMany({
      where: {
        departmentId: deptId,
        role: { in: ['DEPARTMENT_ADMIN', 'ADMIN'] },
        phoneNumber: { not: adm.phoneNumber },
      },
      data: { isActive: false },
    });

    const existingAdminUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: adm.phoneNumber }, { email: adm.email }],
      },
    });

    let user;
    if (existingAdminUser) {
      user = await prisma.user.update({
        where: { id: existingAdminUser.id },
        data: {
          phoneNumber: adm.phoneNumber,
          name: adm.name,
          email: adm.email,
          designation: adm.designation,
          role: 'DEPARTMENT_ADMIN',
          departmentId: deptId,
          district: 'Kolhapur',
          isActive: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          phoneNumber: adm.phoneNumber,
          name: adm.name,
          email: adm.email,
          designation: adm.designation,
          role: 'DEPARTMENT_ADMIN',
          departmentId: deptId,
          district: 'Kolhapur',
          isActive: true,
        },
      });
    }

    await prisma.department.update({
      where: { id: deptId },
      data: {
        primaryAdminId: user.id,
        headOfficerName: user.name,
        contactEmail: adm.email,
        contactPhone: adm.phoneNumber,
      },
    });
  }
  console.log('[3/5] 6 Primary Department Admins linked cleanly (1 per department).');

  // 5. Seed Department Officers (synced across User & Officer tables)
  for (const off of DEPARTMENT_OFFICERS) {
    const deptId = deptMap.get(off.deptCode);
    if (!deptId) continue;

    const existingOffUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: off.phoneNumber }, { email: off.email }],
      },
    });

    let offUser;
    if (existingOffUser) {
      offUser = await prisma.user.update({
        where: { id: existingOffUser.id },
        data: {
          phoneNumber: off.phoneNumber,
          name: off.name,
          email: off.email,
          designation: off.designation,
          role: 'OFFICER',
          departmentId: deptId,
          district: 'Kolhapur',
          isActive: true,
        },
      });
    } else {
      offUser = await prisma.user.create({
        data: {
          phoneNumber: off.phoneNumber,
          name: off.name,
          email: off.email,
          designation: off.designation,
          role: 'OFFICER',
          departmentId: deptId,
          district: 'Kolhapur',
          isActive: true,
        },
      });
    }

    const existingOfficer = await prisma.officer.findFirst({
      where: {
        OR: [{ phoneNumber: off.phoneNumber }, { email: off.email }],
      },
    });

    let officerRecord;
    if (existingOfficer) {
      officerRecord = await prisma.officer.update({
        where: { id: existingOfficer.id },
        data: {
          name: off.name,
          phoneNumber: off.phoneNumber,
          email: off.email,
          designation: off.designation,
          badgeId: off.badgeId,
          departmentId: deptId,
          userId: offUser.id,
          isAvailable: true,
        },
      });
    } else {
      officerRecord = await prisma.officer.create({
        data: {
          name: off.name,
          phoneNumber: off.phoneNumber,
          email: off.email,
          designation: off.designation,
          badgeId: off.badgeId,
          departmentId: deptId,
          userId: offUser.id,
          isAvailable: true,
        },
      });
    }

    // Sync assignedOfficerUserId on existing complaints assigned to this Officer record
    await prisma.complaint.updateMany({
      where: { assignedOfficerId: officerRecord.id, assignedOfficerUserId: null },
      data: { assignedOfficerUserId: offUser.id },
    });
  }

  // Re-assign existing complaints whose assignedOfficerId pointed to Super Admin to their dept's lead officer
  const superAdminOfficer = await prisma.officer.findUnique({
    where: { phoneNumber: SUPER_ADMIN_PHONE },
  });
  if (superAdminOfficer) {
    const orphaned = await prisma.complaint.findMany({
      where: { assignedOfficerId: superAdminOfficer.id },
    });
    for (const cmp of orphaned) {
      const deptOff = await prisma.officer.findFirst({
        where: { departmentId: cmp.departmentId || undefined, id: { not: superAdminOfficer.id } },
      });
      if (deptOff) {
        await prisma.complaint.update({
          where: { id: cmp.id },
          data: {
            assignedOfficerId: deptOff.id,
            assignedOfficerName: deptOff.name,
            assignedOfficerUserId: deptOff.userId,
          },
        });
      } else {
        await prisma.complaint.update({
          where: { id: cmp.id },
          data: { assignedOfficerId: null, assignedOfficerName: null, assignedOfficerUserId: null },
        });
      }
    }
    await prisma.officer.delete({ where: { id: superAdminOfficer.id } });
  }
  console.log(`[4/5] Synced ${DEPARTMENT_OFFICERS.length} Department Officers with User login accounts.`);

  // 6. Seed Field Workers (EMPLOYEE RECORDS ONLY — NO User rows, NO login, NO passwords)
  let workersSeeded = 0;
  for (const [deptCode, workers] of Object.entries(FIELD_WORKERS_BY_DEPT)) {
    const deptId = deptMap.get(deptCode);
    if (!deptId) continue;

    for (const fw of workers) {
      const existingWorker = await prisma.fieldWorker.findFirst({
        where: { departmentId: deptId, name: fw.name },
      });
      if (!existingWorker) {
        await prisma.fieldWorker.create({
          data: {
            name: fw.name,
            phone: fw.phone,
            designation: fw.designation,
            skills: fw.skills,
            departmentId: deptId,
            availabilityStatus: 'AVAILABLE',
            status: 'ACTIVE',
            createdById: superAdmin.id,
          },
        });
      }
      workersSeeded++;
    }
  }
  console.log(`[5/5] Verified ${workersSeeded} non-login Field Worker employee records across 6 departments.`);

  console.log('\nSeeded Staff Credentials (Phone OTP -> use dev OTP 123456):');
  console.log(`  - SUPER_ADMIN:        ${SUPER_ADMIN_PHONE} (Sushant More)`);
  for (const adm of DEPT_ADMINS) {
    console.log(`  - DEPT_ADMIN (${adm.deptCode.padEnd(17)}): ${adm.phoneNumber} (${adm.name})`);
  }
  for (const off of DEPARTMENT_OFFICERS) {
    console.log(`  - OFFICER    (${off.deptCode.padEnd(17)}): ${off.phoneNumber} (${off.name})`);
  }
  console.log('===============================================================');
}

runSeed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
