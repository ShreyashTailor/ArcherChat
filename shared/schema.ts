import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  profilePicture: text("profile_picture"),
  publicKey: text("public_key").notNull(),
  encryptedPrivateKey: text("encrypted_private_key"),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id").notNull().references(() => users.id),
  encryptedContent: text("encrypted_content").notNull(),
  senderEncryptedKey: text("sender_encrypted_key").notNull(),
  recipientEncryptedKey: text("recipient_encrypted_key").notNull(),
  iv: text("iv").notNull(),
  type: text("type", { enum: ["text", "image"] }).notNull().default("text"),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const blocks = sqliteTable("blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  blockerId: integer("blocker_id").notNull().references(() => users.id),
  blockedId: integer("blocked_id").notNull().references(() => users.id),
});

export const reactions = sqliteTable("reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(50),
  publicKey: z.string().min(1),
  encryptedPrivateKey: z.string().optional(),
}).omit({ id: true });

export const insertMessageSchema = createInsertSchema(messages, {
  encryptedContent: z.string().min(1),
  senderEncryptedKey: z.string().min(1),
  recipientEncryptedKey: z.string().min(1),
  iv: z.string().min(1),
  type: z.enum(["text", "image"]).default("text"),
}).omit({ id: true, timestamp: true, deleted: true });

export const insertBlockSchema = createInsertSchema(blocks).omit({ id: true });

export const insertReactionSchema = createInsertSchema(reactions).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertBlock = z.infer<typeof insertBlockSchema>;

export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = z.infer<typeof insertReactionSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(1),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export interface Conversation {
  userId: number;
  username: string;
  displayName: string;
  profilePicture: string | null;
  lastMessage: string | null;
  lastMessageTime: Date | null;
  unreadCount: number;
}

export interface DecryptedMessage extends Omit<Message, "encryptedContent"> {
  content: string;
}
