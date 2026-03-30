import { io, Socket } from "socket.io-client";
import type {
  BedStatusUpdateEvent,
  DischargeOrderUpdateEvent,
  EmergencyAlertPayload,
  QueueUpdatePayload,
} from "@/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";

let socket: Socket | null = null;
const joinedWards = new Set<number>();

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("WebSocket connected to:", SOCKET_URL);
      joinedWards.forEach((wardId) => {
        socket?.emit("join_ward", { ward_id: wardId });
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.warn("WebSocket connection error:", error.message);
    });
  }
  return socket;
}

export function joinWard(wardId: number): void {
  joinedWards.add(wardId);
  const s = getSocket();
  s.emit("join_ward", { ward_id: wardId });
}

export function leaveWard(wardId: number): void {
  joinedWards.delete(wardId);
  const s = getSocket();
  s.emit("leave_ward", { ward_id: wardId });
}

export const socketService = {
  getSocket,
  joinWard,
  leaveWard,
  onEmergencyAlert: (callback: (data: EmergencyAlertPayload) => void) => {
    getSocket().on("emergency_alert", callback);
  },
  onQueueUpdate: (callback: (data: QueueUpdatePayload) => void) => {
    getSocket().on("queue_update", callback);
  },
  onBedStatusUpdate: (callback: (data: BedStatusUpdateEvent) => void) => {
    getSocket().on("bed_status_update", callback);
  },
  onDischargeOrderUpdate: (callback: (data: DischargeOrderUpdateEvent) => void) => {
    getSocket().on("discharge_order_update", callback);
  },
  removeListener: (
    event: string,
    callback?:
      | ((data: EmergencyAlertPayload) => void)
      | ((data: QueueUpdatePayload) => void)
      | ((data: BedStatusUpdateEvent) => void)
      | ((data: DischargeOrderUpdateEvent) => void)
  ) => {
    if (callback) {
      getSocket().off(event, callback);
    } else {
      getSocket().off(event);
    }
  }
};
