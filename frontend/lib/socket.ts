import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

class SocketService {
  private static instance: SocketService;
  public socket: Socket;

  private constructor() {
    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket'],
    });
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Typed listeners
  public onQueueUpdate(callback: (data: unknown) => void) {
    this.socket.on('queue_update', callback);
  }

  public onBedStatusUpdate(callback: (data: unknown) => void) {
    this.socket.on('bed_status_update', callback);
  }

  public onEmergencyAlert(callback: (data: unknown) => void) {
    this.socket.on('emergency_alert', callback);
  }

  public removeListener(event: string, callback?: (data: unknown) => void) {
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }
}

export const socketService = SocketService.getInstance();
export const socket = socketService.socket;
