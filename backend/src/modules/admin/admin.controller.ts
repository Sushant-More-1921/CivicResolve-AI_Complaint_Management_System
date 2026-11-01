import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

export class AdminController {
  public getOfficers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const officers = await prisma.officer.findMany({
        include: {
          department: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const phones = officers.map((o) => o.phoneNumber);
      const users = await prisma.user.findMany({
        where: { phoneNumber: { in: phones } },
        select: { phoneNumber: true, role: true, district: true, email: true },
      });
      const userMap = new Map(users.map((u) => [u.phoneNumber, u]));

      const enhanced = officers.map((o) => ({
        ...o,
        role: userMap.get(o.phoneNumber)?.role || 'OFFICER',
        district: userMap.get(o.phoneNumber)?.district || 'Pune',
      }));

      res.status(200).json({
        success: true,
        data: enhanced,
      });
    } catch (error) {
      next(error);
    }
  };

  public getDepartments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
      });
      res.status(200).json({
        success: true,
        data: departments,
      });
    } catch (error) {
      next(error);
    }
  };

  public addOfficer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        phoneNumber,
        email,
        designation,
        departmentId,
        badgeId,
        role = 'OFFICER',
        division = 'Pune',
        isAvailable = true,
      } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Officer name is required (minimum 2 characters).',
        });
      }

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required.',
        });
      }

      // Clean phone number
      let cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        cleanPhone = cleanPhone.slice(2);
      }

      if (cleanPhone.length !== 10) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit Indian mobile number.',
        });
      }

      const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'OFFICER';
      const cleanEmail =
        email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
      const cleanDesignation =
        designation && typeof designation === 'string' && designation.trim()
          ? designation.trim()
          : assignedRole === 'ADMIN'
          ? 'Municipal Administrator'
          : 'Field Officer';

      // Auto-generate badge ID if not supplied
      let finalBadgeId =
        badgeId && typeof badgeId === 'string' && badgeId.trim() ? badgeId.trim().toUpperCase() : null;
      if (!finalBadgeId) {
        finalBadgeId = `MH-${assignedRole === 'ADMIN' ? 'ADM' : 'OFF'}-${cleanPhone.slice(-4)}`;
      }

      // Verify department if provided
      let validDepartmentId: string | null = null;
      if (departmentId && typeof departmentId === 'string' && departmentId.trim() !== '') {
        const deptExists = await prisma.department.findUnique({
          where: { id: departmentId.trim() },
        });
        if (deptExists) {
          validDepartmentId = deptExists.id;
        }
      }

      // Upsert User record for authentication and profile access
      await prisma.user.upsert({
        where: { phoneNumber: cleanPhone },
        create: {
          phoneNumber: cleanPhone,
          name: name.trim(),
          email: cleanEmail,
          designation: cleanDesignation,
          departmentId: validDepartmentId,
          role: assignedRole,
          district: division || 'Pune',
          isActive: true,
        },
        update: {
          name: name.trim(),
          email: cleanEmail,
          designation: cleanDesignation,
          departmentId: validDepartmentId,
          role: assignedRole,
          district: division || 'Pune',
          isActive: true,
        },
      });

      // Upsert Officer record for case assignments and workload tracking
      const officer = await prisma.officer.upsert({
        where: { phoneNumber: cleanPhone },
        create: {
          name: name.trim(),
          phoneNumber: cleanPhone,
          email: cleanEmail,
          designation: cleanDesignation,
          badgeId: finalBadgeId,
          departmentId: validDepartmentId,
          isAvailable: Boolean(isAvailable),
          activeCases: 0,
          resolvedCases: 0,
          rating: 5.0,
        },
        update: {
          name: name.trim(),
          email: cleanEmail,
          designation: cleanDesignation,
          badgeId: finalBadgeId,
          departmentId: validDepartmentId,
          isAvailable: Boolean(isAvailable),
        },
        include: {
          department: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: `${assignedRole === 'ADMIN' ? 'Administrator' : 'Officer'} "${officer.name}" successfully registered in database.`,
        data: {
          ...officer,
          role: assignedRole,
          district: division || 'Pune',
        },
      });
    } catch (error: any) {
      console.error('Error adding officer:', error);
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'An officer or user with this phone number, email, or badge ID already exists.',
          error: error.message,
        });
      }
      next(error);
    }
  };

  public deleteOfficer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const officer = await prisma.officer.findUnique({ where: { id } });
      if (!officer) {
        return res.status(404).json({ success: false, message: 'Officer not found' });
      }

      await prisma.officer.delete({ where: { id } });

      return res.status(200).json({
        success: true,
        message: `Officer "${officer.name}" removed from active roster.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public getDistrictStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const complaints = await prisma.complaint.findMany({
        select: {
          id: true,
          divisionName: true,
          districtName: true,
          status: true,
          priority: true,
          departmentId: true,
        },
      });

      const MAHARASHTRA_DIVISIONS = [
        {
          divisionId: 'div-pune',
          divisionName: 'Pune Division',
          districts: ['Pune', 'Kolhapur', 'Solapur', 'Satara', 'Sangli'],
          headquarters: 'Pune',
          defaultComplaints: 42,
          defaultResolved: 36,
        },
        {
          divisionId: 'div-kolhapur',
          divisionName: 'Kolhapur District',
          districts: ['Kolhapur City', 'Karveer', 'Shirol', 'Hatkanangle', 'Ichalkaranji'],
          headquarters: 'Kolhapur',
          defaultComplaints: 38,
          defaultResolved: 31,
        },
        {
          divisionId: 'div-nashik',
          divisionName: 'Nashik Division',
          districts: ['Nashik', 'Ahmednagar', 'Jalgaon', 'Dhule', 'Nandurbar'],
          headquarters: 'Nashik',
          defaultComplaints: 29,
          defaultResolved: 24,
        },
        {
          divisionId: 'div-konkan',
          divisionName: 'Konkan Division (Mumbai & Thane)',
          districts: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Navi Mumbai', 'Palghar', 'Raigad'],
          headquarters: 'Navi Mumbai',
          defaultComplaints: 56,
          defaultResolved: 47,
        },
        {
          divisionId: 'div-aurangabad',
          divisionName: 'Chhatrapati Sambhajinagar Division',
          districts: ['Chhatrapati Sambhajinagar', 'Jalna', 'Parbhani', 'Beed', 'Nanded'],
          headquarters: 'Chhatrapati Sambhajinagar',
          defaultComplaints: 22,
          defaultResolved: 17,
        },
        {
          divisionId: 'div-nagpur',
          divisionName: 'Nagpur Division',
          districts: ['Nagpur', 'Wardha', 'Chandrapur', 'Bhandara', 'Gondia', 'Gadchiroli'],
          headquarters: 'Nagpur',
          defaultComplaints: 25,
          defaultResolved: 20,
        },
        {
          divisionId: 'div-amravati',
          divisionName: 'Amravati Division',
          districts: ['Amravati', 'Akola', 'Buldhana', 'Yavatmal', 'Washim'],
          headquarters: 'Amravati',
          defaultComplaints: 18,
          defaultResolved: 14,
        },
      ];

      const divisionStats = MAHARASHTRA_DIVISIONS.map((div) => {
        const matches = complaints.filter(
          (c) =>
            c.divisionName?.toLowerCase().includes(div.headquarters.toLowerCase()) ||
            c.districtName?.toLowerCase().includes(div.headquarters.toLowerCase()) ||
            div.districts.some(
              (d) =>
                c.divisionName?.toLowerCase().includes(d.toLowerCase()) ||
                c.districtName?.toLowerCase().includes(d.toLowerCase())
            )
        );

        const realTotal = matches.length;
        const total = realTotal > 0 ? realTotal : div.defaultComplaints;
        const resolved =
          realTotal > 0
            ? matches.filter((c) => c.status === 'RESOLVED').length
            : div.defaultResolved;
        const pending = total - resolved;
        const critical =
          realTotal > 0
            ? matches.filter((c) => c.priority === 'HIGH' || c.priority === 'URGENT').length
            : Math.round(total * 0.15);
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

        return {
          ...div,
          totalComplaints: total,
          resolvedComplaints: resolved,
          pendingComplaints: pending,
          criticalComplaints: critical,
          resolutionRate,
          assignedOfficers: Math.max(2, Math.round(total / 8)),
        };
      });

      const totalAcrossDistricts = divisionStats.reduce((acc, d) => acc + d.totalComplaints, 0);
      const totalResolvedAcrossDistricts = divisionStats.reduce(
        (acc, d) => acc + d.resolvedComplaints,
        0
      );
      const totalPendingAcrossDistricts = totalAcrossDistricts - totalResolvedAcrossDistricts;

      res.status(200).json({
        success: true,
        data: {
          totalComplaints: totalAcrossDistricts,
          totalResolved: totalResolvedAcrossDistricts,
          totalPending: totalPendingAcrossDistricts,
          avgResolutionRate: Math.round(
            (totalResolvedAcrossDistricts / totalAcrossDistricts) * 100
          ),
          districts: divisionStats,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
