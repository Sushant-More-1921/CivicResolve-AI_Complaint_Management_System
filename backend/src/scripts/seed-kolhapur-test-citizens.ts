import '../config/env';
import { prisma } from '../config/database';

interface KolhapurComplaintSeed {
  trackingNumber: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  deptCode: string;
  location: string;
  landmark: string;
  pincode: string;
  region: string;
  latitude: number;
  longitude: number;
  priority: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'SUBMITTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'RESOLVED' | 'ASSIGNED';
  imageUrl: string;
  resolutionRemarks?: string;
  timelineNotes: Array<{
    status: string;
    note: string;
    author: string;
    authorRole: string;
    actionType: string;
  }>;
}

const CITIZEN_COMPLAINTS: Record<number, KolhapurComplaintSeed[]> = {
  // ==========================================
  // CITIZEN 1: Tester 1
  // ==========================================
  1: [
    {
      trackingNumber: 'CMP-2026-KLP-T1-01',
      title: 'Overflowing Municipal Garbage Container near Rajampuri Market',
      description: 'The community municipal waste bin on 4th lane has been overflowing for the past 3 days. Stray cattle and dogs are scattering waste across the road, creating an unhygienic environment for pedestrians and local shopkeepers.',
      category: 'Solid Waste',
      subcategory: 'Garbage Dump Overflow',
      deptCode: 'SOLID_WASTE',
      location: '4th Lane Corner, Near Janata Bank, Rajampuri, Kolhapur',
      landmark: 'Janata Sahakari Bank ATM',
      pincode: '416008',
      region: 'Kolhapur Central',
      latitude: 16.7028,
      longitude: 74.2462,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      imageUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Grievance lodged via CivicResolve Portal with photo evidence and GPS proof.', author: 'Tester 1', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'ASSIGNED', note: 'Auto-routed to Solid Waste Department (Kolhapur Central Zone).', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', actionType: 'AUTO_ROUTED' },
        { status: 'IN_PROGRESS', note: 'Sanitation vehicle KMC-SW-14 dispatched for waste clearance and disinfectant spray.', author: 'Dr. Anita Deshmukh', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T1-02',
      title: 'Major Drinking Water Pipeline Leakage on Main Road',
      description: 'Underground clean water pipeline has fractured, causing heavy water fountain gushing onto the road since morning. Thousands of liters of potable water are being wasted and water pressure in nearby households has completely dropped.',
      category: 'Water Supply',
      subcategory: 'Pipeline Leakage',
      deptCode: 'WATER_SUPPLY',
      location: '8th Lane Main Road, Near Shri Ram Mandir, Rajampuri, Kolhapur',
      landmark: 'Shri Ram Mandir',
      pincode: '416008',
      region: 'Kolhapur Central',
      latitude: 16.7015,
      longitude: 74.2480,
      priority: 'VERY_HIGH',
      status: 'SUBMITTED',
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Emergency water leakage reported with live photograph.', author: 'Tester 1', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'ASSIGNED', note: 'Grievance routed to Water Supply Department emergency valve crew.', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', actionType: 'AUTO_ROUTED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T1-03',
      title: 'Dangerous Deep Potholes on Shahupuri Railway Station Approach',
      description: 'Multiple severe potholes of 10-15 cm depth have formed on the main station approach road following recent rainfall. Two-wheelers frequently skid during night hours, posing acute risk of serious accidents.',
      category: 'Road Infrastructure',
      subcategory: 'Pothole Repair',
      deptCode: 'PWD_ROADS',
      location: 'Station Road, Opposite Kolhapur Railway Station, Kolhapur',
      landmark: 'Chhatrapati Shahu Maharaj Terminus',
      pincode: '416001',
      region: 'Kolhapur North',
      latitude: 16.7035,
      longitude: 74.2385,
      priority: 'HIGH',
      status: 'UNDER_REVIEW',
      imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Road defect grievance registered with high-resolution image.', author: 'Tester 1', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'UNDER_REVIEW', note: 'PWD engineer assessing bitumen patch requirements and traffic diversion.', author: 'Er. Sandeep Patil', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T1-04',
      title: 'Non-Functional Streetlights Creating Complete Dark Spot',
      description: 'Continuous row of four LED street lamps has remained dark for over a week. The street is completely pitch black at night, causing safety and security concerns for women and senior citizens.',
      category: 'Street Lighting',
      subcategory: 'Streetlight Malfunction',
      deptCode: 'ELECTRICAL',
      location: '11th Lane, Near Shahu Smarak Bhavan, Rajampuri, Kolhapur',
      landmark: 'Shahu Smarak Bhavan Lane',
      pincode: '416008',
      region: 'Kolhapur Central',
      latitude: 16.6998,
      longitude: 74.2492,
      priority: 'MEDIUM',
      status: 'RESOLVED',
      imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80',
      resolutionRemarks: 'Electrical maintenance crew replaced burned driver circuits and restored all 4 LED fixtures.',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Streetlight dark spot reported via civic portal.', author: 'Tester 1', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Electrical wing lineman dispatched with replacement LED fixtures.', author: 'Er. Mahesh Jadhav', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
        { status: 'RESOLVED', note: 'Power restored. All 4 fixtures tested and illuminating normally.', author: 'Er. Mahesh Jadhav', authorRole: 'OFFICER', actionType: 'RESOLVED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T1-05',
      title: 'Blocked Stormwater Drain and Sewage Overflow',
      description: 'Underground sewer line is chocked with silt and plastic debris, causing dark black drainage water to spill over the pedestrian pavement and into adjacent commercial basements.',
      category: 'Drainage & Sewerage',
      subcategory: 'Drain Blockage',
      deptCode: 'DRAINAGE_SEWERAGE',
      location: 'Shahupuri 3rd Lane, Near Basant Bahar Talkies, Kolhapur',
      landmark: 'Basant Bahar Cinema Hall',
      pincode: '416001',
      region: 'Kolhapur North',
      latitude: 16.7020,
      longitude: 74.2370,
      priority: 'HIGH',
      status: 'ASSIGNED',
      imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Sewer backflow grievance registered by citizen.', author: 'Tester 1', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'ASSIGNED', note: 'Assigned to KMC Drainage Division Jetting Machine Unit 2.', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', actionType: 'AUTO_ROUTED' },
      ],
    },
  ],

  // ==========================================
  // CITIZEN 2: Tester 2
  // ==========================================
  2: [
    {
      trackingNumber: 'CMP-2026-KLP-T2-01',
      title: 'Severe Asphalt Breakdown and Road Crater near CPR Hospital',
      description: 'Large crater on ambulance entry route to CPR Hospital. Ambulances carrying emergency patients are experiencing severe jolts and delays navigating the damaged road surface.',
      category: 'Road Infrastructure',
      subcategory: 'Road Surface Crater',
      deptCode: 'PWD_ROADS',
      location: 'CPR Hospital Chowk, Dasara Chowk Road, Kolhapur',
      landmark: 'Chhatrapati Pramilatai Raje Hospital Main Gate',
      pincode: '416002',
      region: 'Kolhapur Central',
      latitude: 16.6985,
      longitude: 74.2310,
      priority: 'VERY_HIGH',
      status: 'IN_PROGRESS',
      imageUrl: 'https://images.unsplash.com/photo-1580974852861-c381510bc98a?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Urgent road defect filed by citizen citing hospital access hazard.', author: 'Tester 2', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Emergency road maintenance gang deployed with cold-mix asphalt.', author: 'Er. Rohan Shinde', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T2-02',
      title: 'Illegal Commercial Waste Dumping along Panchganga Riverbed',
      description: 'Commercial waste and chemical packaging sacks are being dumped late at night near the riverbank. This is contaminating the river water supply and polluting the revered ghat area.',
      category: 'Solid Waste',
      subcategory: 'Illegal Dumping',
      deptCode: 'SOLID_WASTE',
      location: 'Panchganga Ghat Road, Near Shivaji Bridge, Kolhapur',
      landmark: 'Historical Shivaji Bridge',
      pincode: '416012',
      region: 'Kolhapur North',
      latitude: 16.7045,
      longitude: 74.2190,
      priority: 'HIGH',
      status: 'SUBMITTED',
      imageUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'River pollution incident registered with photo evidence.', author: 'Tester 2', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T2-03',
      title: 'Contaminated Yellowish Tap Water Supply in Somwar Peth',
      description: 'Municipal water supplied in the morning hours is murky, turbid, and smells foul. Multiple families suspect cross-contamination with nearby sewer lines, creating risk of waterborne illnesses.',
      category: 'Water Supply',
      subcategory: 'Water Quality Issue',
      deptCode: 'WATER_SUPPLY',
      location: 'Papachi Tikti Chowk, Somwar Peth, Kolhapur',
      landmark: 'Papachi Tikti Monument',
      pincode: '416012',
      region: 'Kolhapur Central',
      latitude: 16.6938,
      longitude: 74.2212,
      priority: 'VERY_HIGH',
      status: 'ASSIGNED',
      imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Contaminated water complaint submitted by resident.', author: 'Tester 2', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'ASSIGNED', note: 'Forwarded to Municipal Water Quality Testing Laboratory & SDO.', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', actionType: 'AUTO_ROUTED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T2-04',
      title: 'Broken Stormwater Grating and Open Gutter Hazard',
      description: 'Cast iron drainage grating is cracked and sunken in the middle of the crowded wholesale bazaar. Pedestrians and porters carrying loads have suffered ankle injuries.',
      category: 'Drainage & Sewerage',
      subcategory: 'Broken Manhole Chamber',
      deptCode: 'DRAINAGE_SEWERAGE',
      location: 'Laxmipuri Vegetable Market Lane, Kolhapur',
      landmark: 'Vegetable Wholesale Mandi Gate',
      pincode: '416002',
      region: 'Kolhapur Central',
      latitude: 16.6992,
      longitude: 74.2280,
      priority: 'HIGH',
      status: 'RESOLVED',
      imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      resolutionRemarks: 'Installed heavy-duty ductile iron chamber slab and reinforced concrete surround.',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Bazaar gutter hazard reported.', author: 'Tester 2', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Drainage repair crew replaced sunken metal frame.', author: 'Er. Snehal Kadam', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
        { status: 'RESOLVED', note: 'Permanent slab installed, cemented and road opened.', author: 'Er. Snehal Kadam', authorRole: 'OFFICER', actionType: 'RESOLVED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T2-05',
      title: 'Dangly Live Electric Cable Dropping Low over Footpath',
      description: 'Overhead power supply line connecting civic illumination pole has snapped loose from bracket and is hanging at head height above the pedestrian walkway.',
      category: 'Street Lighting',
      subcategory: 'Electrical Hazard',
      deptCode: 'ELECTRICAL',
      location: 'Bhavani Mandap Road, Near Old Palace Gate, Kolhapur',
      landmark: 'Historical Bhavani Mandap',
      pincode: '416012',
      region: 'Kolhapur Central',
      latitude: 16.6955,
      longitude: 74.2238,
      priority: 'HIGH',
      status: 'UNDER_REVIEW',
      imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Loose electrical line danger lodged with live photograph.', author: 'Tester 2', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'UNDER_REVIEW', note: 'Electrical inspection officer reviewing pole isolation and rewiring.', author: 'Er. Mahesh Jadhav', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
  ],

  // ==========================================
  // CITIZEN 3: Tester 3
  // ==========================================
  3: [
    {
      trackingNumber: 'CMP-2026-KLP-T3-01',
      title: 'Continuous Stagnant Water and Mosquito Breeding at Tarabai Park',
      description: 'Rainwater and greywater runoff has collected into a massive stagnant pool due to broken roadside curbing. Stagnation is breeding mosquitoes and spreading bad odor across residential bungalows.',
      category: 'Drainage & Sewerage',
      subcategory: 'Water Stagnation',
      deptCode: 'DRAINAGE_SEWERAGE',
      location: 'Tarabai Park Main Road, Opp Circuit House, Kolhapur',
      landmark: 'Government Circuit House',
      pincode: '416003',
      region: 'Kolhapur North',
      latitude: 16.7118,
      longitude: 74.2345,
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Stagnant water complaint registered by citizen.', author: 'Tester 3', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Suction tanker deployed to clear standing water and abate mosquito breeding.', author: 'Er. Snehal Kadam', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T3-02',
      title: 'Damaged Footpath Paver Blocks on Nagala Park Avenue',
      description: 'Interlocking cement paver blocks along the pedestrian walkway have dislodged and cracked due to tree root expansion. Senior citizens walking to the administrative offices struggle to walk safely.',
      category: 'Road Infrastructure',
      subcategory: 'Footpath Maintenance',
      deptCode: 'PWD_ROADS',
      location: 'Collector Office Road, Nagala Park, Kolhapur',
      landmark: 'District Collectorate Office',
      pincode: '416003',
      region: 'Kolhapur North',
      latitude: 16.7142,
      longitude: 74.2318,
      priority: 'MEDIUM',
      status: 'SUBMITTED',
      imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Footpath damage reported with photos.', author: 'Tester 3', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T3-03',
      title: 'Uncollected Garden Waste and Tree Prunings Blocking Lane',
      description: 'Huge piles of cut tree branches and garden cuttings have been dumped on the lane corner for 5 days. Dry branches are encroaching on road space and creating a fire hazard.',
      category: 'Solid Waste',
      subcategory: 'Green Waste Disposal',
      deptCode: 'SOLID_WASTE',
      location: 'Ruikar Colony 2nd Lane, Near Shivaji Park, Kolhapur',
      landmark: 'Shivaji Park Playground',
      pincode: '416005',
      region: 'Kolhapur East',
      latitude: 16.7095,
      longitude: 74.2412,
      priority: 'LOW',
      status: 'ASSIGNED',
      imageUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Green waste accumulation reported.', author: 'Tester 3', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'ASSIGNED', note: 'Assigned to Ward Horticultural Waste Truck.', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', actionType: 'AUTO_ROUTED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T3-04',
      title: 'Low Water Pressure in High-Rise Zone of Ruikar Colony',
      description: 'Water supply pressure has drastically diminished over the last week. Water fails to reach overhead storage tanks even with domestic booster pumps running.',
      category: 'Water Supply',
      subcategory: 'Low Pressure Supply',
      deptCode: 'WATER_SUPPLY',
      location: 'Pawar Colony, Near Kawala Naka Water Tank, Kolhapur',
      landmark: 'Kawala Naka Elevated Storage Reservoir',
      pincode: '416005',
      region: 'Kolhapur East',
      latitude: 16.7082,
      longitude: 74.2445,
      priority: 'HIGH',
      status: 'RESOLVED',
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?auto=format&fit=crop&w=800&q=80',
      resolutionRemarks: 'Repaired faulty pneumatic pressure valve at Kawala Naka feeder station.',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Low water pressure grievance registered.', author: 'Tester 3', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Hydraulic engineer calibrated valve distribution grid.', author: 'Er. Prakash Shinde', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
        { status: 'RESOLVED', note: 'Feeder station valve repaired. Standard 2.2 bar pressure restored.', author: 'Er. Prakash Shinde', authorRole: 'OFFICER', actionType: 'RESOLVED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T3-05',
      title: 'Streetlight Pole Rusted and Tilting dangerously towards Traffic',
      description: 'Octagonal high-mast streetlight pole at junction base is corroded through with rust and is noticeably tilted toward the roadway, threatening collapse under gusty winds.',
      category: 'Street Lighting',
      subcategory: 'Structural Pole Defect',
      deptCode: 'ELECTRICAL',
      location: 'Dabholkar Corner Junction, Kolhapur',
      landmark: 'Central Bus Stand Entrance',
      pincode: '416001',
      region: 'Kolhapur Central',
      latitude: 16.7070,
      longitude: 74.2452,
      priority: 'HIGH',
      status: 'UNDER_REVIEW',
      imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Tilting light pole structural safety hazard reported.', author: 'Tester 3', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'UNDER_REVIEW', note: 'Structural safety audit in progress; civil foundation replacement planned.', author: 'Er. Mahesh Jadhav', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
  ],

  // ==========================================
  // CITIZEN 4: Tester 4
  // ==========================================
  4: [
    {
      trackingNumber: 'CMP-2026-KLP-T4-01',
      title: 'Litter and Plastic Accumulation at Rankala Lake West Promenade',
      description: 'Food wrappers, single-use plastic cups, and coconut shells left by evening tourists have accumulated along the lake banks. The waste is blowing into Rankala lake and harming aquatic birdlife.',
      category: 'Solid Waste',
      subcategory: 'Tourist Spot Cleanup',
      deptCode: 'SOLID_WASTE',
      location: 'Rankala Chaupati, West Promenade, Kolhapur',
      landmark: 'Rankala Chaupati Food Court',
      pincode: '416012',
      region: 'Kolhapur South',
      latitude: 16.6915,
      longitude: 74.2180,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      imageUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Promenade litter accumulation reported with lake boundary photos.', author: 'Tester 4', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Special cleanliness drive team dispatched for manual shoreline cleanup.', author: 'Vaishnavi Mane', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T4-02',
      title: 'Open Manhole Lid on Children Play Route near Sandhyamath',
      description: 'Concrete manhole cover over main sewer line is completely broken open. Depth of hole is over 8 feet. Located right outside school and playground route, posing extreme danger of someone falling inside.',
      category: 'Drainage & Sewerage',
      subcategory: 'Missing Manhole Cover',
      deptCode: 'DRAINAGE_SEWERAGE',
      location: 'Near Sandhyamath Mandir, Shivaji Peth, Kolhapur',
      landmark: 'Sandhyamath Temple Complex',
      pincode: '416012',
      region: 'Kolhapur South',
      latitude: 16.6925,
      longitude: 74.2205,
      priority: 'VERY_HIGH',
      status: 'SUBMITTED',
      imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Life-safety hazard: Open 8-foot sewer hole reported.', author: 'Tester 4', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T4-03',
      title: 'Severe Road Subsidence and Asphalt Cracking near Kalamba Lake',
      description: 'Road embankment along the canal has subsided by nearly 8 inches, causing longitudinal fissures across both lanes. Heavy transport trucks are struggling and road could collapse further.',
      category: 'Road Infrastructure',
      subcategory: 'Road Subsidence',
      deptCode: 'PWD_ROADS',
      location: 'Kalamba Ring Road, Near Water Filtration Plant, Kolhapur',
      landmark: 'Kalamba Water Treatment Facility',
      pincode: '416007',
      region: 'Kolhapur South',
      latitude: 16.6695,
      longitude: 74.2315,
      priority: 'HIGH',
      status: 'ASSIGNED',
      imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Embankment road subsidence grievance registered with photo.', author: 'Tester 4', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'ASSIGNED', note: 'Assigned to PWD Kolhapur South Highway Engineering Team.', author: 'Auto-Routing Engine', authorRole: 'SYSTEM', actionType: 'AUTO_ROUTED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T4-04',
      title: 'Muddy Water Backflow in Residential Connections of Mangalwar Peth',
      description: 'Muddy brown water with dirt sediments flowing from house taps for 2 consecutive days. Problem appeared after road trenching work punctured municipal distribution pipe.',
      category: 'Water Supply',
      subcategory: 'Pipeline Contamination',
      deptCode: 'WATER_SUPPLY',
      location: 'Subhash Road, Mangalwar Peth, Kolhapur',
      landmark: 'Shree Mahalaxmi High School Lane',
      pincode: '416012',
      region: 'Kolhapur Central',
      latitude: 16.6922,
      longitude: 74.2255,
      priority: 'VERY_HIGH',
      status: 'RESOLVED',
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?auto=format&fit=crop&w=800&q=80',
      resolutionRemarks: 'Excavated and sealed joint fracture; flushed line with chlorine solution and restored pure water supply.',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Water contamination grievance submitted by resident.', author: 'Tester 4', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'IN_PROGRESS', note: 'Trenching fracture identified and replacement sleeve applied.', author: 'Er. Kavita Naik', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
        { status: 'RESOLVED', note: 'Pipeline sealed and lab samples tested clear. Water restored.', author: 'Er. Kavita Naik', authorRole: 'OFFICER', actionType: 'RESOLVED' },
      ],
    },
    {
      trackingNumber: 'CMP-2026-KLP-T4-05',
      title: 'Flickering and Dim Streetlights near Gangavesh Chowk',
      description: 'Streetlights around Gangavesh circle are rapidly flickering on and off throughout the evening due to fluctuating phase voltage, causing poor visibility for vehicular traffic.',
      category: 'Street Lighting',
      subcategory: 'Low Voltage & Flickering',
      deptCode: 'ELECTRICAL',
      location: 'Gangavesh Chowk, Near Dudh Katta, Kolhapur',
      landmark: 'Gangavesh Historical Arch',
      pincode: '416012',
      region: 'Kolhapur Central',
      latitude: 16.6908,
      longitude: 74.2208,
      priority: 'MEDIUM',
      status: 'UNDER_REVIEW',
      imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80',
      timelineNotes: [
        { status: 'SUBMITTED', note: 'Voltage fluctuation and streetlight flickering reported.', author: 'Tester 4', authorRole: 'CITIZEN', actionType: 'SUBMISSION' },
        { status: 'UNDER_REVIEW', note: 'Substation transformer load balancing in progress with MSEDCL.', author: 'Er. Mahesh Jadhav', authorRole: 'OFFICER', actionType: 'STATUS_UPDATE' },
      ],
    },
  ],
};

async function main() {
  console.log('🏛️ Starting Kolhapur Test Citizens & Complaints Seeder...\n');

  // Step 1: Fetch and Rename 4 Citizens
  const citizens = await prisma.user.findMany({
    where: { role: 'CITIZEN' },
    orderBy: { createdAt: 'asc' },
  });

  if (citizens.length < 4) {
    console.warn(`Found only ${citizens.length} citizen(s). Expected at least 4.`);
  }

  console.log(`Found ${citizens.length} citizen users in database.`);

  const citizenConfigs = [
    {
      name: 'Tester 1',
      email: 'tester1@gmail.com',
      ward: 'Ward 12 - Rajampuri',
      address: '4th Lane, Rajampuri, Kolhapur',
      pincode: '416008',
    },
    {
      name: 'Tester 2',
      email: 'tester2@gmail.com',
      ward: 'Ward 7 - Shahupuri',
      address: 'Station Road, Shahupuri, Kolhapur',
      pincode: '416001',
    },
    {
      name: 'Tester 3',
      email: 'tester3@gmail.com',
      ward: 'Ward 4 - Tarabai Park',
      address: 'Circuit House Road, Tarabai Park, Kolhapur',
      pincode: '416003',
    },
    {
      name: 'Tester 4',
      email: 'tester4@gmail.com',
      ward: 'Ward 18 - Rankala',
      address: 'Rankala Lake Promenade, Shivaji Peth, Kolhapur',
      pincode: '416012',
    },
  ];

  const updatedCitizens: Array<{ id: string; name: string; phone: string; index: number }> = [];

  for (let i = 0; i < Math.min(citizens.length, 4); i++) {
    const rawCitizen = citizens[i];
    const config = citizenConfigs[i];

    const updated = await prisma.user.update({
      where: { id: rawCitizen.id },
      data: {
        name: config.name,
        email: config.email,
        district: 'Kolhapur',
        ward: config.ward,
        address: config.address,
        pincode: config.pincode,
        isActive: true,
      },
    });

    updatedCitizens.push({
      id: updated.id,
      name: updated.name || config.name,
      phone: updated.phoneNumber,
      index: i + 1,
    });

    console.log(`✅ Citizen ${i + 1} Renamed: "${rawCitizen.name}" -> "${updated.name}" (${updated.phoneNumber})`);
  }

  // Step 2: Fetch Department Map and Officer Map for linking
  const departments = await prisma.department.findMany();
  const deptMap = new Map<string, string>(); // code -> id
  for (const d of departments) {
    if (d.code) deptMap.set(d.code, d.id);
  }

  const officers = await prisma.user.findMany({
    where: { role: 'OFFICER' },
  });
  const defaultOfficer = officers[0] || null;

  // Step 3: Insert 5 Complaints for each of the 4 citizens
  console.log('\n--- Seeding 5 Complaints per Citizen in Kolhapur Region ---');

  for (const citizen of updatedCitizens) {
    const seedList = CITIZEN_COMPLAINTS[citizen.index] || [];
    console.log(`\nAdding ${seedList.length} grievances for ${citizen.name} (ID: ${citizen.id}, Mobile: ${citizen.phone})...`);

    for (const c of seedList) {
      const departmentId = deptMap.get(c.deptCode) || departments[0]?.id;

      // Clean existing complaint if re-running
      const existing = await prisma.complaint.findUnique({
        where: { trackingNumber: c.trackingNumber },
      });
      if (existing) {
        await prisma.evidence.deleteMany({ where: { complaintId: existing.id } });
        await prisma.complaintTimeline.deleteMany({ where: { complaintId: existing.id } });
        await prisma.complaintAttachment.deleteMany({ where: { complaintId: existing.id } });
        await prisma.notification.deleteMany({ where: { complaintId: existing.id } });
        await prisma.complaint.delete({ where: { id: existing.id } });
      }

      const now = new Date();
      const slaDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // Create Complaint
      const createdComplaint = await prisma.complaint.create({
        data: {
          trackingNumber: c.trackingNumber,
          title: c.title,
          description: c.description,
          category: c.category,
          subcategory: c.subcategory,
          divisionId: 'div-kolhapur',
          divisionName: 'Kolhapur Division',
          districtId: 'dist-kolhapur',
          districtName: 'Kolhapur District',
          authorityId: 'auth-kmc',
          authorityName: 'Kolhapur Municipal Corporation (KMC)',
          departmentId: departmentId,
          location: c.location,
          landmark: c.landmark,
          pincode: c.pincode,
          region: c.region,
          latitude: c.latitude,
          longitude: c.longitude,
          imageUrl: c.imageUrl,
          priority: c.priority,
          status: c.status,
          citizenId: citizen.id,
          slaHours: 48,
          slaDeadline: slaDeadline,
          isOverdue: false,
          aiConfidence: 0.94,
          aiSuggestedCategory: c.category,
          aiReasoning: 'Validated by civic NLP classifier with high geo-proximity confidence in Kolhapur.',
          aiUrgencyScore: c.priority === 'VERY_HIGH' ? 0.95 : c.priority === 'HIGH' ? 0.82 : 0.65,
          resolutionRemarks: c.resolutionRemarks || null,
          resolvedAt: c.status === 'RESOLVED' ? now : null,
        },
      });

      // Create Evidence Record
      if (defaultOfficer) {
        await prisma.evidence.create({
          data: {
            complaintId: createdComplaint.id,
            uploadedByOfficerId: defaultOfficer.id,
            stage: 'BEFORE',
            fileUrl: c.imageUrl,
            caption: `Geotagged site evidence photograph at ${c.location}`,
            verified: true,
            verifiedById: defaultOfficer.id,
            verifiedAt: now,
          },
        });
      }

      // Create Complaint Attachment Record
      await prisma.complaintAttachment.create({
        data: {
          complaintId: createdComplaint.id,
          fileUrl: c.imageUrl,
          fileName: `${c.trackingNumber}_evidence.jpg`,
          fileType: 'image/jpeg',
          uploadedBy: citizen.name,
        },
      });

      // Create Timeline Records
      for (let tIndex = 0; tIndex < c.timelineNotes.length; tIndex++) {
        const t = c.timelineNotes[tIndex];
        const timelineTime = new Date(now.getTime() - (c.timelineNotes.length - tIndex) * 2 * 60 * 60 * 1000);
        await prisma.complaintTimeline.create({
          data: {
            complaintId: createdComplaint.id,
            status: t.status,
            note: t.note,
            author: t.author,
            authorRole: t.authorRole,
            actionType: t.actionType,
            createdAt: timelineTime,
          },
        });
      }

      // Create Notification Record for Citizen
      await prisma.notification.create({
        data: {
          userId: citizen.id,
          complaintId: createdComplaint.id,
          phoneNumber: citizen.phone,
          title: `Complaint #${c.trackingNumber} ${c.status === 'RESOLVED' ? 'Resolved' : c.status === 'IN_PROGRESS' ? 'In Progress' : 'Submitted'}`,
          message: c.status === 'RESOLVED'
            ? `Your complaint regarding "${c.title}" has been resolved by Municipal Corporation.`
            : `Your complaint has been submitted successfully and routed to ${c.category} department at Kolhapur.`,
          type: c.status === 'RESOLVED' ? 'RESOLUTION' : 'STATUS_CHANGE',
          channel: 'ALL',
          deliveryStatus: 'DELIVERED',
          isRead: false,
          link: `/citizen/dashboard`,
        },
      });

      console.log(`  -> [${c.trackingNumber}] ${c.title} (${c.category} | ${c.status})`);
    }
  }

  // Summary Count
  const totalInDb = await prisma.complaint.count();
  console.log(`\n🎉 SEEDING COMPLETED SUCCESSFULLY! Total complaints in DB: ${totalInDb}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeder failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

