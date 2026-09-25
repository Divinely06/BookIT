import { FormEvent, useEffect, useRef, useState } from "react";

const apiBase = "";
const sessionStorageKey = "cardinal-resource-hub-session";
let notificationAudioContext: AudioContext | null = null;
const getNotificationAudioContext = () => {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!notificationAudioContext || notificationAudioContext.state === "closed") {
    notificationAudioContext = new AudioContextClass();
  }
  return notificationAudioContext;
};
const playNotificationSound = () => {
  const context = getNotificationAudioContext();
  if (!context) return;
  const playTone = () => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.setValueAtTime(988, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.35);
  };
  if (context.state === "suspended") {
    context.resume().then(playTone).catch(() => undefined);
  } else {
    playTone();
  }
};
const localDateValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

type Role = "organization" | "faculty" | "dean" | "cdmo" | "admin";
type UserSession = {
  userId: number;
  role: Role;
  name: string;
  email: string;
};
type AppNotification = {
  notification_id: number;
  booking_id?: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};
const notificationVisual = (title: string) => title.includes("Faculty")
  ? { icon: "✦", tone: "faculty" }
  : title.includes("CDMO")
    ? { icon: "◆", tone: "cdmo" }
    : title.includes("Admin")
      ? { icon: "⚙", tone: "admin" }
      : title.includes("rejected")
          ? { icon: "×", tone: "rejected" }
          : { icon: "✓", tone: "organization" };
const isActionNotification = (title: string) => title.endsWith("needed");
type NotificationToast = AppNotification;
type StoredSession = {
  role: Role;
  user?: UserSession;
  organizationId?: number;
};
type Status =
  | "Faculty review"
  | "Dean review"
  | "CDMO review"
  | "Admin review"
  | "Final admin review"
  | "Approved"
  | "Prepared"
  | "Rejected";
type Page =
  | "dashboard"
  | "proposals"
  | "facilities"
  | "equipment"
  | "requests"
  | "bookings"
  | "history"
  | "management"
  | "organizations"
  | "profile";
type Organization = {
  id: number;
  name: string;
  email: string;
  password: string;
  facultyAdviser: string;
  status: "Active" | "Pending" | "Inactive";
};
type Booking = {
  id: string;
  event: string;
  orgId: number;
  org: string;
  venue: string;
  date: string;
  time: string;
  people: number;
  status: Status;
  equipment: Array<string | { equipmentId: number; quantity: number }>;
  purpose: string;
  rejectionReason?: string;
  requestedByUserId: number;
  roomId: number;
  eventDate?: string;
  requestKey?: string;
  attachment?: { name: string; type: string; data: string };
  documents?: { name: string; type: string; data: string }[];
  activityApplication?: ActivityApplicationData;
};

type ActivityApplicationData = {
  school?: string;
  academicYear?: string;
  tagline?: string;
  mode?: "Face-to-face" | "Online";
  targetParticipants?: string;
  sdgAlignment?: string;
  sdgs?: string[];
  sdgExplanations?: Record<string, string>;
  eventTitle?: string;
  activityDate?: string;
  venue?: string;
  startTime?: string;
  endTime?: string;
  purpose?: string;
  people?: number;
  category: string;
  size: string;
  memberCount: number;
  applicantName: string;
  studentNumber: string;
  programYear: string;
  submissionDate: string;
  position: string;
  organizationCourseSection: string;
  nature: string;
  objectives: string;
  individualContribution: string;
  missionAlignment: string[];
  coreValuesExplanation: string;
  peoPo: string;
  budgetProposal?: { category: string; details: string; quantity: number; unitCost: number }[];
  eventFlow?: { startTime: string; endTime: string; activity: string }[];
  projectManagement?: { group: string; position: string; name: string; studentNumber: string; email: string }[];
};

type ProposalFormData = {
  school: string;
  academicYear: string;
  eventTitle: string;
  tagline: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: "Face-to-face" | "Online";
  sdgs: string[];
  sdgExplanations: Record<string, string>;
  description: string;
  objectives: string[];
  targetParticipants: string;
  expectedCount: number;
  strategies: { title: string; description: string }[];
  eventFlow: { startTime: string; endTime: string; activity: string }[];
  team: { group: string; position: string; name: string; studentNumber: string; email: string }[];
  participants: { type: "Officer" | "Adviser" | "Member"; name: string; studentNumber: string; email: string; attended: boolean }[];
  budget: { category: string; details: string; quantity: number; unitCost: number }[];
  sponsoredAmount: number;
  preparedBy: string;
  notedBy: string;
};

const emptyProposal = (organizationName: string, userName: string): ProposalFormData => ({
  school: "Mapúa University",
  academicYear: "2026-2027",
  eventTitle: "",
  tagline: "",
  eventDate: "",
  startTime: "09:00",
  endTime: "16:00",
  venue: "",
  mode: "Face-to-face",
  sdgs: [],
  sdgExplanations: {},
  description: "",
  objectives: [""],
  targetParticipants: organizationName,
  expectedCount: 0,
  strategies: [{ title: "", description: "" }],
  eventFlow: [{ startTime: "09:00", endTime: "10:00", activity: "" }],
  team: [{ group: "", position: "", name: userName, studentNumber: "", email: "" }],
  participants: [{ type: "Officer", name: "", studentNumber: "", email: "", attended: false }],
  budget: [{ category: "", details: "", quantity: 1, unitCost: 0 }],
  sponsoredAmount: 0,
  preparedBy: userName,
  notedBy: "",
});

const printEventProposal = (data: ProposalFormData, organizationName: string) => {
  const popup = window.open("", "_blank", "width=1000,height=1100");
  if (!popup) return;
  const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const rows = (items: string[]) => items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item)}</td></tr>`).join("");
  const strategyRows = data.strategies.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.description)}</td></tr>`).join("");
  const flowRows = data.eventFlow.map((item) => `<tr><td>${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}</td><td>${escapeHtml(item.activity)}</td></tr>`).join("");
  const budgetRows = data.budget.map((item) => `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.details)}</td><td>${item.quantity}</td><td>₱${(item.quantity * item.unitCost).toFixed(2)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html><head><title>Event Proposal</title><style>body{font:11px Arial;color:#111;margin:32px;line-height:1.35}h1{text-align:center;font-size:18px;margin:0}h2{font-size:13px;border-bottom:1px solid #111;padding-bottom:4px;margin:18px 0 7px}.meta{text-align:center}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111}.cell{padding:6px;border:1px solid #bbb}.wide{grid-column:1/-1}.label{display:block;font-size:8px;text-transform:uppercase;color:#555}table{width:100%;border-collapse:collapse;margin:5px 0 12px}td,th{border:1px solid #aaa;padding:5px;text-align:left}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:55px}.line{border-top:1px solid #111;padding-top:5px}@media print{body{margin:12mm}}</style></head><body><h1>MAPÚA UNIVERSITY</h1><p class="meta"><b>EVENT / PROJECT PROPOSAL</b><br>${escapeHtml(organizationName)} · ${escapeHtml(data.academicYear)}</p><h2>Proposal details</h2><div class="grid"><div class="cell"><span class="label">Event title</span>${escapeHtml(data.eventTitle)}</div><div class="cell"><span class="label">Tagline</span>${escapeHtml(data.tagline)}</div><div class="cell"><span class="label">Date and time</span>${escapeHtml(data.eventDate)} · ${escapeHtml(data.startTime)} - ${escapeHtml(data.endTime)}</div><div class="cell"><span class="label">Venue / mode</span>${escapeHtml(data.venue)} · ${escapeHtml(data.mode)}</div><div class="cell wide"><span class="label">Description</span>${escapeHtml(data.description)}</div><div class="cell"><span class="label">Target participants</span>${escapeHtml(data.targetParticipants)}</div><div class="cell"><span class="label">Expected count</span>${data.expectedCount}</div></div><h2>Objectives</h2><table><tbody>${rows(data.objectives)}</tbody></table><h2>Strategies</h2><table><tr><th>#</th><th>Title</th><th>Description</th></tr>${strategyRows}</table><h2>Event flow</h2><p>Timing is subject to change.</p><table><tr><th>Time</th><th>Activity</th></tr>${flowRows}</table><h2>Budget Proposal</h2><table><tr><th>Category</th><th>Details</th><th>Qty</th><th>Subtotal</th></tr>${budgetRows}</table><p><b>Total:</b> ₱${data.budget.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toFixed(2)} &nbsp; <b>Sponsored:</b> ₱${data.sponsoredAmount.toFixed(2)}</p><h2>Signatures</h2><div class="signatures"><div class="line">Prepared by: ${escapeHtml(data.preparedBy)}</div><div class="line">Noted by: ${escapeHtml(data.notedBy || "Organization Adviser")}</div></div><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
};

const printActivityApplication = (data: ActivityApplicationData, shared: {
  organization: string;
  event: string;
  date: string;
  venue: string;
  people: number;
  startTime: string;
  endTime: string;
  purpose: string;
  equipment: string[];
}) => {
  const popup = window.open("", "_blank", "width=900,height=1100");
  if (!popup) return;
  const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const equipmentList = shared.equipment.length
    ? shared.equipment.map((item) => escaped(item)).join("<br>")
    : "None";
  popup.document.write(`<!doctype html><html><head><title>FM-SA-14-01</title><style>
    body{font:12px Arial,sans-serif;color:#111;margin:36px;line-height:1.4}.pdf-header{display:flex;align-items:center;gap:22px;margin-bottom:8px}.pdf-header img{width:100px;height:auto;max-height:90px;object-fit:contain}.pdf-header-copy{flex:1;text-align:center}.pdf-header-copy h1{font-size:18px;margin:0}.meta{text-align:center;margin:4px}h2{font-size:14px;border-bottom:1px solid #111;padding-bottom:4px;margin:20px 0 8px}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111}.cell{padding:7px;border:1px solid #bbb;min-height:24px}.wide{grid-column:1/-1}.label{font-size:9px;text-transform:uppercase;color:#555;display:block}.checks{display:grid;gap:7px;margin:10px 0}.check-item{display:flex;align-items:flex-start;gap:6px}.check-box{flex:0 0 auto}.signature{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}.line{border-top:1px solid #111;padding-top:5px}@media print{body{margin:15mm}}
  </style></head><body><div class="pdf-header"><img src="/mapua-logo.png" alt="Mapúa University logo"><div class="pdf-header-copy"><h1>MAPUA UNIVERSITY</h1><div class="meta">STUDENT ACTIVITY APPLICATION FORM</div><div class="meta"><b>FM-SA-14-01</b> | Effective March 1, 2024</div></div></div>
  <h2>Applicant and activity information</h2><div class="grid">
  <div class="cell"><span class="label">Organization</span>${escaped(shared.organization)}</div><div class="cell"><span class="label">Submission date</span>${escaped(data.submissionDate)}</div>
  <div class="cell"><span class="label">Applicant</span>${escaped(data.applicantName)} (${escaped(data.studentNumber)})</div><div class="cell"><span class="label">Program and year</span>${escaped(data.programYear)}</div>
  <div class="cell"><span class="label">Position</span>${escaped(data.position)}</div><div class="cell"><span class="label">Organization/course and section</span>${escaped(data.organizationCourseSection)}</div>
  <div class="cell"><span class="label">Category / size</span>${escaped(data.category)} / ${escaped(data.size)}</div><div class="cell"><span class="label">Class or organization members</span>${data.memberCount}</div>
  <div class="cell"><span class="label">Activity title</span>${escaped(shared.event)}</div><div class="cell"><span class="label">Nature</span>${escaped(data.nature)}</div>
  <div class="cell"><span class="label">Reserved room</span>${escaped(shared.venue)}</div><div class="cell"><span class="label">Date / time</span>${escaped(shared.date)} / ${escaped(shared.startTime)} - ${escaped(shared.endTime)}</div>
  <div class="cell"><span class="label">Expected participants</span>${shared.people}</div><div class="cell"><span class="label">Mode</span>${escaped(data.mode || "N/A")}</div>
  <div class="cell wide"><span class="label">Equipment requested</span>${equipmentList}</div>
  <div class="cell wide"><span class="label">Objectives</span>${escaped(data.objectives)}</div><div class="cell wide"><span class="label">Purpose</span>${escaped(shared.purpose)}</div>
  <div class="cell"><span class="label">Individual contribution</span>${escaped(data.individualContribution)}</div><div class="cell"><span class="label">Proposed budget</span>To be completed from Budget Proposal</div></div>
  <h2>Proposal alignment</h2><div class="grid"><div class="cell"><span class="label">School / academic year</span>${escaped(data.school || "N/A")} / ${escaped(data.academicYear || "N/A")}</div><div class="cell"><span class="label">Target participants</span>${escaped(data.targetParticipants || "N/A")}</div><div class="cell wide"><span class="label">SDG alignment</span>${escaped(data.sdgAlignment || data.sdgs?.join(", ") || "N/A")}</div><div class="cell wide"><span class="label">Mission alignment</span><div class="checks">${data.missionAlignment.map((item) => `<div class="check-item"><span class="check-box">&#9745;</span><span>${escaped(item)}</span></div>`).join("")}</div></div><div class="cell wide"><span class="label">Mapúa Core Values explanation</span>${escaped(data.coreValuesExplanation || "N/A")}</div><div class="cell wide"><span class="label">PEO/PO</span>${escaped(data.peoPo || "")}</div></div>
  <p><b>Submission rule:</b> Submit at least 10 days before the activity. Post-activity documents are due within 3 days after.</p><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
};

const printApprovedBooking = (booking: Booking) => {
  const popup = window.open("", "_blank", "width=900,height=1100");
  if (!popup) return;
  const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const equipment = booking.equipment.length
    ? booking.equipment.map((item) => escaped(typeof item === "string" ? item : `${item.quantity} × equipment #${item.equipmentId}`)).join("<br>")
    : "None";
  popup.document.write(`<!doctype html><html><head><title>Approved Booking - ${escaped(booking.event)}</title><style>
    body{font:12px Arial,sans-serif;color:#111;margin:36px;line-height:1.4}.pdf-header{display:flex;align-items:center;gap:22px;border-bottom:2px solid #c8102e;padding-bottom:12px}.pdf-header img{width:100px;height:auto;max-height:90px;object-fit:contain}.pdf-header-copy{flex:1;text-align:center}.pdf-header-copy h1{font-size:19px;margin:0}.meta{text-align:center;margin:4px}.approved{margin:20px 0;padding:12px;border:2px solid #39805a;color:#276b49;text-align:center;font-size:18px;font-weight:bold;letter-spacing:.08em}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111}.cell{padding:8px;border:1px solid #bbb;min-height:25px}.wide{grid-column:1/-1}.label{font-size:9px;text-transform:uppercase;color:#555;display:block}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:65px}.signature{border-top:1px solid #111;padding-top:6px}.signature b{display:block;font-family:cursive;font-size:16px;font-weight:normal}.signature small{display:block;color:#555;margin-top:2px}@media print{body{margin:15mm}}
  </style></head><body><div class="pdf-header"><img src="/mapua-logo.png" alt="Mapúa University logo"><div class="pdf-header-copy"><h1>MAPUA UNIVERSITY</h1><div class="meta">APPROVED BOOKING CONFIRMATION</div><div class="meta"><b>${escaped(booking.id)}</b></div></div></div>
  <div class="approved">APPROVED</div><h2>Booking details</h2><div class="grid">
  <div class="cell"><span class="label">Organization</span>${escaped(booking.org)}</div><div class="cell"><span class="label">Event</span>${escaped(booking.event)}</div>
  <div class="cell"><span class="label">Reserved room</span>${escaped(booking.venue)}</div><div class="cell"><span class="label">Date and time</span>${escaped(booking.date)} · ${escaped(booking.time)}</div>
  <div class="cell"><span class="label">Participants</span>${booking.people}</div><div class="cell"><span class="label">Status</span>Approved</div>
  <div class="cell wide"><span class="label">Purpose</span>${escaped(booking.purpose)}</div><div class="cell wide"><span class="label">Equipment reserved</span>${equipment}</div></div>
  <h2>Approval signatures</h2><div class="signatures"><div class="signature"><b>Prof. Maria Santos</b>Faculty Adviser<small>Approved electronically</small></div><div class="signature"><b>Dr. Elena Cruz</b>Dean / Subject Chair<small>Approved electronically</small></div><div class="signature"><b>Engr. Paolo Reyes</b>CDMO Representative<small>Approved electronically</small></div><div class="signature"><b>Admin Office</b>Final Booking Confirmation<small>Approved electronically</small></div></div>
  <p><b>Approval record:</b> This confirmation reflects the final approved status recorded in Cardinal Resource Hub.</p><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
};

function mapBooking(row: Record<string, any>): Booking {
  const eventDate = String(row.event_date ?? "").slice(0, 10);
  const parsedDate = eventDate ? new Date(`${eventDate}T00:00:00`) : null;
  const displayDate = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "Date unavailable";
  return {
    id: String(row.booking_id),
    event: String(row.event_name),
    orgId: Number(row.org_id),
    org: String(row.org_name),
    venue: String(row.room_name),
    date: displayDate,
    time: `${String(row.start_time).slice(0, 5)} – ${String(row.end_time).slice(0, 5)}`,
    people: Number(row.participant_count),
    status: String(row.status) as Status,
    equipment: Array.isArray(row.equipment)
      ? row.equipment.map((item: any) => String(item))
      : [],
    purpose: String(row.purpose),
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    requestedByUserId: Number(row.requested_by_user_id),
    roomId: Number(row.room_id),
    eventDate,
    documents: Array.isArray(row.documents) ? row.documents as Booking["documents"] : [],
  };
}

const facilities = [
  {
    roomId: 1,
    name: "Multi-Purpose Hall",
    type: "Event hall",
    location: "Building A · Ground Floor",
    capacity: 200,
    status: "Available",
    detail: "A flexible hall for assemblies, summits, and large campus events.",
  },
  {
    roomId: 2,
    name: "Function Room 1",
    type: "Meeting room",
    location: "Building B · 2nd Floor",
    capacity: 50,
    status: "Available",
    detail:
      "A comfortable room for workshops, consultations, and organization meetings.",
  },
  {
    roomId: 3,
    name: "Audio-Visual Room",
    type: "AV room",
    location: "Building C · 3rd Floor",
    capacity: 80,
    status: "Available",
    detail:
      "Integrated projector, sound system, and stage lighting for presentations.",
  },
  {
    roomId: 4,
    name: "Open Court",
    type: "Outdoor",
    location: "Campus Grounds",
    capacity: 300,
    status: "Unavailable",
    detail: "Outdoor court currently reserved for campus athletics.",
  },
];
const equipment = [
  {
    equipmentId: 1,
    name: "Wireless Microphone",
    category: "Audio",
    available: 8,
    total: 10,
    condition: "Good",
  },
  {
    equipmentId: 2,
    name: "LCD Projector",
    category: "Audiovisual",
    available: 4,
    total: 6,
    condition: "Good",
  },
  {
    equipmentId: 3,
    name: "Folding Tables",
    category: "Furniture",
    available: 35,
    total: 40,
    condition: "Good",
  },
  {
    equipmentId: 4,
    name: "Monobloc Chairs",
    category: "Furniture",
    available: 150,
    total: 200,
    condition: "Fair",
  },
  {
    equipmentId: 5,
    name: "LED Spotlight",
    category: "Lighting",
    available: 2,
    total: 8,
    condition: "Good",
  },
  {
    equipmentId: 6,
    name: "Speaker Set",
    category: "Audio",
    available: 0,
    total: 4,
    condition: "Good",
  },
];
const initialOrganizations: Organization[] = [
  {
    id: 1,
    name: "Supreme Student Council",
    email: "ssc@mapua.edu.ph",
    password: "demo",
    facultyAdviser: "Prof. Maria Santos",
    status: "Active",
  },
  {
    id: 2,
    name: "IT Students Society",
    email: "itss@mapua.edu.ph",
    password: "demo",
    facultyAdviser: "Prof. Maria Santos",
    status: "Active",
  },
  {
    id: 3,
    name: "Business Enthusiasts Club",
    email: "bec@mapua.edu.ph",
    password: "demo",
    facultyAdviser: "Prof. Jose Reyes",
    status: "Active",
  },
];
const initialBookings: Booking[] = [
  {
    id: "BR-2026-001",
    event: "Leadership Summit 2026",
    orgId: 1,
    org: "Supreme Student Council",
    venue: "Multi-Purpose Hall",
    date: "Sep 20, 2026",
    time: "8:00 AM – 5:00 PM",
    people: 150,
    status: "Final admin review",
    equipment: ["Wireless Microphone × 4", "LCD Projector × 2"],
    purpose: "Annual leadership training and summit for organization officers.",
    requestedByUserId: 101,
    roomId: 1,
  },
  {
    id: "BR-2026-002",
    event: "Tech Talk Series: AI in Industry",
    orgId: 2,
    org: "IT Students Society",
    venue: "Audio-Visual Room",
    date: "Sep 25, 2026",
    time: "1:00 PM – 5:00 PM",
    people: 60,
    status: "Faculty review",
    equipment: ["Wireless Microphone × 2", "LCD Projector × 1"],
    purpose:
      "Speaker series featuring industry professionals in AI and technology.",
    requestedByUserId: 102,
    roomId: 3,
  },
  {
    id: "BR-2026-003",
    event: "Entrepreneurship Fair 2026",
    orgId: 3,
    org: "Business Enthusiasts Club",
    venue: "Multi-Purpose Hall",
    date: "Oct 05, 2026",
    time: "9:00 AM – 4:00 PM",
    people: 200,
    status: "Prepared",
    equipment: ["Folding Tables × 30", "Monobloc Chairs × 100"],
    purpose: "Annual fair showcasing student business projects.",
    requestedByUserId: 103,
    roomId: 1,
  },
];
const roleInfo: Record<
  Role,
  { name: string; label: string; initials: string }
> = {
  organization: {
    name: "Supreme Student Council",
    label: "Organization requester",
    initials: "SS",
  },
  faculty: {
    name: "Prof. Maria Santos",
    label: "Faculty reviewer",
    initials: "MS",
  },
  dean: { name: "Dean Reviewer", label: "Dean reviewer", initials: "DR" },
  admin: { name: "Administrator", label: "Administrator", initials: "AD" },
  cdmo: {
    name: "CDMO Officer",
    label: "CDMO reviewer",
    initials: "CD",
  },
};

function Logo({ dark = false, showName = true }: { dark?: boolean; showName?: boolean }) {
  return (
    <div className={`brand ${dark ? "brand-dark" : ""}`}>
      <img
        className="mapua-logo"
        src="/mapua-logo.png"
        alt="Mapua University"
      />
      {showName && (
        <span>
          <b>BookIT</b>
          <small>MAPUA UNIVERSITY</small>
        </span>
      )}
    </div>
  );
}
function Icon({ children }: { children: string }) {
  return (
    <span className="nav-icon" aria-hidden="true">
      {children}
    </span>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button ${secondary ? "button-secondary" : ""}`}
    >
      {children}
    </button>
  );
}
function Status({ value }: { value: Status | string }) {
  return (
    <span
      className={`status status-${value.toLowerCase().replaceAll(" ", "-")}`}
    >
      {value}
    </span>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  min,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  min?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
      />
    </div>
  );
}
function Auth({
  organizations,
  onLogin,
}: {
  organizations: Organization[];
  onLogin: (role: Role, organizationId?: number, user?: UserSession) => void;
}) {
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "reset") {
      if (password.length < 4 || password !== confirmPassword) {
        setMessage("Passwords must match and be at least 4 characters.");
        return;
      }
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated. You can now sign in.");
      return;
    }
    if (password.length < 4) {
      setMessage("Enter your password to continue.");
      return;
    }
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (response.ok) {
        onLogin(
          result.role as Role,
          result.organizationId ?? undefined,
          result.name
            ? { userId: Number(result.userId), role: result.role as Role, name: result.name, email: result.email ?? email.trim() }
            : undefined,
        );
        return;
      }
      if (response.status !== 503) {
        setMessage(result.error ?? "Use an active Mapúa account.");
        return;
      }
    } catch {}

    const organization = organizations.find(
      (item) =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.password === password,
    );
    const staffRole = ["faculty", "dean", "admin", "cdmo"].find(
      (role) => `${role}@mapua.edu.ph` === email.trim().toLowerCase(),
    ) as Role | undefined;
    const fallbackUser: UserSession | undefined = email.trim().toLowerCase() === "eblancaflor@mapua.edu.ph"
      ? { userId: 0, role: "faculty", name: "Prof. Eblancaflor", email }
      : undefined;
    if ((staffRole || fallbackUser) && password === "demo") {
      onLogin(staffRole ?? "faculty", undefined, fallbackUser ?? {
        userId: 0,
        role: staffRole! as Role,
        name: roleInfo[staffRole!].name,
        email,
      });
    }
    else if (organization) onLogin("organization", organization.id);
    else setMessage("Use an active Mapúa account to continue.");
  };
  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div>
          <Logo showName={false} />
          <p className="eyebrow">MAPÚA UNIVERSITY · MAKATI CAMPUS</p>
          <h1>
            Reserve the spaces
            <br />
            where ideas happen.
          </h1>
          <p className="auth-copy">
            A single place for organizations, faculty, administrators, and
            the CDMO to move every event forward.
          </p>
        </div>
        <div className="auth-note">
          <span>RESOURCE OPERATIONS</span>
          <strong>Facilities and equipment, in sync.</strong>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-inner">
          <span className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : "ACCOUNT ACCESS"}
          </span>
          <h2>
            {mode === "login"
              ? "Sign in to BookIT"
              : mode === "forgot"
                ? "Need a password reset?"
                : "Create a new password"}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Use your Mapúa University account to continue."
              : mode === "forgot"
                ? "Use the appropriate contact below to reset your account password."
                : "Choose a strong password for your Resource Hub account."}
          </p>
          {message && <div className="notice">{message}</div>}
          <form onSubmit={submit}>
            {mode === "forgot" && (
              <div className="auth-contact auth-contact-page">
                <span>Organization accounts: contact the administrator.</span>
                <span>Faculty, admin, and CDMO accounts: contact the DOIT.</span>
              </div>
            )}
            {mode === "reset" && (
              <>
                <Field
                  label="New password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 4 characters"
                />
                <Field
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Repeat your password"
                />
              </>
            )}
            {mode === "login" && (
              <>
                <Field
                  label="University email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@mapua.edu.ph"
                />
                <div className="field">
                  <label>Password</label>
                  <div className="password">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                    <button type="button" onClick={() => setShow(!show)}>
                      {show ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="form-row">
                  <label className="check">
                    <input type="checkbox" /> Remember me
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setMode("forgot");
                      setMessage("");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}
            {mode !== "forgot" && (
              <Button type="submit">
                {mode === "login" ? "Sign in" : "Update password"}
              </Button>
            )}
          </form>
          {mode !== "login" && (
            <button
              className="back-link"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              ← Back to sign in
            </button>
          )}
          <p className="auth-footer">
            School of Information Technology
          </p>
        </div>
      </section>
    </div>
  );
}

function Shell({
  role,
  user,
  organizationName,
  page,
  setPage,
  onLogout,
  children,
}: {
  role: Role;
  user?: UserSession;
  organizationName?: string;
  page: Page;
  setPage: (p: Page) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<NotificationToast | null>(null);
  const knownNotificationIds = useRef<Set<number> | null>(null);
  const notificationWrapRef = useRef<HTMLDivElement | null>(null);
  const info = roleInfo[role];
  const displayName = role === "organization" ? organizationName ?? info.name : user?.name ?? info.name;
  const displayInitials = user?.name
    ? user.name
        .replace(/^(Prof\. |Dr\. )/, "")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : info.initials;
  const nav =
    role === "organization"
      ? [
          ["dashboard", "Overview", "⌂"],
          ["facilities", "Facilities", "▦"],
          ["equipment", "Equipment", "▣"],
          ["requests", "My requests", "☷"],
          ["bookings", "Approved bookings", "✓"],
          ["history", "Booking history", "◷"],
        ]
      : role === "faculty"
        ? [
            ["dashboard", "Overview", "⌂"],
            ["requests", "Faculty review", "☷"],
            ["history", "Approval history", "◷"],
          ]
        : role === "dean"
          ? [
              ["dashboard", "Overview", "⌂"],
              ["requests", "Dean approval", "☷"],
              ["history", "Approval history", "◷"],
            ]
          : role === "admin"
          ? [
              ["dashboard", "Overview", "⌂"],
              ["requests", "Final booking review", "☷"],
              ["management", "Manage resources", "▦"],
              ["organizations", "Organizations", "◎"],
              ["bookings", "Approved bookings", "✓"],
              ["history", "Booking records", "◷"],
            ]
          : role === "cdmo"
            ? [
                ["dashboard", "Overview", "⌂"],
                ["requests", "CDMO review", "☷"],
                ["equipment", "Equipment", "▣"],
                ["management", "Manage equipment", "▦"],
                ["history", "CDMO history", "◷"],
              ]
            : [
                ["dashboard", "Overview", "⌂"],
                ["requests", "Admin review", "☷"],
                ["history", "Booking records", "◷"],
              ];
  useEffect(() => {
    if (!user?.userId) return;
    const refreshNotifications = () => {
      fetch(`${apiBase}/api/notifications?userId=${user.userId}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load notifications")))
        .then((items: AppNotification[]) => {
          const knownIds = knownNotificationIds.current;
          const newest = knownIds
            ? items.find((item) => !item.is_read && !knownIds.has(item.notification_id))
            : undefined;
          if (newest) {
            setToast(newest);
            playNotificationSound();
          }
          knownNotificationIds.current = new Set(items.map((item) => item.notification_id));
          setNotifications(items);
        })
        .catch(() => undefined);
    };
    refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 5000);
    return () => window.clearInterval(interval);
  }, [user?.userId]);
  useEffect(() => {
    const unlockAudio = () => {
      const context = getNotificationAudioContext();
      if (context?.state === "suspended") void context.resume();
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationWrapRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const markNotificationRead = async (notificationId: number) => {
    setNotifications((items) => items.map((item) => item.notification_id === notificationId ? { ...item, is_read: true } : item));
    await fetch(`${apiBase}/api/notifications?id=${notificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user?.userId }),
    }).catch(() => undefined);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <img
          className="sidebar-logo-only"
          src="/mapua-logo.png"
          alt="Mapua University"
        />
        <div className="campus">
          MAKATI CAMPUS <span>•</span> 2026–27
        </div>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id as Page)}
            >
              <Icon>{icon}</Icon>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user">
            <span className="avatar">{displayInitials}</span>
            <button className="user-details" onClick={() => setPage("profile")}>
              <b>{displayName}</b>
              <small>{info.label}</small>
            </button>
            <button
              className="logout"
              onClick={() => {
                if (window.confirm("Are you sure you want to sign out?")) {
                  onLogout();
                }
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="topbar-label">SCHOOL OF INFORMATION TECHNOLOGY</span>
            <span className="slash">/</span>
            <span>{info.label}</span>
          </div>
          <div className="top-actions">
            <div className="notification-wrap" ref={notificationWrapRef}>
              <button
                className="notification-button"
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <span className="notification-bell" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                  </svg>
                </span>
                {unreadCount > 0 && <b className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</b>}
              </button>
              {notificationsOpen && (
                <div className="notification-menu">
                  <div className="notification-menu-header">
                    <b>Notifications</b>
                    <span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notification-empty">No notifications yet.</p>
                  ) : notifications.map((item) => (
                    <button
                      className={`notification-item ${item.is_read ? "read" : "unread"}`}
                      key={item.notification_id}
                      onClick={() => {
                        markNotificationRead(item.notification_id);
                        setNotificationsOpen(false);
                      }}
                    >
                      <i className={`notification-icon ${notificationVisual(item.title).tone}`}>{notificationVisual(item.title).icon}</i>
                      <span className="notification-copy">
                        <b>{item.title}</b>
                        {isActionNotification(item.title) && <em>Action needed</em>}
                      </span>
                      <span>{item.message}</span>
                      <small>{new Date(item.created_at).toLocaleString()}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="online">
              <i /> Campus operations online
            </span>
          </div>
        </header>
        {toast && (
          <button
            className="notification-toast"
            onClick={() => {
              markNotificationRead(toast.notification_id);
              setNotificationsOpen(true);
              setToast(null);
            }}
          >
            <span className={`toast-dot ${notificationVisual(toast.title).tone}`}>{notificationVisual(toast.title).icon}</span>
            <span>
              <b>{toast.title}</b>
              <small>{toast.message}</small>
            </span>
            <span className="toast-close" aria-hidden="true">×</span>
          </button>
        )}
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
function Header({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  tone = "red",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className={`stat stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function BookingList({
  data,
  onSelect,
}: {
  data: Booking[];
  onSelect?: (b: Booking) => void;
}) {
  return (
    <div className="booking-list">
      {data.map((b) => (
        <button
          className="booking-row"
          key={b.id}
          onClick={() => onSelect?.(b)}
        >
          <span className="date-block">
            <b>{b.date.split(" ")[1]?.replace(",", "")}</b>
            <small>{b.date.split(" ")[0]}</small>
          </span>
          <span className="booking-info">
            <b>{b.event}</b>
            <small>
              {b.org} · {b.venue}
            </small>
          </span>
          <span className="booking-time">{b.time}</span>
          <Status value={b.status} />
        </button>
      ))}
    </div>
  );
}

function Dashboard({
  role,
  user,
  bookings,
  facilities: availableFacilities,
  organizationName,
  onAction,
  onBook,
}: {
  role: Role;
  user?: UserSession;
  bookings: Booking[];
  facilities: typeof facilities;
  organizationName?: string;
  onAction: (p: Page) => void;
  onBook?: () => void;
}) {
  const faculty = role === "faculty";
  const dean = role === "dean";
  const admin = role === "admin";
  const cdmo = role === "cdmo";
  const organization = role === "organization";
  const pendingReview = bookings.filter((booking) =>
      ["Faculty review", "Dean review", "Admin review", "CDMO review", "Final admin review"].includes(
      booking.status,
    ),
  ).length;
  const inProgressBookings = bookings.filter((booking) =>
      ["Faculty review", "Dean review", "Admin review", "CDMO review", "Final admin review"].includes(
      booking.status,
    ),
  ).length;
  const approvedBookings = bookings.filter((booking) =>
    ["Approved", "Prepared"].includes(booking.status),
  ).length;
  const rejectedBookings = bookings.filter(
    (booking) => booking.status === "Rejected",
  ).length;
  const onTrack = bookings.length
    ? Math.round(((bookings.length - rejectedBookings) / bookings.length) * 100)
    : 0;
  return (
    <>
      <Header
        eyebrow={`${roleInfo[role].label.toUpperCase()} / OVERVIEW`}
        title={
          faculty
            ? `Good morning, ${user?.name ?? "Faculty reviewer"}.`
            : dean
              ? `Good morning, ${user?.name ?? "Dean reviewer"}.`
            : admin
              ? "Operations overview"
              : cdmo
                ? "Review requests."
                : `Good morning, ${organizationName ?? "organization team"}.`
        }
        sub={
          faculty
            ? "Review event submissions before they move to Admin."
            : dean
              ? "Dean accounts can review approval history."
            : admin
              ? "Complete final approval after CDMO review."
              : cdmo
                ? "Review dean-approved bookings before final Admin approval."
                : "Submit events and follow them through every approval stage."
        }
        action={onBook && <Button onClick={onBook}>＋ New booking</Button>}
      />
      <div className="stats">
        {faculty ? (
          <>
            <Stat label="Faculty review" value={bookings.filter((booking) => booking.status === "Faculty review").length} tone="amber" />
            <Stat label="Approved this term" value={approvedBookings} tone="green" />
            <Stat label="Approval rate" value={`${onTrack}%`} tone="blue" />
          </>
        ) : dean ? (
          <>
            <Stat label="Approval history" value={bookings.filter((booking) => ["Approved", "Rejected"].includes(booking.status)).length} tone="green" />
            <Stat label="Requests tracked" value={bookings.length} tone="blue" />
          </>
        ) : admin ? (
          <>
            <Stat label="Final review" value={pendingReview} tone="amber" />
            <Stat label="Approved bookings" value={approvedBookings} tone="green" />
            <Stat label="Active venues" value={availableFacilities.filter((facility) => facility.status === "Available").length} tone="blue" />
          </>
        ) : cdmo ? (
          <>
            <Stat label="CDMO review" value={bookings.filter((booking) => booking.status === "CDMO review").length} tone="amber" />
            <Stat label="Completed reviews" value={bookings.filter((booking) => ["Admin review", "Approved", "Rejected"].includes(booking.status)).length} tone="green" />
            <Stat label="In progress" value={pendingReview} tone="blue" />
          </>
        ) : organization ? (
          <>
            <Stat
              label="Requests in progress"
              value={inProgressBookings}
              tone="amber"
            />
            <Stat label="Approved bookings" value={approvedBookings} tone="green" />
            <Stat label="Available facilities" value={availableFacilities.filter((facility) => facility.status === "Available").length} tone="blue" />
          </>
        ) : null}
      </div>
      <div className="dashboard-grid">
        <Panel
          title={
            faculty
              ? "Requests for faculty review"
              : dean
                ? "Approval history"
              : cdmo
                ? "CDMO review queue"
                : admin
                  ? "Final booking review"
                  : "Recent requests"
          }
          action={
            <button
              className="text-button"
              onClick={() => onAction("requests")}
            >
              View all →
            </button>
          }
        >
          <BookingList data={bookings} />
        </Panel>
        <Panel title={organization ? "Your workflow" : "Workflow status"}>
          <div className="pulse">
            <div>
              <span className="pulse-number">{organization ? "5" : `${onTrack}%`}</span>
              <span className="muted">
                {organization ? "workflow stages" : "of requests are on track"}
              </span>
            </div>
            <div className="bar">
                <i style={{ width: organization ? "100%" : `${onTrack}%` }} />
            </div>
            <p>
              {cdmo
                ? "Review requests after faculty approval before final Admin confirmation."
                : dean
                ? "Dean accounts can view approval history."
                : organization
                ? "Org request → Faculty review → Dean review → CDMO review → Admin confirmation."
                : "Campus operations are running normally. No system alerts today."}
            </p>
            <Button
              secondary
              onClick={() => onAction(organization ? "requests" : "requests")}
            >
              Open work queue
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function EventProposalPage({ user, organization }: { user?: UserSession; organization: Organization }) {
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [status, setStatus] = useState("Draft");
  const [form, setForm] = useState(() => emptyProposal(organization.name, user?.name ?? ""));
  const [proposals, setProposals] = useState<{ proposal_id: number; status: string; form_data: ProposalFormData }[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof ProposalFormData>(key: K, value: ProposalFormData[K]) => setForm((current) => ({ ...current, [key]: value }));
  const loadProposals = () => fetch(`${apiBase}/api/event-proposals?userId=${user?.userId ?? 0}&orgId=${organization.id}`).then((response) => response.ok ? response.json() : []).then((items: typeof proposals) => {
    setProposals(items);
    const draft = items.find((item) => item.status === "Draft");
    if (draft) { setProposalId(draft.proposal_id); setStatus(draft.status); setForm({ ...emptyProposal(organization.name, user?.name ?? ""), ...draft.form_data }); }
  }).catch(() => undefined);
  useEffect(() => { void loadProposals(); }, [organization.id, user?.userId]);
  const save = async (submit = false) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/event-proposals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId, orgId: organization.id, userId: user?.userId, formData: form, submit }) });
      const result = await response.json().catch(() => null) as { proposal_id?: number; status?: string; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to save proposal");
      if (result?.proposal_id) setProposalId(result.proposal_id);
      if (result?.status) setStatus(result.status);
      setMessage(submit ? "Proposal submitted for adviser notation." : "Draft saved.");
      void loadProposals();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save proposal"); }
    finally { setSaving(false); }
  };
  const total = form.budget.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  return (
    <>
      <Header
        eyebrow="EVENT PROPOSAL"
        title="Create an event proposal"
        sub={`${organization.name}. This proposal is independent from bookings and SAAF.`}
      />
      <div className="form-layout">
        <form
          className="panel form-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void save(true);
          }}
        >
          <div className="form-section">
            <h3>Proposal details</h3>
            <div className="form-grid">
              <Field
                label="School"
                type="text"
                value={form.school}
                onChange={(value) => update("school", value)}
                placeholder="Mapúa University"
              />
              <Field
                label="Academic year"
                type="text"
                value={form.academicYear}
                onChange={(value) => update("academicYear", value)}
                placeholder="2026-2027"
              />
              <Field
                label="Event title"
                type="text"
                value={form.eventTitle}
                onChange={(value) => update("eventTitle", value)}
                placeholder="Event title"
              />
              <Field
                label="Tagline"
                type="text"
                value={form.tagline}
                onChange={(value) => update("tagline", value)}
                placeholder="Optional tagline"
              />
              <Field
                label="Date"
                type="date"
                value={form.eventDate}
                onChange={(value) => update("eventDate", value)}
                placeholder=""
                min={localDateValue()}
              />
              <div className="field">
                <label>Time</label>
                <div className="time-row">
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      update("startTime", event.target.value)
                    }
                  />
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => update("endTime", event.target.value)}
                  />
                </div>
              </div>
              <Field
                label="Venue"
                type="text"
                value={form.venue}
                onChange={(value) => update("venue", value)}
                placeholder="Venue or online link"
              />
              <div className="field">
                <label>Mode</label>
                <div className="choice-row">
                  {["Face-to-face", "Online"].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        checked={form.mode === value}
                        onChange={() =>
                          update("mode", value as ProposalFormData["mode"])
                        }
                      />{" "}
                      {value}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field full">
                <label>Event description</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  rows={4}
                />
              </div>
              <Field
                label="Target participants"
                type="text"
                value={form.targetParticipants}
                onChange={(value) => update("targetParticipants", value)}
                placeholder="Organizations, classes, or community"
              />
              <Field
                label="Expected count"
                type="number"
                value={String(form.expectedCount)}
                onChange={(value) =>
                  update("expectedCount", Number(value) || 0)
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-section">
            <h3>The event supports the following Sustainable Development Goals (SDGs)</h3>
            <div className="choice-grid">
              {[
                "SDG 3 Good Health",
                "SDG 4 Quality Education",
                "SDG 5 Gender Equality",
                "SDG 10 Reduced Inequalities",
                "SDG 11 Sustainable Cities",
                "SDG 17 Partnerships",
              ].map((sdg) => (
                <label key={sdg}>
                  <input
                    type="checkbox"
                    checked={form.sdgs.includes(sdg)}
                    onChange={(event) =>
                      update(
                        "sdgs",
                        event.target.checked
                          ? [...form.sdgs, sdg]
                          : form.sdgs.filter((item) => item !== sdg),
                      )
                    }
                  />{" "}
                  {sdg}
                </label>
              ))}
            </div>
            {form.sdgs.map((sdg) => (
              <div className="field" key={sdg}>
                <label>{sdg} explanation</label>
                <input
                  value={form.sdgExplanations[sdg] ?? ""}
                  onChange={(event) =>
                    update("sdgExplanations", {
                      ...form.sdgExplanations,
                      [sdg]: event.target.value,
                    })
                  }
                />
              </div>
            ))}
            <div className="repeat-list">
              {form.objectives.map((objective, index) => (
                <div className="repeat-row" key={index}>
                  <input
                    value={objective}
                    placeholder={`Objective ${index + 1}`}
                    onChange={(event) =>
                      update(
                        "objectives",
                        form.objectives.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        "objectives",
                        form.objectives.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <Button
              secondary
              onClick={() => update("objectives", [...form.objectives, ""])}
            >
              Add objective
            </Button>
          </div>
          <div className="form-section">
            <h3>Event strategies and event flow</h3>
            <div className="repeat-list">
              {form.strategies.map((item, index) => (
                <div className="repeat-card" key={index}>
                  <input
                    placeholder="Strategy title"
                    value={item.title}
                    onChange={(event) =>
                      update(
                        "strategies",
                        form.strategies.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, title: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <textarea
                    placeholder="Strategy description"
                    value={item.description}
                    onChange={(event) =>
                      update(
                        "strategies",
                        form.strategies.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, description: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        "strategies",
                        form.strategies.filter(
                          (_, rowIndex) => rowIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove strategy
                  </button>
                </div>
              ))}
            </div>
            <Button
              secondary
              onClick={() =>
                update("strategies", [
                  ...form.strategies,
                  { title: "", description: "" },
                ])
              }
            >
              Add strategy
            </Button>
            <p className="muted form-note">Timing is subject to change.</p>
            <table className="entry-table">
              <thead><tr><th>Start</th><th>End</th><th>Activity</th><th>Action</th></tr></thead>
              <tbody>
              {form.eventFlow.map((item, index) => (
                <tr key={index}>
                  <td>
                  <input
                    type="time"
                    value={item.startTime}
                    onChange={(event) =>
                      update(
                        "eventFlow",
                        form.eventFlow.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, startTime: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  </td>
                  <td>
                  <input
                    type="time"
                    value={item.endTime}
                    onChange={(event) =>
                      update(
                        "eventFlow",
                        form.eventFlow.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, endTime: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  </td>
                  <td>
                  <input
                    placeholder="Activity"
                    value={item.activity}
                    onChange={(event) =>
                      update(
                        "eventFlow",
                        form.eventFlow.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, activity: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  </td>
                  <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        "eventFlow",
                        form.eventFlow.filter(
                          (_, rowIndex) => rowIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            <Button
              secondary
              onClick={() =>
                update("eventFlow", [
                  ...form.eventFlow,
                  { startTime: "", endTime: "", activity: "" },
                ])
              }
            >
              Add flow row
            </Button>
          </div>
          <div className="form-section">
            <h3>Project management team</h3>
            <table className="entry-table">
              <thead><tr><th>Group</th><th>Position</th><th>Name</th><th>Student number</th><th>Email</th><th>Action</th></tr></thead>
              <tbody>{form.team.map((item, index) => (
                <tr key={index}>
                {(
                  [
                    "group",
                    "position",
                    "name",
                    "studentNumber",
                    "email",
                  ] as const
                ).map((key) => (
                  <td key={key}><input
                    key={key}
                    placeholder={key}
                    value={item[key]}
                    onChange={(event) =>
                      update(
                        "team",
                        form.team.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, [key]: event.target.value }
                            : row,
                        ),
                      )
                    }
                  /></td>
                ))}
                <td><button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    update(
                      "team",
                      form.team.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                >
                  Remove
                </button></td>
                </tr>
              ))}</tbody>
            </table>
            <Button
              secondary
              onClick={() =>
                update("team", [
                  ...form.team,
                  {
                    group: "",
                    position: "",
                    name: "",
                    studentNumber: "",
                    email: "",
                  },
                ])
              }
            >
              Add team member
            </Button>
          </div>
          <div className="form-section">
            <h3>List of participants</h3>
            <p className="muted">
              Tentative list. Mark attendance after the event.
            </p>
            <table className="entry-table">
              <thead><tr><th>Type</th><th>Name</th><th>Student number</th><th>Email</th><th>Attended</th><th>Action</th></tr></thead>
              <tbody>{form.participants.map((item, index) => (
                <tr key={index}>
                  <td>
                <select
                  value={item.type}
                  onChange={(event) =>
                    update(
                      "participants",
                      form.participants.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              type: event.target.value as
                                "Officer" | "Adviser" | "Member",
                            }
                          : row,
                      ),
                    )
                  }
                >
                  <option>Officer</option>
                  <option>Adviser</option>
                  <option>Member</option>
                </select>
                  </td>
                  <td>
                <input
                  placeholder="Name"
                  value={item.name}
                  onChange={(event) =>
                    update(
                      "participants",
                      form.participants.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, name: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <input
                  placeholder="Student number"
                  value={item.studentNumber}
                  onChange={(event) =>
                    update(
                      "participants",
                      form.participants.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, studentNumber: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <input
                  placeholder="Email"
                  value={item.email}
                  onChange={(event) =>
                    update(
                      "participants",
                      form.participants.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, email: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={item.attended}
                    onChange={(event) =>
                      update(
                        "participants",
                        form.participants.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, attended: event.target.checked }
                            : row,
                        ),
                      )
                    }
                  />{" "}
                  Attended
                </label>
                  </td>
                  <td><button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    update(
                      "participants",
                      form.participants.filter(
                        (_, rowIndex) => rowIndex !== index,
                      ),
                    )
                  }
                >
                  Remove
                </button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="form-actions inline-actions">
              <Button
                secondary
                onClick={() =>
                  update("participants", [
                    ...form.participants,
                    {
                      type: "Member",
                      name: "",
                      studentNumber: "",
                      email: "",
                      attended: false,
                    },
                  ])
                }
              >
                Add participant
              </Button>
              <label className="button button-secondary csv-import">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const imported = String(reader.result)
                        .split(/\r?\n/)
                        .slice(1)
                        .filter(Boolean)
                        .map((line) => {
                          const [type, name, studentNumber, email] =
                            line.split(",");
                          return {
                            type: (["Officer", "Adviser", "Member"].includes(
                              type,
                            )
                              ? type
                              : "Member") as "Officer" | "Adviser" | "Member",
                            name: name ?? "",
                            studentNumber: studentNumber ?? "",
                            email: email ?? "",
                            attended: false,
                          };
                        });
                      update("participants", imported);
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="form-section">
            <h3>Signatures</h3>
            <div className="form-grid">
              <Field
                label="Prepared by"
                type="text"
                value={form.preparedBy}
                onChange={(value) => update("preparedBy", value)}
                placeholder="Name"
              />
              <Field
                label="Noted by (Organization Adviser)"
                type="text"
                value={form.notedBy}
                onChange={(value) => update("notedBy", value)}
                placeholder="Adviser name"
              />
            </div>
          </div>
          <div className="form-section">
            <h3>Budget proposal</h3>
            <table className="entry-table">
              <thead><tr><th>Category</th><th>Details</th><th>Quantity</th><th>Unit cost</th><th>Subtotal</th><th>Action</th></tr></thead>
              <tbody>{form.budget.map((item, index) => (
                <tr key={index}>
                  <td>
                <input
                  placeholder="Category"
                  value={item.category}
                  onChange={(event) =>
                    update(
                      "budget",
                      form.budget.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, category: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <input
                  placeholder="Details"
                  value={item.details}
                  onChange={(event) =>
                    update(
                      "budget",
                      form.budget.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, details: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) =>
                    update(
                      "budget",
                      form.budget.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              quantity: Number(event.target.value) || 0,
                            }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <input
                  type="number"
                  min="0"
                  placeholder="Unit cost"
                  value={item.unitCost}
                  onChange={(event) =>
                    update(
                      "budget",
                      form.budget.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              unitCost: Number(event.target.value) || 0,
                            }
                          : row,
                      ),
                    )
                  }
                />
                  </td>
                  <td>
                <span className="muted">
                  ₱{(item.quantity * item.unitCost).toFixed(2)}
                </span>
                  </td>
                  <td><button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    update(
                      "budget",
                      form.budget.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                >
                  Remove
                </button></td>
                </tr>
              ))}</tbody>
            </table>
            <Button
              secondary
              onClick={() =>
                update("budget", [
                  ...form.budget,
                  { category: "", details: "", quantity: 1, unitCost: 0 },
                ])
              }
            >
              Add budget item
            </Button>
            <Field
              label="Sponsored amount"
              type="number"
              value={String(form.sponsoredAmount)}
              onChange={(value) =>
                update("sponsoredAmount", Number(value) || 0)
              }
              placeholder="0"
            />
            <p className="muted">
              Total ₱{total.toFixed(2)} · Net cost ₱
              {Math.max(0, total - form.sponsoredAmount).toFixed(2)}
            </p>
          </div>
          {message && (
            <div
              className={`notice ${message.includes("Unable") || message.includes("required") ? "error" : "success"}`}
            >
              {message}
            </div>
          )}
          <div className="form-actions">
            <Button
              secondary
              onClick={() => printEventProposal(form, organization.name)}
            >
              Export proposal PDF
            </Button>
            <Button
              secondary
              onClick={() => void save(false)}
              disabled={saving}
            >
              Save draft
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Submit proposal"}
            </Button>
          </div>
        </form>
        <aside className="form-aside">
          <span className="eyebrow">MY PROPOSALS</span>
          {proposals.length === 0 ? (
            <p className="muted">No saved proposals yet.</p>
          ) : (
            proposals.map((proposal) => (
              <button
                className="proposal-summary"
                key={proposal.proposal_id}
                onClick={() => {
                  setProposalId(proposal.proposal_id);
                  setStatus(proposal.status);
                  setForm({
                    ...emptyProposal(organization.name, user?.name ?? ""),
                    ...proposal.form_data,
                  });
                }}
              >
                <b>{proposal.form_data.eventTitle || "Untitled proposal"}</b>
                <span>{proposal.status}</span>
              </button>
            ))
          )}
          <p className="muted">Current status: {status}</p>
        </aside>
      </div>
    </>
  );
}

function StudentView({
  user,
  page,
  setPage,
  bookings,
  setBookings,
  facilities: availableFacilities,
  equipment: availableEquipment,
  organizations,
  activeOrganizationId,
}: {
  user?: UserSession;
  page: Page;
  setPage: (p: Page) => void;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  facilities: typeof facilities;
  equipment: typeof equipment;
  organizations: Organization[];
  activeOrganizationId: number;
}) {
  const [selectedFacility, setSelectedFacility] = useState<
    (typeof facilities)[0] | null
  >(null);
  const [query, setQuery] = useState("");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [dateFacilities, setDateFacilities] = useState(availableFacilities);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Booking | null>(null);
  const currentOrganization =
    organizations.find((item) => item.id === activeOrganizationId) ??
    organizations[0];
  const my = bookings.filter((b) => b.orgId === activeOrganizationId);
  useEffect(() => {
    if (!availabilityDate) {
      setDateFacilities(availableFacilities);
      return;
    }
    fetch(`${apiBase}/api/resources?date=${encodeURIComponent(availabilityDate)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load availability")))
      .then((resources: { rooms: Record<string, string | number | boolean>[] }) => {
        setDateFacilities(resources.rooms.map((room) => ({
          ...(availableFacilities.find((item) => item.roomId === Number(room.room_id)) ?? {
            type: "Campus venue",
            detail: `${String(room.location)} venue with capacity for ${Number(room.capacity)} people.`,
          }),
          roomId: Number(room.room_id),
          name: String(room.room_name),
          location: String(room.location),
          capacity: Number(room.capacity),
          status: room.date_available === false ? "Unavailable" : String(room.availability_status),
        })));
      })
      .catch(() => setDateFacilities(availableFacilities));
  }, [availabilityDate, availableFacilities]);
  if (page === "profile") return <Profile role="organization" user={user} />;
  if (showForm && !currentOrganization)
    return (
      <>
        <Header
          eyebrow="NEW REQUEST"
          title="Booking details are still loading"
          sub="Your organization account has not finished loading. Try again in a moment."
        />
        <div className="notice error">
          We could not load the organization details required to create a request.
        </div>
        <Button secondary onClick={() => setShowForm(false)}>
          Back to overview
        </Button>
      </>
    );
  if (showForm)
    return (
      <BookingForm
        user={user}
        organization={currentOrganization}
        facilities={availableFacilities}
        equipment={availableEquipment}
        venue={selectedFacility?.name}
        onCancel={() => setShowForm(false)}
          onSubmit={async (b) => {
          const [startTime, endTime] = b.time.split(" – ");
            const response = await fetch(`${apiBase}/api/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
              orgId: b.orgId,
              roomId: b.roomId,
                requestedByUserId: user?.userId,
                clientRequestId: b.requestKey,
                attachment: b.attachment,
                activityApplication: b.activityApplication,
                equipment: b.equipment,
              eventName: b.event,
              participantCount: b.people,
              eventDate: b.eventDate,
              startTime,
              endTime,
              purpose: b.purpose,
            }),
          });
          if (!response.ok) {
            const details = await response.json().catch(() => null) as { error?: string } | null;
            throw new Error(details?.error ?? "Unable to submit booking request");
          }
          const bookingsResponse = await fetch(
            `${apiBase}/api/bookings?role=organization&userId=${user?.userId ?? 0}`,
          );
          if (bookingsResponse.ok) {
            const rows = (await bookingsResponse.json()) as Record<string, string | number>[];
            setBookings(rows.map(mapBooking));
          }
          setShowForm(false);
          setSubmitted(true);
          setPage("requests");
        }}
      />
    );
  if (page === "facilities")
    return (
      <>
        <Header
          eyebrow="RESOURCES / FACILITIES"
          title="Find a place for your event."
          sub="Choose a venue from the list, then start a request with that venue already selected."
        />
        <div className="filter-row">
          <input
            className="search"
            placeholder="Search facilities"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="field-inline">Check date <input className="date-input" type="date" min={localDateValue()} value={availabilityDate} onChange={(event) => setAvailabilityDate(event.target.value)} /></label>
          <span className="filter-note">
            {
              dateFacilities.filter((f) =>
                f.name.toLowerCase().includes(query.toLowerCase()),
              ).length
            }{" "}
            venues
          </span>
        </div>
        {selectedFacility ? (
          <Detail
            facility={selectedFacility}
            onBack={() => setSelectedFacility(null)}
            onBook={() => setShowForm(true)}
          />
        ) : (
          <div className="venue-list">
            {dateFacilities
              .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
              .map((f) => (
                <button
                  className="venue-row"
                  key={f.name}
                  onClick={() => setSelectedFacility(f)}
                >
                  <span className="venue-icon">▦</span>
                  <span>
                    <b>{f.name}</b>
                    <small>
                      {f.type} · {f.location}
                    </small>
                  </span>
                  <span className="venue-capacity">{f.capacity} seats</span>
                  <Status value={f.status} />
                </button>
              ))}
          </div>
        )}
      </>
    );
  if (page === "equipment")
    return (
      <>
        <Header
          eyebrow="RESOURCES / EQUIPMENT"
          title="Everything your event needs."
          sub="Check live inventory before adding equipment to a booking request."
        />
        <Panel title="Equipment inventory">
          <div className="filter-row">
            <input
              className="search"
              placeholder="Search equipment"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="filter-note">
              {availableEquipment.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).length} items
            </span>
          </div>
          <div className="venue-list">
            {availableEquipment.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).map((item) => {
              const available = item.available > 0;
              return (
                <div className="venue-row equipment-row" key={item.name}>
                  <span className={`venue-icon ${available ? "good" : "bad"}`}>▦</span>
                  <span>
                    <b>{item.name}</b>
                    <small>{item.category}</small>
                  </span>
                  <span className="venue-capacity">
                    {item.available} / {item.total} ready
                  </span>
                  <span className={`dot-label ${available ? "good" : "bad"}`}>
                    {available ? "Available" : "Unavailable"}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </>
    );
  if (page === "requests" || page === "bookings" || page === "history")
    return (
      <>
        <Header
          eyebrow={`ORGANIZATION / ${page.toUpperCase()}`}
          title={
            page === "requests"
              ? "My booking requests"
              : page === "bookings"
                ? "Approved bookings"
                : "Booking history"
          }
          sub="Track your request through organization, faculty, dean, CDMO review, and final Admin confirmation."
        />
        {submitted && (
          <div className="notice success">
            Your request was submitted and is now waiting for faculty review.
          </div>
        )}
        <Panel
          title={page === "requests" ? "Active requests" : "All reservations"}
        >
          <BookingList
            data={
              page === "bookings"
                ? my.filter((b) => ["Approved", "Prepared"].includes(b.status))
                : my
            }
            onSelect={setSelectedRequest}
          />
        </Panel>
        {selectedRequest && (
          <Review
            booking={selectedRequest}
            role="organization"
            readOnly
            onClose={() => setSelectedRequest(null)}
            onUpdate={async () => undefined}
          />
        )}
      </>
    );
  return (
    <Dashboard
      role="organization"
      bookings={my}
      facilities={availableFacilities}
      organizationName={currentOrganization?.name}
      onAction={setPage}
      onBook={() => setShowForm(true)}
    />
  );
}
function Detail({
  facility,
  onBack,
  onBook,
}: {
  facility: (typeof facilities)[0];
  onBack: () => void;
  onBook: () => void;
}) {
  return (
    <div className="detail">
      <button className="back-link" onClick={onBack}>
        ← All facilities
      </button>
      <div className="detail-grid">
        <div className="detail-visual">
          <span>▦</span>
          <em className="available">{facility.status}</em>
        </div>
        <div>
          <span className="eyebrow">{facility.type}</span>
          <h2>{facility.name}</h2>
          <p className="muted">{facility.detail}</p>
          <dl className="detail-list">
            <div>
              <dt>Location</dt>
              <dd>{facility.location}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>{facility.capacity} people</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{facility.status}</dd>
            </div>
          </dl>
          <Button onClick={onBook}>Start a booking request</Button>
        </div>
      </div>
    </div>
  );
}
function BookingForm({
  user,
  organization,
  facilities: availableFacilities,
  equipment: availableEquipment,
  venue: initialVenue,
  onCancel,
  onSubmit,
}: {
  user?: UserSession;
  organization: Organization;
  facilities: typeof facilities;
  equipment: typeof equipment;
  venue?: string;
  onCancel: () => void;
  onSubmit: (b: Booking) => Promise<void>;
}) {
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");
  const [school, setSchool] = useState("Mapúa University");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [tagline, setTagline] = useState("");
  const [mode, setMode] = useState<"Face-to-face" | "Online">("Face-to-face");
  const [targetParticipants, setTargetParticipants] = useState("");
  const [sdgAlignment, setSdgAlignment] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("16:00");
  const [venue, setVenue] = useState(
    initialVenue ??
      availableFacilities.find((f) => f.status === "Available")?.name ??
      availableFacilities[0]?.name ??
      "",
  );
  const [people, setPeople] = useState("50");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [category, setCategory] = useState("Co-Curricular");
  const [activitySize, setActivitySize] = useState("Minor");
  const [memberCount, setMemberCount] = useState("0");
  const [applicantName, setApplicantName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [programYear, setProgramYear] = useState("");
  const [position, setPosition] = useState("");
  const [organizationCourseSection, setOrganizationCourseSection] = useState("");
  const [nature, setNature] = useState("");
  const [objectives, setObjectives] = useState("");
  const [individualContribution, setIndividualContribution] = useState("");
  const [missionAlignment, setMissionAlignment] = useState<string[]>([]);
  const [coreValuesExplanation, setCoreValuesExplanation] = useState("");
  const [peoPo, setPeoPo] = useState("");
  const [budgetProposal, setBudgetProposal] = useState<ActivityApplicationData["budgetProposal"]>([
    { category: "", details: "", quantity: 1, unitCost: 0 },
  ]);
  const [eventFlow, setEventFlow] = useState<ActivityApplicationData["eventFlow"]>([
    { startTime: "09:00", endTime: "10:00", activity: "" },
  ]);
  const [projectManagement, setProjectManagement] = useState<ActivityApplicationData["projectManagement"]>([
    { group: "", position: "", name: "", studentNumber: "", email: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [equipmentRequests, setEquipmentRequests] = useState<Record<string, number>>({});
  const [dateFacilities, setDateFacilities] = useState(availableFacilities);
  const [dateEquipment, setDateEquipment] = useState(availableEquipment);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  useEffect(() => {
    if (!user?.userId) return;
    fetch(`${apiBase}/api/activity-applications?userId=${user.userId}&orgId=${organization.id}`)
      .then((response) => response.ok ? response.json() : null)
      .then((application: { application_id?: number; status?: string; form_data?: ActivityApplicationData } | null) => {
        if (!application?.form_data || application.status !== "Draft") return;
        const saved = application.form_data;
        setApplicationId(application.application_id ?? null);
        setSchool(saved.school ?? "Mapúa University");
        setAcademicYear(saved.academicYear ?? "2026-2027");
        setTagline(saved.tagline ?? "");
        setMode(saved.mode ?? "Face-to-face");
        setTargetParticipants(saved.targetParticipants ?? "");
        setSdgAlignment(saved.sdgAlignment ?? saved.sdgs?.join(", ") ?? "");
        setEvent(saved.eventTitle ?? "");
        setDate(saved.activityDate ?? "");
        setVenue(saved.venue ?? venue);
        setStartTime(saved.startTime ?? "09:00");
        setEndTime(saved.endTime ?? "16:00");
        setPurpose(saved.purpose ?? "");
        setPeople(String(saved.people ?? 50));
        setCategory(saved.category ?? "Co-Curricular");
        setActivitySize(saved.size ?? "Minor");
        setMemberCount(String(saved.memberCount ?? 0));
        setApplicantName(saved.applicantName ?? "");
        setStudentNumber(saved.studentNumber ?? "");
        setProgramYear(saved.programYear ?? "");
        setPosition(saved.position ?? "");
        setOrganizationCourseSection(saved.organizationCourseSection ?? "");
        setNature(saved.nature ?? "");
        setObjectives(saved.objectives ?? "");
        setIndividualContribution(saved.individualContribution ?? "");
        setMissionAlignment(saved.missionAlignment ?? []);
        setCoreValuesExplanation(saved.coreValuesExplanation ?? "");
        setPeoPo(saved.peoPo ?? "");
        setBudgetProposal(saved.budgetProposal ?? [{ category: "", details: "", quantity: 1, unitCost: 0 }]);
        setEventFlow(saved.eventFlow ?? [{ startTime: "09:00", endTime: "10:00", activity: "" }]);
        setProjectManagement(saved.projectManagement ?? [{ group: "", position: "", name: "", studentNumber: "", email: "" }]);
      })
      .catch(() => undefined);
  }, [organization.id, user]);

  useEffect(() => {
    const interval = window.setInterval(() => setAvailabilityVersion((version) => version + 1), 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setAvailabilityLoading(true);
    fetch(`${apiBase}/api/resources?date=${encodeURIComponent(date)}&startTime=${startTime}&endTime=${endTime}`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load availability");
        return response.json();
      })
      .then((resources: {
        rooms: Record<string, string | number | boolean>[];
        equipment: Record<string, string | number>[];
      }) => {
        if (cancelled) return;
        setDateFacilities(resources.rooms.map((room) => ({
          ...(availableFacilities.find((item) => item.roomId === Number(room.room_id)) ?? {
            type: "Campus venue",
            detail: `${String(room.location)} venue with capacity for ${Number(room.capacity)} people.`,
          }),
          roomId: Number(room.room_id),
          name: String(room.room_name),
          location: String(room.location),
          capacity: Number(room.capacity),
          status: room.date_available === false ? "Unavailable" : String(room.availability_status),
        })));
        setDateEquipment(resources.equipment.map((item) => ({
          ...(availableEquipment.find((resource) => resource.name === String(item.equipment_name)) ?? {
            category: String(item.category ?? "General"),
          }),
          equipmentId: Number(item.equipment_id),
          name: String(item.equipment_name),
          available: Number(item.date_available ?? item.quantity_available),
          total: Number(item.quantity_available),
          condition: String(item.status),
        })));
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load availability for this date.");
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, startTime, endTime, availabilityVersion, availableFacilities, availableEquipment]);

  useEffect(() => {
    const selected = dateFacilities.find((item) => item.name === venue);
    if (!selected || selected.status !== "Available") {
      setVenue(dateFacilities.find((item) => item.status === "Available")?.name ?? "");
    }
  }, [dateFacilities, venue]);
  const activityFormData = (): ActivityApplicationData => ({
    school,
    academicYear,
    tagline,
    mode,
    targetParticipants,
    sdgAlignment,
    eventTitle: event,
    activityDate: date,
    venue,
    startTime,
    endTime,
    purpose,
    people: Number(people) || 0,
    category,
    size: activitySize,
    memberCount: Number(memberCount) || 0,
    applicantName,
    studentNumber,
    programYear,
    submissionDate: localDateValue(),
    position,
    organizationCourseSection,
    nature,
    objectives,
    individualContribution,
    missionAlignment,
    coreValuesExplanation,
    peoPo,
    budgetProposal,
    eventFlow,
    projectManagement,
  });
  const saveDraft = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/activity-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          orgId: organization.id,
          applicantUserId: user?.userId,
          formData: activityFormData(),
        }),
      });
      const result = await response.json().catch(() => null) as { application_id?: number; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to save draft");
      if (result?.application_id) setApplicationId(result.application_id);
      setError("Draft saved.");
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Unable to save draft");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <>
      <Header
        eyebrow="NEW REQUEST"
        title="Create a booking request"
        sub={`Requesting as ${organization.name}. Choose or confirm the venue below.`}
      />
      <div className="form-layout">
        <form
          className="panel form-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!event || !date || !purpose || !venue || !applicantName || !studentNumber
              || !programYear || !position || !organizationCourseSection || !nature || !objectives) {
              setError("Complete the required Form 1 fields before submitting.");
              return;
            }
            if (missionAlignment.length === 0) {
              setError("Select at least one mission alignment statement.");
              return;
            }
            if (startTime >= endTime) {
              setError("The end time must be later than the start time.");
              return;
            }
            if (submitting) return;
            setSubmitting(true);
            const requestKey = crypto.randomUUID();
            const minimumDate = new Date();
            minimumDate.setHours(0, 0, 0, 0);
            minimumDate.setDate(minimumDate.getDate() + 10);
            if (new Date(`${date}T00:00:00`) < minimumDate) {
              setError("The activity must be scheduled at least 10 days from today.");
              setSubmitting(false);
              return;
            }
            const selectedAttachment = attachment;
            const attachmentData = selectedAttachment
              ? await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () => reject(new Error("Unable to read file"));
                  reader.readAsDataURL(selectedAttachment);
                }).catch(() => "")
              : "";
            if (attachment && !attachmentData) {
              setError("The selected file could not be read.");
              setSubmitting(false);
              return;
            }
            try {
              await onSubmit({
              id: `BR-2026-${String(Date.now()).slice(-3)}`,
              event,
              orgId: organization.id,
              org: organization.name,
              venue,
              date: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              }),
              time: `${startTime} – ${endTime}`,
              people: Number(people),
              status: "Faculty review",
              equipment: Object.entries(equipmentRequests)
                .filter(([, quantity]) => quantity > 0)
                .map(([name, quantity]) => ({
                  equipmentId: dateEquipment.find((item) => item.name === name)?.equipmentId ?? 0,
                  quantity,
                })),
              purpose,
              activityApplication: activityFormData(),
              requestedByUserId: user?.userId ?? 0,
              roomId: dateFacilities.find((f) => f.name === venue)?.roomId ?? 0,
              eventDate: date,
              requestKey,
              attachment: attachmentData && selectedAttachment
                ? { name: selectedAttachment.name, type: selectedAttachment.type, data: attachmentData }
                : undefined,
              });
            } catch (submissionError) {
              setError(submissionError instanceof Error ? submissionError.message : "Unable to submit the request. Please try again.");
              setSubmitting(false);
            }
          }}
        >
          <div className="form-section">
            <h3>Event information</h3>
            <div className="form-grid">
              <div className="field full">
                <label>Organization</label>
                <div className="locked-field">
                  {organization.name}
                  <small>{organization.email}</small>
                </div>
              </div>
              <Field
                label="School"
                type="text"
                value={school}
                onChange={setSchool}
                placeholder="Mapúa University"
              />
              <Field
                label="Academic year"
                type="text"
                value={academicYear}
                onChange={setAcademicYear}
                placeholder="2026-2027"
              />
              <Field
                label="Event name"
                type="text"
                value={event}
                onChange={setEvent}
                placeholder="e.g. General Assembly"
              />
              <Field
                label="Tagline"
                type="text"
                value={tagline}
                onChange={setTagline}
                placeholder="Optional event tagline"
              />
              <Field
                label="Participants"
                type="number"
                value={people}
                onChange={setPeople}
                placeholder="50"
              />
              <Field
                label="Event date"
                type="date"
                value={date}
                onChange={setDate}
                placeholder=""
                min={localDateValue()}
              />
              <div className="field">
                <label>Start and end time</label>
                <div className="time-row">
                  <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </div>
              </div>
              <div className="field full">
                <label>Event purpose</label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What will happen at your event?"
                  rows={4}
                />
              </div>
              <div className="field">
                <label>Mode</label>
                <div className="choice-row">
                  {(["Face-to-face", "Online"] as const).map((value) => (
                    <label key={value}>
                      <input type="radio" checked={mode === value} onChange={() => setMode(value)} /> {value}
                    </label>
                  ))}
                </div>
              </div>
              <Field
                label="Target participants"
                type="text"
                value={targetParticipants}
                onChange={setTargetParticipants}
                placeholder="Organizations, classes, or community"
              />
              <div className="field full">
                <label>Sustainable Development Goal alignment</label>
                <input
                  type="text"
                  value={sdgAlignment}
                  onChange={(event) => setSdgAlignment(event.target.value)}
                  placeholder="e.g. SDG 4 Quality Education; SDG 17 Partnerships"
                />
                <small className="field-help">List the SDG number and title supported by this activity.</small>
              </div>
              <div className="field full">
                <label>Venue</label>
                <select
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  disabled={availabilityLoading}
                >
                  {dateFacilities
                    .filter((f) => f.status === "Available")
                    .map((f) => (
                      <option key={f.name}>{f.name}</option>
                    ))}
                </select>
                {date && !availabilityLoading && dateFacilities.every((f) => f.status !== "Available") && (
                  <small className="error-text">No venue is available on this date.</small>
                )}
              </div>
            </div>
          </div>
          <div className="form-section">
            <h3>Student Activity Application · FM-SA-14-01</h3>
            <div className="form-grid">
              <div className="field">
                <label>Category</label>
                <div className="choice-row">
                  {['Co-Curricular', 'Extra-Curricular'].map((value) => (
                    <label key={value}><input type="radio" checked={category === value} onChange={() => setCategory(value)} /> {value}</label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Activity size</label>
                <div className="choice-row">
                  {['Major', 'Minor'].map((value) => (
                    <label key={value}><input type="radio" checked={activitySize === value} onChange={() => setActivitySize(value)} /> {value}</label>
                  ))}
                </div>
              </div>
              <Field label="Total class/org members" type="number" value={memberCount} onChange={setMemberCount} placeholder="0" />
              <Field label="Applicant name" type="text" value={applicantName} onChange={setApplicantName} placeholder="Full name" />
              <Field label="Student number" type="text" value={studentNumber} onChange={setStudentNumber} placeholder="20XXXXXXX" />
              <Field label="Program and year" type="text" value={programYear} onChange={setProgramYear} placeholder="BSCS 3" />
              <Field label="Position" type="text" value={position} onChange={setPosition} placeholder="Class Officer" />
              <Field label="Organization/course and section" type="text" value={organizationCourseSection} onChange={setOrganizationCourseSection} placeholder="Organization or course-section" />
              <Field label="Nature of activity" type="text" value={nature} onChange={setNature} placeholder="Meeting, seminar, outreach..." />
              <Field label="Individual contribution" type="text" value={individualContribution} onChange={setIndividualContribution} placeholder="Amount or details" />
              <div className="field full"><label>Objectives</label><textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={4} placeholder="State the objectives of the activity" /></div>
              <div className="field full"><label>Mission alignment <small>(select at least one)</small></label><div className="mission-list">
                {['The University shall provide a learning environment in order for its students to acquire the attributes that will make them globally competitive.', 'The Institute shall engage in economically viable research, development, and innovation.', 'The Institute shall provide state-of-the-art solutions to problems of industries and communities.'].map((value) => <label key={value}><input className="mission-checkbox" type="checkbox" checked={missionAlignment.includes(value)} onChange={(e) => setMissionAlignment(e.target.checked ? [...missionAlignment, value] : missionAlignment.filter((item) => item !== value))} /> <span>{value}</span></label>)}
              </div></div>
              <div className="field full"><label>Mapúa Core Values explanation</label><textarea value={coreValuesExplanation} onChange={(e) => setCoreValuesExplanation(e.target.value)} rows={3} placeholder="Discipline, Excellence, Commitment, Integrity, Relevance" /></div>
              <div className="field full"><label>PEO/PO <small>(if and when applicable)</small></label><textarea value={peoPo} onChange={(e) => setPeoPo(e.target.value)} rows={2} placeholder="If and when applicable, enumerate the Program Educational Objectives (PEO) or Program Objectives (PO) Satisfied in this Activity" /></div>
            </div>
            <div className="form-section nested-section">
              <h3>Event flow</h3>
              <table className="entry-table"><thead><tr><th>Start</th><th>End</th><th>Activity</th><th>Action</th></tr></thead><tbody>
                {(eventFlow ?? []).map((item, index) => <tr key={index}><td><input type="time" value={item.startTime} onChange={(e) => setEventFlow((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, startTime: e.target.value } : row))} /></td><td><input type="time" value={item.endTime} onChange={(e) => setEventFlow((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, endTime: e.target.value } : row))} /></td><td><input placeholder="Activity" value={item.activity} onChange={(e) => setEventFlow((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, activity: e.target.value } : row))} /></td><td><button type="button" className="text-button" onClick={() => setEventFlow((rows) => (rows ?? []).filter((_, rowIndex) => rowIndex !== index))}>Remove</button></td></tr>)}
              </tbody></table>
              <Button secondary onClick={() => setEventFlow((rows) => [...(rows ?? []), { startTime: "", endTime: "", activity: "" }])}>Add flow row</Button>
            </div>
            <div className="form-section nested-section">
              <h3>Project management</h3>
              <table className="entry-table"><thead><tr><th>Group</th><th>Position</th><th>Name</th><th>Student number</th><th>Email</th><th>Action</th></tr></thead><tbody>
                {(projectManagement ?? []).map((item, index) => <tr key={index}>{(["group", "position", "name", "studentNumber", "email"] as const).map((key) => <td key={key}><input placeholder={key} value={item[key]} onChange={(e) => setProjectManagement((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, [key]: e.target.value } : row))} /></td>)}<td><button type="button" className="text-button" onClick={() => setProjectManagement((rows) => (rows ?? []).filter((_, rowIndex) => rowIndex !== index))}>Remove</button></td></tr>)}
              </tbody></table>
              <Button secondary onClick={() => setProjectManagement((rows) => [...(rows ?? []), { group: "", position: "", name: "", studentNumber: "", email: "" }])}>Add team member</Button>
            </div>
            <div className="form-section nested-section">
              <h3>Budget proposal</h3>
              <table className="entry-table"><thead><tr><th>Category</th><th>Details</th><th>Quantity</th><th>Unit cost</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>
                {(budgetProposal ?? []).map((item, index) => <tr key={index}><td><input placeholder="Category" value={item.category} onChange={(e) => setBudgetProposal((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, category: e.target.value } : row))} /></td><td><input placeholder="Details" value={item.details} onChange={(e) => setBudgetProposal((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, details: e.target.value } : row))} /></td><td><input type="number" min="0" value={item.quantity} onChange={(e) => setBudgetProposal((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(e.target.value) || 0 } : row))} /></td><td><input type="number" min="0" value={item.unitCost} onChange={(e) => setBudgetProposal((rows) => (rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: Number(e.target.value) || 0 } : row))} /></td><td className="muted">₱{(item.quantity * item.unitCost).toFixed(2)}</td><td><button type="button" className="text-button" onClick={() => setBudgetProposal((rows) => (rows ?? []).filter((_, rowIndex) => rowIndex !== index))}>Remove</button></td></tr>)}
              </tbody></table>
              <Button secondary onClick={() => setBudgetProposal((rows) => [...(rows ?? []), { category: "", details: "", quantity: 1, unitCost: 0 }])}>Add budget item</Button>
            </div>
            <p className="muted form-note">Day is calculated from the event date. Proposed budget will be supplied by the Budget Proposal form. Submit at least 10 days before the activity; post-activity documents are due within 3 days after.</p>
            <div className="form-actions inline-actions">
              <Button secondary onClick={() => printActivityApplication(activityFormData(), { organization: organization.name, event, date, venue, people: Number(people), startTime, endTime, purpose, equipment: Object.entries(equipmentRequests).filter(([, quantity]) => quantity > 0).map(([name, quantity]) => `${quantity} × ${name}`) })}>Export Form 1 PDF</Button>
              <Button secondary onClick={saveDraft} disabled={submitting}>Save draft</Button>
            </div>
          </div>
          <div className="form-section">
            <h3>Equipment requests</h3>
            <div className="equipment-request-list">
              {dateEquipment.map((item) => {
                const available = item.available > 0;
                return (
                  <div
                    key={item.name}
                    className={`equipment-request ${available ? "is-available" : "is-unavailable"}`}
                  >
                    <span className={`equipment-icon ${available ? "good" : "bad"}`}>▦</span>
                    <span className="equipment-meta">
                      <b>{item.name}</b>
                      <small>{item.available} available</small>
                    </span>
                    <span className={`dot-label ${available ? "good" : "bad"}`}>
                      {available ? "Available" : "Unavailable"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={item.available}
                      disabled={item.available < 1}
                      value={equipmentRequests[item.name] ?? 0}
                      onChange={(e) => {
                        const quantity = Math.max(
                          0,
                          Math.min(item.available, Number(e.target.value) || 0),
                        );
                        setEquipmentRequests({
                          ...equipmentRequests,
                          [item.name]: quantity,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="form-section">
            <h3>Additional documents <small>(optional)</small></h3>
            <div className="upload">
              <b>＋</b>
              <label htmlFor="booking-attachment">Upload a letter of intent, program flow, or other supporting document</label>
              <small>Optional · PDF or DOCX · up to 10 MB</small>
              <input
                id="booking-attachment"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (selected && selected.size > 10 * 1024 * 1024) {
                    setError("Files must be 10 MB or smaller.");
                    e.target.value = "";
                    setAttachment(null);
                    return;
                  }
                  setError("");
                  setAttachment(selected);
                }}
              />
              {attachment && <small className="file-name">{attachment.name}</small>}
            </div>
          </div>
          {error && <div className="notice error">{error}</div>}
          <div className="form-actions">
            <Button secondary onClick={onCancel}>
              Back to resources
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Review and submit"}
            </Button>
          </div>
        </form>
        <aside className="form-aside">
          <span className="eyebrow">WHAT HAPPENS NEXT</span>
          <ol>
            <li>
              <b>Org request</b>
              <span>Your organization submits the event plan and required documents.</span>
            </li>
            <li>
              <b>Faculty review</b>
              <span>Your adviser checks the event details and documents.</span>
            </li>
            <li>
              <b>Dean review</b>
              <span>
                The dean approves the department-level request after faculty approval.
              </span>
            </li>
            <li>
              <b>CDMO review</b>
              <span>
                Final approval is reviewed based on budget, policy, and campus rules.
              </span>
            </li>
            <li>
              <b>Admin confirmation</b>
              <span>
                The administrator confirms the booking and final logistics.
              </span>
            </li>
          </ol>
        </aside>
      </div>
    </>
  );
}

function StaffView({
  role,
  user,
  page,
  setPage,
  bookings,
  setBookings,
  facilities: availableFacilities,
  equipment: availableEquipment,
  organizations,
  setOrganizations,
}: {
  role: Role;
  user?: UserSession;
  page: Page;
  setPage: (p: Page) => void;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  facilities: typeof facilities;
  equipment: typeof equipment;
  organizations: Organization[];
  setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
}) {
  const [selected, setSelected] = useState<Booking | null>(null);
  const [actionError, setActionError] = useState("");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  if (page === "management") {
    return (
      <Management
        facilities={availableFacilities}
        equipment={availableEquipment}
        equipmentOnly={role === "cdmo"}
      />
    );
  }
  if (page === "organizations")
    return (
      <Organizations
        organizations={organizations}
        setOrganizations={setOrganizations}
      />
    );
  if (page === "equipment")
    return (
      <>
        <Header
          eyebrow="ADMINISTRATION / INVENTORY"
          title="Equipment inventory"
          sub="Check quantities and condition before confirming a setup."
        />
        <Panel title="Current inventory">
          <div className="filter-row">
            <input
              className="search"
              placeholder="Search equipment"
              value={equipmentQuery}
              onChange={(e) => setEquipmentQuery(e.target.value)}
            />
            <span className="filter-note">
              {availableEquipment.filter((item) => item.name.toLowerCase().includes(equipmentQuery.toLowerCase())).length} items
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {availableEquipment.filter((e) => e.name.toLowerCase().includes(equipmentQuery.toLowerCase())).map((e) => (
                  <tr key={e.name}>
                    <td>
                      <b>{e.name}</b>
                    </td>
                    <td>{e.category}</td>
                    <td>
                      {e.available} / {e.total}
                    </td>
                    <td>{e.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  if (page === "profile") return <Profile role={role} user={user} />;
  if (page === "requests" || page === "history" || page === "bookings") {
    const queue =
      role === "faculty"
        ? page === "history"
          ? bookings.filter((b) =>
              [
                "Dean review",
                "Final admin review",
                "CDMO review",
                "Admin review",
                "Approved",
                "Prepared",
              ].includes(b.status),
            )
          : bookings.filter((b) => b.status === "Faculty review")
        : role === "dean"
          ? page === "history"
            ? bookings.filter((b) => ["CDMO review", "Final admin review", "Approved", "Prepared"].includes(b.status))
            : bookings.filter((b) => b.status === "Dean review")
        : role === "cdmo"
          ? page === "history"
            ? bookings.filter((b) => ["Final admin review", "Approved", "Rejected"].includes(b.status))
            : bookings.filter((b) => b.status === "CDMO review")
          : role === "admin"
            ? page === "bookings"
              ? bookings.filter((b) => ["Approved", "Prepared"].includes(b.status))
              : page === "history"
                ? bookings
                : bookings.filter((b) => ["Admin review", "Final admin review"].includes(b.status))
              : page === "bookings"
                ? bookings.filter((b) => ["Approved", "Prepared"].includes(b.status))
                : bookings;
    const title =
      role === "faculty"
        ? page === "history"
          ? "Approved request history"
          : "Faculty event review"
        : role === "dean"
          ? page === "history" ? "Approval history" : "Dean approval"
        : role === "cdmo"
          ? page === "history"
            ? "CDMO review history"
            : "CDMO review"
          : role === "admin"
            ? page === "bookings"
              ? "Approved and upcoming bookings"
              : "Admin review and confirmation"
          : page === "bookings"
            ? "Approved and upcoming bookings"
            : "Booking records";
    const readOnly = page === "history" || page === "bookings";
    return (
      <>
        <Header
          eyebrow={`${roleInfo[role].label.toUpperCase()} / WORK QUEUE`}
          title={title}
          sub={
            role === "faculty"
              ? "History shows requests that passed faculty review."
              : role === "dean"
                ? page === "history" ? "View approval history." : "Approve department-level requests before CDMO review."
              : role === "cdmo"
                ? "Review requests after dean approval."
                : page === "bookings"
                  ? "Approved bookings that are upcoming or currently in progress."
                  : "Complete management records and history."
          }
        />
        <Panel title={page === "history" ? "Records" : "Assigned work queue"}>
          <BookingList data={queue} onSelect={setSelected} />
        </Panel>
        {selected && (
          <Review
            booking={selected}
            role={role}
            readOnly={readOnly || (role === "admin" && !["Admin review", "Final admin review"].includes(selected.status))}
            onClose={() => setSelected(null)}
            onUpdate={async (status, remarks) => {
              setActionError("");
              if (!user?.userId) {
                setActionError("Your reviewer session has expired. Please sign in again.");
                return;
              }
              try {
                const response = await fetch(
                  `${apiBase}/api/bookings/${selected.id}/status`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status, userId: user.userId, remarks }),
                  },
                );
                if (!response.ok) {
                  const result = await response.json().catch(() => ({}));
                  setActionError(result.error ?? "Unable to update this booking.");
                  return;
                }
                setBookings(
                  bookings.map((b) =>
                    b.id === selected.id
                      ? { ...b, status, rejectionReason: status === "Rejected" ? remarks : undefined }
                      : b,
                  ),
                );
                setSelected(null);
              } catch {
                setActionError("Unable to reach the booking service. Try again.");
              }
            }}
          />
        )}
        {actionError && <div className="notice error">{actionError}</div>}
      </>
    );
  }
  return (
    <Dashboard
      role={role}
      user={user}
      bookings={bookings}
      facilities={availableFacilities}
      onAction={setPage}
    />
  );
}
function Review({
  booking,
  role,
  readOnly = false,
  onClose,
  onUpdate,
}: {
  booking: Booking;
  role: Role;
  readOnly?: boolean;
  onClose: () => void;
  onUpdate: (s: Status, remarks?: string) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const nextStatus =
    role === "faculty"
      ? "Dean review"
      : role === "dean"
        ? "CDMO review"
      : role === "admin"
        ? booking.status === "Final admin review" ? "Approved" : "CDMO review"
        : role === "cdmo"
          ? "Final admin review"
          : "Approved";
  const approveLabel =
    role === "faculty"
      ? "Send to Dean"
      : role === "dean"
        ? "Send to CDMO"
      : role === "admin"
        ? booking.status === "Final admin review" ? "Confirm final booking" : "Send to CDMO"
        : role === "cdmo"
          ? "Send to final Admin"
          : "Confirm final booking";
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">
          {booking.id} · {roleInfo[role].label}
        </span>
        <h2>{booking.event}</h2>
        <p className="muted">
          {booking.org} · {booking.venue} · {booking.date}
        </p>
        <div className="review-grid">
          <div>
            <span>Date & time</span>
            <b>
              {booking.date}
              <br />
              {booking.time}
            </b>
          </div>
          <div>
            <span>Participants</span>
            <b>{booking.people} people</b>
          </div>
          <div>
            <span>Purpose</span>
            <b>{booking.purpose}</b>
          </div>
          <div>
            <span>Current status</span>
            <Status value={booking.status} />
          </div>
          {booking.equipment.length > 0 && (
            <div>
              <span>Equipment requested</span>
              <b>{booking.equipment.map((item) => typeof item === "string"
                ? item
                : `${item.quantity} × equipment #${item.equipmentId}`).join(", ")}</b>
            </div>
          )}
          {booking.rejectionReason && (
            <div>
              <span>Rejection reason</span>
              <b>{booking.rejectionReason}</b>
            </div>
          )}
          {booking.documents?.map((document) => (
            <div key={document.name}>
              <span>Attached file</span>
              <a href={document.data} download={document.name} target="_blank" rel="noreferrer">
                {document.name}
              </a>
            </div>
          ))}
        </div>
        {booking.status === "Approved" && (
          <div className="form-actions">
            <Button secondary onClick={() => printApprovedBooking(booking)}>Export approved PDF</Button>
          </div>
        )}
        {!readOnly && (
          <>
            <textarea
              placeholder="Add remarks for the organization..."
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
            <div className="form-actions">
              <Button secondary onClick={() => onUpdate("Rejected", remarks.trim() || "No reason provided")}>
                Reject
              </Button>
              <Button onClick={() => onUpdate(nextStatus, remarks.trim())}>
                {approveLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function Organizations({
  organizations,
  setOrganizations,
}: {
  organizations: Organization[];
  setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
}) {
  const [editing, setEditing] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [facultyAdviser, setFacultyAdviser] = useState("Prof. Maria Santos");
  const [message, setMessage] = useState("");
  const startCreate = () => {
    setEditing({
      id: 0,
      name: "",
      email: "",
      password: "",
      facultyAdviser: "Prof. Maria Santos",
      status: "Active",
    });
    setName("");
    setEmail("");
    setPassword("");
    setMessage("");
  };
  const startEdit = (organization: Organization) => {
    setEditing(organization);
    setName(organization.name);
    setEmail(organization.email);
    setPassword(organization.password);
    setFacultyAdviser(organization.facultyAdviser);
    setMessage("");
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || (editing?.id === 0 && !password.trim())) {
      setMessage(editing?.id ? "Organization name and email are required." : "Complete all organization fields.");
      return;
    }
    if (editing?.id) {
      const response = await fetch(`${apiBase}/api/organizations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: editing.id,
          facultyAdviser,
          password: password.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setMessage(result.error ?? "Unable to update the faculty adviser.");
        return;
      }
      setOrganizations(
        organizations.map((item) =>
          item.id === editing.id ? { ...item, facultyAdviser } : item,
        ),
      );
    } else {
      const response = await fetch(`${apiBase}/api/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, facultyAdviser }),
      });
      if (!response.ok) {
        setMessage("Unable to create the organization account.");
        return;
      }
      const created = await response.json();
      setOrganizations([
        ...organizations,
        {
          id: Number(created.org_id),
          name: String(created.org_name),
          email: String(created.contact_email),
          password: "",
          facultyAdviser,
          status: "Active",
        },
      ]);
    }
    setEditing(null);
    setMessage(`${name} is now available as an organization account.`);
  };
  return (
    <>
      <Header
        eyebrow="ADMINISTRATION / ORGANIZATIONS"
        title="Organization directory"
        sub="Manage separate organization accounts that can submit and track booking requests."
        action={<Button onClick={startCreate}>＋ Add organization</Button>}
      />
      {message && <div className="notice success">{message}</div>}
      {editing && (
        <div className="modal-backdrop">
          <form className="modal org-modal" onSubmit={save}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setEditing(null)}
            >
              ×
            </button>
            <span className="eyebrow">
              {editing.id ? "EDIT ORGANIZATION" : "NEW ORGANIZATION"}
            </span>
            <h2>
              {editing.id
                ? "Update organization account"
                : "Add organization account"}
            </h2>
            <p className="muted">
              Create the credentials the organization will use to access
              Resource Hub.
            </p>
            <Field
              label="Organization name"
              type="text"
              value={name}
              onChange={setName}
              placeholder="e.g. Engineering Student Council"
            />
            <Field
              label="Organization email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="organization@mapua.edu.ph"
            />
            <Field
              label="Account password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Temporary password"
            />
            <Field
              label="Faculty adviser"
              type="text"
              value={facultyAdviser}
              onChange={setFacultyAdviser}
              placeholder="Prof. Name"
            />
            <div className="form-actions">
              <Button secondary onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Save organization</Button>
            </div>
          </form>
        </div>
      )}
      <Panel title={`${organizations.length} registered organizations`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Faculty adviser</th>
                <th>Contact</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {organizations.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.name}</b>
                    <small>OrgID {item.id}</small>
                  </td>
                  <td>{item.facultyAdviser}</td>
                  <td>{item.email}</td>
                  <td>
                    <Status value={item.status} />
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button table-action"
                      onClick={async () => {
                        const nextStatus = item.status === "Inactive" ? "Active" : "Inactive";
                        const response = await fetch(`${apiBase}/api/organizations`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ orgId: item.id, status: nextStatus }),
                        });
                        if (!response.ok) {
                          const result = await response.json().catch(() => ({}));
                          setMessage(result.error ?? "Unable to update organization status.");
                          return;
                        }
                        setOrganizations((current) => current.map((organization) =>
                          organization.id === item.id ? { ...organization, status: nextStatus } : organization,
                        ));
                        setMessage(`${item.name} is now ${nextStatus.toLowerCase()}.`);
                      }}
                    >
                      {item.status === "Inactive" ? "Activate" : "Deactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
function Management({
  facilities: availableFacilities,
  equipment: availableEquipment,
  equipmentOnly = false,
}: {
  facilities: typeof facilities;
  equipment: typeof equipment;
  equipmentOnly?: boolean;
}) {
  const [tab, setTab] = useState<"facilities" | "equipment" | "availability">(
    equipmentOnly ? "equipment" : "facilities",
  );
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Facility");
  const [message, setMessage] = useState("");
  const [facilityRows, setFacilityRows] = useState(availableFacilities);
  const [equipmentRows, setEquipmentRows] = useState(availableEquipment);
  const [availabilityDate, setAvailabilityDate] = useState(localDateValue());
  const [dateFacilityAvailability, setDateFacilityAvailability] = useState<Record<number, boolean>>({});
  const [dateEquipmentAvailability, setDateEquipmentAvailability] = useState<Record<string, number>>({});
  const [availabilityMonth, setAvailabilityMonth] = useState(availabilityDate.slice(0, 7));
  const [monthFacilityAvailability, setMonthFacilityAvailability] = useState<Record<string, Record<number, boolean>>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [editingResource, setEditingResource] = useState<
    { type: "room"; id: number; name: string; location: string; capacity: number; status: string }
    | { type: "equipment"; id: number; name: string; category: string; quantity: number; status: string }
    | null
  >(null);

  useEffect(() => {
    setFacilityRows(availableFacilities);
    setEquipmentRows(availableEquipment);
  }, [availableFacilities, availableEquipment]);

  useEffect(() => {
    fetch(`/api/resources?date=${encodeURIComponent(availabilityDate)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load availability")))
      .then((resources: {
        rooms: { room_id: number; date_available: boolean }[];
        equipment: { equipment_name: string; date_available: number }[];
      }) => {
        setDateFacilityAvailability(Object.fromEntries(resources.rooms.map((room) => [room.room_id, room.date_available])));
        setDateEquipmentAvailability(Object.fromEntries(resources.equipment.map((item) => [item.equipment_name, item.date_available])));
      })
      .catch(() => setMessage("Unable to refresh date availability."));
  }, [availabilityDate]);
  const monthDates = (() => {
    const [year, month] = availabilityMonth.split("-").map(Number);
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, index) => `${availabilityMonth}-${String(index + 1).padStart(2, "0")}`);
  })();
  useEffect(() => {
    let cancelled = false;
    setAvailabilityLoading(true);
    Promise.all(monthDates.map(async (date) => {
      const response = await fetch(`${apiBase}/api/resources?date=${encodeURIComponent(date)}`);
      if (!response.ok) throw new Error("Unable to load availability");
      const resources: { rooms: { room_id: number; date_available: boolean }[] } = await response.json();
      return [date, Object.fromEntries(resources.rooms.map((room) => [room.room_id, room.date_available]))] as const;
    }))
      .then((results) => {
        if (!cancelled) setMonthFacilityAvailability(Object.fromEntries(results));
      })
      .catch(() => {
        if (!cancelled) setMessage("Unable to load the facility availability calendar.");
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [availabilityMonth]);
  const addResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const response = await fetch(`${apiBase}/api/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: category === "Equipment" || equipmentOnly ? "equipment" : "room", name }),
    });
    if (!response.ok) {
      setMessage((await response.json().catch(() => ({}))).error ?? "Unable to add resource.");
      return;
    }
    const created = await response.json();
    if (category === "Equipment" || equipmentOnly) {
      setEquipmentRows((rows) => [...rows, {
        equipmentId: Number(created.equipment_id),
        name: String(created.equipment_name),
        category: String(created.category),
        available: Number(created.quantity_available),
        total: Number(created.quantity_available),
        condition: String(created.status),
      }]);
    } else {
      setFacilityRows((rows) => [...rows, {
        roomId: Number(created.room_id),
        name: String(created.room_name),
        type: "Campus resource",
        location: String(created.location),
        capacity: Number(created.capacity),
        status: String(created.availability_status),
        detail: `${created.location} venue with capacity for ${created.capacity} people.`,
      }]);
    }
    setMessage(`${name} was added to the ${category.toLowerCase()} registry.`);
    setName("");
    setShowAdd(false);
  };
  const saveResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingResource) return;
    const payload = editingResource.type === "room"
      ? {
          type: "room",
          id: editingResource.id,
          name: editingResource.name.trim(),
          location: editingResource.location.trim(),
          capacity: editingResource.capacity,
          availabilityStatus: editingResource.status,
        }
      : {
          type: "equipment",
          id: editingResource.id,
          name: editingResource.name.trim(),
          category: editingResource.category.trim(),
          quantityAvailable: editingResource.quantity,
          status: editingResource.status,
        };
    const response = await fetch(`${apiBase}/api/resources`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setMessage((await response.json().catch(() => ({}))).error ?? "Unable to save resource.");
      return;
    }
    if (editingResource.type === "room") {
      setFacilityRows((rows) => rows.map((row) => row.roomId === editingResource.id
        ? { ...row, name: editingResource.name, location: editingResource.location, capacity: editingResource.capacity, status: editingResource.status }
        : row));
    } else {
      setEquipmentRows((rows) => rows.map((row) => row.equipmentId === editingResource.id
        ? { ...row, name: editingResource.name, category: editingResource.category, available: editingResource.quantity, total: editingResource.quantity, condition: editingResource.status }
        : row));
    }
    setEditingResource(null);
    setMessage("Resource updated for all users.");
  };
  return (
    <>
      <Header
        eyebrow={equipmentOnly ? "CDMO / EQUIPMENT" : "ADMINISTRATION / RESOURCES"}
        title={equipmentOnly ? "Manage equipment" : "Manage campus resources"}
        sub={equipmentOnly ? "Add, edit, and check equipment availability for every setup." : "Keep facility and equipment information accurate for every requester."}
        action={
          <Button onClick={() => setShowAdd(true)}>＋ Add {equipmentOnly ? "equipment" : "resource"}</Button>
        }
      />
      {message && <div className="notice success">{message}</div>}
      <div className="tabs">
        {!equipmentOnly && <button
          className={tab === "facilities" ? "selected" : ""}
          onClick={() => setTab("facilities")}
        >
          Facilities <b>{facilityRows.length}</b>
        </button>}
        <button
          className={tab === "equipment" ? "selected" : ""}
          onClick={() => setTab("equipment")}
        >
          Equipment <b>{equipmentRows.length}</b>
        </button>
        {!equipmentOnly && <button
          className={tab === "availability" ? "selected" : ""}
          onClick={() => setTab("availability")}
        >
          Availability
        </button>}
      </div>
      {tab === "facilities" && (
        <Panel title="Facilities">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {facilityRows.map((f) => (
                  <tr key={f.name}>
                    <td>
                      <b>{f.name}</b>
                      <small>{f.location}</small>
                    </td>
                    <td>{f.type}</td>
                    <td>{f.capacity || "—"}</td>
                    <td>
                      {(() => {
                        const facilityAvailable = dateFacilityAvailability[f.roomId] ?? (f.status === "Available");
                        return <Status value={facilityAvailable ? "Available" : "Unavailable"} />;
                      })()}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setEditingResource({
                          type: "room",
                          id: f.roomId,
                          name: f.name,
                          location: f.location,
                          capacity: f.capacity,
                          status: f.status,
                        })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {tab === "equipment" && (
        <Panel
          title="Equipment inventory"
          action={
            <label className="panel-date-filter">
              <span>Availability date</span>
              <input className="date-input" type="date" value={availabilityDate} onChange={(event) => setAvailabilityDate(event.target.value)} />
            </label>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Condition</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {equipmentRows.map((item) => (
                  <tr key={item.name}>
                    <td>
                      <b>{item.name}</b>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      {dateEquipmentAvailability[item.name] ?? item.available} / {item.total}
                    </td>
                    <td>{item.condition}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setEditingResource({
                          type: "equipment",
                          id: item.equipmentId,
                          name: item.name,
                          category: item.category,
                          quantity: item.total,
                          status: item.condition,
                        })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {tab === "availability" && (
        <Panel title="Availability management">
          <div className="availability-calendar-header">
            <button className="text-button" onClick={() => {
              const [year, month] = availabilityMonth.split("-").map(Number);
              const previous = new Date(year, month - 2, 1);
              setAvailabilityMonth(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`);
            }}>← Previous month</button>
            <strong>{new Date(`${availabilityMonth}-02T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
            <button className="text-button" onClick={() => {
              const [year, month] = availabilityMonth.split("-").map(Number);
              const next = new Date(year, month, 1);
              setAvailabilityMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
            }}>Next month →</button>
          </div>
          <div className="availability-calendar-wrap">
            <table className="availability-calendar">
              <thead>
                <tr>
                  <th>Facility</th>
                  {monthDates.map((date) => <th key={date}>{Number(date.slice(-2))}</th>)}
                </tr>
              </thead>
              <tbody>
                {facilityRows.map((facility) => (
                  <tr key={facility.roomId}>
                    <th>
                      <b>{facility.name}</b>
                      <small>{facility.location}</small>
                    </th>
                    {monthDates.map((date) => {
                      const isAvailable = monthFacilityAvailability[date]?.[facility.roomId] ?? facility.status === "Available";
                      return <td key={date} className={isAvailable ? "date-available" : "date-unavailable"} title={`${facility.name}: ${isAvailable ? "Available" : "Not available"} on ${date}`}><span>{isAvailable ? "Available" : "Unavailable"}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="availability-legend"><span className="date-available">Available</span><span className="date-unavailable">Not available</span>{availabilityLoading && <span className="muted">Refreshing dates…</span>}</p>
          <div className="availability-list">
            {facilityRows.map((f) => (
              <div key={f.name}>
                <span>
                  <b>{f.name}</b>
                  <small>{f.location}</small>
                </span>
                <button
                  className={`availability-toggle ${(dateFacilityAvailability[f.roomId] ?? f.status === "Available") ? "on" : ""}`}
                  onClick={async () => {
                    const nextStatus = f.status === "Available" ? "Unavailable" : "Available";
                    const response = await fetch(`${apiBase}/api/resources`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "room", id: f.roomId, availabilityStatus: nextStatus }),
                    });
                    if (!response.ok) {
                      setMessage("Unable to update facility availability.");
                      return;
                    }
                    setFacilityRows((rows) => rows.map((item) => item.roomId === f.roomId ? { ...item, status: nextStatus } : item));
                    setMessage(`${f.name} is now ${nextStatus.toLowerCase()} for all users.`);
                  }}
                >
                  {dateFacilityAvailability[f.roomId] === false ? "Taken" : f.status}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {showAdd && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={addResource}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowAdd(false)}
            >
              ×
            </button>
            <span className="eyebrow">NEW RESOURCE</span>
            <h2>Add a resource</h2>
            <p className="muted">
              Add a {equipmentOnly ? "equipment" : "facility or equipment"} record to the shared registry.
            </p>
            <Field
              label="Resource name"
              type="text"
              value={name}
              onChange={setName}
              placeholder="e.g. Seminar Room B"
            />
            {!equipmentOnly && <div className="field">
              <label>Resource type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Facility</option>
                <option>Equipment</option>
              </select>
            </div>}
            <div className="form-actions">
              <Button secondary onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit">Add resource</Button>
            </div>
          </form>
        </div>
      )}
      {editingResource && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={saveResource}>
            <button type="button" className="modal-close" onClick={() => setEditingResource(null)}>×</button>
            <span className="eyebrow">EDIT RESOURCE</span>
            <h2>Update {editingResource.type === "room" ? "facility" : "equipment"}</h2>
            <Field label="Name" type="text" value={editingResource.name} onChange={(value) => setEditingResource({ ...editingResource, name: value })} placeholder="Resource name" />
            {editingResource.type === "room" ? (
              <>
                <Field label="Location" type="text" value={editingResource.location} onChange={(value) => setEditingResource({ ...editingResource, location: value })} placeholder="Location" />
                <Field label="Capacity" type="number" value={String(editingResource.capacity)} onChange={(value) => setEditingResource({ ...editingResource, capacity: Number(value) })} placeholder="Capacity" />
                <div className="field"><label>Status</label><select value={editingResource.status} onChange={(event) => setEditingResource({ ...editingResource, status: event.target.value })}><option>Available</option><option>Unavailable</option></select></div>
              </>
            ) : (
              <>
                <Field label="Category" type="text" value={editingResource.category} onChange={(value) => setEditingResource({ ...editingResource, category: value })} placeholder="Category" />
                <Field label="Total quantity" type="number" value={String(editingResource.quantity)} onChange={(value) => setEditingResource({ ...editingResource, quantity: Number(value) })} placeholder="Quantity" />
                <div className="field"><label>Status</label><select value={editingResource.status} onChange={(event) => setEditingResource({ ...editingResource, status: event.target.value })}><option>Available</option><option>Unavailable</option><option>Maintenance</option></select></div>
              </>
            )}
            <div className="form-actions"><Button secondary onClick={() => setEditingResource(null)}>Cancel</Button><Button type="submit">Save changes</Button></div>
          </form>
        </div>
      )}
    </>
  );
}
function Profile({ role, user }: { role: Role; user?: UserSession }) {
  const info = roleInfo[role];
  const displayName = user?.name ?? info.name;
  const displayInitials = user?.name
    ? user.name
        .replace(/^(Prof\. |Dr\. )/, "")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : info.initials;
  const [message, setMessage] = useState("");
  return (
    <>
      <Header
        eyebrow="ACCOUNT"
        title="Your profile"
        sub="Account information connected to your Mapúa University identity."
      />
      {message && <div className="notice success">{message}</div>}
      <div className="profile-card">
        <span className="big-avatar">{displayInitials}</span>
        <div>
          <h2>{displayName}</h2>
          <p className="muted">
            {roleInfo[role].label} ·{" "}
            {user?.email ?? (role === "organization" ? "ssc@mapua.edu.ph" : `${role}@mapua.edu.ph`)}
          </p>
        </div>
        <Button
          secondary
          onClick={() =>
            setMessage("Your profile update request has been recorded.")
          }
        >
          Update details
        </Button>
        <dl>
          <div>
            <dt>Campus</dt>
            <dd>Mapúa University – Makati</dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd className="good-text">Active</dd>
          </div>
          <div>
            <dt>Last sign in</dt>
            <dd>Today, 8:42 AM</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
export default function App() {
  const [storedSession] = useState<StoredSession | null>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(sessionStorageKey) ?? "null") as StoredSession | null;
      if (!parsed || !["organization", "faculty", "admin", "cdmo"].includes(parsed.role)) return null;
      return parsed;
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState<Role | null>(storedSession?.role ?? null);
  const [user, setUser] = useState<UserSession | undefined>(storedSession?.user);
  const [page, setPage] = useState<Page>("dashboard");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [liveFacilities, setLiveFacilities] = useState<typeof facilities>([]);
  const [liveEquipment, setLiveEquipment] = useState<typeof equipment>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState(storedSession?.organizationId ?? 1);
  const saveSession = (nextRole: Role, nextUser: UserSession | undefined, organizationId: number) => {
    setRole(nextRole);
    setUser(nextUser);
    setActiveOrganizationId(organizationId);
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify({
        role: nextRole,
        user: nextUser,
        organizationId,
      } satisfies StoredSession));
    } catch {}
  };
  useEffect(() => {
    Promise.all([
      user
        ? fetch(
            `${apiBase}/api/bookings?role=${user.role}&userId=${user.userId}`,
          )
        : Promise.resolve(null),
      fetch(`${apiBase}/api/resources`),
    ])
      .then(async ([bookingsResponse, resourcesResponse]) => {
        if (bookingsResponse && !bookingsResponse.ok || !resourcesResponse.ok) {
          throw new Error("Unable to load application data");
        }
        return {
          bookings: bookingsResponse
            ? (await bookingsResponse.json()) as Record<string, string | number>[]
            : [],
          resources: (await resourcesResponse.json()) as {
            rooms: Record<string, string | number>[];
            equipment: Record<string, string | number>[];
            organizations: Record<string, string | number | null>[];
          },
        };
      })
      .then(({ bookings: rows, resources }) => {
        setBookings(rows.map(mapBooking));
        setLiveFacilities(
          resources.rooms.map((room) => ({
            roomId: Number(room.room_id),
            name: String(room.room_name),
            type: "Campus venue",
            location: String(room.location),
            capacity: Number(room.capacity),
            status: String(room.availability_status),
            detail: `${room.location} venue with capacity for ${room.capacity} people.`,
          })),
        );
        setOrganizations(
          resources.organizations.map((organization) => ({
            id: Number(organization.org_id),
            name: String(organization.org_name),
            email: String(organization.contact_email),
            password: "",
            facultyAdviser: String(organization.faculty_adviser ?? "Unassigned"),
            status: String(organization.status) as Organization["status"],
          })),
        );
        setLiveEquipment(
          resources.equipment.map((item) => ({
            equipmentId: Number(item.equipment_id),
            name: String(item.equipment_name),
            category: String(item.category),
            available: Number(item.quantity_available),
            total: Number(item.quantity_available),
            condition: String(item.status),
          })),
        );
      })
      .catch(() => {
        setBookings([]);
        setLiveFacilities([]);
        setLiveEquipment([]);
        setOrganizations([]);
      });
  }, [user?.role, user?.userId]);
  useEffect(() => {
    if (!user) return;
    const refreshBookings = () => {
      fetch(`${apiBase}/api/bookings?role=${user.role}&userId=${user.userId}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to refresh bookings")))
        .then((rows: Record<string, string | number>[]) => setBookings(rows.map(mapBooking)))
        .catch(() => undefined);
    };
    const interval = window.setInterval(refreshBookings, 5000);
    return () => window.clearInterval(interval);
  }, [user?.role, user?.userId]);
  useEffect(() => {
    const refreshResources = () => {
      fetch(`${apiBase}/api/resources`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to refresh resources")))
        .then((resources: {
          rooms: Record<string, string | number>[];
          equipment: Record<string, string | number>[];
          organizations: Record<string, string | number | null>[];
        }) => {
          setLiveFacilities(resources.rooms.map((room) => ({
            roomId: Number(room.room_id),
            name: String(room.room_name),
            type: "Campus venue",
            location: String(room.location),
            capacity: Number(room.capacity),
            status: String(room.availability_status),
            detail: `${room.location} venue with capacity for ${room.capacity} people.`,
          })));
          setLiveEquipment(resources.equipment.map((item) => ({
            equipmentId: Number(item.equipment_id),
            name: String(item.equipment_name),
            category: String(item.category),
            available: Number(item.quantity_available),
            total: Number(item.quantity_available),
            condition: String(item.status),
          })));
          setOrganizations(resources.organizations.map((organization) => ({
            id: Number(organization.org_id),
            name: String(organization.org_name),
            email: String(organization.contact_email),
            password: "",
            facultyAdviser: String(organization.faculty_adviser ?? "Unassigned"),
            status: String(organization.status) as Organization["status"],
          })));
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(refreshResources, 5000);
    return () => window.clearInterval(interval);
  }, []);
  if (!role)
    return (
      <Auth
        organizations={organizations}
        onLogin={(nextRole, organizationId, nextUser) => {
          saveSession(nextRole, nextUser, organizationId ?? 1);
          setPage("dashboard");
        }}
      />
    );
  return (
    <Shell
      role={role}
      user={user}
      organizationName={
        role === "organization"
          ? organizations.find((item) => item.id === activeOrganizationId)?.name
          : undefined
      }
      page={page}
      setPage={setPage}
      onLogout={() => {
        localStorage.removeItem(sessionStorageKey);
        setRole(null);
        setUser(undefined);
      }}
    >
      {role === "organization" ? (
        <StudentView
          user={user}
          page={page}
          setPage={setPage}
          bookings={bookings}
          setBookings={setBookings}
          facilities={liveFacilities}
          equipment={liveEquipment}
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
        />
      ) : (
        <StaffView
          role={role}
          user={user}
          page={page}
          setPage={setPage}
          bookings={bookings}
          setBookings={setBookings}
          facilities={liveFacilities}
          equipment={liveEquipment}
          organizations={organizations}
          setOrganizations={setOrganizations}
        />
      )}
    </Shell>
  );
}