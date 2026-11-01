import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  {
    name: 'Roads & Bridges Department',
    code: 'PWD_ROADS',
    description: 'Potholes, asphalt damages, road resurfacing, footpaths, bridges, and traffic signage',
    contactEmail: 'roads@kolhapur.gov.in',
    contactPhone: '+912312651234',
    headOfficerName: 'Er. Sandeep Patil (Executive Engineer)',
  },
  {
    name: 'Water Supply & Sewerage',
    code: 'WATER_SEWER',
    description: 'Pipeline bursts, water contamination, low pressure, drainage overflow, and sewer blockage',
    contactEmail: 'watersupply@kolhapur.gov.in',
    contactPhone: '+912312651235',
    headOfficerName: 'Er. Prakash Shinde (Superintending Engineer)',
  },
  {
    name: 'Solid Waste & Sanitation',
    code: 'SOLID_WASTE',
    description: 'Uncollected garbage, open dumping, street sweeping, dead animal disposal, public bin maintenance',
    contactEmail: 'sanitation@kolhapur.gov.in',
    contactPhone: '+912312651236',
    headOfficerName: 'Dr. Anita Deshmukh (Chief Medical Officer of Health)',
  },
  {
    name: 'Electrical & Street Lighting',
    code: 'ELEC_LIGHTS',
    description: 'Non-functional streetlights, dangerous hanging wires, open transformer panels, high-mast lamps',
    contactEmail: 'electricity@kolhapur.gov.in',
    contactPhone: '+912312651237',
    headOfficerName: 'Er. Mahesh Jadhav (Chief Electrical Engineer)',
  },
  {
    name: 'Public Health & Pest Control',
    code: 'HEALTH_PEST',
    description: 'Mosquito fogging, dengue/malaria outbreak prevention, stray animal vaccination, public hygiene',
    contactEmail: 'health@kolhapur.gov.in',
    contactPhone: '+912312651238',
    headOfficerName: 'Dr. Vijay Chougule (Health Officer)',
  },
  {
    name: 'Town Planning & Encroachment',
    code: 'TOWN_PLAN',
    description: 'Unauthorized construction, footpath encroachment, illegal hoardings, roadside hawker obstruction',
    contactEmail: 'encroachment@kolhapur.gov.in',
    contactPhone: '+912312651239',
    headOfficerName: 'Smt. Kavita Pawar (Assistant Town Planner)',
  },
];

async function seed() {
  console.log(`
========================================================================
🏛️  CIVICRESOLVE - SUPABASE DATABASE SEED & VERIFICATION
========================================================================`);

  try {
    console.log('🔄 Connecting to database and verifying schema...');
    await prisma.$connect();
    console.log('✅ Successfully connected to database!');

    // 1. Seed Departments
    console.log('\n🏢 Seeding Municipal Departments...');
    const departmentMap: Record<string, string> = {};
    for (const dept of DEPARTMENTS) {
      const record = await prisma.department.upsert({
        where: { name: dept.name },
        update: {
          code: dept.code,
          description: dept.description,
          contactEmail: dept.contactEmail,
          contactPhone: dept.contactPhone,
          headOfficerName: dept.headOfficerName,
        },
        create: dept,
      });
      departmentMap[dept.code] = record.id;
      console.log(`   • ${dept.name} [ID: ${record.id}]`);
    }

    // 2. Seed Officers
    console.log('\n👮 Seeding Field & Desk Officers...');
    const OFFICERS = [
      {
        name: 'Er. Sandeep Patil',
        phoneNumber: '9822011223',
        email: 'sandeep.patil@kolhapur.gov.in',
        designation: 'Executive Engineer (Roads)',
        badgeId: 'KMC-RDS-01',
        departmentId: departmentMap['PWD_ROADS'],
        activeCases: 3,
        resolvedCases: 48,
        rating: 4.8,
      },
      {
        name: 'Er. Prakash Shinde',
        phoneNumber: '9822011224',
        email: 'prakash.shinde@kolhapur.gov.in',
        designation: 'Sub-Divisional Officer (Water)',
        badgeId: 'KMC-WTR-02',
        departmentId: departmentMap['WATER_SEWER'],
        activeCases: 2,
        resolvedCases: 62,
        rating: 4.9,
      },
      {
        name: 'Dr. Anita Deshmukh',
        phoneNumber: '9822011225',
        email: 'anita.deshmukh@kolhapur.gov.in',
        designation: 'Sanitary Inspector (Solid Waste)',
        badgeId: 'KMC-SWM-03',
        departmentId: departmentMap['SOLID_WASTE'],
        activeCases: 4,
        resolvedCases: 95,
        rating: 4.7,
      },
      {
        name: 'Er. Mahesh Jadhav',
        phoneNumber: '9822011226',
        email: 'mahesh.jadhav@kolhapur.gov.in',
        designation: 'Assistant Engineer (Electrical)',
        badgeId: 'KMC-ELE-04',
        departmentId: departmentMap['ELEC_LIGHTS'],
        activeCases: 1,
        resolvedCases: 74,
        rating: 4.6,
      },
    ];

    for (const officer of OFFICERS) {
      const record = await prisma.officer.upsert({
        where: { phoneNumber: officer.phoneNumber },
        update: {
          name: officer.name,
          email: officer.email,
          designation: officer.designation,
          badgeId: officer.badgeId,
          departmentId: officer.departmentId,
          activeCases: officer.activeCases,
          resolvedCases: officer.resolvedCases,
          rating: officer.rating,
        },
        create: officer,
      });
      console.log(`   • ${officer.name} (${officer.designation}) [Badge: ${officer.badgeId}]`);
    }

    // 3. Seed Administrator Account
    console.log('\n👑 Seeding Administrative Account...');
    const adminUser = await prisma.user.upsert({
      where: { phoneNumber: '9822011223' },
      update: {
        name: 'Rajesh Sharma',
        role: 'ADMIN',
        designation: 'Chief Municipal Commissioner',
        email: 'commissioner@kolhapur.gov.in',
      },
      create: {
        phoneNumber: '9822011223',
        name: 'Rajesh Sharma',
        role: 'ADMIN',
        designation: 'Chief Municipal Commissioner',
        email: 'commissioner@kolhapur.gov.in',
        district: 'Kolhapur',
      },
    });
    console.log(`   • Admin: ${adminUser.name} (${adminUser.role}) [Phone: +91 ${adminUser.phoneNumber}]`);

    console.log(`
========================================================================
🎉 SUPABASE DATABASE SEEDED SUCCESSFULLY!
All tables (Departments, Officers, Users, Complaints) are ready to use.
========================================================================`);
  } catch (error) {
    console.error('❌ Database seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
