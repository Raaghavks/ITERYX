export const PILOT_DEMO_STEPS = [
  {
    title: "Register a mild OPD case",
    summary: "Use the intake desk to add a low-acuity fever patient and confirm they settle low in the queue.",
    href: "/opd/register",
  },
  {
    title: "Register a critical respiratory case",
    summary: "Add a low SpO2 patient and watch the queue reprioritize in real time for the doctor.",
    href: "/opd/register",
  },
  {
    title: "Reserve and confirm admission",
    summary: "Move the critical patient from consultation into a reserved bed and confirm the admission.",
    href: "/doctor/queue",
  },
  {
    title: "Verify bed map and admin KPIs",
    summary: "Confirm occupancy, ward state, and live operational cards update without manual refresh.",
    href: "/admin/dashboard",
  },
];

export const PILOT_OPERATIONAL_RULES = [
  "Critical patients should be called into consultation before lower-acuity cases even if they arrived later.",
  "ICU or high-dependency beds should only be reserved for clinically appropriate patients or explicit pilot scenarios.",
  "If a prediction falls back to safety logic, staff should continue the workflow using clinical judgment instead of waiting on ML output.",
  "Pending discharges should be confirmed during the pilot so bed-release timing stays realistic for the next allocation.",
];

export const PILOT_SUCCESS_CRITERIA = [
  "A critical patient reaches the top of the doctor queue automatically.",
  "A bed can be reserved and then converted into an active admission without manual database edits.",
  "Admin staff can see occupancy, discharge, and emergency signals from one place during the demo.",
  "Every screen still supports an operational fallback if realtime or model confidence is degraded.",
];
