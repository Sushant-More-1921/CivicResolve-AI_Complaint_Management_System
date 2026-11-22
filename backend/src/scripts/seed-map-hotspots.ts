import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding sample complaints and hotspot regions into Supabase DB...');

  // Ensure citizens exist
  const citizens = await prisma.user.findMany({ where: { role: 'CITIZEN' } });
  if (citizens.length === 0) {
    throw new Error('No citizens found in DB to link complaints to.');
  }
  const citizen1 = citizens[0]; // tester (8452885574)
  const citizen2 = citizens.length > 1 ? citizens[1] : citizen1; // Krushnat More (8975899477)
  const citizen3 = citizens.length > 2 ? citizens[2] : citizen1; // test (8380934905)

  // Fetch departments
  const depts = await prisma.department.findMany();
  const getDept = (code: string) => depts.find((d) => d.code === code)?.id;

  const waterDept = getDept('WATER_SEWER');
  const wasteDept = getDept('SOLID_WASTE');
  const roadsDept = getDept('PWD_ROADS');
  const elecDept = getDept('ELEC_LIGHTS');
  const healthDept = getDept('HEALTH_PEST');

  // Fetch officers
  const officers = await prisma.officer.findMany();
  const getOfficer = (nameSnippet: string) => officers.find((o) => o.name.includes(nameSnippet));

  const waterOfficer = getOfficer('Prakash Shinde');
  const wasteOfficer = getOfficer('Anita Deshmukh');
  const roadOfficer = getOfficer('Sandeep Patil');
  const elecOfficer = getOfficer('Mahesh Jadhav');

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const sampleComplaints = [
    // ==========================================
    // HOTSPOT 1: MAHALAXMI TEMPLE & BAZAAR (CRITICAL DENSITY HOTSPOT)
    // Center: ~16.6946, 74.2232 (Kolhapur Central)
    // ==========================================
    {
      trackingNumber: 'CMP-2026-HOT1A1',
      title: 'Major Water Pipeline Rupture & High-Pressure Leakage',
      description: 'Main municipal feeder pipe burst near Temple South Gate on Bhausingji Road. Continuous high-pressure water flooding pedestrian walkway and market shops.',
      category: 'Water',
      subcategory: 'Pipeline Burst',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: waterDept,
      location: 'Bhausingji Road, Near Mahalaxmi Temple South Gate, Kolhapur',
      landmark: 'Mahalaxmi Temple South Gate',
      pincode: '416012',
      region: 'Central Ward',
      latitude: 16.6948,
      longitude: 74.2230,
      priority: 'VERY_HIGH',
      status: 'IN_PROGRESS',
      citizenId: citizen1.id,
      assignedOfficerId: waterOfficer?.id,
      assignedOfficerName: waterOfficer?.name,
      slaHours: 12,
      slaDeadline: hoursAgo(-8),
      isOverdue: false,
      aiConfidence: 0.96,
      aiSuggestedCategory: 'Water Supply & Sewerage',
      aiReasoning: 'Critical infrastructure failure with immediate hazard to pilgrims and retail establishments.',
      aiUrgencyScore: 0.94,
      createdAt: hoursAgo(4),
      timeline: [
        { status: 'SUBMITTED', note: 'Grievance lodged via Mobile Portal with geo-coordinates', author: citizen1.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(4) },
        { status: 'ASSIGNED', note: 'Assigned to Water Supply Sub-Division 1. Emergency response dispatched.', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', createdAt: hoursAgo(3.5) },
        { status: 'IN_PROGRESS', note: 'Repair crew on site isolating valve section.', author: waterOfficer?.name || 'Field Officer', authorRole: 'OFFICER', createdAt: hoursAgo(2) },
      ]
    },
    {
      trackingNumber: 'CMP-2026-HOT1B2',
      title: 'Heavy Solid Waste Accumulation & Overflowing Dumpster',
      description: 'Community garbage collection point overflowing onto vegetable market street. Foul odor and health hazard for visiting pilgrims and local vendors.',
      category: 'Solid Waste',
      subcategory: 'Garbage Dump Overflow',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: wasteDept,
      location: 'Gujri Market Lane, Near Bindu Chowk, Kolhapur',
      landmark: 'Bindu Chowk Circle',
      pincode: '416012',
      region: 'Central Ward',
      latitude: 16.6953,
      longitude: 74.2241,
      priority: 'HIGH',
      status: 'SUBMITTED',
      citizenId: citizen2.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaHours: 24,
      slaDeadline: hoursAgo(-20),
      isOverdue: false,
      aiConfidence: 0.92,
      aiSuggestedCategory: 'Solid Waste & Sanitation',
      aiReasoning: 'Public health concern in dense commercial pilgrim zone.',
      aiUrgencyScore: 0.85,
      createdAt: hoursAgo(3),
      timeline: [
        { status: 'SUBMITTED', note: 'Logged by citizen. AI verified category Solid Waste (92% confidence)', author: citizen2.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(3) }
      ]
    },
    {
      trackingNumber: 'CMP-2026-HOT1C3',
      title: 'Open Sewage Drainage Chamber Overflowing into Street',
      description: 'Underground drainage backflow overflowing sewage water across Shivaji Road intersection. Pedestrians unable to cross road safely.',
      category: 'Drainage',
      subcategory: 'Sewage Overflow',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: waterDept,
      location: 'Shivaji Road Crossing, Near Bhausingji Road, Kolhapur',
      landmark: 'Shivaji Road Corner',
      pincode: '416012',
      region: 'Central Ward',
      latitude: 16.6942,
      longitude: 74.2225,
      priority: 'VERY_HIGH',
      status: 'SUBMITTED',
      citizenId: citizen3.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaHours: 12,
      slaDeadline: hoursAgo(-8),
      isOverdue: false,
      aiConfidence: 0.95,
      aiSuggestedCategory: 'Water Supply & Sewerage',
      aiReasoning: 'Biohazard risk with potential contamination of surrounding retail food stalls.',
      aiUrgencyScore: 0.92,
      createdAt: hoursAgo(2),
      timeline: [
        { status: 'SUBMITTED', note: 'Grievance submitted with high urgency flag', author: citizen3.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(2) }
      ]
    },
    {
      trackingNumber: 'CMP-2026-HOT1D4',
      title: 'High-Mast Public Streetlight Grid Failure',
      description: 'Entire high-mast lighting pole non-functional at Bindu Chowk. Critical security concern due to high pedestrian movement post-sunset.',
      category: 'Streetlight',
      subcategory: 'Pole Dark',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: elecDept,
      location: 'Bindu Chowk Circle, Kolhapur',
      landmark: 'Central Circle Pole #4',
      pincode: '416012',
      region: 'Central Ward',
      latitude: 16.6957,
      longitude: 74.2248,
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      citizenId: citizen1.id,
      assignedOfficerId: elecOfficer?.id,
      assignedOfficerName: elecOfficer?.name,
      slaHours: 24,
      slaDeadline: hoursAgo(-18),
      isOverdue: false,
      aiConfidence: 0.89,
      aiSuggestedCategory: 'Electrical & Street Lighting',
      aiReasoning: 'Public safety risk during night operations.',
      aiUrgencyScore: 0.70,
      createdAt: hoursAgo(6),
      timeline: [
        { status: 'SUBMITTED', note: 'Grievance registered', author: citizen1.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(6) },
        { status: 'ASSIGNED', note: 'Assigned to Electrical Department for ballast / fuse inspection', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', createdAt: hoursAgo(5) }
      ]
    },
    {
      trackingNumber: 'CMP-2026-HOT1E5',
      title: 'Deep Road Crater & Broken Paver Blocks on Heritage Corridor',
      description: 'Multiple deep craters and displaced granite paving blocks causing two-wheeler accidents on approach road to temple.',
      category: 'Roads',
      subcategory: 'Deep Pothole',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: roadsDept,
      location: 'Mahadwar Road, Mahalaxmi Temple West Gate, Kolhapur',
      landmark: 'Mahadwar Gate Arch',
      pincode: '416012',
      region: 'Central Ward',
      latitude: 16.6940,
      longitude: 74.2220,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      citizenId: citizen2.id,
      assignedOfficerId: roadOfficer?.id,
      assignedOfficerName: roadOfficer?.name,
      slaHours: 36,
      slaDeadline: hoursAgo(-24),
      isOverdue: false,
      aiConfidence: 0.94,
      aiSuggestedCategory: 'Roads & Bridges Department',
      aiReasoning: 'Severe road surface damage with continuous vehicle hazard.',
      aiUrgencyScore: 0.86,
      createdAt: hoursAgo(10),
      timeline: [
        { status: 'SUBMITTED', note: 'Reported by commuter', author: citizen2.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(10) },
        { status: 'ASSIGNED', note: 'Assigned to Road Maintenance Team', author: 'Auto-Routing', authorRole: 'SYSTEM', createdAt: hoursAgo(8) },
        { status: 'IN_PROGRESS', note: 'Cold mix patch material dispatched', author: roadOfficer?.name || 'Field Officer', authorRole: 'OFFICER', createdAt: hoursAgo(3) }
      ]
    },

    // ==========================================
    // HOTSPOT 2: RAJARAMPURI COMMERCIAL & RESIDENTIAL HUB (HIGH DENSITY HOTSPOT)
    // Center: ~16.6850, 74.2480 (Rajarampuri 2nd/3rd Lane)
    // ==========================================
    {
      trackingNumber: 'CMP-2026-HOT2A1',
      title: 'Unbarricaded Excavation Trench Left on Main Road',
      description: 'Deep 6-foot trench dug across road for cable laying left open without safety barricades or caution tape. Highly dangerous for evening traffic.',
      category: 'Roads',
      subcategory: 'Open Trench',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: roadsDept,
      location: 'Rajarampuri 2nd Lane, Near Janata Bank, Kolhapur',
      landmark: 'Janata Bank Corner',
      pincode: '416008',
      region: 'East Ward',
      latitude: 16.6852,
      longitude: 74.2478,
      priority: 'VERY_HIGH',
      status: 'SUBMITTED',
      citizenId: citizen1.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaHours: 12,
      slaDeadline: hoursAgo(-10),
      isOverdue: false,
      aiConfidence: 0.97,
      aiSuggestedCategory: 'Roads & Bridges Department',
      aiReasoning: 'Immediate life-safety hazard on busy commercial thoroughfare.',
      aiUrgencyScore: 0.95,
      createdAt: hoursAgo(2),
      timeline: [
        { status: 'SUBMITTED', note: 'Urgent citizen submission with GPS geotag', author: citizen1.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(2) }
      ]
    },
    {
      trackingNumber: 'CMP-2026-HOT2B2',
      title: 'Illegal Commercial Debris & Garbage Dumping on Public Footpath',
      description: 'Building renovation debris and plastic packaging dumped along pedestrian pathway blocking shop access and senior citizen walkway.',
      category: 'Solid Waste',
      subcategory: 'Debris Dumping',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: wasteDept,
      location: 'Rajarampuri 3rd Lane Corner, Kolhapur',
      landmark: 'Opposite State Bank ATM',
      pincode: '416008',
      region: 'East Ward',
      latitude: 16.6858,
      longitude: 74.2485,
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      citizenId: citizen2.id,
      assignedOfficerId: wasteOfficer?.id,
      assignedOfficerName: wasteOfficer?.name,
      slaHours: 24,
      slaDeadline: hoursAgo(-12),
      isOverdue: false,
      aiConfidence: 0.91,
      aiSuggestedCategory: 'Solid Waste & Sanitation',
      aiReasoning: 'Encroachment of public right-of-way by commercial waste.',
      aiUrgencyScore: 0.72,
      createdAt: hoursAgo(12),
      timeline: [
        { status: 'SUBMITTED', note: 'Grievance lodged', author: citizen2.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(12) },
        { status: 'ASSIGNED', note: 'Assigned to Ward Sanitary Officer', author: 'Auto-Routing', authorRole: 'SYSTEM', createdAt: hoursAgo(10) },
        { status: 'IN_PROGRESS', note: 'Notice issued to premises owner; municipal dump truck scheduled.', author: wasteOfficer?.name || 'Sanitary Inspector', authorRole: 'OFFICER', createdAt: hoursAgo(4) }
      ]
    },
    {
      trackingNumber: 'CMP-2026-HOT2C3',
      title: 'Low Water Pressure & Intermittent Contaminated Supply',
      description: 'Residential society receiving muddy water with inadequate pressure for the past 48 hours. Water filter shows heavy sediment.',
      category: 'Water',
      subcategory: 'Low Pressure & Quality',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: waterDept,
      location: 'Cyber Chowk, Near University Road, Kolhapur',
      landmark: 'Cyber Chowk Circle',
      pincode: '416008',
      region: 'East Ward',
      latitude: 16.6845,
      longitude: 74.2470,
      priority: 'HIGH',
      status: 'ASSIGNED',
      citizenId: citizen3.id,
      assignedOfficerId: waterOfficer?.id,
      assignedOfficerName: waterOfficer?.name,
      slaHours: 24,
      slaDeadline: hoursAgo(-16),
      isOverdue: false,
      aiConfidence: 0.93,
      aiSuggestedCategory: 'Water Supply & Sewerage',
      aiReasoning: 'Public health concern regarding drinking water supply.',
      aiUrgencyScore: 0.88,
      createdAt: hoursAgo(8),
      timeline: [
        { status: 'SUBMITTED', note: 'Submitted via citizen app', author: citizen3.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(8) },
        { status: 'ASSIGNED', note: 'Assigned to Sub-Divisional Officer for water testing', author: 'Auto-Routing', authorRole: 'SYSTEM', createdAt: hoursAgo(7) }
      ]
    },

    // ==========================================
    // HOTSPOT 3: PATTAN KODOLI / ALATWADI (RECURRING AREA TESTING)
    // Nearby existing CMP-2026-C9E2C2D4 (16.6587427, 74.3644854)
    // ==========================================
    {
      trackingNumber: 'CMP-2026-REC3A1',
      title: 'Secondary Water Pipeline Leakage & Ground Erosion',
      description: 'Second pipeline leakage detected 80 meters from previous Ganesh Mandir repair point. Water soaking road foundation and eroding asphalt edge.',
      category: 'Water',
      subcategory: 'Secondary Leak',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: waterDept,
      location: 'Near Ganesh Mandir, Alatwadi, Pattan Kodoli',
      landmark: 'Ganesh Mandir Approach',
      pincode: '416202',
      region: 'South Zone',
      latitude: 16.6591,
      longitude: 74.3649,
      priority: 'HIGH',
      status: 'SUBMITTED',
      citizenId: citizen1.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaHours: 24,
      slaDeadline: hoursAgo(-22),
      isOverdue: false,
      aiConfidence: 0.94,
      aiSuggestedCategory: 'Water Supply & Sewerage',
      aiReasoning: 'Recurring pipe joint failure identified within 90m of previously resolved case.',
      aiUrgencyScore: 0.84,
      createdAt: hoursAgo(2),
      timeline: [
        { status: 'SUBMITTED', note: 'AI matched cluster proximity to previous grievance CMP-2026-C9E2C2D4', author: citizen1.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(2) }
      ]
    },

    // ==========================================
    // HOTSPOT 4: TARABAI PARK (ROUTINE OPERATIONAL TESTING)
    // Center: ~16.7120, 74.2380
    // ==========================================
    {
      trackingNumber: 'CMP-2026-TAR4A1',
      title: 'Damaged Electric Junction Box with Exposed Wiring',
      description: 'Pedestrian streetlight junction box lid knocked off by delivery vehicle. Exposed 230V live cables accessible to children.',
      category: 'Streetlight',
      subcategory: 'Exposed Wiring',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: elecDept,
      location: 'Circuit House Road, Tarabai Park, Kolhapur',
      landmark: 'Opposite Circuit House Gate 2',
      pincode: '416003',
      region: 'North Ward',
      latitude: 16.7124,
      longitude: 74.2382,
      priority: 'VERY_HIGH',
      status: 'RESOLVED',
      citizenId: citizen2.id,
      assignedOfficerId: elecOfficer?.id,
      assignedOfficerName: elecOfficer?.name,
      slaHours: 12,
      slaDeadline: daysAgo(1),
      isOverdue: false,
      aiConfidence: 0.98,
      aiSuggestedCategory: 'Electrical & Street Lighting',
      aiReasoning: 'Immediate electrocution risk near pedestrian jogging track.',
      aiUrgencyScore: 0.96,
      resolutionRemarks: 'Junction box replaced with lockable polycarbonate enclosure. Circuit breaker tested and certified safe.',
      resolvedAt: hoursAgo(6),
      createdAt: daysAgo(1),
      timeline: [
        { status: 'SUBMITTED', note: 'Reported by morning walker', author: citizen2.name || 'Citizen', authorRole: 'CITIZEN', createdAt: daysAgo(1) },
        { status: 'ASSIGNED', note: 'Emergency dispatch to Electrical Sub-Division', author: 'Auto-Routing', authorRole: 'SYSTEM', createdAt: daysAgo(0.9) },
        { status: 'IN_PROGRESS', note: 'Line disconnected and junction box enclosure installed', author: elecOfficer?.name || 'Field Officer', authorRole: 'OFFICER', createdAt: daysAgo(0.5) },
        { status: 'RESOLVED', note: 'Resolved and safety clearance uploaded.', author: elecOfficer?.name || 'Field Officer', authorRole: 'OFFICER', createdAt: hoursAgo(6) }
      ]
    },

    // ==========================================
    // HOTSPOT 5: PUNE DIVISION / SHIVAJINAGAR (CROSS-DIVISION REGIONAL TESTING)
    // Center: ~18.5314, 73.8446
    // ==========================================
    {
      trackingNumber: 'CMP-2026-PUN5A1',
      title: 'Overflowing Municipal Garbage Skip on University Access Road',
      description: 'Major student thoroughfare blocked by large uncollected garbage mound. Waste spilled onto road causing severe traffic hazard and foul stench.',
      category: 'Solid Waste',
      subcategory: 'Dumpster Overflow',
      divisionId: 'div-pune',
      divisionName: 'Pune Division',
      districtId: 'dist-pune',
      districtName: 'Pune District',
      authorityId: 'auth-pmc',
      authorityName: 'Pune Municipal Corporation (PMC)',
      departmentId: wasteDept,
      location: 'JM Road, Near Modern College, Shivajinagar, Pune',
      landmark: 'Modern College Crossing',
      pincode: '411005',
      region: 'Shivajinagar Zone',
      latitude: 18.5314,
      longitude: 73.8446,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      citizenId: citizen1.id,
      assignedOfficerId: wasteOfficer?.id,
      assignedOfficerName: wasteOfficer?.name,
      slaHours: 24,
      slaDeadline: hoursAgo(-14),
      isOverdue: false,
      aiConfidence: 0.95,
      aiSuggestedCategory: 'Solid Waste & Sanitation',
      aiReasoning: 'Heavy pedestrian footfall near educational institution.',
      aiUrgencyScore: 0.88,
      createdAt: hoursAgo(10),
      timeline: [
        { status: 'SUBMITTED', note: 'Submitted via citizen app', author: citizen1.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(10) },
        { status: 'IN_PROGRESS', note: 'Compactor vehicle scheduled for collection', author: 'Pune Municipal Control', authorRole: 'SYSTEM', createdAt: hoursAgo(6) }
      ]
    },
    {
      trackingNumber: 'CMP-2026-PUN5B2',
      title: 'Water Supply Contamination & Chemical Odor in Model Colony',
      description: 'Potable tap water supply contaminated with industrial effluent smell and dark tint. Multiple families reporting digestive sickness.',
      category: 'Water',
      subcategory: 'Water Contamination',
      divisionId: 'div-pune',
      divisionName: 'Pune Division',
      districtId: 'dist-pune',
      districtName: 'Pune District',
      authorityId: 'auth-pmc',
      authorityName: 'Pune Municipal Corporation (PMC)',
      departmentId: waterDept,
      location: 'Model Colony, Deep Bunglow Chowk, Shivajinagar, Pune',
      landmark: 'Deep Bunglow Chowk',
      pincode: '411016',
      region: 'Shivajinagar Zone',
      latitude: 18.5340,
      longitude: 73.8395,
      priority: 'VERY_HIGH',
      status: 'SUBMITTED',
      citizenId: citizen2.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaHours: 12,
      slaDeadline: hoursAgo(-8),
      isOverdue: false,
      aiConfidence: 0.98,
      aiSuggestedCategory: 'Water Supply & Sewerage',
      aiReasoning: 'Critical public health emergency with potential epidemic threat.',
      aiUrgencyScore: 0.98,
      createdAt: hoursAgo(4),
      timeline: [
        { status: 'SUBMITTED', note: 'Emergency health incident logged. Directorate alerted.', author: citizen2.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(4) }
      ]
    },

    // ==========================================
    // UNMAPPED COMPLAINT (TESTING NO GPS / LOCATION PENDING DRAWER)
    // ==========================================
    {
      trackingNumber: 'CMP-2026-UNM6A1',
      title: 'Overflowing Public Sanitation Block at Central Bus Stand',
      description: 'Public urinal and septic tank overflow reported by commuters inside Central Bus Stand depot premises. Location coordinates unavailable from simple mobile phone.',
      category: 'Drainage',
      subcategory: 'Septic Overflow',
      divisionId: 'div-kolhapur',
      divisionName: 'Kolhapur Division',
      districtId: 'dist-kolhapur',
      districtName: 'Kolhapur District',
      authorityId: 'auth-kmc',
      authorityName: 'Kolhapur Municipal Corporation (KMC)',
      departmentId: waterDept,
      location: 'Central ST Bus Stand Depot Premises, CBS Kolhapur',
      landmark: 'Behind Platform 4',
      pincode: '416001',
      region: 'Central Ward',
      latitude: null,
      longitude: null,
      priority: 'HIGH',
      status: 'SUBMITTED',
      citizenId: citizen3.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaHours: 24,
      slaDeadline: hoursAgo(-18),
      isOverdue: false,
      aiConfidence: 0.91,
      aiSuggestedCategory: 'Water Supply & Sewerage',
      aiReasoning: 'Severe sanitary nuisance in transport hub.',
      aiUrgencyScore: 0.85,
      createdAt: hoursAgo(6),
      timeline: [
        { status: 'SUBMITTED', note: 'Complaint lodged without GPS fix. Pending manual coordinates assignment.', author: citizen3.name || 'Citizen', authorRole: 'CITIZEN', createdAt: hoursAgo(6) }
      ]
    }
  ];

  let createdCount = 0;
  for (const item of sampleComplaints) {
    const existing = await prisma.complaint.findUnique({
      where: { trackingNumber: item.trackingNumber }
    });

    if (existing) {
      console.log(`Skipping existing ${item.trackingNumber}`);
      continue;
    }

    const { timeline, ...complaintData } = item;
    const created = await prisma.complaint.create({
      data: {
        ...complaintData,
        timeline: {
          create: timeline
        }
      }
    });
    console.log(`Created: ${created.trackingNumber} (${created.category}, ${created.priority}, ${created.status}) at ${created.location}`);
    createdCount++;
  }

  console.log(`Seeding complete! Successfully inserted ${createdCount} sample complaints.`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

