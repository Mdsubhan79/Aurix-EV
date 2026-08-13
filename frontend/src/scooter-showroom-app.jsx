import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Zap, LayoutDashboard, Bike, Receipt, TrendingUp, Wallet, Users, Settings as SettingsIcon,
  Plus, X, Trash2, Edit2, Search, Download, Share2, ChevronRight, ChevronLeft,
  Battery, IndianRupee, MapPin, Phone, Mail, Building2, FileText, Calendar,
  ArrowUpRight, ArrowDownRight, Check, Upload, Image as ImageIcon
} from "lucide-react";
import * as XLSX from "xlsx";

/* ---------------------------------------------------------------
   DESIGN TOKENS
   bg #12151A  surface #1B1F27  surface2 #232833
   volt (accent) #C4F135   volt-dim #8FAE2A
   circuit (secondary accent) #3D8BFD
   text #F2F3F0   muted #8B93A1   danger #FF6B6B  line #2A2F3A
   display font: Space Grotesk | body: Inter | data/mono: JetBrains Mono
----------------------------------------------------------------*/

const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap";

function useFonts() {
  useEffect(() => {
    if (!document.getElementById("ss-fonts")) {
      const link = document.createElement("link");
      link.id = "ss-fonts";
      link.rel = "stylesheet";
      link.href = FONTS_LINK;
      document.head.appendChild(link);
    }
  }, []);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ---------- storage helpers (personal, not shared) ----------
async function sGet(key, fallback) {
  try {
    const r = await window.storage.get(key, false);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function sSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error("storage set failed", key, e);
  }
}

// ---------- date range helpers ----------
function inRange(dateStr, range) {
  const d = new Date(dateStr);
  const now = new Date();
  if (range === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (range === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (range === "year") {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

const RANGE_LABEL = { today: "Today", week: "This Week", month: "This Month", year: "This Year" };

/* =================================================================
   ROOT APP
================================================================= */
export default function App() {
  useFonts();
  const [stage, setStage] = useState("boot"); // boot -> login -> onboarding -> loading -> app
  const [owner, setOwner] = useState(null);
  const [business, setBusiness] = useState(null);
  const [scooters, setScooters] = useState([]);
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [partners, setPartners] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const seededOwner = await sGet("owner", null);
      let ownerData = seededOwner;
      if (!ownerData) {
        ownerData = { name: "MOHD SUBHAN", email: "mdsammlk00@gmail.com" };
        await sSet("owner", ownerData);
      }
      setOwner(ownerData);
      const biz = await sGet("business", null);
      const sc = await sGet("scooters", []);
      const bl = await sGet("bills", []);
      const ex = await sGet("expenses", []);
      const pt = await sGet("partners", []);
      setBusiness(biz);
      setScooters(sc);
      setBills(bl);
      setExpenses(ex);
      setPartners(pt);
      setLoaded(true);
      setStage("login");
    })();
  }, []);

  const enterApp = () => {
    setStage(business ? "loading" : "onboarding");
  };

  const finishOnboarding = async (biz) => {
    setBusiness(biz);
    await sSet("business", biz);
    setStage("loading");
  };

  useEffect(() => {
    if (stage === "loading") {
      const t = setTimeout(() => setStage("app"), 1600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  if (!loaded || stage === "boot") return <BootBlank />;
  if (stage === "login") return <LoginScreen owner={owner} onEnter={enterApp} />;
  if (stage === "onboarding") return <OnboardingScreen onDone={finishOnboarding} />;
  if (stage === "loading") return <LoadingScreen business={business} />;

  return (
    <AppShell
      owner={owner}
      business={business}
      setBusiness={async (b) => { setBusiness(b); await sSet("business", b); }}
      scooters={scooters}
      setScooters={async (s) => { setScooters(s); await sSet("scooters", s); }}
      bills={bills}
      setBills={async (b) => { setBills(b); await sSet("bills", b); }}
      expenses={expenses}
      setExpenses={async (e) => { setExpenses(e); await sSet("expenses", e); }}
      partners={partners}
      setPartners={async (p) => { setPartners(p); await sSet("partners", p); }}
      tab={tab}
      setTab={setTab}
    />
  );
}

function BootBlank() {
  return <div style={{ background: "#12151A", height: "100vh", width: "100%" }} />;
}

/* =================================================================
   LOGIN SCREEN
================================================================= */
function LoginScreen({ owner, onEnter }) {
  return (
    <div style={styles.centerScreen}>
      <div style={styles.voltGlow} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 36 }}>
          <div style={styles.boltBadge}><Zap size={20} color="#12151A" strokeWidth={2.5} /></div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: "#F2F3F0", letterSpacing: 0.2 }}>VoltLine</span>
        </div>

        <div style={{ ...styles.card, padding: 28, textAlign: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 18px",
            background: "linear-gradient(135deg,#C4F135,#8FAE2A)", display: "flex", alignItems: "center",
            justifyContent: "center", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 26, color: "#12151A"
          }}>
            {owner.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, color: "#F2F3F0" }}>{owner.name}</div>
          <div style={{ color: "#8B93A1", fontSize: 14, marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>{owner.email}</div>
          <div style={{ color: "#8B93A1", fontSize: 12, marginTop: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>Owner Account</div>

          <button onClick={onEnter} style={{ ...styles.primaryBtn, width: "100%", marginTop: 26 }}>
            Enter Dashboard <ChevronRight size={17} />
          </button>
        </div>
        <div style={{ textAlign: "center", color: "#5A616F", fontSize: 12, marginTop: 20 }}>
          Electric Scooter Showroom · Sales · Service · Repair
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   ONBOARDING — business details
================================================================= */
function OnboardingScreen({ onDone }) {
  const [f, setF] = useState({
    name: "", tagline: "", address: "", email: "", phone: "", whatsapp: "",
    gstin: "", gstRate: "18", logo: ""
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logo", reader.result);
    reader.readAsDataURL(file);
  };

  const canSubmit = f.name.trim() && f.phone.trim();

  return (
    <div style={{ ...styles.screen, alignItems: "flex-start", paddingTop: 0 }}>
      <div style={{ width: "100%", maxWidth: 460, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={styles.boltBadge}><Zap size={16} color="#12151A" strokeWidth={2.5} /></div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: "#F2F3F0" }}>VoltLine</span>
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: "#F2F3F0", margin: "18px 0 4px" }}>Set up your business</h1>
        <p style={{ color: "#8B93A1", fontSize: 14, margin: "0 0 26px" }}>This appears on every bill, catalogue sheet, and WhatsApp report.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LogoPicker logo={f.logo} onChange={handleLogo} />
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

        <button disabled={!canSubmit} onClick={() => onDone(f)}
          style={{ ...styles.primaryBtn, width: "100%", marginTop: 26, opacity: canSubmit ? 1 : 0.4 }}>
          Save & Continue <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

function LogoPicker({ logo, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: "#1B1F27", border: "1px dashed #3A414F",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0
      }}>
        {logo ? <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} color="#5A616F" />}
      </div>
      <label style={{ ...styles.ghostBtn, cursor: "pointer", fontSize: 13 }}>
        <Upload size={14} /> Upload logo
        <input type="file" accept="image/*" onChange={onChange} style={{ display: "none" }} />
      </label>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea, type = "text" }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#8B93A1", fontWeight: 500 }}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={styles.input} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={styles.input} />
      )}
    </div>
  );
}

/* =================================================================
   LOADING SCREEN — charging bar signature element
================================================================= */
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
    <div style={styles.centerScreen}>
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 30 }}>
          <div style={styles.boltBadge}><Zap size={20} color="#12151A" strokeWidth={2.5} /></div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: "#F2F3F0" }}>{business?.name || "VoltLine"}</span>
        </div>
        {/* battery charging signature */}
        <div style={{ width: 180, height: 70, border: "3px solid #2A2F3A", borderRadius: 10, position: "relative", margin: "0 auto", padding: 5 }}>
          <div style={{
            position: "absolute", right: -11, top: "50%", transform: "translateY(-50%)",
            width: 8, height: 24, background: "#2A2F3A", borderRadius: "0 3px 3px 0"
          }} />
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 5,
            background: "linear-gradient(90deg,#8FAE2A,#C4F135)",
            transition: "width 0.05s linear", boxShadow: "0 0 16px rgba(196,241,53,0.5)"
          }} />
        </div>
        <div style={{ marginTop: 16, fontFamily: "'JetBrains Mono',monospace", color: "#C4F135", fontSize: 14, fontWeight: 600 }}>
          Charging up your dashboard · {Math.floor(pct)}%
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   APP SHELL — nav + routing
================================================================= */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "catalogue", label: "Catalogue", icon: Bike },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "partners", label: "Partners", icon: Users },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function AppShell(props) {
  const { tab, setTab, business } = props;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 860;

  return (
    <div style={{ minHeight: "100vh", background: "#12151A", color: "#F2F3F0", fontFamily: "'Inter',sans-serif", display: "flex" }}>
      {!isMobile && <Sidebar tab={tab} setTab={setTab} business={business} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar business={business} tab={tab} />
        <div style={{ flex: 1, padding: isMobile ? "16px 14px 90px" : "24px 32px 40px", overflowY: "auto" }}>
          {tab === "dashboard" && <Dashboard {...props} />}
          {tab === "catalogue" && <Catalogue {...props} />}
          {tab === "billing" && <Billing {...props} />}
          {tab === "sales" && <Sales {...props} />}
          {tab === "expenses" && <Expenses {...props} />}
          {tab === "partners" && <Partners {...props} />}
          {tab === "settings" && <SettingsTab {...props} />}
        </div>
      </div>
      {isMobile && <BottomNav tab={tab} setTab={setTab} />}
    </div>
  );
}

function Sidebar({ tab, setTab, business }) {
  return (
    <div style={{ width: 224, borderRight: "1px solid #232833", padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 30 }}>
        <div style={styles.boltBadge}><Zap size={16} color="#12151A" strokeWidth={2.5} /></div>
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
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const visible = NAV.filter(n => ["dashboard", "catalogue", "billing", "sales", "expenses"].includes(n.id));
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, background: "#171B23", borderTop: "1px solid #232833",
      display: "flex", justifyContent: "space-around", padding: "8px 4px calc(env(safe-area-inset-bottom,0px) + 8px)", zIndex: 10
    }}>
      {visible.map((n) => {
        const Icon = n.icon;
        const active = tab === n.id;
        return (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center",
            gap: 3, color: active ? "#C4F135" : "#5A616F", fontSize: 10, padding: "4px 8px"
          }}>
            <Icon size={19} /> {n.label}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ business, tab }) {
  const label = NAV.find(n => n.id === tab)?.label || "";
  return (
    <div style={{ padding: "18px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 21 }}>{label}</div>
        {business?.tagline ? <div style={{ color: "#5A616F", fontSize: 12, marginTop: 2 }}>{business.tagline}</div> : null}
      </div>
    </div>
  );
}

/* =================================================================
   DASHBOARD
================================================================= */
function Dashboard({ bills, expenses, scooters, partners, setTab }) {
  const [range, setRange] = useState("today");
  const periodBills = bills.filter(b => inRange(b.date, range));
  const periodExpenses = expenses.filter(e => inRange(e.date, range));
  const sales = periodBills.reduce((s, b) => s + b.total, 0);
  const profit = periodBills.reduce((s, b) => s + (b.items || []).reduce((x, it) => x + (it.sellingPrice - it.actualPrice) * it.qty, 0), 0);
  const expTotal = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = profit - expTotal;

  const locations = useMemo(() => {
    const map = {};
    periodBills.forEach(b => {
      const loc = b.location || "Unspecified";
      map[loc] = (map[loc] || 0) + b.total;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [periodBills]);

  return (
    <div>
      <RangeTabs range={range} setRange={setRange} />
      <div style={styles.statGrid}>
        <StatCard icon={IndianRupee} label={`Sales · ${RANGE_LABEL[range]}`} value={inr(sales)} accent="#C4F135" sub={`${periodBills.length} bill${periodBills.length !== 1 ? "s" : ""}`} />
        <StatCard icon={TrendingUp} label="Gross Profit" value={inr(profit)} accent="#3D8BFD" />
        <StatCard icon={ArrowDownRight} label="Expenses" value={inr(expTotal)} accent="#FF6B6B" />
        <StatCard icon={netProfit >= 0 ? ArrowUpRight : ArrowDownRight} label="Net Profit" value={inr(netProfit)} accent={netProfit >= 0 ? "#C4F135" : "#FF6B6B"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginTop: 20 }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Recent bills</div>
          {bills.length === 0 ? <Empty text="No bills yet. Create your first bill from Billing." /> : (
            <div>
              {bills.slice().reverse().slice(0, 6).map(b => (
                <div key={b.id} style={styles.rowLine}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.customerName || "Walk-in"}</div>
                    <div style={{ color: "#5A616F", fontSize: 11.5 }}>{fmtDate(b.date)} · {b.type}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#C4F135" }}>{inr(b.total)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Sales by location</div>
          {locations.length === 0 ? <Empty text="No location data for this period." /> : (
            <div>
              {locations.map(([loc, amt]) => (
                <div key={loc} style={styles.rowLine}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}><MapPin size={13} color="#8B93A1" /> {loc}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{inr(amt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
    <button onClick={onClick} style={{ ...styles.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#1E2430", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color="#C4F135" />
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function RangeTabs({ range, setRange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {Object.keys(RANGE_LABEL).map(r => (
        <button key={r} onClick={() => setRange(r)} style={{
          padding: "7px 14px", borderRadius: 20, border: "1px solid " + (range === r ? "#C4F135" : "#2A2F3A"),
          background: range === r ? "rgba(196,241,53,0.1)" : "transparent", color: range === r ? "#C4F135" : "#8B93A1",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer"
        }}>{RANGE_LABEL[r]}</button>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: "#8B93A1", fontSize: 12, fontWeight: 500 }}>{label}</div>
        <Icon size={15} color={accent} />
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 22, marginTop: 8, color: accent }}>{value}</div>
      {sub ? <div style={{ color: "#5A616F", fontSize: 11, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ color: "#5A616F", fontSize: 13, padding: "18px 4px", textAlign: "center" }}>{text}</div>;
}

/* =================================================================
   CATALOGUE
================================================================= */
function emptyScooter() {
  return {
    id: uid(), name: "", image: "", chassisNo: "", motorNo: "", features: "",
    warranty: "", batteryInfo: "", scooterPrice: "", batteryPrice: "", actualPrice: "", sellingPrice: ""
  };
}

function Catalogue({ scooters, setScooters }) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = scooters.filter(s => (s.name + s.chassisNo + s.motorNo).toLowerCase().includes(query.toLowerCase()));

  const save = async (s) => {
    const exists = scooters.some(x => x.id === s.id);
    const next = exists ? scooters.map(x => x.id === s.id ? s : x) : [...scooters, s];
    await setScooters(next);
    setEditing(null);
  };
  const remove = async (id) => { await setScooters(scooters.filter(s => s.id !== id)); };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ ...styles.searchBox, flex: 1, minWidth: 180 }}>
          <Search size={15} color="#5A616F" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, chassis, motor no." style={styles.searchInput} />
        </div>
        <button onClick={() => setEditing(emptyScooter())} style={styles.primaryBtn}><Plus size={16} /> Add scooter</button>
      </div>

      {filtered.length === 0 ? <Empty text="No scooters in catalogue yet." /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {filtered.map(s => (
            <div key={s.id} style={styles.card}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, background: "#1E2430", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.image ? <img src={s.image} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Bike size={22} color="#5A616F" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name || "Untitled"}</div>
                  <div style={{ color: "#5A616F", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>Chassis {s.chassisNo || "—"}</div>
                  <div style={{ color: "#5A616F", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>Motor {s.motorNo || "—"}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12.5 }}>
                <div style={{ color: "#8B93A1" }}>Actual: <b style={{ color: "#F2F3F0" }}>{inr(s.actualPrice)}</b></div>
                <div style={{ color: "#8B93A1" }}>Selling: <b style={{ color: "#C4F135" }}>{inr(s.sellingPrice)}</b></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setEditing(s)} style={styles.ghostBtnSm}><Edit2 size={13} /> Edit</button>
                <button onClick={() => remove(s.id)} style={{ ...styles.ghostBtnSm, color: "#FF6B6B" }}><Trash2 size={13} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <ScooterModal scooter={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ScooterModal({ scooter, onClose, onSave }) {
  const [f, setF] = useState(scooter);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const handleImg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("image", reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <Modal title={scooter.name ? "Edit scooter" : "Add scooter"} onClose={onClose}>
      <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 10, background: "#1E2430", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {f.image ? <img src={f.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} color="#5A616F" />}
        </div>
        <label style={{ ...styles.ghostBtn, cursor: "pointer", fontSize: 13 }}>
          <Upload size={14} /> Upload image
          <input type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
        </label>
      </div>
      <div style={styles.formGrid}>
        <Field label="Scooter name *" value={f.name} onChange={v => set("name", v)} placeholder="e.g. Volt Ryder X1" />
        <Field label="Chassis no." value={f.chassisNo} onChange={v => set("chassisNo", v)} placeholder="CH-000123" />
        <Field label="Motor no." value={f.motorNo} onChange={v => set("motorNo", v)} placeholder="MT-000456" />
        <Field label="Warranty" value={f.warranty} onChange={v => set("warranty", v)} placeholder="e.g. 2 yrs / 25,000 km" />
        <Field label="Features" value={f.features} onChange={v => set("features", v)} placeholder="LED display, reverse mode..." textarea />
        <Field label="Battery info" value={f.batteryInfo} onChange={v => set("batteryInfo", v)} placeholder="60V 30Ah Lithium, removable" textarea />
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Scooter price" value={f.scooterPrice} onChange={v => set("scooterPrice", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
          <Field label="Battery price" value={f.batteryPrice} onChange={v => set("batteryPrice", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Actual (cost) price *" value={f.actualPrice} onChange={v => set("actualPrice", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
          <Field label="Selling price *" value={f.sellingPrice} onChange={v => set("sellingPrice", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </div>
      </div>
      <button onClick={() => onSave(f)} disabled={!f.name || !f.actualPrice || !f.sellingPrice}
        style={{ ...styles.primaryBtn, width: "100%", marginTop: 16, opacity: (!f.name || !f.actualPrice || !f.sellingPrice) ? 0.4 : 1 }}>
        <Check size={16} /> Save scooter
      </button>
    </Modal>
  );
}

/* =================================================================
   BILLING
================================================================= */
function emptyBill(business) {
  return {
    id: uid(), date: todayISO(), customerName: "", customerPhone: "", location: "",
    type: "sale", serviceDesc: "", items: [], gstRate: business?.gstRate || "18", paymentMode: "Cash"
  };
}

function Billing({ scooters, bills, setBills, business }) {
  const [draft, setDraft] = useState(null);
  const [viewing, setViewing] = useState(null);

  const addItem = (scooterId) => {
    const sc = scooters.find(s => s.id === scooterId);
    if (!sc) return;
    setDraft(d => ({
      ...d, items: [...d.items, {
        scooterId: sc.id, name: sc.name, chassisNo: sc.chassisNo, motorNo: sc.motorNo,
        actualPrice: Number(sc.actualPrice) || 0, sellingPrice: Number(sc.sellingPrice) || 0, qty: 1
      }]
    }));
  };
  const removeItem = (idx) => setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));

  const subtotal = draft ? draft.items.reduce((s, it) => s + it.sellingPrice * it.qty, 0) : 0;
  const gstAmt = draft ? +(subtotal * (Number(draft.gstRate) || 0) / 100).toFixed(2) : 0;
  const total = subtotal + gstAmt;

  const saveBill = async () => {
    const bill = { ...draft, subtotal, gstAmount: gstAmt, total };
    await setBills([...bills, bill]);
    setDraft(null);
  };

  const shareBillWhatsApp = (bill) => {
    let msg = `*${business?.name || "Invoice"}*\n${business?.address || ""}\nPh: ${business?.phone || ""}\n\n`;
    msg += `*BILL* — ${fmtDate(bill.date)}\nCustomer: ${bill.customerName || "Walk-in"}\nType: ${bill.type}\n\n`;
    bill.items.forEach(it => { msg += `${it.name} x${it.qty} — ${inr(it.sellingPrice * it.qty)}\n`; });
    if (bill.serviceDesc) msg += `Service: ${bill.serviceDesc}\n`;
    msg += `\nSubtotal: ${inr(bill.subtotal)}\nGST (${bill.gstRate}%): ${inr(bill.gstAmount)}\n*Total: ${inr(bill.total)}*\n\nThank you for your business!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setDraft(emptyBill(business))} style={styles.primaryBtn}><Plus size={16} /> New bill</button>
      </div>

      {bills.length === 0 ? <Empty text="No bills yet." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bills.slice().reverse().map(b => (
            <div key={b.id} style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
              <div onClick={() => setViewing(b)} style={{ cursor: "pointer", flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.customerName || "Walk-in"} <span style={{ color: "#5A616F", fontWeight: 400, fontSize: 12 }}>· {b.type}</span></div>
                <div style={{ color: "#5A616F", fontSize: 11.5, marginTop: 2 }}>{fmtDate(b.date)} {b.location ? "· " + b.location : ""}</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#C4F135", marginRight: 14 }}>{inr(b.total)}</div>
              <button onClick={() => shareBillWhatsApp(b)} style={styles.iconBtn}><Share2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <Modal title="New bill" onClose={() => setDraft(null)} wide>
          <div style={styles.formGrid}>
            <Field label="Customer name" value={draft.customerName} onChange={v => setDraft(d => ({ ...d, customerName: v }))} placeholder="Customer name" />
            <Field label="Customer phone" value={draft.customerPhone} onChange={v => setDraft(d => ({ ...d, customerPhone: v }))} placeholder="98765 43210" />
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Date" type="date" value={draft.date} onChange={v => setDraft(d => ({ ...d, date: v }))} />
              <Field label="Location / branch" value={draft.location} onChange={v => setDraft(d => ({ ...d, location: v }))} placeholder="e.g. Main Showroom" />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "#8B93A1", fontWeight: 500, display: "block", marginBottom: 6 }}>Bill type</label>
                <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} style={styles.input}>
                  <option value="sale">Sale</option>
                  <option value="service">Service</option>
                  <option value="repair">Repair</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "#8B93A1", fontWeight: 500, display: "block", marginBottom: 6 }}>Payment mode</label>
                <select value={draft.paymentMode} onChange={e => setDraft(d => ({ ...d, paymentMode: e.target.value }))} style={styles.input}>
                  <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>EMI</option>
                </select>
              </div>
            </div>
            {draft.type !== "sale" && (
              <Field label="Service / repair description" value={draft.serviceDesc} onChange={v => setDraft(d => ({ ...d, serviceDesc: v }))} placeholder="Describe work done" textarea />
            )}
          </div>

          {draft.type === "sale" && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: "#8B93A1", fontWeight: 500 }}>Add scooter from catalogue</label>
              <select onChange={e => { if (e.target.value) { addItem(e.target.value); e.target.value = ""; } }} style={{ ...styles.input, marginTop: 6 }} defaultValue="">
                <option value="" disabled>Select scooter…</option>
                {scooters.map(s => <option key={s.id} value={s.id}>{s.name} — {inr(s.sellingPrice)}</option>)}
              </select>
            </div>
          )}

          {draft.items.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {draft.items.map((it, idx) => (
                <div key={idx} style={{ ...styles.rowLine }}>
                  <div style={{ fontSize: 13 }}>{it.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{inr(it.sellingPrice * it.qty)}</span>
                    <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer" }}><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Field label="GST rate %" value={draft.gstRate} onChange={v => setDraft(d => ({ ...d, gstRate: v.replace(/[^0-9.]/g, "") }))} placeholder="18" />
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid #2A2F3A", paddingTop: 12 }}>
            <div style={styles.rowLine}><span style={{ color: "#8B93A1", fontSize: 13 }}>Subtotal</span><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{inr(subtotal)}</span></div>
            <div style={styles.rowLine}><span style={{ color: "#8B93A1", fontSize: 13 }}>GST ({draft.gstRate}%)</span><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{inr(gstAmt)}</span></div>
            <div style={{ ...styles.rowLine, borderTop: "1px solid #2A2F3A", paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>Total</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#C4F135", fontSize: 17 }}>{inr(total)}</span>
            </div>
          </div>

          <button onClick={saveBill} disabled={draft.type === "sale" && draft.items.length === 0}
            style={{ ...styles.primaryBtn, width: "100%", marginTop: 16, opacity: (draft.type === "sale" && draft.items.length === 0) ? 0.4 : 1 }}>
            <Check size={16} /> Save bill
          </button>
        </Modal>
      )}

      {viewing && (
        <Modal title="Bill details" onClose={() => setViewing(null)}>
          <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
            <div><b>{viewing.customerName || "Walk-in"}</b> · {viewing.customerPhone}</div>
            <div style={{ color: "#8B93A1" }}>{fmtDate(viewing.date)} · {viewing.type} · {viewing.location}</div>
            <div style={{ marginTop: 10 }}>
              {viewing.items.map((it, i) => <div key={i} style={styles.rowLine}><span>{it.name} x{it.qty}</span><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{inr(it.sellingPrice * it.qty)}</span></div>)}
            </div>
            {viewing.serviceDesc && <div style={{ marginTop: 8, color: "#8B93A1" }}>Note: {viewing.serviceDesc}</div>}
            <div style={{ ...styles.rowLine, borderTop: "1px solid #2A2F3A", marginTop: 10, paddingTop: 10 }}>
              <span style={{ fontWeight: 700 }}>Total</span><span style={{ color: "#C4F135", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{inr(viewing.total)}</span>
            </div>
          </div>
          <button onClick={() => shareBillWhatsApp(viewing)} style={{ ...styles.primaryBtn, width: "100%", marginTop: 16 }}><Share2 size={15} /> Share on WhatsApp</button>
        </Modal>
      )}
    </div>
  );
}

/* =================================================================
   SALES — analytics + excel export
================================================================= */
function Sales({ bills, scooters }) {
  const [range, setRange] = useState("month");
  const filtered = bills.filter(b => inRange(b.date, range));
  const total = filtered.reduce((s, b) => s + b.total, 0);
  const profit = filtered.reduce((s, b) => s + (b.items || []).reduce((x, it) => x + (it.sellingPrice - it.actualPrice) * it.qty, 0), 0);

  const exportExcel = () => {
    const rows = [];
    filtered.forEach(b => {
      if (b.items.length === 0) {
        rows.push({
          Date: b.date, Customer: b.customerName, Phone: b.customerPhone, Location: b.location, Type: b.type,
          Scooter: "", "Chassis No": "", "Motor No": "", "Scooter Price": "", "Battery Price": "", "Actual Price": "",
          "Selling Price": "", Qty: "", "Profit Margin": "", Subtotal: b.subtotal, GST: b.gstAmount, Total: b.total, Payment: b.paymentMode
        });
      } else {
        b.items.forEach(it => {
          rows.push({
            Date: b.date, Customer: b.customerName, Phone: b.customerPhone, Location: b.location, Type: b.type,
            Scooter: it.name, "Chassis No": it.chassisNo, "Motor No": it.motorNo,
            "Actual Price": it.actualPrice, "Selling Price": it.sellingPrice, Qty: it.qty,
            "Profit Margin": (it.sellingPrice - it.actualPrice) * it.qty,
            Subtotal: b.subtotal, GST: b.gstAmount, Total: b.total, Payment: b.paymentMode
          });
        });
      }
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sales");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scooters.map(s => ({
      Name: s.name, "Chassis No": s.chassisNo, "Motor No": s.motorNo, Warranty: s.warranty,
      "Scooter Price": s.scooterPrice, "Battery Price": s.batteryPrice, "Actual Price": s.actualPrice, "Selling Price": s.sellingPrice
    }))), "Catalogue");
    XLSX.writeFile(wb, `sales-${range}-${todayISO()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <RangeTabs range={range} setRange={setRange} />
        <button onClick={exportExcel} style={styles.ghostBtn}><Download size={15} /> Export Excel</button>
      </div>
      <div style={styles.statGrid}>
        <StatCard icon={IndianRupee} label="Total sales" value={inr(total)} accent="#C4F135" sub={`${filtered.length} bills`} />
        <StatCard icon={TrendingUp} label="Total profit margin" value={inr(profit)} accent="#3D8BFD" />
      </div>
      <div style={{ ...styles.card, marginTop: 16, overflowX: "auto" }}>
        <div style={styles.cardTitle}>Bill-wise breakdown</div>
        {filtered.length === 0 ? <Empty text="No sales in this period." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 600 }}>
            <thead>
              <tr style={{ color: "#8B93A1", textAlign: "left" }}>
                <th style={styles.th}>Date</th><th style={styles.th}>Customer</th><th style={styles.th}>Location</th>
                <th style={styles.th}>Type</th><th style={styles.th}>Total</th><th style={styles.th}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice().reverse().map(b => (
                <tr key={b.id} style={{ borderTop: "1px solid #232833" }}>
                  <td style={styles.td}>{fmtDate(b.date)}</td>
                  <td style={styles.td}>{b.customerName || "Walk-in"}</td>
                  <td style={styles.td}>{b.location || "—"}</td>
                  <td style={styles.td}>{b.type}</td>
                  <td style={{ ...styles.td, fontFamily: "'JetBrains Mono',monospace" }}>{inr(b.total)}</td>
                  <td style={{ ...styles.td, fontFamily: "'JetBrains Mono',monospace", color: "#C4F135" }}>
                    {inr((b.items || []).reduce((x, it) => x + (it.sellingPrice - it.actualPrice) * it.qty, 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* =================================================================
   EXPENSES
================================================================= */
function emptyExpense() { return { id: uid(), date: todayISO(), category: "", amount: "", note: "", location: "" }; }

function Expenses({ expenses, setExpenses }) {
  const [draft, setDraft] = useState(null);
  const [range, setRange] = useState("month");
  const filtered = expenses.filter(e => inRange(e.date, range));
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const save = async () => { await setExpenses([...expenses, draft]); setDraft(null); };
  const remove = async (id) => { await setExpenses(expenses.filter(e => e.id !== id)); };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map(e => ({
      Date: e.date, Category: e.category, Amount: e.amount, Location: e.location, Note: e.note
    }))), "Expenses");
    XLSX.writeFile(wb, `expenses-${range}-${todayISO()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <RangeTabs range={range} setRange={setRange} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportExcel} style={styles.ghostBtn}><Download size={15} /> Export</button>
          <button onClick={() => setDraft(emptyExpense())} style={styles.primaryBtn}><Plus size={16} /> Add expense</button>
        </div>
      </div>
      <StatCard icon={Wallet} label={`Total expenses · ${RANGE_LABEL[range]}`} value={inr(total)} accent="#FF6B6B" />

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? <Empty text="No expenses recorded." /> : filtered.slice().reverse().map(e => (
          <div key={e.id} style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.category}</div>
              <div style={{ color: "#5A616F", fontSize: 11.5 }}>{fmtDate(e.date)} {e.location ? "· " + e.location : ""} {e.note ? "· " + e.note : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#FF6B6B" }}>{inr(e.amount)}</div>
              <button onClick={() => remove(e.id)} style={styles.iconBtn}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <Modal title="Add expense" onClose={() => setDraft(null)}>
          <div style={styles.formGrid}>
            <Field label="Category *" value={draft.category} onChange={v => setDraft(d => ({ ...d, category: v }))} placeholder="e.g. Rent, Salary, Parts, Electricity" />
            <Field label="Amount *" value={draft.amount} onChange={v => setDraft(d => ({ ...d, amount: v.replace(/[^0-9.]/g, "") }))} placeholder="0" />
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Date" type="date" value={draft.date} onChange={v => setDraft(d => ({ ...d, date: v }))} />
              <Field label="Location" value={draft.location} onChange={v => setDraft(d => ({ ...d, location: v }))} placeholder="e.g. Main Showroom" />
            </div>
            <Field label="Note" value={draft.note} onChange={v => setDraft(d => ({ ...d, note: v }))} placeholder="Optional details" textarea />
          </div>
          <button onClick={save} disabled={!draft.category || !draft.amount} style={{ ...styles.primaryBtn, width: "100%", marginTop: 16, opacity: (!draft.category || !draft.amount) ? 0.4 : 1 }}>
            <Check size={16} /> Save expense
          </button>
        </Modal>
      )}
    </div>
  );
}

/* =================================================================
   PARTNERS — profit sharing + WhatsApp
================================================================= */
function emptyPartner() { return { id: uid(), name: "", phone: "", sharePercent: "" }; }

function Partners({ bills, expenses, partners, setPartners, business }) {
  const [draft, setDraft] = useState(null);
  const [range, setRange] = useState("month");

  const periodBills = bills.filter(b => inRange(b.date, range));
  const periodExpenses = expenses.filter(e => inRange(e.date, range));
  const sales = periodBills.reduce((s, b) => s + b.total, 0);
  const grossProfit = periodBills.reduce((s, b) => s + (b.items || []).reduce((x, it) => x + (it.sellingPrice - it.actualPrice) * it.qty, 0), 0);
  const expTotal = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = grossProfit - expTotal;

  const save = async () => { await setPartners([...partners, draft]); setDraft(null); };
  const remove = async (id) => { await setPartners(partners.filter(p => p.id !== id)); };

  const shareToAll = () => {
    let msg = `*${business?.name || "Business"} — ${RANGE_LABEL[range]} Report*\n\n`;
    msg += `Total Sales: ${inr(sales)}\nGross Profit: ${inr(grossProfit)}\nExpenses: ${inr(expTotal)}\n*Net Profit: ${inr(netProfit)}*\n\n`;
    msg += `*Partner Shares:*\n`;
    partners.forEach(p => {
      const share = netProfit * (Number(p.sharePercent) || 0) / 100;
      msg += `${p.name} (${p.sharePercent}%): ${inr(share)}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const shareToPartner = (p) => {
    const share = netProfit * (Number(p.sharePercent) || 0) / 100;
    let msg = `Hi ${p.name}, here's the *${RANGE_LABEL[range]}* summary from ${business?.name || "us"}:\n\n`;
    msg += `Total Sales: ${inr(sales)}\nGross Profit: ${inr(grossProfit)}\nExpenses: ${inr(expTotal)}\nNet Profit: ${inr(netProfit)}\n\n`;
    msg += `*Your share (${p.sharePercent}%): ${inr(share)}*`;
    const phone = (p.phone || "").replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <RangeTabs range={range} setRange={setRange} />
        <div style={{ display: "flex", gap: 8 }}>
          {partners.length > 0 && <button onClick={shareToAll} style={styles.ghostBtn}><Share2 size={15} /> Share full report</button>}
          <button onClick={() => setDraft(emptyPartner())} style={styles.primaryBtn}><Plus size={16} /> Add partner</button>
        </div>
      </div>

      <div style={styles.statGrid}>
        <StatCard icon={IndianRupee} label="Sales" value={inr(sales)} accent="#C4F135" />
        <StatCard icon={TrendingUp} label="Gross profit" value={inr(grossProfit)} accent="#3D8BFD" />
        <StatCard icon={ArrowDownRight} label="Expenses" value={inr(expTotal)} accent="#FF6B6B" />
        <StatCard icon={ArrowUpRight} label="Net profit" value={inr(netProfit)} accent="#C4F135" />
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {partners.length === 0 ? <Empty text="No partners added yet." /> : partners.map(p => {
          const share = netProfit * (Number(p.sharePercent) || 0) / 100;
          return (
            <div key={p.id} style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div style={{ color: "#5A616F", fontSize: 11.5 }}>{p.sharePercent}% share {p.phone ? "· " + p.phone : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#C4F135" }}>{inr(share)}</div>
                <button onClick={() => shareToPartner(p)} style={styles.iconBtn}><Share2 size={14} /></button>
                <button onClick={() => remove(p.id)} style={styles.iconBtn}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {draft && (
        <Modal title="Add partner" onClose={() => setDraft(null)}>
          <div style={styles.formGrid}>
            <Field label="Partner name *" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} placeholder="Partner name" />
            <Field label="WhatsApp number" value={draft.phone} onChange={v => setDraft(d => ({ ...d, phone: v }))} placeholder="91 98765 43210" />
            <Field label="Profit share %" value={draft.sharePercent} onChange={v => setDraft(d => ({ ...d, sharePercent: v.replace(/[^0-9.]/g, "") }))} placeholder="e.g. 25" />
          </div>
          <button onClick={save} disabled={!draft.name || !draft.sharePercent} style={{ ...styles.primaryBtn, width: "100%", marginTop: 16, opacity: (!draft.name || !draft.sharePercent) ? 0.4 : 1 }}>
            <Check size={16} /> Save partner
          </button>
        </Modal>
      )}
    </div>
  );
}

/* =================================================================
   SETTINGS
================================================================= */
function SettingsTab({ business, setBusiness }) {
  const [f, setF] = useState(business);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logo", reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Business details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
          <LogoPicker logo={f.logo} onChange={handleLogo} />
          <Field label="Business name" value={f.name} onChange={v => set("name", v)} />
          <Field label="Tagline" value={f.tagline} onChange={v => set("tagline", v)} />
          <Field label="Address" value={f.address} onChange={v => set("address", v)} textarea />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Phone" value={f.phone} onChange={v => set("phone", v)} />
            <Field label="WhatsApp" value={f.whatsapp} onChange={v => set("whatsapp", v)} />
          </div>
          <Field label="Email" value={f.email} onChange={v => set("email", v)} />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="GSTIN" value={f.gstin} onChange={v => set("gstin", v.toUpperCase())} />
            <Field label="GST rate %" value={f.gstRate} onChange={v => set("gstRate", v.replace(/[^0-9.]/g, ""))} />
          </div>
        </div>
        <button onClick={() => setBusiness(f)} style={{ ...styles.primaryBtn, width: "100%", marginTop: 18 }}>
          <Check size={16} /> Save changes
        </button>
      </div>
    </div>
  );
}

/* =================================================================
   SHARED UI
================================================================= */
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "flex-end",
      justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#171B23", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: wide ? 560 : 460,
        maxHeight: "88vh", overflowY: "auto", padding: 22, border: "1px solid #232833", borderBottom: "none"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ background: "#1E2430", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color="#8B93A1" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const styles = {
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
  th: { padding: "8px 10px", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 },
  td: { padding: "9px 10px" },
};
