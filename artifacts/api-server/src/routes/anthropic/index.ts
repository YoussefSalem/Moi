import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateAnthropicConversationBody,
  GetAnthropicConversationParams,
  DeleteAnthropicConversationParams,
  ListAnthropicMessagesParams,
  SendAnthropicMessageParams,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/anthropic/conversations", async (req, res) => {
  try {
    const rows = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(rows.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt })));
  } catch (err) {
    req.log.error(err, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/anthropic/conversations", async (req, res) => {
  try {
    const body = CreateAnthropicConversationBody.parse(req.body);
    const [created] = await db.insert(conversations).values({ title: body.title }).returning();
    res.status(201).json({ id: created.id, title: created.title, createdAt: created.createdAt });
  } catch (err) {
    req.log.error(err, "Failed to create conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/anthropic/conversations/:id", async (req, res) => {
  try {
    const { id } = GetAnthropicConversationParams.parse(req.params);
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    req.log.error(err, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/anthropic/conversations/:id", async (req, res) => {
  try {
    const { id } = DeleteAnthropicConversationParams.parse(req.params);
    const [deleted] = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error(err, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = ListAnthropicMessagesParams.parse(req.params);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json(
      msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    );
  } catch (err) {
    req.log.error(err, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = SendAnthropicMessageParams.parse(req.params);
    const body = SendAnthropicMessageBody.parse(req.body);

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content: body.content,
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
