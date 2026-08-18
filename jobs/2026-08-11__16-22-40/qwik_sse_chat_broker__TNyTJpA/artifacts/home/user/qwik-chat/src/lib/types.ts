export interface Message {
  room: string;
  seq: number;
  user: string;
  text: string;
  ts: number;
}
