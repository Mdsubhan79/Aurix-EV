import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Plus, Trash2, Edit2, Search, Eye, Download, Share2, ArrowLeft,
  Printer, X, Check, Bike, Wrench, Package, RefreshCw
} from "lucide-react";

/* =========================================================================
   API CLIENT — mirrors the instance created in App.jsx so Billing.jsx
   can be dropped in as its own module without extra wiring.
========================================================================= */
const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("voltline_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
/* =========================================================================
   HELPERS
========================================================================= */
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const money = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const todayISO = () => new Date().toISOString().slice(0, 10);

const BILL_TYPES = [
  { id: "sale", label: "Scooter Sale", icon: Bike },
  { id: "service", label: "Service", icon: Wrench },
  { id: "repair", label: "Repair", icon: Wrench },
  { id: "part", label: "Spare Part", icon: Package },
];

// Item + bill shape here matches exactly what Sales.jsx / Dashboard / Partners
// tabs in App.jsx already expect: items[].{name,chassisNo,motorNo,actualPrice,
// sellingPrice,qty}, and bill.{customerName,customerPhone,location,type,date,
// subtotal,gstAmount,total,paymentMode}.
const emptyItem = (type = "sale") => ({
  type, name: "", chassisNo: "", motorNo: "", actualPrice: "", sellingPrice: "", qty: 1,
});

const emptyDraft = (business) => ({
  date: todayISO(),
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  location: "",
  type: "sale",
  items: [emptyItem("sale")],
  gstRate: business?.gstRate ?? 18,
  discount: 0,
  paymentMode: "Cash",
  notes: "",
});

const calcTotals = (items, gstRate, discount) => {
  const subtotal = items.reduce((s, it) => s + Number(it.sellingPrice || 0) * Number(it.qty || 1), 0);
  const cost = items.reduce((s, it) => s + Number(it.actualPrice || 0) * Number(it.qty || 1), 0);
  const taxable = Math.max(0, subtotal - Number(discount || 0));
  const gstAmount = gstRate > 0 ? +(taxable * (Number(gstRate) / 100)).toFixed(2) : 0;
  const total = +(taxable + gstAmount).toFixed(2);
  const profit = +(taxable - cost).toFixed(2);
  return { subtotal, cost, gstAmount, total, profit };
};

/* =========================================================================
   MAIN COMPONENT
========================================================================= */
export default function Billing({ business }) {
  const [view, setView] = useState("list"); // list | form | detail
  const [bills, setBills] = useState([]);
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [activeBill, setActiveBill] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const previewRef = useRef(null);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const loadBills = useCallback(() => {
    setLoading(true);
    api
      .get("/bills")
      .then((res) => setBills(Array.isArray(res.data) ? res.data : res.data.bills || []))
      .catch(() => notify("Failed to load bills", "error"))
      .finally(() => setLoading(false));
  }, []);

  const loadScooters = useCallback(() => {
    api.get("/scooters").then((res) => setScooters(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadBills();
    loadScooters();
  }, [loadBills, loadScooters]);

  /* ---------------- navigation helpers ---------------- */
  const goNew = () => {
    setDraft(emptyDraft(business));
    setEditingId(null);
    setView("form");
  };

  const goEdit = (bill) => {
    setDraft({
      date: bill.date ? bill.date.slice(0, 10) : todayISO(),
      customerName: bill.customerName || "",
      customerPhone: bill.customerPhone || "",
      customerAddress: bill.customerAddress || "",
      location: bill.location || "",
      type: bill.type || "sale",
      items: (bill.items || []).length ? bill.items.map((it) => ({ ...it })) : [emptyItem("sale")],
      gstRate: bill.gstRate ?? business?.gstRate ?? 18,
      discount: bill.discount || 0,
      paymentMode: bill.paymentMode || "Cash",
      notes: bill.notes || "",
    });
    setEditingId(bill._id);
    setView("form");
  };

  const goDetail = (bill) => {
    setActiveBill(bill);
    setView("detail");
  };

  const backToList = () => {
    setView("list");
    setDraft(null);
    setEditingId(null);
    setActiveBill(null);
  };

  /* ---------------- draft editing ---------------- */
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const setItemField = (idx, k, v) => {
    setDraft((d) => {
      const items = [...d.items];
      const it = { ...items[idx] };
      it[k] = v;
      items[idx] = it;
      return { ...d, items };
    });
  };

  const pickScooter = (idx, scooterId) => {
    const s = scooters.find((sc) => sc._id === scooterId);
    if (!s) return;
    setDraft((d) => {
      const items = [...d.items];
      items[idx] = {
        ...items[idx],
        name: s.name,
        chassisNo: s.chassisNo,
        motorNo: s.motorNo,
        actualPrice: s.actualPrice,
        sellingPrice: s.sellingPrice,
      };
      return { ...d, items };
    });
  };

  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, emptyItem(d.type)] }));
  const removeItem = (idx) => {
    setDraft((d) => {
      if (d.items.length === 1) return d;
      return { ...d, items: d.items.filter((_, i) => i !== idx) };
    });
  };

  const totals = draft ? calcTotals(draft.items, Number(draft.gstRate || 0), Number(draft.discount || 0)) : null;

  const canSave =
    draft &&
    draft.customerName.trim() &&
    draft.customerPhone.trim() &&
    draft.items.every((it) => it.name && it.sellingPrice !== "" && it.sellingPrice !== null);

  const saveBill = async () => {
    if (!canSave) {
      notify("Fill customer name, phone and item details", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: draft.date,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        customerAddress: draft.customerAddress,
        location: draft.location,
        type: draft.type,
        items: draft.items.map((it) => ({
          ...it,
          qty: Number(it.qty) || 1,
          actualPrice: Number(it.actualPrice) || 0,
          sellingPrice: Number(it.sellingPrice) || 0,
        })),
        gstRate: Number(draft.gstRate) || 0,
        discount: Number(draft.discount) || 0,
        paymentMode: draft.paymentMode,
        notes: draft.notes,
        subtotal: totals.subtotal,
        gstAmount: totals.gstAmount,
        total: totals.total,
      };

      let saved;
      if (editingId) {
        saved = (await api.put(`/bills/${editingId}`, payload)).data;
        notify("Bill updated");
      } else {
        saved = (await api.post("/bills", payload)).data;
        notify("Bill created");
      }
      await loadBills();
      goDetail(saved);
    } catch (err) {
      notify(err.response?.data?.message || "Failed to save bill", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteBill = async (id) => {
    if (!window.confirm("Permanently delete this bill?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/bills/${id}`);
      notify("Bill deleted");
      if (activeBill?._id === id) backToList();
      await loadBills();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to delete bill", "error");
    } finally {
      setDeletingId(null);
    }
  };

  /* ---------------- share / export ---------------- */
  const shareWhatsApp = (bill) => {
    let text = `*${business?.name || "Invoice"}*\n`;
    if (business?.address) text += `${business.address}\n`;
    if (business?.phone) text += `Ph: ${business.phone}\n`;
    if (business?.gstin) text += `GSTIN: ${business.gstin}\n`;

    text += `\n🧾 *INVOICE*\n`;
    text += `Bill No: ${bill._id?.slice(-8).toUpperCase() || ""}\n`;
    text += `Date: ${fmtDate(bill.date)}\n\n`;

    text += `*Customer*\nName: ${bill.customerName}\nPhone: ${bill.customerPhone}\n`;
    if (bill.customerAddress) text += `Address: ${bill.customerAddress}\n`;

    text += `\n*Items*\n`;
    (bill.items || []).forEach((it, i) => {
      text += `\n${i + 1}. ${it.name} (x${it.qty})\n`;
      if (it.chassisNo) text += `Chassis: ${it.chassisNo}\n`;
      if (it.motorNo) text += `Motor: ${it.motorNo}\n`;
      text += `Amount: ${inr(it.sellingPrice * it.qty)}\n`;
    });

    text += `\nSubtotal: ${inr(bill.subtotal)}\n`;
    text += `GST (${bill.gstRate ?? business?.gstRate ?? 0}%): ${inr(bill.gstAmount)}\n`;
    if (bill.discount) text += `Discount: ${inr(bill.discount)}\n`;
    text += `*TOTAL: ${inr(bill.total)}*\n\nThank you for your business! 🙏`;

    const phone = (bill.customerPhone || "").replace(/\D/g, "");
    window.open(
      phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  const downloadPDF = async (bill) => {
    const node = previewRef.current;
    if (!node) return;
    notify("Generating PDF…");
    const clone = node.cloneNode(true);
    Object.assign(clone.style, {
      width: "794px", maxWidth: "794px", position: "fixed", left: "0", top: "0",
      zIndex: "-9999", background: "#171B23",
    });
    document.body.appendChild(clone);
    await new Promise((r) => setTimeout(r, 250));
    try {
      const canvas = await html2canvas(clone, { scale: 2.5, useCORS: true, backgroundColor: "#171B23" });
      clone.remove();
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      const img = canvas.toDataURL("image/png", 1);
      if (height <= 297) pdf.addImage(img, "PNG", 0, 0, width, height);
      else pdf.addImage(img, "PNG", 0, 0, width, 297);
      const name = (bill.customerName || "customer").replace(/[^a-zA-Z0-9]/g, "_");
      pdf.save(`Invoice_${name}_${bill._id?.slice(-6) || ""}.pdf`);
      notify("PDF downloaded");
    } catch {
      clone.remove();
      notify("Failed to generate PDF", "error");
    }
  };

  /* ---------------- filtered list ---------------- */
  const filtered = bills.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || (b.customerName || "").toLowerCase().includes(q) || (b.customerPhone || "").includes(q) || (b.location || "").toLowerCase().includes(q);
    const matchDate = !filterDate || (b.date && new Date(b.date).toDateString() === new Date(filterDate).toDateString());
    return matchSearch && matchDate;
  });

  /* ========================================================= RENDER ===== */
  return (
    <div>
      {toast && (
        <div style={{ ...S.toast, background: toast.type === "error" ? "#3A1F22" : "#1C2A1E", color: toast.type === "error" ? "#FF6B6B" : "#C4F135", border: `1px solid ${toast.type === "error" ? "#5A2A2E" : "#2E4A24"}` }}>
          {toast.msg}
        </div>
      )}

      {view === "list" && (
        <BillList
          bills={filtered}
          loading={loading}
          search={search}
          setSearch={setSearch}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          onNew={goNew}
          onRefresh={loadBills}
          onView={goDetail}
          onEdit={goEdit}
          onDelete={deleteBill}
          deletingId={deletingId}
        />
      )}

      {view === "form" && draft && (
        <BillForm
          draft={draft}
          editingId={editingId}
          scooters={scooters}
          totals={totals}
          setField={setField}
          setItemField={setItemField}
          pickScooter={pickScooter}
          addItem={addItem}
          removeItem={removeItem}
          onCancel={backToList}
          onSave={saveBill}
          saving={saving}
          canSave={canSave}
        />
      )}

      {view === "detail" && activeBill && (
        <BillDetail
          bill={activeBill}
          business={business}
          previewRef={previewRef}
          onBack={backToList}
          onEdit={() => goEdit(activeBill)}
          onShare={() => shareWhatsApp(activeBill)}
          onPDF={() => downloadPDF(activeBill)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   LIST VIEW
========================================================================= */
function BillList({ bills, loading, search, setSearch, filterDate, setFilterDate, onNew, onRefresh, onView, onEdit, onDelete, deletingId }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.cardTitle}>All bills</div>
          <span style={S.badge}>{bills.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onRefresh} style={S.ghostBtn}><RefreshCw size={14} /> Refresh</button>
          <button onClick={onNew} style={S.primaryBtn}><Plus size={16} /> New bill</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ ...S.searchBox, flex: 1, minWidth: 200 }}>
          <Search size={15} color="#5A616F" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone, location…" style={S.searchInput} />
        </div>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...S.input, width: 170 }} />
      </div>

      <div style={{ ...S.card, overflowX: "auto" }}>
        {loading ? (
          <Empty text="Loading bills…" />
        ) : bills.length === 0 ? (
          <Empty text="No bills found." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
            <thead>
              <tr style={{ color: "#8B93A1", textAlign: "left" }}>
                <th style={S.th}>Date</th>
                <th style={S.th}>Customer</th>
                <th style={S.th}>Location</th>
                <th style={S.th}>Type</th>
                <th style={{ ...S.th, textAlign: "right" }}>Total</th>
                <th style={{ ...S.th, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b._id} style={{ borderTop: "1px solid #232833" }}>
                  <td style={S.td}>{fmtDate(b.date)}</td>
                  <td style={S.td}>{b.customerName || "Walk-in"}</td>
                  <td style={S.td}>{b.location || "—"}</td>
                  <td style={{ ...S.td, textTransform: "capitalize" }}>{b.type}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#C4F135" }}>{inr(b.total)}</td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button onClick={() => onView(b)} style={S.iconBtn}><Eye size={14} /></button>
                      <button onClick={() => onEdit(b)} style={S.iconBtn}><Edit2 size={14} /></button>
                      <button disabled={deletingId === b._id} onClick={() => onDelete(b._id)} style={{ ...S.iconBtn, color: "#FF6B6B" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
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

/* =========================================================================
   CREATE / EDIT FORM
========================================================================= */
function BillForm({ draft, editingId, scooters, totals, setField, setItemField, pickScooter, addItem, removeItem, onCancel, onSave, saving, canSave }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button onClick={onCancel} style={S.iconBtn}><ArrowLeft size={16} /></button>
        <div style={S.cardTitle}>{editingId ? "Edit bill" : "Create bill"}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 12 }}>Customer details</div>
          <div style={S.formGrid}>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Customer name *" value={draft.customerName} onChange={(v) => setField("customerName", v)} placeholder="Full name" />
              <Field label="Phone *" value={draft.customerPhone} onChange={(v) => setField("customerPhone", v)} placeholder="98765 43210" />
            </div>
            <Field label="Address" value={draft.customerAddress} onChange={(v) => setField("customerAddress", v)} placeholder="Optional" textarea />
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Location / branch" value={draft.location} onChange={(v) => setField("location", v)} placeholder="e.g. Main Showroom" />
              <Field label="Date" type="date" value={draft.date} onChange={(v) => setField("date", v)} />
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 12 }}>Bill type</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BILL_TYPES.map((t) => {
              const Icon = t.icon;
              const active = draft.type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setField("type", t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20,
                    border: "1px solid " + (active ? "#C4F135" : "#2A2F3A"),
                    background: active ? "rgba(196,241,53,0.1)" : "transparent",
                    color: active ? "#C4F135" : "#8B93A1", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={S.cardTitle}>Items</div>
            <button onClick={addItem} style={S.ghostBtnSm}><Plus size={13} /> Add item</button>
          </div>

          {draft.items.map((it, idx) => (
            <div key={idx} style={{ border: "1px solid #232833", borderRadius: 12, padding: 14, marginBottom: 12, background: "#12151A" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <b style={{ fontSize: 12.5, color: "#8B93A1" }}>Item {idx + 1}</b>
                {draft.items.length > 1 && (
                  <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer" }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {draft.type === "sale" && scooters.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={S.fieldLabel}>Pick from catalogue (auto-fills details)</label>
                  <select onChange={(e) => e.target.value && pickScooter(idx, e.target.value)} defaultValue="" style={S.input}>
                    <option value="">— Select scooter —</option>
                    {scooters.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} · {s.chassisNo || "no chassis"}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={S.formGrid}>
                <Field label="Item name *" value={it.name} onChange={(v) => setItemField(idx, "name", v)} placeholder="e.g. Volt Ryder X1 / Brake service" />
                {draft.type === "sale" && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <Field label="Chassis no." value={it.chassisNo} onChange={(v) => setItemField(idx, "chassisNo", v)} placeholder="CH-000123" />
                    <Field label="Motor no." value={it.motorNo} onChange={(v) => setItemField(idx, "motorNo", v)} placeholder="MT-000456" />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <Field label="Actual (cost) price" value={String(it.actualPrice)} onChange={(v) => setItemField(idx, "actualPrice", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
                  <Field label="Selling price *" value={String(it.sellingPrice)} onChange={(v) => setItemField(idx, "sellingPrice", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
                  <Field label="Qty" value={String(it.qty)} onChange={(v) => setItemField(idx, "qty", v.replace(/[^0-9]/g, "") || "1")} placeholder="1" />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 10, fontSize: 12, color: "#8B93A1" }}>
                <span>Line total: <b style={{ color: "#C4F135" }}>{inr(Number(it.sellingPrice || 0) * Number(it.qty || 1))}</b></span>
              </div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 12 }}>Payment</div>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="GST rate %" value={String(draft.gstRate)} onChange={(v) => setField("gstRate", v.replace(/[^0-9.]/g, ""))} placeholder="18" />
            <Field label="Discount" value={String(draft.discount)} onChange={(v) => setField("discount", v.replace(/[^0-9.]/g, ""))} placeholder="0" />
          </div>
          <label style={S.fieldLabel}>Payment mode</label>
          <select value={draft.paymentMode} onChange={(e) => setField("paymentMode", e.target.value)} style={S.input}>
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Finance</option>
            <option>Bank Transfer</option>
          </select>
          <div style={{ marginTop: 12 }}>
            <Field label="Notes / warranty terms" value={draft.notes} onChange={(v) => setField("notes", v)} textarea placeholder="e.g. Motor & battery: 12 months warranty" />
          </div>
        </div>

        <div style={{ ...S.card, textAlign: "right" }}>
          <div style={S.cardTitle}>Bill summary</div>
          <div style={{ color: "#8B93A1", fontSize: 13, marginTop: 8 }}>Subtotal: <b style={{ color: "#F2F3F0" }}>{inr(totals.subtotal)}</b></div>
          <div style={{ color: "#8B93A1", fontSize: 13 }}>GST ({draft.gstRate}%): <b style={{ color: "#F2F3F0" }}>{inr(totals.gstAmount)}</b></div>
          {Number(draft.discount) > 0 && <div style={{ color: "#8B93A1", fontSize: 13 }}>Discount: <b style={{ color: "#FF6B6B" }}>-{inr(draft.discount)}</b></div>}
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 22, marginTop: 6, color: "#C4F135" }}>{inr(totals.total)}</div>
        </div>

        <button onClick={onSave} disabled={saving || !canSave} style={{ ...S.primaryBtn, width: "100%", padding: "13px 18px", opacity: saving || !canSave ? 0.5 : 1 }}>
          <Check size={16} /> {saving ? (editingId ? "Updating…" : "Creating…") : editingId ? "Update bill" : "Create bill"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   DETAIL VIEW
========================================================================= */
function BillDetail({ bill, business, previewRef, onBack, onEdit, onShare, onPDF }) {
  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <button onClick={onBack} style={S.ghostBtn}><ArrowLeft size={15} /> Back</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onEdit} style={S.ghostBtn}><Edit2 size={14} /> Edit</button>
          <button onClick={onShare} style={{ ...S.primaryBtn, background: "#25D366", color: "#0B1A0F" }}><Share2 size={15} /> WhatsApp</button>
          <button onClick={onPDF} style={S.ghostBtn}><Download size={14} /> PDF</button>
          <button onClick={() => window.print()} style={S.ghostBtn}><Printer size={14} /> Print</button>
        </div>
      </div>

      <div ref={previewRef} style={{ ...S.card, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #232833", paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {business?.logoUrl && <img src={business.logoUrl} crossOrigin="anonymous" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "1px solid #232833" }} />}
            <div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19 }}>{business?.name || "Business"}</div>
              <div style={{ color: "#8B93A1", fontSize: 12 }}>{business?.tagline || ""}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#8B93A1" }}>
            <div>Bill: <b style={{ color: "#F2F3F0" }}>{bill._id?.slice(-8).toUpperCase()}</b></div>
            <div>Date: <b style={{ color: "#F2F3F0" }}>{fmtDate(bill.date)}</b></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1px solid #232833", borderRadius: 10, padding: 12, fontSize: 12.5 }}>
            <b style={{ display: "block", marginBottom: 6, color: "#8B93A1" }}>Business</b>
            <div>{business?.address || "—"}</div>
            <div>{business?.phone || "—"}</div>
            {business?.gstin && <div>GSTIN: {business.gstin}</div>}
          </div>
          <div style={{ border: "1px solid #232833", borderRadius: 10, padding: 12, fontSize: 12.5 }}>
            <b style={{ display: "block", marginBottom: 6, color: "#8B93A1" }}>Customer</b>
            <div>{bill.customerName}</div>
            <div>{bill.customerPhone}</div>
            {bill.customerAddress && <div>{bill.customerAddress}</div>}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: "#1E2430" }}>
              <th style={S.thLight}>Item</th>
              <th style={S.thLight}>Details</th>
              <th style={{ ...S.thLight, textAlign: "right" }}>Qty</th>
              <th style={{ ...S.thLight, textAlign: "right" }}>Price</th>
              <th style={{ ...S.thLight, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(bill.items || []).map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #232833" }}>
                <td style={S.td}><b>{it.name}</b></td>
                <td style={S.td}>
                  {it.chassisNo && <div>Chassis: {it.chassisNo}</div>}
                  {it.motorNo && <div>Motor: {it.motorNo}</div>}
                </td>
                <td style={{ ...S.td, textAlign: "right" }}>{it.qty}</td>
                <td style={{ ...S.td, textAlign: "right" }}>{money(it.sellingPrice)}</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{inr(it.sellingPrice * it.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 240, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Subtotal</span><span>{inr(bill.subtotal)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>GST ({bill.gstRate ?? business?.gstRate ?? 0}%)</span><span>{inr(bill.gstAmount)}</span></div>
            {bill.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#FF6B6B" }}><span>Discount</span><span>-{inr(bill.discount)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #232833", marginTop: 6, paddingTop: 8, fontWeight: 700, fontSize: 16, color: "#C4F135" }}>
              <span>TOTAL</span><span>{inr(bill.total)}</span>
            </div>
          </div>
        </div>

        {bill.notes && (
          <div style={{ border: "1px solid #232833", borderRadius: 10, padding: 12, marginTop: 16, fontSize: 12, color: "#8B93A1", whiteSpace: "pre-line" }}>
            {bill.notes}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, color: "#5A616F", fontSize: 11 }}>Thank you for your business!</div>
      </div>
    </div>
  );
}

/* =========================================================================
   SHARED UI PRIMITIVES (local copies, matching App.jsx's design tokens)
========================================================================= */
function Field({ label, value, onChange, placeholder, textarea, type = "text" }) {
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

function Empty({ text }) {
  return <div style={{ color: "#5A616F", fontSize: 13, padding: "18px 4px", textAlign: "center" }}>{text}</div>;
}

const S = {
  card: { background: "#171B23", border: "1px solid #232833", borderRadius: 14, padding: 18 },
  cardTitle: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14.5 },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#C4F135", color: "#12151A", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" },
  ghostBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#1B1F27", color: "#F2F3F0", border: "1px solid #2A2F3A", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  ghostBtnSm: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#1E2430", color: "#8B93A1", border: "none", borderRadius: 8, padding: "7px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer" },
  iconBtn: { background: "#1E2430", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8B93A1" },
  input: { background: "#12151A", border: "1px solid #2A2F3A", borderRadius: 9, padding: "10px 12px", color: "#F2F3F0", fontSize: 13.5, fontFamily: "'Inter',sans-serif", outline: "none", width: "100%", boxSizing: "border-box" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, background: "#171B23", border: "1px solid #232833", borderRadius: 10, padding: "9px 12px" },
  searchInput: { background: "transparent", border: "none", outline: "none", color: "#F2F3F0", fontSize: 13.5, width: "100%" },
  formGrid: { display: "flex", flexDirection: "column", gap: 12 },
  fieldLabel: { fontSize: 12, color: "#8B93A1", fontWeight: 500, display: "block", marginBottom: 6 },
  field: { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  th: { padding: "8px 10px", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 },
  thLight: { padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "left", color: "#8B93A1" },
  td: { padding: "9px 10px" },
  badge: { background: "rgba(196,241,53,0.12)", color: "#C4F135", padding: "3px 9px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  toast: { position: "fixed", top: 16, right: 16, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 200 },
};
