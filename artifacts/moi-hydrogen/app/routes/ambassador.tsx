import { useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, UserRound, Phone, Mail, Facebook, Instagram, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { CartDrawer } from "~/components/CartDrawer";
import { WhatsAppButton } from "~/components/WhatsAppButton";
import { SearchModal } from "~/components/SearchModal";
import { features } from "~/config/features";
import type { CartReturn } from "@shopify/hydrogen";

export const meta: MetaFunction = () => [
  { title: "Become an Ambassador — Moi" },
  { name: "description", content: "Apply to collaborate with Moi and represent the brand through your content, audience, and personal style." },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const { cart } = context;
  const cartData = await cart.get();
  return json({ cart: cartData });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const body = await request.json() as Record<string, string>;
  const apiOrigin = context.env.PUBLIC_API_ORIGIN ?? "https://admin.buy-moi.com";
  try {
    const res = await fetch(`${apiOrigin}/api/ambassador`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { success?: boolean; error?: string };
    return json(data, { status: res.status });
  } catch {
    return json({ success: false, error: "Network error" }, { status: 500 });
  }
}

const inputCls =
  "w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none focus:border-black/30 transition-colors text-sm";

export default function Ambassador() {
  const { cart } = useLoaderData<{ cart: CartReturn | null }>();
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const cartFetcher = useFetcher();

  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [message, setMessage] = useState("");

  const status = fetcher.state !== "idle" ? "loading" : fetcher.data?.success ? "success" : fetcher.data?.error ? "error" : "idle";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fetcher.state !== "idle") return;
    fetcher.submit(
      JSON.stringify({ name, phone, email, facebook, instagram, message }),
      { method: "post", encType: "application/json" },
    );
  }

  const currentCart = (cartFetcher.data as { cart?: CartReturn } | undefined)?.cart ?? cart;

  return (
    <>
      <Header
        itemCount={currentCart?.totalQuantity ?? 0}
        onOpenCart={() => setCartOpen(true)}
        onSearch={() => setSearchOpen(true)}
        dark
      />

      <main className="min-h-screen pb-24 px-6 md:px-12" style={{ backgroundColor: "hsl(30 15% 95%)", paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }}>
        <div className="max-w-6xl mx-auto">
          <motion.section
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <p className="text-[10px] tracking-[0.35em] uppercase mb-4" style={{ color: "#7a6e64" }}>Join Moi</p>
            <h1 className="font-serif leading-none" style={{ color: "#1e1814", fontSize: "clamp(2.5rem, 7vw, 5rem)" }}>
              Become an Ambassador
            </h1>
            <p className="mt-6 text-base leading-8 max-w-2xl" style={{ color: "#5a5048" }}>
              Apply to collaborate with Moi and represent the brand through your content, audience, and personal style.
            </p>
          </motion.section>

          <section className="mt-14 flex flex-col items-center gap-12">
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="w-full max-w-3xl rounded-3xl p-10 md:p-14 flex flex-col items-center text-center gap-6"
                  style={{ backgroundColor: "#f7f4ef", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <CheckCircle size={44} strokeWidth={1.2} style={{ color: "#7a6e64" }} />
                  <h2 className="font-serif text-3xl" style={{ color: "#1e1814" }}>Application Received</h2>
                  <p className="text-sm leading-7 max-w-md" style={{ color: "#5a5048" }}>
                    Thank you for your interest. We'll review your application and be in touch soon.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-3xl rounded-3xl p-6 md:p-8 border border-black/10"
                  style={{ backgroundColor: "#f7f4ef", boxShadow: "0 16px 40px rgba(20,16,12,0.06)" }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                        <UserRound size={13} /> Full name <span style={{ color: "#c0392b" }}>*</span>
                      </span>
                      <input className={inputCls} type="text" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                        <Phone size={13} /> Phone number
                      </span>
                      <input className={inputCls} type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </label>
                  </div>

                  <div className="mt-4">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                        <Mail size={13} /> Email address <span style={{ color: "#c0392b" }}>*</span>
                      </span>
                      <input className={inputCls} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                        <Facebook size={13} /> Facebook profile
                      </span>
                      <input className={inputCls} type="url" placeholder="https://facebook.com/…" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                        <Instagram size={13} /> Instagram profile
                      </span>
                      <input className={inputCls} type="url" placeholder="https://instagram.com/…" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
                    </label>
                  </div>

                  <div className="mt-4">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                        Message <span style={{ color: "#c0392b" }}>*</span>
                      </span>
                      <textarea
                        className={`${inputCls} resize-none`}
                        rows={4}
                        placeholder="Tell us about yourself and why you'd like to be a Moi ambassador…"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  {status === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ backgroundColor: "#fef2f2", color: "#991b1b" }}
                    >
                      <AlertCircle size={15} />
                      {fetcher.data?.error ?? "Something went wrong. Please try again."}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="mt-6 flex items-center justify-center gap-2 w-full py-4 text-[11px] tracking-[0.28em] uppercase text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: "#1e1814", borderRadius: "1rem" }}
                  >
                    {status === "loading" ? (
                      <Loader size={15} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    {status === "loading" ? "Sending…" : "Submit Application"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>

      <Footer />

      <CartDrawer
        cart={currentCart as CartReturn | null}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      {features.ENABLE_WHATSAPP_BUTTON && <WhatsAppButton />}
    </>
  );
}
