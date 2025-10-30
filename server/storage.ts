import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import { users, messages, blocks, type User, type Message, type Conversation } from "@shared/schema";

class Storage {
  async getUser(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string) {
    return (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
  }

  async searchUsers(query: string) {
    return db.select().from(users).where(sql`LOWER(${users.username}) LIKE ${`%${query}%`}`).limit(20);
  }

  async createUser(data: typeof users.$inferInsert) {
    return (await db.insert(users).values(data).returning())[0];
  }

  async updateUserPassword(userId: number, passwordHash: string) {
    return (await db.update(users).set({ passwordHash }).where(eq(users.id, userId)).returning()).length > 0;
  }

  async updateProfilePicture(userId: number, profilePicture: string | null) {
    const result = await db.update(users).set({ profilePicture }).where(eq(users.id, userId)).returning();
    if (result.length === 0) return null;
    return result[0];
  }

  async getMessages(userId1: number, userId2: number) {
    return db.select().from(messages).where(
      or(
        and(eq(messages.senderId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.senderId, userId2), eq(messages.recipientId, userId1))
      )
    ).orderBy(messages.timestamp);
  }

  async createMessage(data: typeof messages.$inferInsert) {
    return (await db.insert(messages).values(data).returning())[0];
  }

  async deleteMessage(messageId: number, userId: number) {
    const msg = (await db.select().from(messages).where(eq(messages.id, messageId)).limit(1))[0];
    if (!msg || msg.senderId !== userId) return false;
    await db.update(messages).set({ deleted: true }).where(eq(messages.id, messageId));
    return true;
  }

  async deleteMessages(messageIds: number[], userId: number) {
    const msgs = await db.select().from(messages).where(inArray(messages.id, messageIds));
    const validIds = msgs.filter(m => m.senderId === userId).map(m => m.id);
    if (validIds.length === 0) return false;
    await db.update(messages).set({ deleted: true }).where(inArray(messages.id, validIds));
    return true;
  }

  async deleteConversation(userId1: number, userId2: number) {
    await db.delete(messages).where(
      or(
        and(eq(messages.senderId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.senderId, userId2), eq(messages.recipientId, userId1))
      )
    );
  }

  async getConversations(userId: number): Promise<Conversation[]> {
    const blockedIds = (await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, userId))).map(b => b.id);
    const msgs = await db.select().from(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId))).orderBy(desc(messages.timestamp));
    
    const convMap = new Map<number, Conversation>();
    for (const msg of msgs) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (blockedIds.includes(otherId) || convMap.has(otherId)) continue;
      
      const other = await this.getUser(otherId);
      if (!other) continue;
      
      convMap.set(otherId, {
        userId: otherId,
        username: other.username,
        displayName: other.displayName,
        profilePicture: other.profilePicture,
        lastMessage: msg.deleted ? "[Message deleted]" : null,
        lastMessageTime: msg.timestamp,
        unreadCount: 0,
      });
    }
    return Array.from(convMap.values());
  }

  async isBlocked(blockerId: number, blockedId: number) {
    return (await db.select().from(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))).limit(1)).length > 0;
  }

  async blockUser(blockerId: number, blockedId: number) {
    return (await db.insert(blocks).values({ blockerId, blockedId }).returning())[0];
  }

  async unblockUser(blockerId: number, blockedId: number) {
    return (await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))).returning()).length > 0;
  }
}

export const storage = new Storage();
