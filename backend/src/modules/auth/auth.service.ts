import { prisma } from '../../config/database';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { smsService } from './sms.service';

export class AuthService {
  /**
   * Helper to clean phone numbers to 10 digits
   */
  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits === '83080934906') {
      return '8380934906';
    }
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  /**
   * Send real 6-digit OTP to citizen mobile number
   */
  public async sendOtp(phoneNumber: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);
    if (cleanNumber.length !== 10) {
      const error: any = new Error('Invalid mobile number. Must be a 10-digit Indian number.');
      error.statusCode = 400;
      throw error;
    }

    // Rate limiting: max 20 requests per 10 min in development, 5 in production
    const maxAllowedRequests = env.NODE_ENV === 'production' ? 5 : 20;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentOtps = await prisma.otpVerification.count({
      where: {
        phoneNumber: cleanNumber,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentOtps >= maxAllowedRequests) {
      const error: any = new Error('Too many OTP requests. Please wait a few minutes before trying again.');
      error.statusCode = 429;
      throw error;
    }

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    const record = await prisma.otpVerification.create({
      data: {
        phoneNumber: cleanNumber,
        otpCode,
        expiresAt,
      },
    });

    // Dispatch SMS via TextBee or terminal console fallback
    const smsResult = await smsService.sendOtpSms(cleanNumber, otpCode);

    return {
      success: true,
      message: `OTP sent successfully to +91 ${cleanNumber.slice(0, 2)}******${cleanNumber.slice(-2)}`,
      expiresInSeconds: 300,
      otpSessionId: record.id,
      provider: smsResult.provider,
    };
  }

  /**
   * Verify citizen 6-digit OTP against persistent database
   */
  public async verifyOtp(phoneNumber: string, otp: string, otpSessionId?: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6) {
      const error: any = new Error('Verification code must be exactly 6 digits.');
      error.statusCode = 400;
      throw error;
    }

    // Find the latest unverified OTP record
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber: cleanNumber,
        otpCode: cleanOtp,
        verified: false,
        expiresAt: { gt: new Date() },
        ...(otpSessionId ? { id: otpSessionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      const error: any = new Error('Invalid or expired OTP code. Please request a new OTP.');
      error.statusCode = 400;
      throw error;
    }

    // Mark as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Find or create citizen user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
      },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          phoneNumber: cleanNumber,
          name: '',
          role: 'CITIZEN',
          district: 'Pune',
        },
      });
    }

    // Sign persistent 365-day JWT token so citizen stays logged in until manual logout or account deletion
    const token = jwt.sign(
      { id: user.id, role: user.role, phoneNumber: user.phoneNumber },
      env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    return {
      success: true,
      message: 'Mobile number verified successfully.',
      token,
      isNewUser,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber.startsWith('+91') ? user.phoneNumber : `+91${user.phoneNumber}`,
        name: user.name || '',
        email: user.email || '',
        district: user.district || 'Pune',
        ward: user.ward || '',
        address: user.address || '',
        pincode: user.pincode || '',
        role: user.role,
        profileCompleted: !isNewUser,
      },
    };
  }

  /**
   * Send 2FA OTP for Administrator
   */
  public async sendAdminOtp(phoneNumber: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);

    // Verify user exists and has ADMIN, SUPER_ADMIN, or OFFICER clearance
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
        role: { in: ['ADMIN', 'SUPER_ADMIN', 'OFFICER'] },
      },
    });

    if (!adminUser) {
      const error: any = new Error('Access Denied: This mobile number does not have administrative clearance.');
      error.statusCode = 403;
      throw error;
    }

    // Generate admin OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const record = await prisma.otpVerification.create({
      data: {
        phoneNumber: cleanNumber,
        otpCode,
        expiresAt,
      },
    });

    const smsResult = await smsService.sendOtpSms(cleanNumber, otpCode);

    return {
      success: true,
      message: `Administrative security code sent to authorized officer +91 ${cleanNumber.slice(0, 2)}******${cleanNumber.slice(-2)}`,
      expiresInSeconds: 300,
      otpSessionId: record.id,
      provider: smsResult.provider,
    };
  }

  /**
   * Verify Administrator 2FA OTP
   */
  public async verifyAdminOtp(phoneNumber: string, otp: string, otpSessionId?: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6) {
      const error: any = new Error('Administrative security code must be 6 digits.');
      error.statusCode = 400;
      throw error;
    }

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber: cleanNumber,
        otpCode: cleanOtp,
        verified: false,
        expiresAt: { gt: new Date() },
        ...(otpSessionId ? { id: otpSessionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      const error: any = new Error('Invalid or expired administrative verification code.');
      error.statusCode = 400;
      throw error;
    }

    // Verify user role in database
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
        role: { in: ['ADMIN', 'SUPER_ADMIN', 'OFFICER'] },
      },
    });

    if (!adminUser) {
      const error: any = new Error('Unauthorized: User does not hold administrative permissions.');
      error.statusCode = 403;
      throw error;
    }

    // Mark OTP as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    const token = jwt.sign(
      { id: adminUser.id, role: adminUser.role, phoneNumber: adminUser.phoneNumber },
      env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    return {
      success: true,
      message: 'Administrative clearance granted successfully.',
      token,
      user: {
        id: adminUser.id,
        phoneNumber: adminUser.phoneNumber.startsWith('+91') ? adminUser.phoneNumber : `+91${adminUser.phoneNumber}`,
        name: adminUser.name || 'Rajesh Sharma',
        role: adminUser.role,
        designation: adminUser.designation || 'Chief Grievance Redressal Administrator',
      },
    };
  }

  /**
   * Register new citizen profile
   */
  public async register(data: { phoneNumber: string; name?: string; email?: string }) {
    const cleanNumber = this.cleanPhone(data.phoneNumber);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
      },
    });

    if (existingUser) {
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: data.name || existingUser.name,
          email: data.email || existingUser.email,
        },
      });
      return { id: updated.id, phoneNumber: updated.phoneNumber, name: updated.name };
    }

    const user = await prisma.user.create({
      data: {
        phoneNumber: cleanNumber,
        name: data.name || 'Verified Citizen',
        email: data.email,
        role: 'CITIZEN',
      },
    });

    return { id: user.id, phoneNumber: user.phoneNumber, name: user.name };
  }
}
