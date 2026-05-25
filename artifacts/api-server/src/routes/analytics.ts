import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { analyticsSessions, analyticsEvents } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, count, isNull, or } from "drizzle-orm";

const router: IRouter = Router();

/** POST /api/analytics/session — start or update a session */
router.post("/analytics/session", async (req, res) => {
  const { sessionId, visitorId, utmSource, utmCampaign, utmMedium, deviceType, os, browser, entryUrl, userAgent, isReturning } = req.body as Record<string, unknown>;
  if (!sessionId || !visitorId || typeof sessionId !== "string" || typeof visitorId !== "string") {
    res.status(400).json({ error: "sessionId and visitorId required" });
    return;
  }
  try {
    await db.insert(analyticsSessions).values({
      sessionId,
      visitorId,
      utmSource: utmSource as string | undefined ?? null,
      utmCampaign: utmCampaign as string | undefined ?? null,
      utmMedium: utmMedium as string | undefined ?? null,
      deviceType: deviceType as string | undefined ?? null,
      os: os as string | undefined ?? null,
      browser: browser as string | undefined ?? null,
      entryUrl: entryUrl as string | undefined ?? null,
      userAgent: userAgent as string | undefined ?? null,
      isReturning: isReturning as boolean | undefined ?? false,
      isBounce: false,
    }).onConflictDoNothing({ target: analyticsSessions.sessionId });
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "Analytics session insert failed");
    res.status(500).json({ error: "Failed" });
  }
});

/** POST /api/analytics/session/end — end a session */
router.post("/analytics/session/end", async (req, res) => {
  const { sessionId, exitUrl, durationSeconds, isBounce } = req.body as Record<string, unknown>;
  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  try {
    await db.update(analyticsSessions)
      .set({
        exitUrl: exitUrl as string | undefined ?? null,
        durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
        isBounce: isBounce as boolean | undefined ?? false,
      })
      .where(eq(analyticsSessions.sessionId, sessionId));
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "Analytics session end failed");
    res.status(500).json({ error: "Failed" });
  }
});

/** POST /api/analytics/event — record an event */
router.post("/analytics/event", async (req, res) => {
  const { sessionId, visitorId, category, event, pageUrl, metadata, productId, productTitle } = req.body as Record<string, unknown>;
  if (!sessionId || !visitorId || !category || !event || typeof sessionId !== "string" || typeof visitorId !== "string" || typeof category !== "string" || typeof event !== "string") {
    res.status(400).json({ error: "sessionId, visitorId, category, event required" });
    return;
  }
  try {
    await db.insert(analyticsEvents).values({
      sessionId,
      visitorId,
      category: category as string,
      event: event as string,
      pageUrl: pageUrl as string | undefined ?? null,
      productId: productId as string | undefined ?? null,
      productTitle: productTitle as string | undefined ?? null,
      metadata: metadata ?? null,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "Analytics event insert failed");
    res.status(500).json({ error: "Failed" });
  }
});

/** GET /api/admin/analytics — dashboard data */
router.get("/admin/analytics", async (req, res) => {
  let since: Date;
  let until: Date | undefined;
  let days = 7;
  const rawFrom = req.query.from as string | undefined;
  const rawTo = req.query.to as string | undefined;
  if (rawFrom && rawTo) {
    since = new Date(rawFrom);
    until = new Date(rawTo);
    until.setHours(23, 59, 59, 999);
  } else {
    days = Math.max(1, Math.min(90, parseInt(req.query.days as string ?? "7", 10)));
    since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  try {
    // --- Sessions ---
    const sessionConditions = until
      ? and(gte(analyticsSessions.createdAt, since), lte(analyticsSessions.createdAt, until))
      : gte(analyticsSessions.createdAt, since);
    const sessions = await db.select().from(analyticsSessions)
      .where(sessionConditions)
      .orderBy(desc(analyticsSessions.createdAt));

    const totalVisitors = new Set(sessions.map(s => s.visitorId)).size;
    const totalSessions = sessions.length;
    const bounceRate = totalSessions > 0 ? Math.round((sessions.filter(s => s.isBounce).length / totalSessions) * 100) : 0;
    const returningCount = sessions.filter(s => s.isReturning).length;
    const returningRate = totalSessions > 0 ? Math.round((returningCount / totalSessions) * 100) : 0;

    // --- Events ---
    const eventConditions = until
      ? and(gte(analyticsEvents.createdAt, since), lte(analyticsEvents.createdAt, until))
      : gte(analyticsEvents.createdAt, since);
    const events = await db.select().from(analyticsEvents)
      .where(eventConditions)
      .orderBy(desc(analyticsEvents.createdAt));

    // --- Funnel ---
    const pageViews = events.filter(e => e.category === "page" && e.event === "page_view").length;
    const productViews = events.filter(e => e.category === "product" && e.event === "view").length;
    const addToCarts = events.filter(e => e.category === "cart" && e.event === "add_to_cart").length;
    const checkouts = events.filter(e => e.category === "checkout" && e.event === "step_start").length;
    const purchases = events.filter(e => e.category === "purchase" && e.event === "complete").length;

    const funnel = {
      visitors: totalSessions,
      productViews,
      addToCarts,
      checkouts,
      purchases,
      productViewRate: totalSessions > 0 ? Math.round((productViews / totalSessions) * 100) : 0,
      addToCartRate: productViews > 0 ? Math.round((addToCarts / productViews) * 100) : 0,
      checkoutRate: addToCarts > 0 ? Math.round((checkouts / addToCarts) * 100) : 0,
      purchaseRate: checkouts > 0 ? Math.round((purchases / checkouts) * 100) : 0,
      overallConversion: totalSessions > 0 ? Math.round((purchases / totalSessions) * 100) : 0,
    };

    // --- Traffic source quality ---
    const bySource: Record<string, { sessions: number; addToCarts: number; checkouts: number; purchases: number; bounceRate: number }> = {};
    for (const s of sessions) {
      const src = s.utmSource ?? "direct";
      if (!bySource[src]) bySource[src] = { sessions: 0, addToCarts: 0, checkouts: 0, purchases: 0, bounceRate: 0 };
      bySource[src].sessions++;
      if (s.isBounce) bySource[src].bounceRate++;
    }
    for (const e of events) {
      const s = sessions.find(s => s.sessionId === e.sessionId);
      const src = s?.utmSource ?? "direct";
      if (e.category === "cart" && e.event === "add_to_cart") bySource[src].addToCarts++;
      if (e.category === "checkout" && e.event === "step_start") bySource[src].checkouts++;
      if (e.category === "purchase" && e.event === "complete") bySource[src].purchases++;
    }
    const sourceQuality = Object.entries(bySource).map(([name, data]) => ({
      name,
      sessions: data.sessions,
      bounceRate: data.sessions > 0 ? Math.round((data.bounceRate / data.sessions) * 100) : 0,
      addToCartRate: data.sessions > 0 ? Math.round((data.addToCarts / data.sessions) * 100) : 0,
      checkoutRate: data.addToCarts > 0 ? Math.round((data.checkouts / data.addToCarts) * 100) : 0,
      purchaseRate: data.checkouts > 0 ? Math.round((data.purchases / data.checkouts) * 100) : 0,
    })).sort((a, b) => b.sessions - a.sessions);

    // --- Device segmentation ---
    const byDevice: Record<string, { sessions: number; purchases: number }> = {};
    for (const s of sessions) {
      const dev = s.deviceType ?? "unknown";
      if (!byDevice[dev]) byDevice[dev] = { sessions: 0, purchases: 0 };
      byDevice[dev].sessions++;
    }
    for (const e of events) {
      if (e.category === "purchase" && e.event === "complete") {
        const s = sessions.find(s => s.sessionId === e.sessionId);
        const dev = s?.deviceType ?? "unknown";
        byDevice[dev].purchases++;
      }
    }
    const deviceSegmentation = Object.entries(byDevice).map(([name, data]) => ({
      name,
      sessions: data.sessions,
      conversionRate: data.sessions > 0 ? Math.round((data.purchases / data.sessions) * 100) : 0,
    })).sort((a, b) => b.sessions - a.sessions);

    // --- OS segmentation ---
    const byOS: Record<string, { sessions: number; purchases: number }> = {};
    for (const s of sessions) {
      const os = s.os ?? "unknown";
      if (!byOS[os]) byOS[os] = { sessions: 0, purchases: 0 };
      byOS[os].sessions++;
    }
    for (const e of events) {
      if (e.category === "purchase" && e.event === "complete") {
        const s = sessions.find(s => s.sessionId === e.sessionId);
        const os = s?.os ?? "unknown";
        byOS[os].purchases++;
      }
    }
    const osSegmentation = Object.entries(byOS).map(([name, data]) => ({
      name,
      sessions: data.sessions,
      conversionRate: data.sessions > 0 ? Math.round((data.purchases / data.sessions) * 100) : 0,
    })).sort((a, b) => b.sessions - a.sessions);

    // --- Returning vs New ---
    const newVisitors = sessions.filter(s => !s.isReturning).length;
    const returningVisitors = sessions.filter(s => s.isReturning).length;
    const newPurchases = events.filter(e => e.category === "purchase" && e.event === "complete" && sessions.find(s => s.sessionId === e.sessionId && !s.isReturning)).length;
    const returningPurchases = events.filter(e => e.category === "purchase" && e.event === "complete" && sessions.find(s => s.sessionId === e.sessionId && s.isReturning)).length;

    // --- Hesitation signals ---
    const repeatedViews = events.filter(e => e.category === "product" && e.event === "repeated_view").length;
    const cartAbandons = events.filter(e => e.category === "cart" && e.event === "abandon").length;
    const longViews = events.filter(e => {
      if (e.category !== "product" || e.event !== "time_spent") return false;
      const meta = e.metadata as Record<string, unknown> | null;
      return typeof meta?.seconds === "number" && meta.seconds > 60;
    }).length;

    res.json({
      period: rawFrom && rawTo ? { from: rawFrom, to: rawTo } : { days, since: since.toISOString() },
      summary: {
        totalVisitors,
        totalSessions,
        bounceRate,
        returningRate,
        pageViews,
      },
      funnel,
      sourceQuality,
      deviceSegmentation,
      osSegmentation,
      visitorType: {
        new: { count: newVisitors, purchases: newPurchases, conversionRate: newVisitors > 0 ? Math.round((newPurchases / newVisitors) * 100) : 0 },
        returning: { count: returningVisitors, purchases: returningPurchases, conversionRate: returningVisitors > 0 ? Math.round((returningPurchases / returningVisitors) * 100) : 0 },
      },
      hesitationSignals: {
        repeatedViews,
        longViews,
        cartAbandons,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Analytics dashboard query failed");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
