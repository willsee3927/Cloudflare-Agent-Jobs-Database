import type { Filters, FilterPatch, SearchResult } from "./search";
export interface ChatMessage {
  id: string; role: "user" | "assistant"; text: string; at: string;
  result?: SearchResult; error?: boolean;
}
export interface Conversation {
  messages: ChatMessage[]; filters: Filters; preferences: FilterPatch; lastActive: number;
}
