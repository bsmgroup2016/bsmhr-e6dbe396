export const CHAT_PAGE_SIZE = 50;
export type ChatCursor = { createdAt: string; id: string };
export type DatedMessage = { id: string; created_at: string };

export function chatMessageQuery(chatId: string, before?: ChatCursor, limit = CHAT_PAGE_SIZE) {
  const params = new URLSearchParams({ chat_id: `eq.${chatId}`, select: "id,sender,content,author_name,created_at", order: "created_at.desc,id.desc", limit: String(limit + 1) });
  if (before) params.set("or", `(created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id}))`);
  return `live_chat_messages?${params}`;
}

/** Fetch newest-first, display oldest-first; one extra row indicates older history. */
export function chatMessagePage<T extends DatedMessage>(rows: T[], limit = CHAT_PAGE_SIZE) {
  const messages = rows.slice(0, limit).reverse();
  const first = messages[0];
  return { messages, hasOlder: rows.length > limit, nextCursor: first ? { createdAt: first.created_at, id: first.id } : null };
}

export function mergeChatMessages<T extends DatedMessage>(existing: T[], incoming: T[]): T[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}