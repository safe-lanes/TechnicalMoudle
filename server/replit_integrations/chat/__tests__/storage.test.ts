import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, desc } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { conversations, messages } from "@shared/models/chat";

const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../../../db", () => ({ getDb: mock.getDb }));
import { chatStorage } from "../storage";

const dialect = new PgDialect();
const sql = (expression: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(expression);

describe("chat model references and unchanged query construction (no database)", () => {
  const conversation = { id: 3, title: "chat", createdAt: new Date(0) };
  const message = { id: 7, conversationId: 3, role: "user", content: "hello", createdAt: new Date(1) };
  let rows: unknown[];
  let query: Record<string, ReturnType<typeof vi.fn>>;
  let db: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    rows = [conversation];
    query = {};
    for (const method of ["from", "where", "orderBy", "values"]) {
      query[method] = vi.fn(() => query);
    }
    query.returning = vi.fn(async () => rows);
    query.then = vi.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve));
    db = { select: vi.fn(() => query), insert: vi.fn(() => query), delete: vi.fn(() => query) };
    mock.getDb.mockReset().mockResolvedValue(db);
  });

  it("selects a single conversation from the real model by id (including not found)", async () => {
    expect(await chatStorage.getConversation(3)).toBe(conversation);
    expect(query.from).toHaveBeenCalledWith(conversations);
    expect(sql(query.where.mock.calls[0][0])).toEqual(sql(eq(conversations.id, 3)));
    rows = [];
    expect(await chatStorage.getConversation(99)).toBeUndefined();
  });

  it("lists conversations in descending creation order", async () => {
    expect(await chatStorage.getAllConversations()).toEqual([conversation]);
    expect(query.from).toHaveBeenCalledWith(conversations);
    expect(sql(query.orderBy.mock.calls[0][0])).toEqual(sql(desc(conversations.createdAt)));
  });

  it("creates a conversation using only title, without generated id/timestamps", async () => {
    expect(await chatStorage.createConversation("chat")).toBe(conversation);
    expect(db.insert).toHaveBeenCalledWith(conversations);
    expect(query.values).toHaveBeenCalledExactlyOnceWith({ title: "chat" });
    expect(query.returning).toHaveBeenCalledOnce();
  });

  it("deletes messages before their conversation with the original predicates", async () => {
    await chatStorage.deleteConversation(3);
    expect(db.delete.mock.calls).toEqual([[messages], [conversations]]);
    expect(query.where.mock.calls.map(([condition]) => sql(condition))).toEqual([
      sql(eq(messages.conversationId, 3)), sql(eq(conversations.id, 3)),
    ]);
    expect(mock.getDb).toHaveBeenCalledOnce();
  });

  it("lists messages by conversation in ascending creation order", async () => {
    rows = [message];
    expect(await chatStorage.getMessagesByConversation(3)).toEqual([message]);
    expect(query.from).toHaveBeenCalledWith(messages);
    expect(sql(query.where.mock.calls[0][0])).toEqual(sql(eq(messages.conversationId, 3)));
    expect(query.orderBy).toHaveBeenCalledWith(messages.createdAt);
  });

  it("creates a message using the existing fields and returning query", async () => {
    rows = [message];
    expect(await chatStorage.createMessage(3, "user", "hello")).toBe(message);
    expect(db.insert).toHaveBeenCalledWith(messages);
    expect(query.values).toHaveBeenCalledExactlyOnceWith({ conversationId: 3, role: "user", content: "hello" });
    expect(query.returning).toHaveBeenCalledOnce();
  });
});
