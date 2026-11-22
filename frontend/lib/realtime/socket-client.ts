import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

function resolveAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("civicresolve_token") ||
      sessionStorage.getItem("token") ||
      null
    );
  } catch {
    return null;
  }
}

export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, "");
  }
  return "http://localhost:5000";
}

/**
 * Retrieves the singleton authenticated Socket.IO instance.
 * Reconnects or updates auth payload if token changes.
 */
export function getSocket(overrideToken?: string): Socket | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = overrideToken || resolveAuthToken();

  if (!token) {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
      currentToken = null;
    }
    return null;
  }

  // If already connected with the same token, reuse existing socket
  if (socketInstance && currentToken === token && socketInstance.connected) {
    return socketInstance;
  }

  // If token changed, disconnect old socket
  if (socketInstance && currentToken !== token) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  currentToken = token;
  const socketUrl = getSocketUrl();

  socketInstance = io(socketUrl, {
    auth: {
      token,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
  });

  socketInstance.on("connect", () => {
    console.log(`🔌 [Socket.IO] Connected to ${socketUrl} (ID: ${socketInstance?.id})`);
  });

  socketInstance.on("connect_error", (err) => {
    console.warn(`[Socket.IO] Connection error:`, err.message);
  });

  socketInstance.on("disconnect", (reason) => {
    console.log(`🔌 [Socket.IO] Disconnected:`, reason);
  });

  return socketInstance;
}

/**
 * Disconnect socket on user logout
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = null;
  }
}

/**
 * Subscribe to new real-time notifications
 */
export function onNotificationReceived(callback: (notification: any) => void): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on("notification:new", callback);

  return () => {
    socket.off("notification:new", callback);
  };
}

/**
 * Subscribe to notification read status updates
 */
export function onNotificationRead(callback: (data: any) => void): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on("notification:read", callback);

  return () => {
    socket.off("notification:read", callback);
  };
}

/**
 * Subscribe to notification cleared updates
 */
export function onNotificationCleared(callback: (data: any) => void): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on("notification:cleared", callback);

  return () => {
    socket.off("notification:cleared", callback);
  };
}

