import React, { useEffect, useMemo, useState, useCallback } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  api,
  socket,
  S,
  Field,
  Modal,
  Empty,
  inr,
  fmtDate,
  todayISO
} from "./App";
import {
  Plus, Trash2, RefreshCw, ArrowLeft, Eye, Pencil, Download,
  MessageCircle, Printer, Calculator, Search, X, Check
} from "lucide-react";
import { api, socket, S, Field, Modal, Empty, inr, fmtDate, todayISO } from "./App";



const VEHICLE_SPEC_FIELDS = [
  ["model", "Model"],
  ["color", "Color"],
  ["batteryType", "Battery"],
  ["motorPower", "Motor Power"],
  ["range", "Range"],
  ["topSpeed", "Top Speed"],
  ["chargingTime", "Charging Time"],
  ["controller", "Controller"],
  ["wheelSize", "Wheel Size"],
];

function emptyItem() {
  return {
    scooter: null, name: "", description: "", chassisNo: "", motorNo: "",
    model: "", color: "", batteryType: "", motorPower: "", range: "",
    topSpeed: "", chargingTime: "", controller: "", wheelSize: "",
    actualPrice: 0, sellingPrice: 0, qty: 1,
  };
}

function emptyDraft(business) {
  return {
    date: todayISO(),
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerAadhar: "",
    location: "",
    type: "sale",
    serviceDesc: "",
    items: [],
    gstRate: business?.gstRate ?? 18,
    paymentMode: "Cash",
  };
}

// GST-inclusive: sellingPrice already includes GST.
function computeTotals(items, gstRate) {
  const grandTotal = items.reduce((s, it) => s + Number(it.sellingPrice || 0) * Number(it.qty || 1), 0);
  const rate = Number(gstRate) || 0;
  const gstAmount = rate > 0 ? +((grandTotal * rate) / (100 + rate)).toFixed(2) : 0;
  const subtotal = +(grandTotal - gstAmount).toFixed(2);
  const total = +grandTotal.toFixed(2);
  return { subtotal, gstAmount, total };
}


function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, kind = "success") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);
  const node = toast ? (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: toast.kind === "error" ? "#3A1414" : "#16231A",
      border: `1px solid ${toast.kind === "error" ? "#FF6B6B" : "#8FAE2A"}`,
      color: toast.kind === "error" ? "#FF6B6B" : "#C4F135",
      padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      zIndex: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", maxWidth: "90vw", textAlign: "center"
    }}>{toast.message}</div>
  ) : null;
  return [node, show];
}

function usePrintStyles() {
  useEffect(() => {
    if (document.getElementById("bill-print-css")) return;
    const style = document.createElement("style");
    style.id = "bill-print-css";
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #bill-preview, #bill-preview * { visibility: visible; }
        #bill-preview { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}
export default function Billing({ business, exportCompleteReport }) {
  usePrintStyles();
  const [toastNode, showToast] = useToast();

  const [mode, setMode] = useState("list"); // list | create | edit | view
  const [bills, setBills] = useState([]);
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [draft, setDraft] = useState(emptyDraft(business));
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadBills = useCallback(() => api.get("/bills").then((res) => setBills(res.data)), []);
  const loadScooters = useCallback(() => api.get("/scooters").then((res) => setScooters(res.data)), []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBills(), loadScooters()]).finally(() => setLoading(false));
  }, [loadBills, loadScooters]);

  useEffect(() => {
    const refresh = () => loadBills();
    socket.on("bill:created", refresh);
    socket.on("bill:updated", refresh);
    socket.on("bill:deleted", refresh);
    return () => {
      socket.off("bill:created", refresh);
      socket.off("bill:updated", refresh);
      socket.off("bill:deleted", refresh);
    };
  }, [loadBills]);

  const totals = useMemo(() => computeTotals(draft.items, draft.gstRate), [draft.items, draft.gstRate]);

  /* ----------------------------- actions ----------------------------- */
  const openCreate = () => { setDraft(emptyDraft(business)); setEditingId(null); setMode("create"); };

  const openEdit = (bill) => {
    setDraft({
      date: (bill.date || "").slice(0, 10) || todayISO(),
      customerName: bill.customerName || "",
      customerPhone: bill.customerPhone || "",
      customerAddress: bill.customerAddress || "",
      customerAadhar: bill.customerAadhar || "",
      location: bill.location || "",
      type: bill.type || "sale",
      serviceDesc: bill.serviceDesc || "",
      items: (bill.items || []).map((it) => ({ ...emptyItem(), ...it })),
      gstRate: bill.gstRate ?? business?.gstRate ?? 18,
      paymentMode: bill.paymentMode || "Cash",
    });
    setEditingId(bill._id);
    setMode("edit");
  };

  const openView = (bill) => { setViewing(bill); setMode("view"); };
  const backToList = () => { setMode("list"); setViewing(null); loadBills(); };

  const addItem = (scooterId) => {
    const sc = scooters.find((s) => s._id === scooterId);
    if (!sc) return;
    setDraft((d) => ({
      ...d,
      items: [...d.items, {
        ...emptyItem(),
        scooter: sc._id, name: sc.name, chassisNo: sc.chassisNo, motorNo: sc.motorNo,
        batteryType: sc.batteryInfo || "", warranty: sc.warranty || "",
        actualPrice: Number(sc.actualPrice) || 0, sellingPrice: Number(sc.sellingPrice) || 0, qty: 1,
      }],
    }));
  };
  const removeItem = (idx) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => setDraft((d) => ({
    ...d,
    items: d.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
  }));

  const addServiceCharge = () => setDraft((d) => ({
    ...d,
    items: [...d.items, { ...emptyItem(), name: d.type === "repair" ? "Repair charge" : "Service charge", actualPrice: 0, sellingPrice: 0, qty: 1 }],
  }));

  const buildPayload = () => ({
    date: draft.date,
    customerName: draft.customerName,
    customerPhone: draft.customerPhone,
    customerAddress: draft.customerAddress,
    customerAadhar: draft.customerAadhar,
    location: draft.location,
    type: draft.type,
    serviceDesc: draft.serviceDesc,
    items: draft.items,
    gstRate: Number(draft.gstRate) || 0,
    paymentMode: draft.paymentMode,
  });

  const saveBill = async (e) => {
    e.preventDefault();
    if (!draft.customerName || !draft.customerPhone) {
      showToast("Please fill customer name and phone number", "error");
      return;
    }
    if (draft.items.length === 0) {
      showToast("Add at least one item to the bill", "error");
      return;
    }
    if (draft.items.some((it) => !it.name || !it.sellingPrice)) {
      showToast("Every item needs a name and a price", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      let res;
      if (mode === "edit" && editingId) {
        res = await api.put(`/bills/${editingId}`, payload);
        showToast("Bill updated");
      } else {
        res = await api.post("/bills", payload);
        showToast("Bill created");
      }
      setViewing(res.data);
      setMode("view");
      loadBills();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save bill", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteBill = async (id) => {
    if (!window.confirm("Permanently delete this bill?")) return;
    setDeleting(id);
    try {
      await api.delete(`/bills/${id}`);
      showToast("Bill deleted");
      loadBills();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete bill", "error");
    } finally {
      setDeleting(null);
    }
  };

  const shareWhatsApp = (bill) => {
    let text = `*${business?.name || "Invoice"}*\n${business?.address || ""}\nPh: ${business?.phone || ""}\n`;
    if (business?.gstin) text += `GSTIN: ${business.gstin}\n`;
    text += `\n🧾 *INVOICE* ${bill.invoiceNumber || ""}\nDate: ${fmtDate(bill.date)}\n\n`;
    text += `*Customer*\nName: ${bill.customerName || "Walk-in"}\nPhone: ${bill.customerPhone || "N/A"}\n`;
    if (bill.customerAadhar) text += `Aadhar: ${bill.customerAadhar}\n`;
    if (bill.customerAddress) text += `Address: ${bill.customerAddress}\n`;
    text += `\n*Items*\n`;
    (bill.items || []).forEach((it, i) => {
      text += `\n${i + 1}. *${it.name}*\nQty: ${it.qty}\nPrice: ${inr(it.sellingPrice)} (GST incl.)\nAmount: ${inr(it.sellingPrice * it.qty)}\n`;
      if (it.model) text += `Model: ${it.model}\n`;
      if (it.color) text += `Color: ${it.color}\n`;
      if (it.chassisNo) text += `Chassis No: ${it.chassisNo}\n`;
      if (it.motorNo) text += `Motor No: ${it.motorNo}\n`;
    });
    text += `\n*Payment:* ${(bill.paymentMode || "Cash").toUpperCase()}\n`;
    text += `Subtotal: ${inr(bill.subtotal)}\nGST (${bill.gstRate}%): ${inr(bill.gstAmount)}\n*TOTAL: ${inr(bill.total)}*\n`;
    if (bill.serviceDesc) text += `\n*Notes*\n${bill.serviceDesc}\n`;
    text += `\nThank you for your business! 🙏`;

    const phone = (bill.customerPhone || "").replace(/\D/g, "");
    window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const downloadPDF = async (bill) => {
    const input = document.getElementById("bill-preview");
    if (!input) return showToast("Invoice element not found", "error");
    showToast("Generating PDF…");
    try {
      const clone = input.cloneNode(true);
      Object.assign(clone.style, {
        width: "794px", maxWidth: "794px", minHeight: "1123px",
        position: "fixed", left: "0", top: "0", zIndex: "-9999",
        background: "#fff", boxShadow: "none",
      });
      document.body.appendChild(clone);
      await new Promise((r) => setTimeout(r, 250));

      const canvas = await html2canvas(clone, {
        scale: 3, useCORS: true, backgroundColor: "#fff",
        width: clone.offsetWidth, height: clone.offsetHeight,
        windowWidth: clone.offsetWidth, windowHeight: clone.offsetHeight,
      });
      clone.remove();

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      const image = canvas.toDataURL("image/png", 1);

      if (height <= 297) {
        pdf.addImage(image, "PNG", 0, 0, width, height);
      } else {
        const scale = 297 / height;
        pdf.addImage(image, "PNG", (210 - width * scale) / 2, 0, width * scale, 297);
      }

      const name = (bill.customerName || "Customer").replace(/[^a-zA-Z0-9]/g, "_");
      pdf.save(`Invoice_${name}_${(bill.invoiceNumber || "bill").replace(/\//g, "-")}.pdf`);
      showToast("PDF downloaded");
    } catch (err) {
      console.error(err);
      showToast("Failed to download PDF", "error");
    }
  };

  /* ============================= LIST ============================= */
  if (mode === "list") {
    const filtered = bills.filter((b) => {
      const q = search.toLowerCase();
      const matchSearch = (b.customerName || "").toLowerCase().includes(q) || (b.invoiceNumber || "").toLowerCase().includes(q);
      const matchDate = !filterDate || new Date(b.date).toDateString() === new Date(filterDate).toDateString();
      return matchSearch && matchDate;
    });

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <span style={{ background: "rgba(196,241,53,0.12)", color: "#C4F135", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            {bills.length} total
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

  <button
    onClick={() => exportCompleteReport("month", business)}
    style={S.ghostBtn}
  >
    <Download size={15} />
    Export Excel
  </button>

  <button
    onClick={openCreate}
    style={S.primaryBtn}
  >
    <Plus size={16} />
    New bill
  </button>

  <button
    onClick={() => {
      setLoading(true);
      loadBills().finally(() => setLoading(false));
    }}
    style={S.ghostBtn}
  >
    <RefreshCw size={15} />
    Refresh
  </button>

</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ ...S.searchBox, flex: 1, minWidth: 180 }}>
            <Search size={15} color="#5A616F" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or invoice no." style={S.searchInput} />
          </div>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...S.input, width: 170 }} />
        </div>

        {loading ? <Empty text="Loading bills…" /> : filtered.length === 0 ? <Empty text="No bills found." /> : (
          <div style={{ ...S.card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ color: "#8B93A1", textAlign: "left" }}>
                  <th style={S.th}>Invoice</th><th style={S.th}>Customer</th><th style={S.th}>Type</th>
                  <th style={S.th}>Date</th><th style={{ ...S.th, textAlign: "right" }}>Total</th><th style={{ ...S.th, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b._id} style={{ borderTop: "1px solid #232833" }}>
                    <td style={{ ...S.td, fontFamily: "'JetBrains Mono',monospace" }}>{b.invoiceNumber || "—"}</td>
                    <td style={S.td}>{b.customerName || "Walk-in"}</td>
                    <td style={S.td}>{b.type}</td>
                    <td style={S.td}>{fmtDate(b.date)}</td>
                    <td style={{ ...S.td, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#C4F135", fontWeight: 700 }}>{inr(b.total)}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button onClick={() => openView(b)} style={S.iconBtn}><Eye size={14} /></button>
                        <button onClick={() => openEdit(b)} style={S.iconBtn}><Pencil size={14} /></button>
                        <button disabled={deleting === b._id} onClick={() => deleteBill(b._id)} style={{ ...S.iconBtn, color: "#FF6B6B", opacity: deleting === b._id ? 0.5 : 1 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {toastNode}
      </div>
    );
  }

  /* ========================= CREATE / EDIT ========================= */
  if (mode === "create" || mode === "edit") {
    return (
      <div style={{ maxWidth: 680 }}>
        <button onClick={() => setMode("list")} style={{ ...S.ghostBtn, marginBottom: 16 }}>
          <ArrowLeft size={15} /> Back
        </button>

        <form onSubmit={saveBill} style={S.card}>
          <div style={S.cardTitle}>👤 Customer details</div>
          <div style={{ ...S.formGrid, marginTop: 10, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Customer name *" value={draft.customerName} onChange={(v) => setDraft((d) => ({ ...d, customerName: v }))} placeholder="Customer name" />
              <Field label="Phone *" value={draft.customerPhone} onChange={(v) => setDraft((d) => ({ ...d, customerPhone: v }))} placeholder="98765 43210" />
            </div>
            <Field label="Address" value={draft.customerAddress} onChange={(v) => setDraft((d) => ({ ...d, customerAddress: v }))} placeholder="Customer address" />
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Aadhar number" value={draft.customerAadhar} onChange={(v) => setDraft((d) => ({ ...d, customerAadhar: v }))} placeholder="XXXX XXXX XXXX" />
              <Field label="Location / branch" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} placeholder="e.g. Main Showroom" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Date" type="date" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} />
              <div style={{ flex: 1 }}>
                <label style={S.fieldLabel}>Bill type</label>
                <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} style={S.input}>
                  <option value="sale">Sale</option><option value="service">Service</option><option value="repair">Repair</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={S.cardTitle}>📦 {draft.type === "sale" ? "Products" : draft.type === "repair" ? "Repair items" : "Service items"}</div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select onChange={(e) => { if (e.target.value) { addItem(e.target.value); e.target.value = ""; } }} style={{ ...S.input, flex: 1, minWidth: 200 }} defaultValue="">
              <option value="" disabled>Add scooter from catalogue…</option>
              {scooters.map((s) => <option key={s._id} value={s._id}>{s.name} — {inr(s.sellingPrice)}</option>)}
            </select>
            {draft.type !== "sale" && (
              <button type="button" onClick={addServiceCharge} style={S.ghostBtn}><Plus size={14} /> Add charge line</button>
            )}
          </div>

          {draft.items.map((it, idx) => (
            <div key={idx} style={{ background: "#12151A", border: "1px solid #232833", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>Item {idx + 1}</b>
                <button type="button" onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <div style={{ flex: 2, minWidth: 140 }}>
                  <input value={it.name} onChange={(e) => updateItem(idx, "name", e.target.value)} placeholder="Item name *" style={S.input} />
                </div>
                <div style={{ width: 70 }}>
                  <input type="number" min="1" value={it.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value) || 1)} placeholder="Qty" style={S.input} />
                </div>
                <div style={{ width: 130 }}>
                  <input type="number" value={it.sellingPrice} onChange={(e) => updateItem(idx, "sellingPrice", Number(e.target.value) || 0)} placeholder="Price (GST incl.) *" style={S.input} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <input value={it.chassisNo} onChange={(e) => updateItem(idx, "chassisNo", e.target.value)} placeholder="Chassis no." style={{ ...S.input, flex: 1, minWidth: 120 }} />
                <input value={it.motorNo} onChange={(e) => updateItem(idx, "motorNo", e.target.value)} placeholder="Motor no." style={{ ...S.input, flex: 1, minWidth: 120 }} />
              </div>
              {draft.type === "sale" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 6 }}>
                  {VEHICLE_SPEC_FIELDS.map(([field, label]) => (
                    <input key={field} value={it[field]} onChange={(e) => updateItem(idx, field, e.target.value)} placeholder={label} style={{ ...S.input, fontSize: 12, padding: "7px 9px" }} />
                  ))}
                </div>
              )}
              {draft.type !== "sale" && (
                <textarea value={draft.serviceDesc} onChange={(e) => setDraft((d) => ({ ...d, serviceDesc: e.target.value }))} placeholder="Describe the work done" rows={2} style={{ ...S.input, marginTop: 4 }} />
              )}
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 11, color: "#5A616F" }}>Cost price (internal, not shown on invoice)</label>
                <input type="number" value={it.actualPrice} onChange={(e) => updateItem(idx, "actualPrice", Number(e.target.value) || 0)} placeholder="0" style={{ ...S.input, marginTop: 4 }} />
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>Payment mode</label>
              <select value={draft.paymentMode} onChange={(e) => setDraft((d) => ({ ...d, paymentMode: e.target.value }))} style={S.input}>
                <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>EMI</option>
              </select>
            </div>
            <Field label="GST rate %" value={String(draft.gstRate)} onChange={(v) => setDraft((d) => ({ ...d, gstRate: v.replace(/[^0-9.]/g, "") }))} placeholder="18" />
          </div>

          <div style={{ marginTop: 18, borderTop: "1px solid #2A2F3A", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8B93A1", fontSize: 12.5, marginBottom: 8 }}>
              <Calculator size={13} /> Bill summary (prices are GST-inclusive)
            </div>
            <div style={S.rowLine}><span style={{ color: "#8B93A1", fontSize: 13 }}>Subtotal (excl. GST)</span><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{inr(totals.subtotal)}</span></div>
            <div style={S.rowLine}><span style={{ color: "#8B93A1", fontSize: 13 }}>GST ({draft.gstRate}%, included)</span><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{inr(totals.gstAmount)}</span></div>
            <div style={{ ...S.rowLine, borderTop: "1px solid #2A2F3A", paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>Grand total</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#C4F135", fontSize: 17 }}>{inr(totals.total)}</span>
            </div>
          </div>

          <button type="submit" disabled={saving} style={{ ...S.primaryBtn, width: "100%", marginTop: 18, opacity: saving ? 0.6 : 1 }}>
            <Check size={16} /> {saving ? (mode === "edit" ? "Updating…" : "Creating…") : (mode === "edit" ? "Update bill" : "Create bill")}
          </button>
        </form>
        {toastNode}
      </div>
    );
  }

  /* ============================= VIEW ============================= */
  const bill = viewing;
  if (!bill) { setMode("list"); return null; }

  return (
    <div>
      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <button onClick={backToList} style={S.ghostBtn}><ArrowLeft size={15} /> Back</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => openEdit(bill)} style={S.ghostBtn}><Pencil size={14} /> Edit Bill</button>
          <button onClick={() => shareWhatsApp(bill)} style={{ ...S.primaryBtn, background: "#25D366", color: "#fff" }}><MessageCircle size={15} /> WhatsApp</button>
          <button onClick={() => downloadPDF(bill)} style={{ ...S.primaryBtn, background: "#3D8BFD", color: "#fff" }}><Download size={15} /> Download PDF</button>
          <button onClick={() => window.print()} style={{ ...S.primaryBtn, background: "#12151A", color: "#fff", border: "1px solid #2A2F3A" }}><Printer size={14} /> Print Bill</button>
        </div>
      </div>

      {/* Single source of truth: this exact node is what's shown, printed, and exported to PDF. */}
      <div id="bill-preview" style={{ background: "#fff", color: "#12151A", maxWidth: 794, margin: "0 auto", padding: 32, borderRadius: 8, fontFamily: "'Inter',sans-serif", border: "1px solid #eee" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "2px solid #0F4B3A", paddingBottom: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {business?.logoUrl && <img src={business.logoUrl} crossOrigin="anonymous" style={{ width: 64, height: 64, objectFit: "contain", border: "1px solid #eee", borderRadius: 8 }} />}
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0F4B3A" }}>{business?.name || "Business"}</div>
              <div style={{ color: "#666", fontSize: 12.5 }}>{business?.tagline || ""}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12.5, color: "#333" }}>
            <div>No: <b>{bill.invoiceNumber || "—"}</b></div>
            <div>Date: <b>{fmtDate(bill.date)}</b></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18, fontSize: 12.5 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
            <b>🏢 Business Details</b>
            <div style={{ marginTop: 6, lineHeight: 1.8 }}>
              Address: {business?.address || "N/A"}<br />
              GSTIN: {business?.gstin || "N/A"}<br />
              Phone: {business?.phone || "N/A"}<br />
              Email: {business?.email || "N/A"}
            </div>
          </div>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
            <b>👤 Customer Details</b>
            <div style={{ marginTop: 6, lineHeight: 1.8 }}>
              Name: {bill.customerName || "Walk-in"}<br />
              Phone: {bill.customerPhone || "N/A"}<br />
              {bill.customerAadhar ? <>Aadhar: {bill.customerAadhar}<br /></> : null}
              Address: {bill.customerAddress || "N/A"}
            </div>
          </div>
        </div>

        {bill.type === "sale" && (bill.items || []).some((it) => it.model || it.color || it.batteryType || it.motorPower || it.range || it.wheelSize) && (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 18 }}>
            <b style={{ fontSize: 12.5 }}>🔧 Vehicle Specifications</b>
            {(bill.items || []).map((it, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8, marginTop: 8, fontSize: 11.5 }}>
                <div>MODEL<br /><b>{it.model || "N/A"}</b></div>
                <div>COLOR<br /><b>{it.color || "N/A"}</b></div>
                <div>BATTERY<br /><b>{it.batteryType || "N/A"}</b></div>
                <div>MOTOR<br /><b>{it.motorPower || "N/A"}</b></div>
                <div>RANGE<br /><b>{it.range || "N/A"}</b></div>
                <div>WHEEL<br /><b>{it.wheelSize || "N/A"}</b></div>
              </div>
            ))}
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 18 }}>
          <thead>
            <tr style={{ background: "#0F4B3A", color: "#fff" }}>
              <th style={{ padding: 8, textAlign: "left" }}>Item</th>
              <th style={{ padding: 8, textAlign: "left" }}>Description</th>
              <th style={{ padding: 8, textAlign: "right" }}>Qty</th>
              <th style={{ padding: 8, textAlign: "right" }}>Price</th>
              <th style={{ padding: 8, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(bill.items || []).map((it, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #ddd", padding: 8, fontWeight: 600 }}>{it.name}</td>
                <td style={{ border: "1px solid #ddd", padding: 8, fontSize: 11.5 }}>
                  {it.chassisNo ? <>Chassis: {it.chassisNo}<br /></> : null}
                  {it.motorNo ? <>Motor: {it.motorNo}<br /></> : null}
                  {bill.type !== "sale" && bill.serviceDesc ? bill.serviceDesc : null}
                  <span style={{ color: "#0F4B3A" }}>GST included</span>
                </td>
                <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "right" }}>{it.qty}</td>
                <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "right" }}>{inr(it.sellingPrice)}</td>
                <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "right", fontWeight: 600 }}>{inr(it.sellingPrice * it.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 14, width: 280, fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ background: "#eef7ee", color: "#0F4B3A", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {(bill.paymentMode || "Cash").toUpperCase()}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{inr(bill.subtotal)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>GST ({bill.gstRate}%)</span><span>{inr(bill.gstAmount)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #ddd", marginTop: 8, paddingTop: 8, fontWeight: 700, color: "#0F4B3A", fontSize: 15 }}>
              <span>TOTAL</span><span>{inr(bill.total)}</span>
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid #f0d98c", background: "#fffbea", borderRadius: 8, padding: 12, marginTop: 18, fontSize: 12 }}>
          <b>Warranty Information</b>
          <div style={{ marginTop: 4, whiteSpace: "pre-line" }}>
            Motor, Controller & Charger Warranty: 12 Months{"\n"}Battery Warranty: 12 Months
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 30, fontSize: 12, color: "#555" }}>
          <div>If you have any questions about this invoice, please contact us at {business?.phone || "N/A"}</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Thank you!</div>
          <div style={{ textAlign: "right", marginTop: 40 }}>
            _______________________<br />
            Authorized Signatory<br />
            <b>{business?.name || "Business"}</b>
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
