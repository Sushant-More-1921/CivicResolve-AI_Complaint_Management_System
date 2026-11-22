import { prisma } from '../../config/database';

export interface CanonicalDepartmentSpec {
  code: string;
  fallbackCodes: string[];
  name: string;
  description: string;
  canonicalCategory: string;
  aliases: string[];
}

export const CANONICAL_DEPARTMENTS: CanonicalDepartmentSpec[] = [
  {
    code: 'SOLID_WASTE',
    fallbackCodes: ['SOLID_WASTE'],
    name: 'Solid Waste Department',
    description: 'Door-to-door garbage collection, overflowing bins, sanitation, and street cleaning.',
    canonicalCategory: 'Solid Waste / Garbage Disposal',
    aliases: ['waste', 'garbage', 'solid waste', 'trash', 'dumpster', 'sanitation', 'sweeping'],
  },
  {
    code: 'PWD_ROADS',
    fallbackCodes: ['ROAD_MAINTENANCE', 'PWD_ROADS'],
    name: 'Road Maintenance Department',
    description: 'Roadway pothole repair, pavement resurfacing, footpath restoration, and road safety.',
    canonicalCategory: 'Potholes & Road Maintenance',
    aliases: ['road', 'roads', 'pothole', 'potholes', 'road/pothole', 'asphalt', 'crater', 'footpath', 'bridge'],
  },
  {
    code: 'WATER_SUPPLY',
    fallbackCodes: ['WATER_SUPPLY', 'WATER_SEWER'],
    name: 'Water Supply Department',
    description: 'Drinking water distribution, pipeline bursts, contamination, and low pressure faults.',
    canonicalCategory: 'Water Supply & Leakage',
    aliases: ['water', 'water supply', 'pipeline', 'drinking water', 'tap', 'leakage'],
  },
  {
    code: 'DRAINAGE_SEWERAGE',
    fallbackCodes: ['DRAINAGE_SEWERAGE'],
    name: 'Drainage & Sewerage Department',
    description: 'Blocked storm drains, sewage overflow, open manholes, and wastewater disposal.',
    canonicalCategory: 'Sewage & Drainage Overflow',
    aliases: ['drainage', 'drain', 'sewage', 'sewer', 'manhole', 'gutter', 'waterlogging'],
  },
  {
    code: 'ELECTRICAL',
    fallbackCodes: ['ELECTRICAL', 'ELEC_LIGHTS'],
    name: 'Electrical Department',
    description: 'Municipal street lighting, dark zones, electrical pole faults, and live wire hazards.',
    canonicalCategory: 'Streetlight Malfunction',
    aliases: ['streetlight', 'streetlights', 'street light', 'light', 'lighting', 'electric', 'electrical', 'wire', 'pole'],
  },
  {
    code: 'OTHER_CIVIC',
    fallbackCodes: ['OTHER_CIVIC', 'TOWN_PLAN', 'HEALTH_PEST'],
    name: 'Other Civic Issues Department',
    description: 'General civic grievances, noise/pollution, encroachments, parks, and public amenities.',
    canonicalCategory: 'Other Civic Issue',
    aliases: ['other', 'other civic issue', 'pollution', 'encroachment', 'park', 'stray', 'noise', 'general'],
  },
];

/**
 * Resolves a raw citizen form category or AI-predicted category to the exact canonical department spec.
 */
export function resolveDepartmentSpec(rawCategory?: string | null): CanonicalDepartmentSpec {
  const cleaned = (rawCategory || '').trim().toLowerCase();
  if (!cleaned) {
    return CANONICAL_DEPARTMENTS[CANONICAL_DEPARTMENTS.length - 1];
  }

  for (const spec of CANONICAL_DEPARTMENTS) {
    if (cleaned === spec.canonicalCategory.toLowerCase()) {
      return spec;
    }
  }

  for (const spec of CANONICAL_DEPARTMENTS) {
    if (spec.aliases.some((alias) => cleaned === alias || cleaned.includes(alias))) {
      return spec;
    }
  }

  return CANONICAL_DEPARTMENTS[CANONICAL_DEPARTMENTS.length - 1];
}

/**
 * Looks up the persisted Department row matching a category string.
 */
export async function resolveDepartmentForCategory(rawCategory?: string | null) {
  const spec = resolveDepartmentSpec(rawCategory);

  // Prefer exact canonical department code/name match before fallback codes
  const primaryDepartment = await prisma.department.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { code: spec.code },
        { name: { equals: spec.name, mode: 'insensitive' } },
      ],
    },
  });

  if (primaryDepartment) {
    return { department: primaryDepartment, spec };
  }

  const candidateCodes = [spec.code, ...spec.fallbackCodes];
  const department = await prisma.department.findFirst({
    where: {
      status: 'ACTIVE',
      code: { in: candidateCodes },
    },
  });

  if (department) {
    return { department, spec };
  }

  // Fallback to any department matching name prefix if status migration was partial
  const fallback = await prisma.department.findFirst({
    where: {
      OR: [
        { code: { in: candidateCodes } },
        { name: { contains: spec.name.split(' ')[0], mode: 'insensitive' } },
      ],
    },
  });

  return { department: fallback, spec };
}

/**
 * Normalizes UI or AI category keys into standardized canonical category labels.
 */
export function normalizeCanonicalCategory(rawCategory?: string | null): string {
  return resolveDepartmentSpec(rawCategory).canonicalCategory;
}

