import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { normalizeRole } from '../../middleware/auth.middleware';

export interface AuthenticatedSocketUser {
  id: string;
  role: string;
  name?: string | null;
  phoneNumber?: string | null;
  departmentId?: string | null;
  officerId?: string | null;
}

export class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer | null = null;
  private userSocketMap = new Map<string, Set<string>>(); // userId -> Set of socketIds

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Socket.IO server attached to the HTTP server
   */
  public init(httpServer: HttpServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps, curl, server-to-server)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin) || origin.endsWith('.civicresolve.gov.in') || origin.includes('localhost')) {
            return callback(null, true);
          }
          return callback(null, true); // Dev-friendly fallback
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    // JWT Authentication Handshake Middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

        if (!token) {
          return next(new Error('Authentication failed: Missing token'));
        }

        const decoded = jwt.verify(token, env.JWT_SECRET) as {
          id: string;
          role: string;
          phoneNumber?: string;
          departmentId?: string;
        };

        if (!decoded?.id) {
          return next(new Error('Authentication failed: Invalid token payload'));
        }

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            role: true,
            name: true,
            phoneNumber: true,
            departmentId: true,
            isActive: true,
            officerProfile: {
              select: { id: true, departmentId: true },
            },
          },
        });

        if (!user || !user.isActive) {
          return next(new Error('Authentication failed: User account inactive or not found'));
        }

        const canonicalRole = normalizeRole(user.role);
        if (canonicalRole === 'FIELD_WORKER') {
          return next(new Error('Authentication failed: Field workers do not have portal access'));
        }

        const authUser: AuthenticatedSocketUser = {
          id: user.id,
          role: canonicalRole,
          name: user.name,
          phoneNumber: user.phoneNumber,
          departmentId: user.departmentId || user.officerProfile?.departmentId || null,
          officerId: user.officerProfile?.id || null,
        };

        socket.data.user = authUser;
        next();
      } catch (err: any) {
        console.warn(`[Socket.IO] Authentication handshake rejected: ${err?.message || 'Token verification failed'}`);
        next(new Error('Authentication failed: Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user: AuthenticatedSocketUser = socket.data.user;
      if (!user) {
        socket.disconnect(true);
        return;
      }

      // Track connected socket for user
      if (!this.userSocketMap.has(user.id)) {
        this.userSocketMap.set(user.id, new Set());
      }
      this.userSocketMap.get(user.id)!.add(socket.id);

      // Server-assigned private rooms:
      // 1. Private User Room
      const userRoom = `user:${user.id}`;
      socket.join(userRoom);

      // 2. Department Admin Rooms
      if (user.role === 'DEPARTMENT_ADMIN' || user.role === 'SUPER_ADMIN') {
        socket.join(`admin:${user.id}`);
        if (user.departmentId) {
          socket.join(`admin:dept:${user.departmentId}`);
        }
      }

      // 3. Super Admin Rooms
      if (user.role === 'SUPER_ADMIN') {
        socket.join(`superadmin:${user.id}`);
        socket.join('superadmin:all');
        socket.join('admin:all');
      }

      // 4. Officer Rooms
      if (user.role === 'OFFICER') {
        socket.join(`officer:${user.id}`);
        if (user.departmentId) {
          socket.join(`officer:dept:${user.departmentId}`);
        }
      }

      console.log(`🔌 [Socket.IO] Connected: ${user.name || user.id} (Role: ${user.role}, Socket: ${socket.id})`);

      // Prevent unauthorized client subscription to arbitrary rooms
      socket.on('join_room', () => {
        socket.emit('error', { message: 'Dynamic room joining is restricted. Rooms are assigned server-side.' });
      });

      // Disconnect handling
      socket.on('disconnect', (reason) => {
        const set = this.userSocketMap.get(user.id);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            this.userSocketMap.delete(user.id);
          }
        }
        console.log(`🔌 [Socket.IO] Disconnected: ${user.name || user.id} (Reason: ${reason})`);
      });
    });

    console.log('⚡ [Socket.IO] Real-time engine initialized successfully');
    return this.io;
  }

  /**
   * Emit event to a specific authenticated user's private room
   */
  public emitToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to an entire department (Admins and Officers)
   */
  public emitToDepartment(deptId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`admin:dept:${deptId}`).to(`officer:dept:${deptId}`).emit(event, data);
  }

  /**
   * Emit event to all Super Administrators
   */
  public emitToSuperAdmins(event: string, data: any): void {
    if (!this.io) return;
    this.io.to('superadmin:all').emit(event, data);
  }

  /**
   * Broadcast event to all connected authenticated clients
   */
  public broadcast(event: string, data: any): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Check if a specific user has at least one active socket connection
   */
  public isUserOnline(userId: string): boolean {
    const sockets = this.userSocketMap.get(userId);
    return !!(sockets && sockets.size > 0);
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const socketService = SocketService.getInstance();

