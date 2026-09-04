import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./responsive.css";
import Billing from "./Billing";
import {
  Zap, LayoutDashboard, Bike, Receipt, TrendingUp, Wallet, Users, Settings as SettingsIcon,
  Plus, X, Trash2, Edit2, Search, Download, Share2, ChevronRight, IndianRupee, MapPin,
Image as ImageIcon,
Upload,
Check,
ArrowUpRight,
ArrowDownRight,
LogOut,
Eye,
EyeOff,
MoreHorizontal
} from "lucide-react";

/* =========================================================================
   0. API CLIENT + SOCKET
========================================================================= */
const API_URL = import.meta.env?.VITE_API_URL;
const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL;

export const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("voltline_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const socket = io(SOCKET_URL, { autoConnect: false });

/* =========================================================================
   1. GLOBAL STYLE INJECTION 
========================================================================= */
function GlobalStyles() {
  useEffect(() => {
    if (!document.getElementById("vl-fonts")) {
      const link = document.createElement("link");
      link.id = "vl-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    if (!document.getElementById("vl-base")) {
      const style = document.createElement("style");
      style.id = "vl-base";
      style.innerHTML = `
        * { box-sizing: border-box; }
        html, body, #root { margin:0; padding:0; background:#12151A; color:#F2F3F0; font-family:'Inter',sans-serif; min-height:100vh; }
        button, input, select, textarea { font-family: inherit; }
        input:focus, select:focus, textarea:focus { border-color:#8FAE2A !important; outline:none; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #2A2F3A; border-radius: 8px; }
      `;
      document.head.appendChild(style);
    }
  }, []);
  return null;
}

/* =========================================================================
   2. UTIL HELPERS 
========================================================================= */

export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const RANGE_LABEL = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year"
};


// ============================================================
/* =========================================================================
   GOOGLE SHEET COMPLETE REPORT EXPORT
======================================================================== */

export const exportCompleteReport = async () => {
  try {
    const response = await api.post("/reports/export-complete");

    alert(
      response.data?.message ||
      "Complete report exported successfully to Google Sheets!"
    );

    return response.data;
  } catch (error) {
    console.error(
      "Google Sheet export failed:",
      error.response?.data || error
    );

    alert(
      error.response?.data?.message ||
      "Unable to export complete report to Google Sheets."
    );

    throw error;
  }
};

/* =========================================================================
   3. ROOT APP
========================================================================= */
export default function App() {
  const [stage, setStage] = useState("boot"); // boot -> login -> onboarding -> loading -> app
  const [owner, setOwner] = useState(null);
  const [business, setBusiness] = useState(null);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    const token = localStorage.getItem("voltline_token");
    if (!token) {
      setStage("login");
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setOwner(res.data.owner);
        setBusiness(res.data.business);
        socket.connect();
        setStage(res.data.business ? "app" : "onboarding");
      })
      .catch(() => {
        localStorage.removeItem("voltline_token");
        setStage("login");
      });
  }, []);

  const handleLoggedIn = (data) => {
    localStorage.setItem("voltline_token", data.token);
    setOwner(data.owner);
    setBusiness(data.business);
    socket.connect();
    setStage(data.business ? "loading" : "onboarding");
  };

  const handleOnboarded = (biz) => {
    setBusiness(biz);
    setStage("loading");
  };

  useEffect(() => {
    if (stage === "loading") {
      const t = setTimeout(() => setStage("app"), 1600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const logout = () => {
    localStorage.removeItem("voltline_token");
    socket.disconnect();
    setOwner(null);
    setBusiness(null);
    setStage("login");
  };

  return (
    <>
      <GlobalStyles />
      {stage === "boot" && <div style={{ background: "#12151A", minHeight: "100vh" }} />}
      {stage === "login" && <LoginScreen onLoggedIn={handleLoggedIn} />}
      {stage === "onboarding" && <OnboardingScreen onDone={handleOnboarded} />}
      {stage === "loading" && <LoadingScreen business={business} />}
      {stage === "app" && (
        <AppShell
          owner={owner}
          business={business}
          setBusiness={setBusiness}
          tab={tab}
          setTab={setTab}
          onLogout={logout}
        />
      )}
    </>
  );
}

/* =========================================================================
   4. LOGIN SCREEN
========================================================================= */
function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("mdsammlk00@gmail.com");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      onLoggedIn(res.data);
    } catch (e2) {
      setErr(e2.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.centerScreen}>
      <div style={S.voltGlow} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 36 }}>
          <div style={S.boltBadge}><Zap size={20} color="#12151A" strokeWidth={2.5} /></div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20 }}>A EV M</span>
        </div>

        <form onSubmit={submit} style={{ ...S.card, padding: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", margin: "0 auto 18px",
            background: "linear-gradient(135deg,#C4F135,#8FAE2A)", display: "flex", alignItems: "center",
            justifyContent: "center", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 24, color: "#12151A"
          }}>MS</div>
          <div style={{ textAlign: "center", color: "#8B93A1", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 20 }}>Owner Login</div>

          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <div style={{ height: 12 }} />
          <div style={{ position: "relative" }}>
            <Field label="Password" type={showPw ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" />
            <button type="button" onClick={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 10, top: 30, background: "none", border: "none", color: "#5A616F", cursor: "pointer" }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {err && <div style={{ color: "#FF6B6B", fontSize: 12.5, marginTop: 10 }}>{err}</div>}

          <button type="submit" disabled={busy || !email || !password} style={{ ...S.primaryBtn, width: "100%", marginTop: 20, opacity: (busy || !email || !password) ? 0.5 : 1 }}>
            {busy ? "Signing in…" : "Enter Dashboard"} <ChevronRight size={17} />
          </button>
        </form>
        <div style={{ textAlign: "center", color: "#5A616F", fontSize: 12, marginTop: 20 }}>
          Electric Scooter Showroom · Sales · Service · Repair
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   5. ONBOARDING — business setup
========================================================================= */
function OnboardingScreen({ onDone }) {
  const [f, setF] = useState({ name: "", tagline: "", address: "", email: "", phone: "", whatsapp: "", gstin: "", gstRate: "18" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const canSubmit = f.name.trim() && f.phone.trim() && !busy;

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api.post("/business", f);
      let business = res.data;
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        const logoRes = await api.post("/business/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
        business = logoRes.data;
      }
      onDone(business);
    } catch (e2) {
      setErr(e2.response?.data?.message || "Could not save business details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...S.screen, alignItems: "flex-start" }}>
      <div style={{ width: "100%", maxWidth: 460, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={S.boltBadge}><Zap size={16} color="#12151A" strokeWidth={2.5} /></div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16 }}>VoltLine</span>
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, margin: "18px 0 4px" }}>Set up your business</h1>
        <p style={{ color: "#8B93A1", fontSize: 14, margin: "0 0 26px" }}>This appears on every bill, catalogue sheet, and WhatsApp report.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#1B1F27", border: "1px dashed #3A414F", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {logoPreview ? <img src={logoPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} color="#5A616F" />}
            </div>
            <label style={{ ...S.ghostBtn, cursor: "pointer", fontSize: 13 }}>
              <Upload size={14} /> Upload logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            </label>
          </div>
          <Field label="Business name *" value={f.name} onChange={(v) => set("name", v)} placeholder="e.g. Subhan Electric Scooters" />
          <Field label="Tagline" value={f.tagline} onChange={(v) => set("tagline", v)} placeholder="e.g. Ride the Future" />
          <Field label="Address" value={f.address} onChange={(v) => set("address", v)} placeholder="Shop no., street, city, state" textarea />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Phone *" value={f.phone} onChange={(v) => set("phone", v)} placeholder="98765 43210" />
            <Field label="WhatsApp no." value={f.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="91 98765 43210" />
          </div>
          <Field label="Email" value={f.email} onChange={(v) => set("email", v)} placeholder="shop@example.com" />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="GSTIN" value={f.gstin} onChange={(v) => set("gstin", v.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
            <Field label="GST rate %" value={f.gstRate} onChange={(v) => set("gstRate", v.replace(/[^0-9.]/g, ""))} placeholder="18" />
          </div>
        </div>

        {err && <div style={{ color: "#FF6B6B", fontSize: 12.5, marginTop: 14 }}>{err}</div>}

        <button disabled={!canSubmit} onClick={submit} style={{ ...S.primaryBtn, width: "100%", marginTop: 22, opacity: canSubmit ? 1 : 0.4 }}>
          {busy ? "Saving…" : "Save & Continue"} <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   6. LOADING SCREEN
========================================================================= */
function LoadingScreen({ business }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / 1500) * 100);
      setPct(p);
      if (p >= 100) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={S.centerScreen}>
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 30 }}>
          <div style={S.boltBadge}><Zap size={20} color="#12151A" strokeWidth={2.5} /></div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20 }}>{business?.name || "VoltLine"}</span>
        </div>
        <div style={{ width: 180, height: 70, border: "3px solid #2A2F3A", borderRadius: 10, position: "relative", margin: "0 auto", padding: 5 }}>
          <div style={{ position: "absolute", right: -11, top: "50%", transform: "translateY(-50%)", width: 8, height: 24, background: "#2A2F3A", borderRadius: "0 3px 3px 0" }} />
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5, background: "linear-gradient(90deg,#8FAE2A,#C4F135)", transition: "width 0.05s linear", boxShadow: "0 0 16px rgba(196,241,53,0.5)" }} />
        </div>
        <div style={{ marginTop: 16, fontFamily: "'JetBrains Mono',monospace", color: "#C4F135", fontSize: 14, fontWeight: 600 }}>
          Charging up your dashboard · {Math.floor(pct)}%
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   7. APP SHELL — nav
========================================================================= */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "catalogue", label: "Catalogue", icon: Bike },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "partners", label: "Partners", icon: Users },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function AppShell({ owner, business, setBusiness, tab, setTab, onLogout }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 860);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 860);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#12151A", color: "#F2F3F0", fontFamily: "'Inter',sans-serif", display: "flex" }}>
      {!isMobile && <Sidebar tab={tab} setTab={setTab} business={business} onLogout={onLogout} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar business={business} tab={tab} owner={owner} onLogout={onLogout} isMobile={isMobile} />
        <div style={{ flex: 1, padding: isMobile ? "16px 14px 90px" : "24px 32px 40px", overflowY: "auto" }}>
          {tab === "dashboard" && <Dashboard setTab={setTab} />}
          {tab === "catalogue" && <Catalogue />}
          {tab === "billing" && (
  <Billing
    business={business}
  />
)}
          {tab === "sales" && <Sales />}
          {tab === "expenses" && <Expenses />}
          {tab === "partners" && <Partners business={business} />}
          {tab === "settings" && <SettingsTab business={business} setBusiness={setBusiness} />}
        </div>
      </div>
      {isMobile && <BottomNav tab={tab} setTab={setTab} />}
    </div>
  );
}

function Sidebar({ tab, setTab, business, onLogout }) {
  return (
    <div style={{ width: 224, borderRight: "1px solid #232833", padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 30 }}>
        <div style={S.boltBadge}><Zap size={16} color="#12151A" strokeWidth={2.5} /></div>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16 }}>{business?.name?.slice(0, 16) || "VoltLine"}</span>
      </div>
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = tab === n.id;
        return (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
            background: active ? "#1E2430" : "transparent", border: "none", cursor: "pointer",
            color: active ? "#C4F135" : "#8B93A1", fontSize: 14, fontWeight: 500, marginBottom: 3, textAlign: "left",
            borderLeft: active ? "2px solid #C4F135" : "2px solid transparent"
          }}>
            <Icon size={17} /> {n.label}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: "#5A616F", fontSize: 13, fontWeight: 500 }}>
        <LogOut size={15} /> Log out
      </button>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const [showMore, setShowMore] = useState(false);

  const mainNav = NAV.filter((n) =>
    ["dashboard", "catalogue", "billing", "sales", "expenses"].includes(n.id)
  );

  const moreNav = NAV.filter((n) =>
    ["partners", "settings"].includes(n.id)
  );

  const selectTab = (id) => {
    setTab(id);
    setShowMore(false);
  };

  return (
    <>
      {showMore && (
        <>
          <div
            onClick={() => setShowMore(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 98,
            }}
          />

          <div
            style={{
              position: "fixed",
              left: 12,
              right: 12,
              bottom: 78,
              background: "#1B1F27",
              border: "1px solid #2A3140",
              borderRadius: 16,
              padding: 10,
              zIndex: 99,
              boxShadow: "0 -8px 30px rgba(0,0,0,0.35)",
            }}
          >
            {moreNav.map((n) => {
              const Icon = n.icon;

              return (
                <button
                  key={n.id}
                  onClick={() => selectTab(n.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "15px 14px",
                    background:
                      tab === n.id ? "#252C38" : "transparent",
                    border: "none",
                    borderRadius: 10,
                    color:
                      tab === n.id ? "#C4F135" : "#D6DAE2",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  <Icon size={19} />
                  {n.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#171B23",
          borderTop: "1px solid #232833",
          display: "flex",
          justifyContent: "space-around",
          padding:
            "8px 2px calc(env(safe-area-inset-bottom,0px) + 8px)",
          zIndex: 100,
        }}
      >
        {mainNav.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;

          return (
            <button
              key={n.id}
              onClick={() => selectTab(n.id)}
              style={{
                flex: 1,
                minWidth: 0,
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                color: active ? "#C4F135" : "#5A616F",
                fontSize: 10,
                padding: "4px 2px",
                cursor: "pointer",
              }}
            >
              <Icon size={18} />
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {n.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setShowMore((v) => !v)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            color:
              showMore ||
              tab === "partners" ||
              tab === "settings"
                ? "#C4F135"
                : "#5A616F",
            fontSize: 10,
            padding: "4px 2px",
            cursor: "pointer",
          }}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </div>
    </>
  );
}

function TopBar({ business, tab, owner, onLogout, isMobile }) {
  const label = NAV.find((n) => n.id === tab)?.label || "";
  return (
    <div style={{ padding: "18px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 21 }}>{label}</div>
        {business?.tagline ? <div style={{ color: "#5A616F", fontSize: 12, marginTop: 2 }}>{business.tagline}</div> : null}
      </div>
      {isMobile && (
        <button onClick={onLogout} style={S.iconBtn}><LogOut size={15} /></button>
      )}
    </div>
  );
}

/* =========================================================================
   8. DASHBOARD 
========================================================================= */
function Dashboard({ setTab }) {
  const [range, setRange] = useState("month");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
  setLoading(true);

  try {
    const res = await api.get(`/dashboard/summary?range=${range}`);
    console.log("DASHBOARD DATA:", res.data);
    setSummary(res.data);
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    console.error("STATUS:", error.response?.status);
    console.error("DATA:", error.response?.data);

    setSummary({
      totalSales: 0,
      grossProfit: 0,
      totalExpenses: 0,
      netProfit: 0,
      billCount: 0,
      locations: [],
      recentBills: [],
    });
  } finally {
    setLoading(false);
  }
}, [range]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refresh = () => load();
    socket.on("bill:created", refresh);
    socket.on("bill:updated", refresh);
    socket.on("bill:deleted", refresh);
    socket.on("expense:created", refresh);
    socket.on("expense:deleted", refresh);
    return () => {
      socket.off("bill:created", refresh);
      socket.off("bill:updated", refresh);
      socket.off("bill:deleted", refresh);
      socket.off("expense:created", refresh);
      socket.off("expense:deleted", refresh);
    };
  }, [load]);


  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCompleteReport();
    } catch {
      // exportCompleteReport already alerts on failure
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <RangeTabs range={range} setRange={setRange} />
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ ...S.primaryBtn, opacity: exporting ? 0.6 : 1 }}
        >
          <Download size={16} />
          {exporting ? "Exporting…" : "Export to Google Sheet"}
        </button>
      </div>
      {loading || !summary ? <Empty text="Loading…" /> : (
        <>
          <div style={S.statGrid}>
            <StatCard icon={IndianRupee} label={`Sales · ${RANGE_LABEL[range]}`} value={inr(summary.totalSales)} accent="#C4F135" sub={`${summary.billCount} bills`} />
            <StatCard icon={TrendingUp} label="Gross Profit" value={inr(summary.grossProfit)} accent="#3D8BFD" />
            <StatCard icon={ArrowDownRight} label="Expenses" value={inr(summary.totalExpenses)} accent="#FF6B6B" />
            <StatCard icon={summary.netProfit >= 0 ? ArrowUpRight : ArrowDownRight} label="Net Profit" value={inr(summary.netProfit)} accent={summary.netProfit >= 0 ? "#C4F135" : "#FF6B6B"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginTop: 20 }}>
            <div style={S.card}>
              <div style={S.cardTitle}>Recent bills</div>
              {summary.recentBills.length === 0 ? <Empty text="No bills yet." /> : summary.recentBills.map((b) => (
                <div key={b._id} style={S.rowLine}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.customerName || "Walk-in"}</div>
                    <div style={{ color: "#5A616F", fontSize: 11.5 }}>{fmtDate(b.date)} · {b.type}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#C4F135" }}>{inr(b.total)}</div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Sales by location</div>
              {summary.locations.length === 0 ? <Empty text="No location data." /> : summary.locations.map((l) => (
                <div key={l.location} style={S.rowLine}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}><MapPin size={13} color="#8B93A1" /> {l.location}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{inr(l.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 16 }}>
        <QuickAction icon={Receipt} label="New bill" onClick={() => setTab("billing")} />
        <QuickAction icon={Bike} label="Add scooter" onClick={() => setTab("catalogue")} />
        <QuickAction icon={Wallet} label="Add expense" onClick={() => setTab("expenses")} />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#1E2430", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color="#C4F135" />
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

export function RangeTabs({ range, setRange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {Object.keys(RANGE_LABEL).map((r) => (
        <button key={r} onClick={() => setRange(r)} style={{
          padding: "7px 14px", borderRadius: 20, border: "1px solid " + (range === r ? "#C4F135" : "#2A2F3A"),
          background: range === r ? "rgba(196,241,53,0.1)" : "transparent", color: range === r ? "#C4F135" : "#8B93A1",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer"
        }}>{RANGE_LABEL[r]}</button>
      ))}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: "#8B93A1", fontSize: 12, fontWeight: 500 }}>{label}</div>
        <Icon size={15} color={accent} />
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 22, marginTop: 8, color: accent }}>{value}</div>
      {sub ? <div style={{ color: "#5A616F", fontSize: 11, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

export function Empty({ text }) {
  return <div style={{ color: "#5A616F", fontSize: 13, padding: "18px 4px", textAlign: "center" }}>{text}</div>;
}

/* =========================================================================
   9. CATALOGUE 
========================================================================= */
function emptyScooter() {
  return {
    name: "",
    chassisNo: "",
    motorNo: "",
    features: "",
    warranty: "",
    batteryInfo: "",
    scooterPrice: "",
    batteryPrice: "",
    actualPrice: "",
    sellingPrice: "",
  };
}

function Catalogue() {
  const [scooters, setScooters] = useState([]);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);

    api
      .get("/scooters", {
        params: query ? { q: query } : {},
      })
      .then((res) => setScooters(res.data))
      .catch((err) => {
        console.error("Failed to load scooters:", err);
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();

    socket.on("scooter:created", refresh);
    socket.on("scooter:updated", refresh);
    socket.on("scooter:deleted", refresh);

    return () => {
      socket.off("scooter:created", refresh);
      socket.off("scooter:updated", refresh);
      socket.off("scooter:deleted", refresh);
    };
  }, [load]);

  const openNew = () => {
    setEditing({
      id: null,
      data: emptyScooter(),
      imageFile: null,
      imagePreview: "",
    });
  };

  const openEdit = (s) => {
    setEditing({
      id: s._id,
      data: {
        ...emptyScooter(),
        ...s,
      },
      imageFile: null,
      imagePreview: s.imageUrl || "",
    });
  };

  const save = async () => {
    try {
      if (!editing) return;

      const { id, data, imageFile } = editing;

      let saved;

      if (id) {
        saved = (
          await api.put(`/scooters/${id}`, data)
        ).data;
      } else {
        saved = (
          await api.post("/scooters", data)
        ).data;
      }

      if (imageFile) {
        const fd = new FormData();

        fd.append("image", imageFile);

        await api.post(
          `/scooters/${saved._id}/image`,
          fd,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      setEditing(null);

      load();
    } catch (err) {
      console.error("Failed to save scooter:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to save scooter."
      );
    }
  };

  const remove = async (id) => {
    const ok = window.confirm(
      "Are you sure you want to delete this scooter?"
    );

    if (!ok) return;

    try {
      await api.delete(`/scooters/${id}`);

      load();
    } catch (err) {
      console.error("Failed to delete scooter:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to delete scooter."
      );
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            ...S.searchBox,
            flex: 1,
            minWidth: 180,
          }}
        >
          <Search
            size={15}
            color="#5A616F"
          />

          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            placeholder="Search name, chassis, motor no."
            style={S.searchInput}
          />
        </div>

        <button
          onClick={openNew}
          style={S.primaryBtn}
        >
          <Plus size={16} />
          Add scooter
        </button>
      </div>

      {loading ? (
        <Empty text="Loading catalogue…" />
      ) : scooters.length === 0 ? (
        <Empty text="No scooters in catalogue yet." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(260px,1fr))",
            gap: 14,
          }}
        >
          {scooters.map((s) => (
            <div
              key={s._id}
              style={S.card}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    background: "#1E2430",
                    flexShrink: 0,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.imageUrl ? (
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <Bike
                      size={22}
                      color="#5A616F"
                    />
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {s.name}
                  </div>

                  <div
                    style={{
                      color: "#5A616F",
                      fontSize: 11,
                      fontFamily:
                        "'JetBrains Mono',monospace",
                    }}
                  >
                    Chassis{" "}
                    {s.chassisNo || "—"}
                  </div>

                  <div
                    style={{
                      color: "#5A616F",
                      fontSize: 11,
                      fontFamily:
                        "'JetBrains Mono',monospace",
                    }}
                  >
                    Motor{" "}
                    {s.motorNo || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  marginTop: 12,
                  fontSize: 12.5,
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    color: "#8B93A1",
                  }}
                >
                  Actual:{" "}
                  <b
                    style={{
                      color: "#F2F3F0",
                    }}
                  >
                    {inr(s.actualPrice)}
                  </b>
                </div>

                <div
                  style={{
                    color: "#8B93A1",
                  }}
                >
                  Selling:{" "}
                  <b
                    style={{
                      color: "#C4F135",
                    }}
                  >
                    {inr(s.sellingPrice)}
                  </b>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button
                  onClick={() => openEdit(s)}
                  style={S.ghostBtnSm}
                >
                  <Edit2 size={13} />
                  Edit
                </button>

                <button
                  onClick={() => remove(s._id)}
                  style={{
                    ...S.ghostBtnSm,
                    color: "#FF6B6B",
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ScooterModal
          editing={editing}
          setEditing={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,

        background: "rgba(5, 8, 12, 0.75)",
        backdropFilter: "blur(4px)",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        padding: 12,
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",

        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,

          maxHeight:
            "calc(100dvh - 24px - env(safe-area-inset-bottom))",

          background: "#202631",
          border: "1px solid #303846",
          borderRadius: 18,

          display: "flex",
          flexDirection: "column",

          overflow: "hidden",

          boxShadow:
            "0 20px 60px rgba(0,0,0,0.55)",

          position: "relative",
          zIndex: 100000,
        }}
      >
        {/* HEADER */}
        <div
          style={{
            flexShrink: 0,

            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",

            padding: "18px 20px 14px 20px",

            borderBottom:
              "1px solid #303846",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: "#F2F3F0",
            }}
          >
            {title}
          </h2>

          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,

              border: "none",
              borderRadius: 10,

              background: "#28303D",
              color: "#9CA6B5",

              cursor: "pointer",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={19} />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div
          style={{
            flex: 1,
            minHeight: 0,

            overflowY: "auto",
            overflowX: "hidden",

            padding: "16px 20px 30px 20px",

            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
/* =========================================================================
   11. SALES
========================================================================= */
function Sales() {
  const [range, setRange] = useState("month");
  const [bills, setBills] = useState([]);
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get(`/bills?range=${range}`), api.get("/scooters")])
      .then(([b, s]) => { setBills(b.data); setScooters(s.data); })
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    socket.on("bill:created", refresh);
    socket.on("bill:updated", refresh);
    socket.on("bill:deleted", refresh);
    return () => { socket.off("bill:created", refresh); socket.off("bill:updated", refresh); socket.off("bill:deleted", refresh); };
  }, [load]);

  const total = bills.reduce((s, b) => s + b.total, 0);
  const profit = bills.reduce((s, b) => s + (b.items || []).reduce((x, it) => x + (it.sellingPrice - it.actualPrice) * it.qty, 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <RangeTabs range={range} setRange={setRange} />
      </div>
      <div style={S.statGrid}>
        <StatCard icon={IndianRupee} label="Total sales" value={inr(total)} accent="#C4F135" sub={`${bills.length} bills`} />
        <StatCard icon={TrendingUp} label="Total profit margin" value={inr(profit)} accent="#3D8BFD" />
      </div>
      <div style={{ ...S.card, marginTop: 16, overflowX: "auto" }}>
        <div style={S.cardTitle}>Bill-wise breakdown</div>
        {loading ? <Empty text="Loading…" /> : bills.length === 0 ? <Empty text="No sales in this period." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 600 }}>
            <thead><tr style={{ color: "#8B93A1", textAlign: "left" }}>
              <th style={S.th}>Date</th><th style={S.th}>Customer</th><th style={S.th}>Location</th><th style={S.th}>Type</th><th style={S.th}>Total</th><th style={S.th}>Margin</th>
            </tr></thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b._id} style={{ borderTop: "1px solid #232833" }}>
                  <td style={S.td}>{fmtDate(b.date)}</td>
                  <td style={S.td}>{b.customerName || "Walk-in"}</td>
                  <td style={S.td}>{b.location || "—"}</td>
                  <td style={S.td}>{b.type}</td>
                  <td style={{ ...S.td, fontFamily: "'JetBrains Mono',monospace" }}>{inr(b.total)}</td>
                  <td style={{ ...S.td, fontFamily: "'JetBrains Mono',monospace", color: "#C4F135" }}>{inr((b.items || []).reduce((x, it) => x + (it.sellingPrice - it.actualPrice) * it.qty, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   12. EXPENSES
   Flow:
     Expense Name (e.g. "Rent")  +  Amount  +  Note (e.g. "Sameer ko diye the")
        -> Category = first word of Note (e.g. "Sameer")
        -> grouped list, header = category, each row = Note | Name | Amount
========================================================================= */
function emptyExpense() {
  return {
    date: todayISO(),
    name: "",     // Expense Name — e.g. "Rent", "Bill", "Parts", "Salary"
    amount: "",
    note: "",     // e.g. "Sameer ko diye the" — first word becomes the category
    location: ""
  };
}

// First word of the note becomes the expense category.
// Example: "Sameer ko diye the" -> "Sameer"
function getCategoryFromNote(note = "") {
  const firstWord = String(note).trim().split(/\s+/)[0] || "";
  return firstWord.replace(/[.,!?;:()[\]{}"'`]+$/g, "").trim();
}

function Expenses() {
  const [range, setRange] = useState("month");
  const [expenses, setExpenses] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);

    api
      .get(`/expenses?range=${range}`)
      .then((res) => {
        setExpenses(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("Failed to load expenses:", err);
        setExpenses([]);
      })
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();

    socket.on("expense:created", refresh);
    socket.on("expense:updated", refresh);
    socket.on("expense:deleted", refresh);

    return () => {
      socket.off("expense:created", refresh);
      socket.off("expense:updated", refresh);
      socket.off("expense:deleted", refresh);
    };
  }, [load]);

  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  // Group all expenses by category (derived from the note's first word).
  const groupedExpenses = useMemo(() => {
    const groups = {};

    expenses.forEach((expense) => {
      const category =
        String(expense.category || "").trim() || "Uncategorized";

      if (!groups[category]) {
        groups[category] = {
          items: [],
          total: 0
        };
      }

      groups[category].items.push(expense);
      groups[category].total += Number(expense.amount || 0);
    });

    return Object.entries(groups).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [expenses]);

  const updateDraft = (key, value) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  };

  // Live preview of what category this expense will land under.
  const previewCategory = draft
    ? getCategoryFromNote(draft.note) || "Uncategorized"
    : "";

  const save = async () => {
    if (!draft) return;

    const payload = {
      ...draft,
      name: String(draft.name || "").trim(),
      note: String(draft.note || "").trim(),
      category: getCategoryFromNote(draft.note) || "Uncategorized",
    };

    if (!payload.name) {
      alert("Please enter an expense name (e.g. Rent, Bill, Parts).");
      return;
    }

    if (!payload.amount || Number(payload.amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      await api.post("/expenses", payload);
      setDraft(null);
      load();
    } catch (err) {
      console.error("Failed to save expense:", err);
      alert(
        err?.response?.data?.message ||
        "Failed to save expense."
      );
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      await api.delete(`/expenses/${id}`);
      load();
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert(
        err?.response?.data?.message ||
        "Failed to delete expense."
      );
    }
  };

  const canSave =
    draft &&
    String(draft.name || "").trim() &&
    draft.amount &&
    Number(draft.amount) > 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10
        }}
      >
        <RangeTabs range={range} setRange={setRange} />

        <button
          onClick={() => setDraft(emptyExpense())}
          style={S.primaryBtn}
        >
          <Plus size={16} />
          Add expense
        </button>
      </div>

      <StatCard
        icon={Wallet}
        label={`Total expenses · ${RANGE_LABEL[range]}`}
        value={inr(total)}
        accent="#FF6B6B"
      />

      {/* CATEGORY GROUPS — header = category (e.g. "SAMEER"), each row =
          Note | Expense Name | Amount, matching the target layout. */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}
      >
        {loading ? (
          <Empty text="Loading expenses…" />
        ) : expenses.length === 0 ? (
          <Empty text="No expenses recorded." />
        ) : (
          groupedExpenses.map(([category, group]) => (
            <div key={category} style={S.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 4,
                  paddingBottom: 10,
                  borderBottom: "1px solid #232833",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    minWidth: 0
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "rgba(196,241,53,0.10)",
                      border: "1px solid rgba(196,241,53,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#C4F135",
                      fontWeight: 800,
                      flexShrink: 0
                    }}
                  >
                    {category.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {category}
                    </div>

                    <div
                      style={{
                        color: "#5A616F",
                        fontSize: 11.5,
                        marginTop: 2
                      }}
                    >
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "expense" : "expenses"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontWeight: 700,
                    color: "#FF6B6B",
                    whiteSpace: "nowrap"
                  }}
                >
                  {inr(group.total)}
                </div>
              </div>

              {/* Column headers: Note | Expense | Amount */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0 6px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, color: "#5A616F", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Note
                </div>
                <div style={{ flexShrink: 0, minWidth: 70, textAlign: "center", color: "#5A616F", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Expense
                </div>
                <div style={{ flexShrink: 0, minWidth: 60, textAlign: "right", color: "#5A616F", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, paddingRight: 38 }}>
                  Amount
                </div>
              </div>

              {/* Rows: Note (left, grows) — Expense Name (center badge) — Amount (right) */}
              <div>
                {group.items.map((e) => (
                  <div
                    key={e._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 0",
                      borderBottom: "1px solid #232833"
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: "#D6DAE2",
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {e.note || e.name || "Expense"}
                      </div>

                      <div
                        style={{
                          color: "#5A616F",
                          fontSize: 11.5,
                          marginTop: 3
                        }}
                      >
                        {fmtDate(e.date)}
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        flexShrink: 0,
                        minWidth: 70,
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          background: "#1E2430",
                          color: "#8FAE2A",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 20,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.name || "—"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontWeight: 700,
                          color: "#FF6B6B",
                          fontSize: 13,
                          minWidth: 60,
                          textAlign: "right",
                        }}
                      >
                        {inr(e.amount)}
                      </div>

                      <button
                        onClick={() => remove(e._id)}
                        style={S.iconBtn}
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {draft && (
        <Modal
          title="Add expense"
          onClose={() => setDraft(null)}
        >
          <div style={S.formGrid}>
            <Field
              label="Expense Name *"
              value={draft.name}
              onChange={(v) => updateDraft("name", v)}
              placeholder="e.g. Rent, Bill, Parts, Salary"
            />

            <Field
              label="Amount *"
              value={draft.amount}
              onChange={(v) =>
                updateDraft(
                  "amount",
                  v.replace(/[^0-9.]/g, "")
                )
              }
              placeholder="0"
            />

            <Field
              label="Note"
              value={draft.note}
              onChange={(v) => updateDraft("note", v)}
              placeholder="e.g. Sameer ko diye the"
              textarea
            />

            <div
              style={{
                border: "1px solid #303846",
                background: "#171B23",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 12
              }}
            >
              <span style={{ color: "#8B93A1" }}>
                Category (auto, from first word of note):
              </span>{" "}
              <b style={{ color: "#C4F135" }}>
                {previewCategory}
              </b>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Field
                label="Date"
                type="date"
                value={draft.date}
                onChange={(v) => updateDraft("date", v)}
              />

              <Field
                label="Location"
                value={draft.location}
                onChange={(v) => updateDraft("location", v)}
                placeholder="e.g. Main Showroom"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={!canSave}
            style={{
              ...S.primaryBtn,
              width: "100%",
              marginTop: 16,
              opacity: canSave ? 1 : 0.4,
              position: "sticky",
              bottom: -1,
              zIndex: 1,
              boxShadow: "0 -8px 16px 4px #171B23"
            }}
          >
            <Check size={16} />
            Save expense
          </button>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   13. PARTNERS — profit sharing + WhatsApp
========================================================================= */
function emptyPartner() { return { name: "", phone: "", sharePercent: "" }; }

function Partners({ business }) {
  const [range, setRange] = useState("month");
  const [partners, setPartners] = useState([]);
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  // Reinvestment is set aside from net profit before splitting between
  // partners. Kept per range in local state so it's easy to adjust.
  const [reinvest, setReinvest] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/partners").catch(() => ({ data: [] })),
      api.get(`/bills?range=${range}`).catch(() => ({ data: [] })),
      api.get(`/expenses?range=${range}`).catch(() => ({ data: [] })),
    ])
      .then(([p, b, e]) => {
        setPartners(Array.isArray(p.data) ? p.data : []);
        setBills(Array.isArray(b.data) ? b.data : []);
        setExpenses(Array.isArray(e.data) ? e.data : []);
      })
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    const events = ["partner:created", "partner:updated", "partner:deleted", "bill:created", "bill:updated", "bill:deleted", "expense:created", "expense:updated", "expense:deleted"];
    events.forEach((ev) => socket.on(ev, refresh));
    return () => { events.forEach((ev) => socket.off(ev, refresh)); };
  }, [load]);

  const sales = bills.reduce((s, b) => s + Number(b.total || 0), 0);
  const grossProfit = bills.reduce((s, b) => s + (b.items || []).reduce((x, it) => x + (Number(it.sellingPrice || 0) - Number(it.actualPrice || 0)) * Number(it.qty || 1), 0), 0);
  const expTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = grossProfit - expTotal;
  const reinvestAmount = Math.max(0, Number(reinvest[range] || 0));
  const distributable = Math.max(0, netProfit - reinvestAmount);

  const save = async () => {
    if (!draft?.name || !draft?.sharePercent) return;
    try {
      await api.post("/partners", draft);
      setDraft(null);
      load();
    } catch (err) {
      console.error("Failed to save partner:", err);
      alert(err?.response?.data?.message || "Failed to save partner.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this partner?")) return;
    try {
      await api.delete(`/partners/${id}`);
      load();
    } catch (err) {
      console.error("Failed to remove partner:", err);
      alert(err?.response?.data?.message || "Failed to remove partner.");
    }
  };

  const shareToAll = () => {
    let msg = `*${business?.name || "Business"} — ${RANGE_LABEL[range]} Report*\n\n`;
    msg += `Total Sales: ${inr(sales)}\nGross Profit: ${inr(grossProfit)}\nExpenses: ${inr(expTotal)}\nNet Profit: ${inr(netProfit)}\n`;
    if (reinvestAmount > 0) msg += `Reinvestment set aside: ${inr(reinvestAmount)}\n`;
    msg += `*Distributable Profit: ${inr(distributable)}*\n\n*Partner Shares:*\n`;
    partners.forEach((p) => { msg += `${p.name} (${p.sharePercent}%): ${inr(distributable * (Number(p.sharePercent) || 0) / 100)}\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const shareToPartner = (p) => {
    const share = distributable * (Number(p.sharePercent) || 0) / 100;
    let msg = `Hi ${p.name}, here's the *${RANGE_LABEL[range]}* summary from ${business?.name || "us"}:\n\n`;
    msg += `Total Sales: ${inr(sales)}\nGross Profit: ${inr(grossProfit)}\nExpenses: ${inr(expTotal)}\nNet Profit: ${inr(netProfit)}\n`;
    if (reinvestAmount > 0) msg += `Reinvestment set aside: ${inr(reinvestAmount)}\n`;
    msg += `Distributable Profit: ${inr(distributable)}\n\n*Your share (${p.sharePercent}%): ${inr(share)}*`;
    const phone = (p.phone || "").replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <RangeTabs range={range} setRange={setRange} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {partners.length > 0 && <button onClick={shareToAll} style={S.ghostBtn}><Share2 size={15} /> Share full report</button>}
          <button onClick={() => setDraft(emptyPartner())} style={S.primaryBtn}><Plus size={16} /> Add partner</button>
        </div>
      </div>

      <div style={S.statGrid}>
        <StatCard icon={IndianRupee} label="Sales" value={inr(sales)} accent="#C4F135" />
        <StatCard icon={TrendingUp} label="Gross profit" value={inr(grossProfit)} accent="#3D8BFD" />
        <StatCard icon={ArrowDownRight} label="Expenses" value={inr(expTotal)} accent="#FF6B6B" />
        <StatCard icon={ArrowUpRight} label="Net profit" value={inr(netProfit)} accent="#C4F135" />
      </div>

      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={S.cardTitle}>Reinvestment</div>
        <div style={{ color: "#8B93A1", fontSize: 12.5, marginBottom: 10 }}>
          Set aside an amount from net profit for the business before splitting the rest between partners.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field
            label={`Reinvestment amount · ${RANGE_LABEL[range]}`}
            value={String(reinvest[range] ?? "")}
            onChange={(v) => setReinvest((r) => ({ ...r, [range]: v.replace(/[^0-9.]/g, "") }))}
            placeholder="0"
          />
          <div style={{ paddingBottom: 10, fontSize: 13 }}>
            <span style={{ color: "#8B93A1" }}>Distributable profit: </span>
            <b style={{ fontFamily: "'JetBrains Mono',monospace", color: "#C4F135" }}>{inr(distributable)}</b>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? <Empty text="Loading…" /> : partners.length === 0 ? <Empty text="No partners added yet." /> : partners.map((p) => {
          const share = distributable * (Number(p.sharePercent) || 0) / 100;
          return (
            <div key={p._id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div style={{ color: "#5A616F", fontSize: 11.5 }}>{p.sharePercent}% share {p.phone ? "· " + p.phone : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#C4F135" }}>{inr(share)}</div>
                <button onClick={() => shareToPartner(p)} style={S.iconBtn}><Share2 size={14} /></button>
                <button onClick={() => remove(p._id)} style={S.iconBtn}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {draft && (
        <Modal title="Add partner" onClose={() => setDraft(null)}>
          <div style={S.formGrid}>
            <Field label="Partner name *" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Partner name" />
            <Field label="WhatsApp number" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="91 98765 43210" />
            <Field label="Profit share %" value={draft.sharePercent} onChange={(v) => setDraft((d) => ({ ...d, sharePercent: v.replace(/[^0-9.]/g, "") }))} placeholder="e.g. 25" />
          </div>
          <button
            onClick={save}
            disabled={!draft.name || !draft.sharePercent}
            style={{ ...S.primaryBtn, width: "100%", marginTop: 16, opacity: (!draft.name || !draft.sharePercent) ? 0.4 : 1, position: "sticky", bottom: -1, zIndex: 1, boxShadow: "0 -8px 16px 4px #171B23" }}
          >
            <Check size={16} /> Save partner
          </button>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   14. SETTINGS
========================================================================= */
function SettingsTab({ business, setBusiness }) {
  const [f, setF] = useState(business);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(business?.logoUrl || "");
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setBusy(true);
    try {
      let updated = (await api.put("/business", f)).data;
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        updated = (await api.post("/business/logo", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
      }
      setBusiness(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>Business details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#1B1F27", border: "1px dashed #3A414F", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {logoPreview ? <img src={logoPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} color="#5A616F" />}
            </div>
            <label style={{ ...S.ghostBtn, cursor: "pointer", fontSize: 13 }}>
              <Upload size={14} /> Change logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            </label>
          </div>
          <Field label="Business name" value={f.name} onChange={(v) => set("name", v)} />
          <Field label="Tagline" value={f.tagline} onChange={(v) => set("tagline", v)} />
          <Field label="Address" value={f.address} onChange={(v) => set("address", v)} textarea />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Phone" value={f.phone} onChange={(v) => set("phone", v)} />
            <Field label="WhatsApp" value={f.whatsapp} onChange={(v) => set("whatsapp", v)} />
          </div>
          <Field label="Email" value={f.email} onChange={(v) => set("email", v)} />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="GSTIN" value={f.gstin} onChange={(v) => set("gstin", v.toUpperCase())} />
            <Field label="GST rate %" value={String(f.gstRate ?? "")} onChange={(v) => set("gstRate", v.replace(/[^0-9.]/g, ""))} />
          </div>
        </div>
        <button onClick={save} disabled={busy} style={{ ...S.primaryBtn, width: "100%", marginTop: 18, opacity: busy ? 0.6 : 1 }}>
          <Check size={16} /> {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   15. SHARED 
========================================================================= */
export function Field({ label, value, onChange, placeholder, textarea, type = "text" }) {
  return (
    <div style={S.field}>
      <label style={S.fieldLabel}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={S.input} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={S.input} />
      )}
    </div>
  );
}
function ScooterModal({
  editing,
  setEditing,
  onClose,
  onSave,
}) {
  const f = editing.data;

  const set = (key, value) => {
    setEditing((prev) => ({
      ...prev,

      data: {
        ...prev.data,
        [key]: value,
      },
    }));
  };

  const handleImg = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const preview = URL.createObjectURL(file);

    setEditing((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: preview,
    }));
  };

  const canSave =
    f.name &&
    f.actualPrice &&
    f.sellingPrice;

  return (
    <Modal
      title={
        editing.id
          ? "Edit scooter"
          : "Add scooter"
      }
      onClose={onClose}
    >
      {/* IMAGE */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,

            borderRadius: 10,
            background: "#1E2430",

            overflow: "hidden",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            flexShrink: 0,
          }}
        >
          {editing.imagePreview ? (
            <img
              src={editing.imagePreview}
              alt="Scooter"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <ImageIcon
              size={22}
              color="#5A616F"
            />
          )}
        </div>

        <label
          style={{
            ...S.ghostBtn,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <Upload size={14} />

          Upload image

          <input
            type="file"
            accept="image/*"
            onChange={handleImg}
            style={{
              display: "none",
            }}
          />
        </label>
      </div>

      {/* FORM */}
      <div style={S.formGrid}>

        <Field
          label="Scooter name *"
          value={f.name}
          onChange={(v) =>
            set("name", v)
          }
          placeholder="e.g. Volt Ryder X1"
        />

        <Field
          label="Chassis no."
          value={f.chassisNo}
          onChange={(v) =>
            set("chassisNo", v)
          }
          placeholder="CH-000123"
        />

        <Field
          label="Motor no."
          value={f.motorNo}
          onChange={(v) =>
            set("motorNo", v)
          }
          placeholder="MT-000456"
        />

        <Field
          label="Warranty"
          value={f.warranty}
          onChange={(v) =>
            set("warranty", v)
          }
          placeholder="e.g. 2 yrs"
        />

        <Field
          label="Features"
          value={f.features}
          onChange={(v) =>
            set("features", v)
          }
          placeholder="LED display, reverse mode..."
          textarea
        />

        <Field
          label="Battery info"
          value={f.batteryInfo}
          onChange={(v) =>
            set("batteryInfo", v)
          }
          placeholder="60V 30Ah"
          textarea
        />

        {/* SCOOTER + BATTERY PRICE */}
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",

            gap: 10,
          }}
        >
          <Field
            label="Scooter price"
            value={f.scooterPrice}
            onChange={(v) =>
              set(
                "scooterPrice",
                v.replace(/[^0-9.]/g, "")
              )
            }
            placeholder="0"
          />

          <Field
            label="Battery price"
            value={f.batteryPrice}
            onChange={(v) =>
              set(
                "batteryPrice",
                v.replace(/[^0-9.]/g, "")
              )
            }
            placeholder="0"
          />
        </div>

        {/* ACTUAL + SELLING PRICE */}
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",

            gap: 10,
          }}
        >
          <Field
            label="Actual (cost) price *"
            value={f.actualPrice}
            onChange={(v) =>
              set(
                "actualPrice",
                v.replace(/[^0-9.]/g, "")
              )
            }
            placeholder="0"
          />

          <Field
            label="Selling price *"
            value={f.sellingPrice}
            onChange={(v) =>
              set(
                "sellingPrice",
                v.replace(/[^0-9.]/g, "")
              )
            }
            placeholder="0"
          />
        </div>

      </div>

      {/* SAVE BUTTON */}

      <div
        style={{
          marginTop: 20,

          paddingTop: 14,
          paddingBottom: 14,

          position: "sticky",

          bottom: 0,

          zIndex: 999999,

          background: "#202631",

          borderTop:
            "1px solid #303846",
        }}
      >
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{
            ...S.primaryBtn,

            width: "100%",

            justifyContent: "center",

            minHeight: 48,

            opacity:
              canSave
                ? 1
                : 0.45,

            pointerEvents:
              canSave
                ? "auto"
                : "none",
          }}
        >
          <Check size={17} />

          Save scooter
        </button>
      </div>
    </Modal>
  );
}

/* =========================================================================
   16. STYLE TOKEN
========================================================================= */
export const S = {
  screen: { minHeight: "100vh", background: "#12151A", display: "flex", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: "#F2F3F0" },
  centerScreen: { minHeight: "100vh", background: "#12151A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: "#F2F3F0", position: "relative", overflow: "hidden" },
  voltGlow: { position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(196,241,53,0.08),transparent 70%)", top: "-10%", left: "-10%" },
  boltBadge: { width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#C4F135,#8FAE2A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  card: { background: "#171B23", border: "1px solid #232833", borderRadius: 14, padding: 18 },
  cardTitle: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14.5, marginBottom: 4 },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#C4F135", color: "#12151A", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" },
  ghostBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#1B1F27", color: "#F2F3F0", border: "1px solid #2A2F3A", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  ghostBtnSm: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#1E2430", color: "#8B93A1", border: "none", borderRadius: 8, padding: "7px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer", flex: 1 },
  iconBtn: { background: "#1E2430", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8B93A1" },
  input: { background: "#12151A", border: "1px solid #2A2F3A", borderRadius: 9, padding: "10px 12px", color: "#F2F3F0", fontSize: 13.5, fontFamily: "'Inter',sans-serif", outline: "none", width: "100%", boxSizing: "border-box" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, background: "#171B23", border: "1px solid #232833", borderRadius: 10, padding: "9px 12px" },
  searchInput: { background: "transparent", border: "none", outline: "none", color: "#F2F3F0", fontSize: 13.5, width: "100%" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 },
  rowLine: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #1E2430" },
  formGrid: { display: "flex", flexDirection: "column", gap: 12 },
  fieldLabel: { fontSize: 12, color: "#8B93A1", fontWeight: 500, display: "block", marginBottom: 6 },
  field: { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  th: { padding: "8px 10px", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 },
  td: { padding: "9px 10px" },
};
