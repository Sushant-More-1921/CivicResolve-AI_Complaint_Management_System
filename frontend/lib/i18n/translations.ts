export type Language = "en" | "hi" | "mr";

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  shortLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", shortLabel: "EN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", shortLabel: "HI" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", shortLabel: "MR" },
];

export const translations = {
  en: {
    // Brand & Header
    brandName: "CivicResolve",
    brandSubtitle: "Citizen Grievance & Municipal Services Portal",
    directorateSubtitle: "Directorate of Municipal Services • Officer Console",
    citizenServicesSubtitle: "Citizen Grievance Services",
    portalSubtitle: "Government Civic Services • Citizen Console",
    trackGrievanceSubtitle: "Track Grievance Status",
    lodgeGrievanceSubtitle: "Lodge Citizen Grievance",
    registrationSubtitle: "Citizen Grievance Redressal • Registration",
    signInSubtitle: "Sign in with your mobile number to lodge civic complaints and track resolution progress.",
    
    // Header actions
    myComplaints: "My Complaints",
    logout: "Logout",
    citizenLogin: "Citizen Login",
    officerPortal: "Officer Portal",
    officerLogin: "Officer Login",
    officerSecurityConsole: "Officer Security Console",
    alreadyRegisteredLogin: "Already Registered? Login →",
    verified: "VERIFIED",
    home: "Home",
    backToHome: "Back to Home",
    trackStatus: "Track Status",
    registerComplaint: "Register Complaint",

    // Home Page Hero
    heroTitle: "CivicResolve — Grievance Redressal Portal",
    heroSubtitle:
      "Lodge grievances for municipal waste, water issues, road damages, or drainage problems. Track resolution progress with transparent statutory timelines.",

    // Action 1: Register Complaint
    action1Title: "Register a Complaint",
    action1Desc:
      "Submit a new grievance with location details and optional photo evidence for prompt action.",
    action1Btn: "Register Complaint",

    // Action 2: Track Complaint
    action2Title: "Track Complaint Status",
    action2Desc:
      "Check current status, assigned officer, and estimated resolution timeline using your reference number.",
    action2Placeholder: "e.g. CMP-2026-1042",
    action2Btn: "Track Status",

    // Action 3: My Complaints
    action3Title: "My Complaints",
    action3Desc:
      "View your past and active complaints, resolution photos, and official updates registered under your phone number.",
    action3Btn: "View My Complaints",

    // Categories Section
    categoriesTitle: "Civic Service Categories",
    categoriesSubtitle:
      "Statutory resolution timeframes according to Public Service Guarantee norms.",
    catActionLink: "Lodge complaint in this category",

    // Individual Categories
    catSolidWaste: "Solid Waste Management",
    catSolidWasteDesc: "Overflowing dumpsters, garbage heaps, plastic waste",
    catSolidWasteSla: "48 Hours",

    catWater: "Water Supply & Pipelines",
    catWaterDesc: "Pipeline bursts, low water pressure, contaminated supply",
    catWaterSla: "24 Hours",

    catRoads: "Roads & Potholes",
    catRoadsDesc: "Damaged roads, potholes, broken sidewalks",
    catRoadsSla: "72 Hours",

    catSewage: "Sewage & Drainage",
    catSewageDesc: "Choked storm drains, overflowing sewage, manhole safety",
    catSewageSla: "24 Hours",

    catStreetlights: "Streetlight Maintenance",
    catStreetlightsDesc: "Non-functioning streetlights, faulty poles, dark junctions",
    catStreetlightsSla: "48 Hours",

    catHazardous: "Hazardous & Chemical Waste",
    catHazardousDesc: "Illegal industrial dumping, toxic fumes, medical waste",
    catHazardousSla: "12 Hours (Urgent)",

    // How it works / Redressal Process
    processTitle: "Redressal Process",
    processSubtitle:
      "Transparent workflow from initial submission to on-site resolution verification.",
    step1Title: "Submit Grievance",
    step1Desc:
      "Provide problem details, ward location, and upload photo proof. A unique tracking reference is generated.",
    step2Title: "Officer Assignment",
    step2Desc:
      "Grievance is assigned to the appropriate ward engineer or sanitation inspector with a defined statutory deadline.",
    step3Title: "Resolution & Verification",
    step3Desc:
      "Field staff remediates the issue and submits completion proof. Citizens can inspect the timeline directly.",

    // Footer
    helplineText: "Civic Complaint Redressal & Directorate of Public Services • Helpline: 1916 (Toll-Free)",
    allRightsReserved: "CivicResolve. All rights reserved.",
    citizenCharter: "Citizen Charter",

    // Track Page
    trackTitle: "Track Complaint Status",
    trackSubtitle: "Enter your official Complaint Number (e.g., CMP-2026-1042 or CMP-1042) to inspect real-time status, assigned officer, and updates.",
    trackInputPlaceholder: "Enter Complaint Number (e.g., CMP-2026-1042)...",
    checkStatusBtn: "Check Status",
    sampleComplaintNumbers: "Sample Complaint Numbers:",

    // New Complaint Page
    lodgeTitle: "Register a Civic Grievance",
    lodgeSubtitle: "Report an environmental or civic issue in your neighborhood. An official reference number will be generated to track resolution progress.",
    selectCategory: "Select Complaint Category",
    locationDetails: "Location & Ward Details",
    wardPlaceholder: "Select or enter ward number",
    landmarkPlaceholder: "Nearby landmark or specific address",
    descriptionLabel: "Detailed Description of Issue",
    descriptionPlaceholder: "Describe the grievance clearly (e.g., Overflowing garbage bin near main market, water pipeline leakage...)",
    uploadEvidence: "Upload Photographic Proof (Optional)",
    submitGrievanceBtn: "Submit Grievance",

    // Common Status & UI
    statusPending: "Pending Verification",
    statusAssigned: "Assigned to Officer",
    statusInProgress: "In Progress / Remediation",
    statusResolved: "Resolved & Verified",
    statusRejected: "Rejected / Duplicate",
    priorityLow: "Low",
    priorityMedium: "Medium",
    priorityHigh: "High",
    priorityUrgent: "Critical / Urgent",
    loading: "Loading...",
    languageLabel: "Language",

    // Grievance Form
    formBreadcrumbHome: "Home",
    formBreadcrumbMyComplaints: "My Complaints",
    formBreadcrumbRegister: "Register Complaint",
    formHeading: "Register a Civic Grievance",
    formSubheading: "Report an environmental or civic issue in your neighborhood. An official reference number will be generated to track resolution progress.",
    stepCategory: "1. Complaint Category",
    slaHours: "h SLA",
    subIssueType: "Specific Sub-Issue Type",
    stepDescription: "2. Complaint Description",
    voiceSpeak: "Speak to Type (Voice Input)",
    voiceListening: "Listening... (Click to stop)",
    formDescriptionPlaceholder: "Describe the exact location, landmarks, severity, and how long this issue has persisted...",
    formLandmarkHint: "Provide landmarks (school, hospital, market) to prioritize response.",
    charactersCount: "characters",
    standardResolutionWindow: "Standard Resolution Window:",
    hoursFor: "Hours for",
    stepLocation: "3. Select Location",
    useGps: "Use Live Device GPS",
    divisionDistrict: "Division & District",
    municipalAuthority: "Municipal Authority",
    streetAddress: "Street Address, Ward Number or Landmark",
    streetAddressPlaceholder: "e.g. Ward 12, Near New High School, Shivaji Road, Kolhapur North",
    coordinatesLabel: "Coordinates:",
    stepPhoto: "4. Upload Photo (Optional but recommended)",
    uploadPhotoPrompt: "Upload from Camera or Gallery",
    uploadPhotoSpecs: "JPG, PNG, WebP up to 10MB",
    pickSamplePhoto: "Or pick a test sample image:",
    sampleGarbage: "Garbage Dumpster",
    samplePipeline: "Pipeline Burst",
    samplePothole: "Road Pothole",
    evidenceAttached: "Evidence Attached",
    btnCancel: "Cancel",
    btnSubmitComplaint: "Submit Complaint",
    modalSuccessTitle: "Complaint Submitted Successfully!",
    modalAcceptedBy: "Your complaint has been accepted by",
    modalRecorded: "and recorded in the system.",
    complaintNumberLabel: "Complaint Number",
    modalSaveNote: "Save this complaint number to track live status or updates.",
    statutorySlaWindow: "Statutory SLA Window",
    btnGoToDashboard: "Go to My Complaints",
    btnTrackStatus: "Track Complaint Status",
    btnRegisterAnother: "Register Another Complaint",
    footerTagline: "CivicResolve • Directorate of Municipal & Environmental Services",

    // Grievance Categories & Subcategories
    catNameSolidWaste: "Solid Waste Management",
    catNameWaterSupply: "Water Supply & Leakage",
    catNameRoads: "Roads, Potholes & Footpaths",
    catNameSewage: "Sewage & Drainage Overflow",
    catNameStreetlights: "Streetlight Malfunction",
    catNameHazardous: "Hazardous Chemical & Bio-Waste",
    catNameOtherCivic: "Other Civic Grievance",

    subDumpster: "Overflowing Commercial Dumpster",
    subStreetGarbage: "Street Garbage Accumulation",
    subMissedWaste: "Missed Waste Collection",
    subPlasticDumping: "Plastic Debris Dumping",

    subPipelineRupture: "Main Pipeline Rupture",
    subContaminatedWater: "Contaminated / Turbid Water",
    subLowPressure: "Low Pressure Supply",
    subValveOverflow: "Valve Overflow / Water Wasting",

    subDangerousPothole: "Dangerous Pothole Cluster",
    subCavedAsphalt: "Caved-in Asphalt",
    subMissingManhole: "Missing Manhole Cover",
    subBrokenFootpath: "Broken Pedestrian Footpath",

    subChokedDrain: "Choked Stormwater Drain",
    subSewageBackflow: "Sewage Backflow in Street",
    subOpenSeptic: "Open Septic Hazard",
    subMonsoonWaterlogging: "Monsoon Waterlogging",

    subDarkIntersection: "Complete Dark Intersection",
    subFlickeringLight: "Flickering Light",
    subDamagedPole: "Damaged Electric Pole",
    subUncoveredWire: "Uncovered Electrical Wire",

    subBioWasteDumping: "Hospital Bio-Waste Dumping",
    subChemicalRunoff: "Industrial Chemical Runoff",
    subToxicFumes: "Toxic Fume Release",
    subDumpingNearWater: "Illegal Dumping near Waterbody",

    subParkNeglect: "Public Park Neglect",
    subTreeCutting: "Illegal Tree Cutting",
    subEncroachment: "Encroachment of Public Land",
    subNoisePollution: "Noise Pollution",

    // Citizen Dashboard
    tabComplaints: "Complaints & Status",
    tabFeedback: "My Feedback & Ratings",
    tabProfile: "Citizen Profile & Jurisdiction",
    statTotalLodged: "Total Lodged",
    statRecordedGrievances: "Recorded Grievances",
    statUnderProcess: "Under Process",
    statFieldWork: "Field Work In Progress",
    statRemediated: "Remediated & Verified",
    statOfficialPhoto: "Official Photo Proof",
    statFeedbackProvided: "Feedback Provided",
    statAwaitingRating: "Awaiting Rating",
    statAllRatingsUpToDate: "All Ratings Up to Date",
    filterAll: "All",
    filterActive: "Under Process / Active",
    filterResolved: "Resolved & Closed",
    filterCritical: "Critical Priority",
    btnLodgeGrievance: "Lodge Grievance",
    btnEditProfile: "Edit Citizen Profile",
    aadhaarVerified: "Aadhaar Verified",
  },

  hi: {
    // Brand & Header
    brandName: "CivicResolve",
    brandSubtitle: "नागरिक शिकायत और नगर निगम सेवा पोर्टल",
    directorateSubtitle: "नगर निगम सेवा निदेशालय • अधिकारी कंसोल",
    citizenServicesSubtitle: "नागरिक शिकायत निवारण सेवा",
    portalSubtitle: "सरकारी नागरिक सेवाएं • नागरिक कंसोल",
    trackGrievanceSubtitle: "शिकायत की स्थिति ट्रैक करें",
    lodgeGrievanceSubtitle: "नागरिक शिकायत दर्ज करें",
    registrationSubtitle: "नागरिक शिकायत निवारण • पंजीकरण",
    signInSubtitle: "नागरिक शिकायत दर्ज करने और समाधान प्रगति ट्रैक करने के लिए अपने मोबाइल नंबर से साइन इन करें।",

    // Header actions
    myComplaints: "मेरी शिकायतें",
    logout: "लॉगआउट",
    citizenLogin: "नागरिक लॉगिन",
    officerPortal: "अधिकारी पोर्टल",
    officerLogin: "अधिकारी लॉगिन",
    officerSecurityConsole: "अधिकारी सुरक्षा कंसोल",
    alreadyRegisteredLogin: "पहले से पंजीकृत हैं? लॉगिन करें →",
    verified: "सत्यापित",
    home: "होम",
    backToHome: "होम पर वापस जाएं",
    trackStatus: "स्थिति ट्रैक करें",
    registerComplaint: "शिकायत दर्ज करें",

    // Home Page Hero
    heroTitle: "CivicResolve — नागरिक शिकायत निवारण पोर्टल",
    heroSubtitle:
      "नगर निगम कचरा, जल आपूर्ति, टूटी सड़कें, या जल निकासी समस्याओं के लिए शिकायत दर्ज करें। पारदर्शी वैधानिक समय-सीमा के साथ समाधान की प्रगति ट्रैक करें।",

    // Action 1: Register Complaint
    action1Title: "शिकायत दर्ज करें",
    action1Desc:
      "त्वरित कार्रवाई के लिए स्थान विवरण और वैकल्पिक फोटो प्रमाण के साथ एक नई शिकायत प्रस्तुत करें।",
    action1Btn: "शिकायत दर्ज करें",

    // Action 2: Track Complaint
    action2Title: "शिकायत स्थिति ट्रैक करें",
    action2Desc:
      "अपने संदर्भ संख्या (Complaint ID) का उपयोग करके वर्तमान स्थिति, नियुक्त अधिकारी और अनुमानित समय-सीमा की जांच करें।",
    action2Placeholder: "उदा. CMP-2026-1042",
    action2Btn: "स्थिति ट्रैक करें",

    // Action 3: My Complaints
    action3Title: "मेरी शिकायतें",
    action3Desc:
      "अपने पंजीकृत मोबाइल नंबर से जुड़ी पिछली और सक्रिय शिकायतें, समाधान फोटो और आधिकारिक अपडेट देखें।",
    action3Btn: "मेरी शिकायतें देखें",

    // Categories Section
    categoriesTitle: "नागरिक सेवा श्रेणियां",
    categoriesSubtitle:
      "लोक सेवा गारंटी अधिनियम के अनुसार वैधानिक समाधान समय-सीमा।",
    catActionLink: "इस श्रेणी में शिकायत दर्ज करें",

    // Individual Categories
    catSolidWaste: "ठोस कचरा प्रबंधन",
    catSolidWasteDesc: "ओवरफ्लो कूड़ेदान, कचरे के ढेर, प्लास्टिक कचरा",
    catSolidWasteSla: "48 घंटे",

    catWater: "जल आपूर्ति और पाइपलाइन",
    catWaterDesc: "पाइपलाइन फटना, कम पानी का दबाव, दूषित जलापूर्ति",
    catWaterSla: "24 घंटे",

    catRoads: "सड़कें और गड्ढे",
    catRoadsDesc: "क्षतिग्रस्त सड़कें, गड्ढे, टूटे फुटपाथ",
    catRoadsSla: "72 घंटे",

    catSewage: "सीवेज और जल निकासी",
    catSewageDesc: "बंद बरसाती नालियां, ओवरफ्लो सीवेज, खुला मैनहोल",
    catSewageSla: "24 घंटे",

    catStreetlights: "स्ट्रीटलाइट रखरखाव",
    catStreetlightsDesc: "बंद स्ट्रीटलाइट्स, खराब खंभे, अंधेरे चौराहे",
    catStreetlightsSla: "48 घंटे",

    catHazardous: "खतरनाक और रासायनिक कचरा",
    catHazardousDesc: "अवैध औद्योगिक डंपिंग, जहरीला धुआं, बायोमेडिकल कचरा",
    catHazardousSla: "12 घंटे (अत्यावश्यक)",

    // How it works / Redressal Process
    processTitle: "निवारण प्रक्रिया",
    processSubtitle:
      "शिकायत दर्ज करने से लेकर ऑन-साइट समाधान सत्यापन तक पारदर्शी कार्यप्रवाह।",
    step1Title: "शिकायत दर्ज करें",
    step1Desc:
      "समस्या का विवरण, वार्ड स्थान दर्ज करें और फोटो प्रमाण अपलोड करें। एक विशिष्ट ट्रैकिंग संदर्भ नंबर जनरेट होता है।",
    step2Title: "अधिकारी नियुक्ति",
    step2Desc:
      "शिकायत को तय समय-सीमा के साथ संबंधित वार्ड इंजीनियर या स्वच्छता निरीक्षक को सौंपा जाता है।",
    step3Title: "समाधान और सत्यापन",
    step3Desc:
      "क्षेत्रीय कर्मचारी मौके पर समस्या का समाधान करते हैं और कार्य पूर्णता प्रमाण अपलोड करते हैं। नागरिक सीधे स्थिति की पुष्टि कर सकते हैं।",

    // Footer
    helplineText: "नागरिक शिकायत निवारण एवं लोक सेवा निदेशालय • हेल्पलाइन: 1916 (टोल-फ्री)",
    allRightsReserved: "CivicResolve. सर्वाधिकार सुरक्षित।",
    citizenCharter: "नागरिक घोषणापत्र (Citizen Charter)",

    // Track Page
    trackTitle: "शिकायत स्थिति ट्रैक करें",
    trackSubtitle: "रियल-टाइम स्थिति, नियुक्त अधिकारी और आधिकारिक अपडेट जानने के लिए अपना शिकायत नंबर (उदा. CMP-2026-1042) दर्ज करें।",
    trackInputPlaceholder: "शिकायत संख्या दर्ज करें (उदा. CMP-2026-1042)...",
    checkStatusBtn: "स्थिति जांचें",
    sampleComplaintNumbers: "नमूना शिकायत संख्या:",

    // New Complaint Page
    lodgeTitle: "नागरिक शिकायत दर्ज करें",
    lodgeSubtitle: "अपने क्षेत्र की पर्यावरणीय या नागरिक समस्या की रिपोर्ट करें। निवारण प्रगति ट्रैक करने के लिए आधिकारिक संदर्भ संख्या दी जाएगी।",
    selectCategory: "शिकायत श्रेणी चुनें",
    locationDetails: "स्थान और वार्ड विवरण",
    wardPlaceholder: "वार्ड नंबर चुनें या लिखें",
    landmarkPlaceholder: "निकटतम लैंडमार्क या विशिष्ट पता",
    descriptionLabel: "समस्या का विस्तृत विवरण",
    descriptionPlaceholder: "समस्या को स्पष्ट रूप से समझाएं (उदा. मुख्य बाजार के पास कचरे का ढेर, पानी की पाइपलाइन टूटी है...)",
    uploadEvidence: "फोटो प्रमाण अपलोड करें (वैकल्पिक)",
    submitGrievanceBtn: "शिकायत सबमिट करें",

    // Common Status & UI
    statusPending: "सत्यापन लंबित",
    statusAssigned: "अधिकारी को सौंपा गया",
    statusInProgress: "प्रगति पर / निवारण कार्य जारी",
    statusResolved: "समाधानित और सत्यापित",
    statusRejected: "अस्वीकृत / डुप्लिकेट",
    priorityLow: "कम",
    priorityMedium: "मध्यम",
    priorityHigh: "उच्च",
    priorityUrgent: "गंभीर / अति-आवश्यक",
    loading: "लोड हो रहा है...",
    languageLabel: "भाषा",

    // Grievance Form
    formBreadcrumbHome: "होम",
    formBreadcrumbMyComplaints: "मेरी शिकायतें",
    formBreadcrumbRegister: "शिकायत दर्ज करें",
    formHeading: "नागरिक शिकायत दर्ज करें",
    formSubheading: "अपने क्षेत्र की पर्यावरणीय या नागरिक समस्या की रिपोर्ट करें। निवारण प्रगति ट्रैक करने के लिए आधिकारिक संदर्भ संख्या दी जाएगी।",
    stepCategory: "1. शिकायत श्रेणी",
    slaHours: "घंटे SLA",
    subIssueType: "विशिष्ट उप-समस्या प्रकार",
    stepDescription: "2. शिकायत का विवरण",
    voiceSpeak: "बोलकर टाइप करें (आवाज इनपुट)",
    voiceListening: "सुन रहे हैं... (रोकने के लिए क्लिक करें)",
    formDescriptionPlaceholder: "सटीक स्थान, लैंडमार्क, समस्या की गंभीरता और यह समस्या कितने समय से है, इसका विवरण दें...",
    formLandmarkHint: "त्वरित कार्रवाई के लिए नजदीकी लैंडमार्क (स्कूल, अस्पताल, बाजार) अवश्य दें।",
    charactersCount: "अक्षर",
    standardResolutionWindow: "मानक समाधान समय-सीमा:",
    hoursFor: "घंटे -",
    stepLocation: "3. स्थान चुनें",
    useGps: "लाइव डिवाइस जीपीएस का उपयोग करें",
    divisionDistrict: "प्रभाग और जिला",
    municipalAuthority: "नगरपालिका प्राधिकरण",
    streetAddress: "सड़क का पता, वार्ड नंबर या लैंडमार्क",
    streetAddressPlaceholder: "उदा. वार्ड 12, न्यू हाई स्कूल के पास, शिवाजी रोड, कोल्हापुर उत्तर",
    coordinatesLabel: "निर्देशांक:",
    stepPhoto: "4. फोटो अपलोड करें (वैकल्पिक लेकिन अनुशंसित)",
    uploadPhotoPrompt: "कैमरा या गैलरी से फोटो अपलोड करें",
    uploadPhotoSpecs: "JPG, PNG, WebP (10MB तक)",
    pickSamplePhoto: "या एक परीक्षण फोटो चुनें:",
    sampleGarbage: "कचरा डिब्बा",
    samplePipeline: "फटी पाइपलाइन",
    samplePothole: "सड़क का गड्ढा",
    evidenceAttached: "प्रमाण संलग्न किया गया",
    btnCancel: "रद्द करें",
    btnSubmitComplaint: "शिकायत सबमिट करें",
    modalSuccessTitle: "शिकायत सफलतापूर्वक दर्ज की गई!",
    modalAcceptedBy: "आपकी शिकायत स्वीकार कर ली गई है:",
    modalRecorded: "और सिस्टम में दर्ज कर दी गई है।",
    complaintNumberLabel: "शिकायत क्रमांक",
    modalSaveNote: "लाइव स्थिति या अपडेट ट्रैक करने के लिए इस शिकायत नंबर को सुरक्षित रखें।",
    statutorySlaWindow: "वैधानिक समाधान कालमर्यादा",
    btnGoToDashboard: "मेरी शिकायतों पर जाएं",
    btnTrackStatus: "शिकायत स्थिति ट्रैक करें",
    btnRegisterAnother: "दूसरी शिकायत दर्ज करें",
    footerTagline: "CivicResolve • नगर निगम एवं पर्यावरण सेवा निदेशालय",

    // Grievance Categories & Subcategories
    catNameSolidWaste: "ठोस कचरा प्रबंधन",
    catNameWaterSupply: "जल आपूर्ति और रिसाव",
    catNameRoads: "सड़कें, गड्ढे और फुटपाथ",
    catNameSewage: "सीवेज और जल निकासी ओवरफ्लो",
    catNameStreetlights: "स्ट्रीटलाइट खराबी",
    catNameHazardous: "खतरनाक रासायनिक और बायो-कचरा",
    catNameOtherCivic: "अन्य नागरिक शिकायत",

    subDumpster: "ओवरफ्लो कमर्शियल डंपस्टर",
    subStreetGarbage: "सड़क पर कचरा जमा होना",
    subMissedWaste: "कचरा संग्रहण न होना",
    subPlasticDumping: "प्लास्टिक कचरा डंपिंग",

    subPipelineRupture: "मुख्य पाइपलाइन फटना",
    subContaminatedWater: "दूषित / मटमैला पानी",
    subLowPressure: "कम दबाव जलापूर्ति",
    subValveOverflow: "वाल्व ओवरफ्लो / पानी बर्बादी",

    subDangerousPothole: "खतरनाक गड्ढों का समूह",
    subCavedAsphalt: "धंसी हुई डामर सड़क",
    subMissingManhole: "गायब मैनहोल ढक्कन",
    subBrokenFootpath: "टूटा हुआ पैदल फुटपाथ",

    subChokedDrain: "बंद बरसाती नाला",
    subSewageBackflow: "सड़क पर सीवेज का बैकफ्लो",
    subOpenSeptic: "खुला सेप्टिक टैंक खतरा",
    subMonsoonWaterlogging: "बारिश का जलभराव",

    subDarkIntersection: "पूरी तरह अंधेरा चौराहा",
    subFlickeringLight: "टिमटिमाती लाइट",
    subDamagedPole: "क्षतिग्रस्त बिजली का खंभा",
    subUncoveredWire: "खुले बिजली के तार",

    subBioWasteDumping: "अस्पताल का बायो-कचरा डंपिंग",
    subChemicalRunoff: "औद्योगिक रासायनिक बहाव",
    subToxicFumes: "जहरीला धुआं निकलना",
    subDumpingNearWater: "जलस्रोत के पास अवैध डंपिंग",

    subParkNeglect: "सार्वजनिक पार्क की उपेक्षा",
    subTreeCutting: "अवैध पेड़ कटाई",
    subEncroachment: "सार्वजनिक भूमि पर अतिक्रमण",
    subNoisePollution: "ध्वनि प्रदूषण",

    // Citizen Dashboard
    tabComplaints: "शिकायतें और स्थिति",
    tabFeedback: "मेरी प्रतिक्रिया और रेटिंग",
    tabProfile: "नागरिक प्रोफ़ाइल और अधिकार क्षेत्र",
    statTotalLodged: "कुल दर्ज",
    statRecordedGrievances: "दर्ज शिकायतें",
    statUnderProcess: "प्रक्रियाधीन",
    statFieldWork: "फील्ड कार्य जारी",
    statRemediated: "समाधानित और सत्यापित",
    statOfficialPhoto: "आधिकारिक फोटो प्रमाण",
    statFeedbackProvided: "प्रतिक्रिया दी गई",
    statAwaitingRating: "रेटिंग प्रतीक्षित",
    statAllRatingsUpToDate: "सभी रेटिंग अद्यतन हैं",
    filterAll: "सभी",
    filterActive: "प्रक्रियाधीन / सक्रिय",
    filterResolved: "समाधानित और बंद",
    filterCritical: "अति-आवश्यक",
    btnLodgeGrievance: "शिकायत दर्ज करें",
    btnEditProfile: "प्रोफ़ाइल संपादित करें",
    aadhaarVerified: "आधार सत्यापित",
  },

  mr: {
    // Brand & Header
    brandName: "CivicResolve",
    brandSubtitle: "नागरी तक्रार निवारण आणि महापालिका सेवा पोर्टल",
    directorateSubtitle: "महापालिका सेवा संचालनालय • अधिकारी कन्सोल",
    citizenServicesSubtitle: "नागरी तक्रार निवारण सेवा",
    portalSubtitle: "शासकीय नागरी सेवा • नागरिक कन्सोल",
    trackGrievanceSubtitle: "तक्रारीची स्थिती तपासा",
    lodgeGrievanceSubtitle: "नागरी तक्रार नोंदवा",
    registrationSubtitle: "नागरी तक्रार निवारण • नोंदणी",
    signInSubtitle: "नागरी तक्रार नोंदवण्यासाठी आणि निवारण प्रगती तपासण्यासाठी आपल्या मोबाईल नंबरने साइन इन करा.",

    // Header actions
    myComplaints: "माझ्या तक्रारी",
    logout: "लॉगआउट",
    citizenLogin: "नागरिक लॉगिन",
    officerPortal: "अधिकारी पोर्टल",
    officerLogin: "अधिकारी लॉगिन",
    officerSecurityConsole: "अधिकारी सुरक्षा कन्सोल",
    alreadyRegisteredLogin: "आधीच नोंदणीकृत आहात? लॉगिन करा →",
    verified: "सत्यापित",
    home: "मुख्यपृष्ठ",
    backToHome: "मुख्यपृष्ठावर परत जा",
    trackStatus: "स्थिती तपासा",
    registerComplaint: "तक्रार नोंदवा",

    // Home Page Hero
    heroTitle: "CivicResolve — नागरी तक्रार निवारण पोर्टल",
    heroSubtitle:
      "कचरा व्यवस्थापन, पाणीपुरवठा, रस्त्यावरील खड्डे किंवा सांडपाण्याच्या समस्यांसाठी तक्रार नोंदवा. पारदर्शक वैधानिक कालमर्यादेसह निवारणाची प्रगती ट्रॅक करा.",

    // Action 1: Register Complaint
    action1Title: "तक्रार नोंदवा",
    action1Desc:
      "त्वरित कारवाईसाठी ठिकाणाचा तपशील आणि ऐच्छिक फोटो पुराव्यासह नवीन तक्रार सादर करा.",
    action1Btn: "तक्रार नोंदवा",

    // Action 2: Track Complaint
    action2Title: "तक्रारीची स्थिती ट्रॅक करा",
    action2Desc:
      "आपल्या संदर्भ क्रमांकाचा (Complaint ID) वापर करून सध्याची स्थिती, नियुक्त अधिकारी आणि अंदाजित निवारण कालमर्यादा तपासा.",
    action2Placeholder: "उदा. CMP-2026-1042",
    action2Btn: "स्थिती तपासा",

    // Action 3: My Complaints
    action3Title: "माझ्या तक्रारी",
    action3Desc:
      "आपल्या नोंदणीकृत मोबाईल नंबरशी जोडलेल्या मागील आणि सुरू असलेल्या तक्रारी, कामाचे फोटो आणि अधिकृत अपडेट्स पहा.",
    action3Btn: "माझ्या तक्रारी पहा",

    // Categories Section
    categoriesTitle: "नागरी सेवा प्रवर्ग",
    categoriesSubtitle:
      "लोकसेवा हमी कायद्यानुसार वैधानिक निवारण कालमर्यादा.",
    catActionLink: "या प्रवर्गात तक्रार नोंदवा",

    // Individual Categories
    catSolidWaste: "घनकचरा व्यवस्थापन",
    catSolidWasteDesc: "ओसंडून वाहणाऱ्या कचराकुंड्या, कचऱ्याचे ढीग, प्लास्टिक कचरा",
    catSolidWasteSla: "48 तास",

    catWater: "पाणीपुरवठा आणि जलवाहिन्या",
    catWaterDesc: "पाईपलाईन फुटणे, कमी पाण्याचा दाब, दूषित पाणीपुरवठा",
    catWaterSla: "24 तास",

    catRoads: "रस्ते आणि खड्डे",
    catRoadsDesc: "खराब झालेले रस्ते, खड्डे, तुटलेले पदपथ (फुटपाथ)",
    catRoadsSla: "72 तास",

    catSewage: "सांडपाणी आणि निचरा व्यवस्था",
    catSewageDesc: "तुंबलेली गटारे, ओसंडून वाहणारे सांडपाणी, उघडे मॅनहोल",
    catSewageSla: "24 तास",

    catStreetlights: "पथदिवे देखभाल",
    catStreetlightsDesc: "बंद पथदिवे, सदोष विद्युत खांब, अंधारे रस्ते व चौक",
    catStreetlightsSla: "48 तास",

    catHazardous: "घातक व रासायनिक कचरा",
    catHazardousDesc: "बेकायदेशीर औद्योगिक कचरा, विषारी धूर, बायोमेडिकल कचरा",
    catHazardousSla: "12 तास (तातडीचे)",

    // How it works / Redressal Process
    processTitle: "निवारण कार्यपद्धती",
    processSubtitle:
      "तक्रार नोंदणीपासून थेट घटनास्थळावरील निवारण पडताळणीपर्यंत संपूर्ण पारदर्शक प्रक्रिया.",
    step1Title: "तक्रार सादर करा",
    step1Desc:
      "समस्येचे तपशील, प्रभाग स्थान नोंदवा आणि फोटो पुरावा अपलोड करा. एक युनिक ट्रॅकिंग संदर्भ क्रमांक मिळतो.",
    step2Title: "अधिकारी नियुक्ती",
    step2Desc:
      "तक्रार निश्चित कालमर्यादेसह संबंधित प्रभाग अभियंता किंवा स्वच्छता निरीक्षकाकडे वर्ग केली जाते.",
    step3Title: "निवारण आणि पडताळणी",
    step3Desc:
      "क्षेत्रीय कर्मचारी समस्येचे निवारण करतात आणि काम पूर्ण झाल्याचा फोटो पुरावा सादर करतात. नागरिक थेट प्रगती पाहू शकतात.",

    // Footer
    helplineText: "नागरी तक्रार निवारण आणि लोकसेवा संचालनालय • हेल्पलाइन: 1916 (टोल-फ्री)",
    allRightsReserved: "CivicResolve. सर्व हक्क राखीव.",
    citizenCharter: "नागरिक सनद (Citizen Charter)",

    // Track Page
    trackTitle: "तक्रारीची स्थिती तपासा",
    trackSubtitle: "रिअल-टाइम स्थिती, नियुक्त अधिकारी आणि अधिकृत अपडेट्स तपासण्यासाठी आपला तक्रार क्रमांक (उदा. CMP-2026-1042) प्रविष्ट करा.",
    trackInputPlaceholder: "तक्रार क्रमांक टाका (उदा. CMP-2026-1042)...",
    checkStatusBtn: "स्थिती तपासा",
    sampleComplaintNumbers: "नमुना तक्रार क्रमांक:",

    // New Complaint Page
    lodgeTitle: "नागरी तक्रार नोंदवा",
    lodgeSubtitle: "आपल्या परिसरातील पर्यावरणीय किंवा नागरी समस्येची नोंद करा. निवारण प्रगती तपासण्यासाठी अधिकृत संदर्भ क्रमांक दिला जाईल.",
    selectCategory: "तक्रार प्रवर्ग निवडा",
    locationDetails: "स्थान आणि प्रभाग तपशील",
    wardPlaceholder: "प्रभाग क्रमांक निवडा किंवा प्रविष्ट करा",
    landmarkPlaceholder: "जवळची खूण किंवा अचूक पत्ता",
    descriptionLabel: "समस्येचे सविस्तर वर्णन",
    descriptionPlaceholder: "समस्या स्पष्ट शब्दात मांडा (उदा. मुख्य बाजारपेठेत कचरा साचला आहे, पाण्याची पाईपलाईन फुटली आहे...)",
    uploadEvidence: "फोटो पुरावा अपलोड करा (ऐच्छिक)",
    submitGrievanceBtn: "तक्रार सबमिट करा",

    // Common Status & UI
    statusPending: "पडताळणी प्रलंबित",
    statusAssigned: "अधिकाऱ्याकडे वर्ग केले",
    statusInProgress: "काम सुरू / निवारण चालू",
    statusResolved: "निवारण पूर्ण आणि पडताळणी झाली",
    statusRejected: "नाकारले / डुप्लिकेट",
    priorityLow: "कमी",
    priorityMedium: "मध्यम",
    priorityHigh: "उच्च",
    priorityUrgent: "गंभीर / अति-तातडीचे",
    loading: "लोड होत आहे...",
    languageLabel: "भाषा",

    // Grievance Form
    formBreadcrumbHome: "मुख्यपृष्ठ",
    formBreadcrumbMyComplaints: "माझ्या तक्रारी",
    formBreadcrumbRegister: "तक्रार नोंदवा",
    formHeading: "नागरी तक्रार नोंदवा",
    formSubheading: "आपल्या परिसरातील पर्यावरणीय किंवा नागरी समस्येची नोंद करा. निवारण प्रगती तपासण्यासाठी अधिकृत संदर्भ क्रमांक दिला जाईल.",
    stepCategory: "1. तक्रार प्रवर्ग",
    slaHours: "तास SLA",
    subIssueType: "विशिष्ट उप-समस्या प्रकार",
    stepDescription: "2. तक्रारीचे सविस्तर वर्णन",
    voiceSpeak: "बोलून टाईप करा (व्हॉईस इनपुट)",
    voiceListening: "ऐकत आहे... (थांबवण्यासाठी क्लिक करा)",
    formDescriptionPlaceholder: "अचूक ठिकाण, महत्त्वाची खूण (लँडमार्क), समस्येचे गांभीर्य आणि समस्या किती दिवसांपासून आहे ते लिहा...",
    formLandmarkHint: "त्वरित कारवाईसाठी जवळची खूण (शाळा, रुग्णालय, बाजारपेठ) नमूद करा.",
    charactersCount: "अक्षरे",
    standardResolutionWindow: "मानक निवारण कालमर्यादा:",
    hoursFor: "तास -",
    stepLocation: "3. स्थान निवडा",
    useGps: "थेट डिव्हाइस GPS वापरा",
    divisionDistrict: "प्रभाग आणि जिल्हा",
    municipalAuthority: "महानगरपालिका / नगरपालिका प्राधिकरण",
    streetAddress: "रस्त्याचा पत्ता, प्रभाग क्रमांक किंवा महत्त्वाची खूण",
    streetAddressPlaceholder: "उदा. प्रभाग १२, न्यू हायस्कूलजवळ, शिवाजी रोड, कोल्हापूर उत्तर",
    coordinatesLabel: "अक्षांश-रेखांश:",
    stepPhoto: "4. फोटो पुरावा अपलोड करा (ऐच्छिक परंतु शिफारसीय)",
    uploadPhotoPrompt: "कॅमेरा किंवा गॅलरीमधून फोटो अपलोड करा",
    uploadPhotoSpecs: "JPG, PNG, WebP (१० MB पर्यंत)",
    pickSamplePhoto: "किंवा चाचणीसाठी नमुना फोटो निवडा:",
    sampleGarbage: "कचराकुंडी",
    samplePipeline: "फुटलेली पाईपलाईन",
    samplePothole: "रस्त्यावरील खड्डा",
    evidenceAttached: "पुरावा जोडला गेला",
    btnCancel: "रद्द करा",
    btnSubmitComplaint: "तक्रार सबमिट करा",
    modalSuccessTitle: "तक्रार यशस्वीरित्या नोंदवली गेली!",
    modalAcceptedBy: "आपली तक्रार स्वीकारण्यात आली आहे:",
    modalRecorded: "आणि प्रणालीमध्ये नोंदवली गेली आहे.",
    complaintNumberLabel: "तक्रार क्रमांक",
    modalSaveNote: "रिअल-टाइम स्थिती किंवा अपडेट्स तपासण्यासाठी हा तक्रार क्रमांक जतन करा.",
    statutorySlaWindow: "वैधानिक हमी कालमर्यादा",
    btnGoToDashboard: "माझ्या तक्रारींवर जा",
    btnTrackStatus: "तक्रारीची स्थिती तपासा",
    btnRegisterAnother: "दुसरी तक्रार नोंदवा",
    footerTagline: "CivicResolve • नागरी व पर्यावरण सेवा संचालनालय",

    // Grievance Categories & Subcategories
    catNameSolidWaste: "घनकचरा व्यवस्थापन",
    catNameWaterSupply: "पाणीपुरवठा आणि गळती",
    catNameRoads: "रस्ते, खड्डे आणि पदपथ",
    catNameSewage: "सांडपाणी आणि गटार ओव्हरफ्लो",
    catNameStreetlights: "पथदिवे बिघाड व देखभाल",
    catNameHazardous: "घातक रासायनिक व बायो-कचरा",
    catNameOtherCivic: "इतर नागरी तक्रार",

    subDumpster: "ओसंडून वाहणारी व्यावसायिक कचराकुंडी",
    subStreetGarbage: "रस्त्यावर कचरा साचणे",
    subMissedWaste: "कचरा संकलन न होणे",
    subPlasticDumping: "प्लास्टिक कचरा टाकणे",

    subPipelineRupture: "मुख्य जलवाहिनी फुटणे",
    subContaminatedWater: "दूषित / गढूळ पाणी",
    subLowPressure: "कमी दाबाने पाणीपुरवठा",
    subValveOverflow: "झडप (व्हॉल्व्ह) ओव्हरफ्लो / पाण्याची नासाडी",

    subDangerousPothole: "धोकादायक खड्ड्यांचा समूह",
    subCavedAsphalt: "खचलेला डांबरी रस्ता",
    subMissingManhole: "मॅनहोलचे झाकण नसणे",
    subBrokenFootpath: "तुटलेला पादचारी पदपथ (फुटपाथ)",

    subChokedDrain: "तुंबलेली पावसाळी गटारे",
    subSewageBackflow: "रस्त्यावर सांडपाणी उलटणे",
    subOpenSeptic: "उघड्या सेप्टिक टाकीचा धोका",
    subMonsoonWaterlogging: "पावसाळ्यात पाणी साचणे",

    subDarkIntersection: "अंधारा रस्ता व चौक",
    subFlickeringLight: "लुकलुकणारा दिवा",
    subDamagedPole: "नादुरुस्त विजेचा खांब",
    subUncoveredWire: "उघड्या विजेच्या तारा",

    subBioWasteDumping: "रुग्णालयातील बायोमेडिकल कचरा",
    subChemicalRunoff: "औद्योगिक रासायनिक सांडपाणी",
    subToxicFumes: "विषारी वायू गळती",
    subDumpingNearWater: "जलाशयाजवळ बेकायदेशीर कचरा",

    subParkNeglect: "सार्वजनिक बागेची दुरवस्था",
    subTreeCutting: "बेकायदेशीर झाडे तोडणे",
    subEncroachment: "सार्वजनिक जागेवर अतिक्रमण",
    subNoisePollution: "ध्वनी प्रदूषण",

    // Citizen Dashboard
    tabComplaints: "तक्रारी आणि स्थिती",
    tabFeedback: "माझा अभिप्राय आणि रेटिंग",
    tabProfile: "नागरिक प्रोफाइल आणि कार्यक्षेत्र",
    statTotalLodged: "एकूण नोंदवलेल्या",
    statRecordedGrievances: "नोंदवलेल्या तक्रारी",
    statUnderProcess: "काम सुरू / प्रक्रियेत",
    statFieldWork: "प्रत्यक्ष काम सुरू",
    statRemediated: "निवारण पूर्ण आणि पडताळणी",
    statOfficialPhoto: "अधिकृत फोटो पुरावा",
    statFeedbackProvided: "अभिप्राय नोंदवला",
    statAwaitingRating: "रेटिंग देणे बाकी",
    statAllRatingsUpToDate: "सर्व रेटिंग अद्ययावत आहेत",
    filterAll: "सर्व",
    filterActive: "सुरू असलेल्या / प्रक्रियेत",
    filterResolved: "निवारण झालेल्या",
    filterCritical: "तातडीच्या तक्रारी",
    btnLodgeGrievance: "तक्रार नोंदवा",
    btnEditProfile: "प्रोफाइल संपादित करा",
    aadhaarVerified: "आधार सत्यापित",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
