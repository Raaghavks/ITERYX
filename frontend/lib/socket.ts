import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("WebSocket connected to:", SOCKET_URL);
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });
  }
  return socket;
}

export function joinWard(wardId: number): void {
  const s = getSocket();
  s.emit("join_ward", { ward_id: wardId });
}

export function leaveWard(wardId: number): void {
  const s = getSocket();
  s.emit("leave_ward", { ward_id: wardId });
}

export const socketService = {
  getSocket,
  joinWard,
  leaveWard,
  onEmergencyAlert: (callback: (data: any) => void) => {
    getSocket().on("emergency_alert", callback);
  },
  onQueueUpdate: (callback: (data: any) => void) => {
    getSocket().on("queue_update", callback);
  },
  onBedStatusUpdate: (callback: (data: any) => void) => {
    getSocket().on("bed_status_update", callback);
  },
  removeListener: (event: string, callback?: (data: any) => void) => {
    if (callback) {
      getSocket().off(event, callback);
    } else {
      getSocket().off(event);
    }
  }
};
