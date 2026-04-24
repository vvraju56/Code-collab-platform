export type Id = string;

export type PresenceEvent =
  | { type: "join"; socketId: string }
  | { type: "leave"; socketId: string };

