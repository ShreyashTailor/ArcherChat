import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { hashPassword, verifyPassword, generateToken, authMiddleware, rateLimit, type AuthRequest } from "./auth";
import { insertUserSchema, insertMessageSchema, insertBlockSchema } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const registerLimit = rateLimit(10, 15 * 60 * 1000);
const loginLimit = rateLimit(15, 5 * 60 * 1000);

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/auth/check-username/:username", async (req, res) => {
    try {
      const username = req.params.username.toLowerCase();
      if (!username || username.length < 3) {
        return res.json({ available: false, reason: "Username must be at least 3 characters" });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.json({ available: false, reason: "Username can only contain letters, numbers, and underscores" });
      }
      const exists = await storage.getUserByUsername(username);
      res.json({ available: !exists });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/register", registerLimit, async (req, res) => {
    try {
      const { username, password, displayName, publicKey, profilePicture, encryptedPrivateKey } = req.body;
      
      const parsed = insertUserSchema.omit({ passwordHash: true }).safeParse({ username, displayName, publicKey, encryptedPrivateKey });
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
      if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      if (await storage.getUserByUsername(username)) return res.status(400).json({ error: "Username already exists" });

      const user = await storage.createUser({ ...parsed.data, passwordHash: await hashPassword(password), profilePicture });
      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser, token: generateToken(user.id) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", loginLimit, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username and password required" });

      const user = await storage.getUserByUsername(username);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser, token: generateToken(user.id) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid passwords" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      await storage.updateUserPassword(user.id, await hashPassword(newPassword));
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/update-profile-picture", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { profilePicture } = req.body;
      if (profilePicture !== null && typeof profilePicture !== "string") {
        return res.status(400).json({ error: "Invalid profile picture data" });
      }

      const user = await storage.updateProfilePicture(req.userId!, profilePicture);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/recover", loginLimit, async (req, res) => {
    try {
      const { username, newPassword } = req.body;
      if (!username || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid input" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user?.encryptedPrivateKey) return res.status(404).json({ error: "Recovery not available" });

      await storage.updateUserPassword(user.id, await hashPassword(newPassword));
      const { passwordHash: _, ...safeUser } = user;
      res.json({ encryptedPrivateKey: user.encryptedPrivateKey, user: safeUser, token: generateToken(user.id) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/users/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/users/search/:query", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const users = await storage.searchUsers(req.params.query.toLowerCase());
      res.json(users.map(({ passwordHash, ...user }) => user));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/messages/:userId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const otherId = parseInt(req.params.userId);
      if (await storage.isBlocked(otherId, req.userId!)) return res.json([]);
      res.json(await storage.getMessages(req.userId!, otherId));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/messages", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const parsed = insertMessageSchema.safeParse({ ...req.body, senderId: req.userId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
      if (await storage.isBlocked(parsed.data.recipientId, req.userId!)) {
        return res.status(403).json({ error: "Cannot send message to this user" });
      }
      res.json(await storage.createMessage(parsed.data));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/messages/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteMessage(parseInt(req.params.id), req.userId!);
      if (!deleted) return res.status(403).json({ error: "Cannot delete this message" });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/messages/delete-bulk", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { messageIds } = req.body;
      if (!Array.isArray(messageIds)) return res.status(400).json({ error: "Invalid input" });
      const deleted = await storage.deleteMessages(messageIds, req.userId!);
      if (!deleted) return res.status(403).json({ error: "Cannot delete messages" });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/conversations", authMiddleware, async (req: AuthRequest, res) => {
    try {
      res.json(await storage.getConversations(req.userId!));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/conversations/:userId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteConversation(req.userId!, parseInt(req.params.userId));
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/blocks/:userId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      res.json(await storage.isBlocked(req.userId!, parseInt(req.params.userId)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/blocks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const parsed = insertBlockSchema.safeParse({ blockerId: req.userId, blockedId: req.body.blockedId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
      res.json(await storage.blockUser(parsed.data.blockerId, parsed.data.blockedId));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/blocks/:userId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const unblocked = await storage.unblockUser(req.userId!, parseInt(req.params.userId));
      if (!unblocked) return res.status(404).json({ error: "Block not found" });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/upload", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      res.json({ data: base64 });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
