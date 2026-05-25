import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { analyticsSessions, analyticsEvents } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, count, isNull, or } from "drizzle-orm";

const router: IRouter = Router();

/** POST /api/analytics/session — start or update a session */
router.post("/analytics/session", async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body required" });
    return;
  }
  const { sessionId, visitorId, utmSource, utmCampaign, utmMedium, deviceType, os, browser, entryUrl, userAgent, isReturning } = body;
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
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body required" });
    return;
  }
  const { sessionId, exitUrl, durationSeconds, isBounce } = body;
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
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body required" });
    return;
  }
  const { sessionId, visitorId, category, event, pageUrl, metadata, productId, productTitle } = body;
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
      if (!bySource[src]) bySource[src] = { sessions: 0, addToCarts: 0, checkouts: 0, purchases: 0, bounceRate: 0 };
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

    // --- Exit pages ---
    const exitPages: Record<string, number> = {};
    for (const s of sessions) {
      const raw = s.exitUrl ?? s.entryUrl ?? "unknown";
      try {
        const url = new URL(raw);
        // strip tracking params and keep meaningful query params only
        const noise = new Set([
          "utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id",
          "fbclid","gclid","wbraid","gbraid","ttclid","dclid","msclkid",
          "ref","referrer","source","sid","session","token",
        ]);
        const keep: string[] = [];
        for (const [k, v] of url.searchParams) {
          if (!noise.has(k.toLowerCase())) keep.push(`${k}=${v}`);
        }
        const q = keep.length > 0 ? `?${keep.join("&")}` : "";
        const path = `${url.pathname}${q}` || "/";
        exitPages[path] = (exitPages[path] ?? 0) + 1;
      } catch {
        exitPages[raw] = (exitPages[raw] ?? 0) + 1;
      }
    }
    const exitPageRank = Object.entries(exitPages)
      .map(([page, count]) => ({ page, count, pct: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // --- Click heatmap (aggregated by element) ---
    const clickAgg: Record<string, { tag: string; text: string; count: number; rageTaps: number }> = {};
    for (const e of events) {
      if (e.category !== "interaction" || e.event !== "click") continue;
      const meta = e.metadata as Record<string, unknown> | null;
      if (!meta) continue;
      const elId = String(meta.elementId ?? "unknown");
      if (!clickAgg[elId]) clickAgg[elId] = { tag: String(meta.elementTag ?? ""), text: String(meta.elementText ?? ""), count: 0, rageTaps: 0 };
      clickAgg[elId].count++;
      if (meta.isRageTap) clickAgg[elId].rageTaps++;
    }
    const topClicks = Object.entries(clickAgg)
      .map(([elementId, data]) => ({ elementId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // --- Scroll depth distribution ---
    const scrollDepths = events
      .filter(e => e.category === "page" && e.event === "scroll_depth_max")
      .map(e => (e.metadata as Record<string, unknown> | null)?.maxDepth as number ?? 0)
      .filter(d => d > 0);
    const scrollDistribution: Record<number, number> = {};
    for (const d of scrollDepths) {
      const bucket = Math.floor(d / 10) * 10;
      scrollDistribution[bucket] = (scrollDistribution[bucket] ?? 0) + 1;
    }

    // --- Time to purchase ---
    const ttpMinutes = events
      .filter(e => e.category === "purchase" && e.event === "complete")
      .map(e => (e.metadata as Record<string, unknown> | null)?.timeToPurchaseMinutes as number ?? null)
      .filter((m): m is number => typeof m === "number" && m > 0);
    const avgTtp = ttpMinutes.length > 0 ? Math.round(ttpMinutes.reduce((a, b) => a + b, 0) / ttpMinutes.length) : null;
    const minTtp = ttpMinutes.length > 0 ? Math.min(...ttpMinutes) : null;
    const maxTtp = ttpMinutes.length > 0 ? Math.max(...ttpMinutes) : null;

    // --- Product conversion paths ---
    const byProduct: Record<string, { title: string; views: number; carts: number; purchases: number }> = {};
    for (const e of events) {
      const pid = e.productId;
      const meta = e.metadata as Record<string, unknown> | null;
      const title = String(meta?.productTitle ?? e.productTitle ?? pid ?? "Unknown");
      if (!pid) continue;
      if (!byProduct[pid]) byProduct[pid] = { title, views: 0, carts: 0, purchases: 0 };
      if (e.category === "product" && e.event === "view") byProduct[pid].views++;
      if (e.category === "cart" && e.event === "add_to_cart") byProduct[pid].carts++;
      if (e.category === "purchase" && e.event === "complete") byProduct[pid].purchases++;
    }
    const productPaths = Object.entries(byProduct)
      .map(([productId, data]) => ({
        productId,
        ...data,
        viewToCartRate: data.views > 0 ? Math.round((data.carts / data.views) * 100) : 0,
        cartToPurchaseRate: data.carts > 0 ? Math.round((data.purchases / data.carts) * 100) : 0,
        viewToPurchaseRate: data.views > 0 ? Math.round((data.purchases / data.views) * 100) : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // --- Rage taps ---
    const rageTapEvents = events.filter(e => e.category === "interaction" && e.event === "rage_tap");
    const rageTapCount = rageTapEvents.length;
    const rageTapByElement: Record<string, number> = {};
    for (const e of rageTapEvents) {
      const meta = e.metadata as Record<string, unknown> | null;
      const el = String(meta?.elementId ?? "unknown");
      rageTapByElement[el] = (rageTapByElement[el] ?? 0) + 1;
    }
    const topRageTaps = Object.entries(rageTapByElement)
      .map(([elementId, count]) => ({ elementId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // --- Element interactions (buttons, images, selectors) ---
    const elementInteractions: Record<string, number> = {};
    for (const e of events) {
      if (e.category !== "interaction" || e.event !== "element_interaction") continue;
      const meta = e.metadata as Record<string, unknown> | null;
      const key = `${meta?.elementType ?? "unknown"}::${meta?.action ?? "unknown"}`;
      elementInteractions[key] = (elementInteractions[key] ?? 0) + 1;
    }
    const topElementInteractions = Object.entries(elementInteractions)
      .map(([key, count]) => {
        const [elementType, action] = key.split("::");
        return { elementType, action, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Add to cart rate (overall) ---
    const overallAtcRate = totalSessions > 0 ? Math.round((addToCarts / totalSessions) * 100) : 0;

    res.json({
      period: rawFrom && rawTo ? { from: rawFrom, to: rawTo } : { days, since: since.toISOString() },
      summary: {
        totalVisitors,
        totalSessions,
        bounceRate,
        returningRate,
        pageViews,
        overallAtcRate,
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
      exitPages: exitPageRank,
      clickHeatmap: topClicks,
      scrollDistribution,
      timeToPurchase: { avg: avgTtp, min: minTtp, max: maxTtp, count: ttpMinutes.length },
      productPaths,
      rageTaps: { total: rageTapCount, topElements: topRageTaps },
      elementInteractions: topElementInteractions,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics dashboard query failed");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
