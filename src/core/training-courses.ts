import type { CourseCategory, TrainingCourse } from "@/lib/types";

export type CourseTemplate = Omit<TrainingCourse, "id" | "createdAt" | "updatedAt" | "companyId">;

/** Display order of course groups on the Training page. */
export const COURSE_GROUPS: { category: CourseCategory; label: string; hint: string }[] = [
  { category: "Basic", label: "A. Basic", hint: "For every worker" },
  { category: "Process Sites", label: "B. Petroleum / Petrochemical / Process sites", hint: "Jurong Island and process plants" },
  { category: "Lifting", label: "C. Lifting work", hint: "Lifting crew and supervisors" },
  { category: "Scaffolding", label: "D. Scaffolding", hint: "Erectors, supervisors and inspectors" },
  { category: "Trade Skills", label: "E. Trade skills", hint: "Raise skill level and salary" },
  { category: "Supervisor", label: "F. Supervisor level", hint: "Supervisors and coordinators" },
  { category: "Statutory", label: "Statutory", hint: "" },
  { category: "Safety", label: "Safety", hint: "" },
  { category: "Skill", label: "Skill", hint: "" },
  { category: "Induction", label: "Induction", hint: "" },
  { category: "Other", label: "Other", hint: "" },
];

const c = (code: string, name: string, category: CourseCategory, mandatory = false): CourseTemplate => ({
  code, name, category, mandatory, cost: 0,
});

/** Singapore course list supplied by the company. Validity is left blank: enter expiry per certificate. */
export const SINGAPORE_COURSES: CourseTemplate[] = [
  c("CSOC", "Construction Safety Orientation Course (CSOC)", "Basic", true),
  c("WAH", "Working at Height (WAH)", "Basic", true),
  c("FA-CPR", "First Aid + CPR/AED", "Basic"),
  c("FIRE", "Fire Safety / Fire Fighting", "Basic"),
  c("CORETRADE", "CoreTrade (SEC-K) skills test, R1 to R2", "Basic"),
  c("PSOC", "Process sector Safety Orientation (Jurong Island)", "Process Sites"),
  c("CONFINED", "Confined Space (Entrant, Standby Person, Gas Tester)", "Process Sites"),
  c("PTW", "Permit-to-Work (PTW) awareness", "Process Sites"),
  c("HOTWORK", "Hot Work Safety / Fire Watchman", "Process Sites"),
  c("H2S", "H2S awareness", "Process Sites"),
  c("BA", "Breathing Apparatus (BA/SCBA)", "Process Sites"),
  c("GAS", "Gas Detector / Gas Testing", "Process Sites"),
  c("RIGGER", "Rigger", "Lifting"),
  c("SIGNAL", "Signalman", "Lifting"),
  c("LIFT-SUP", "Lifting Supervisor", "Lifting"),
  c("AP", "Appointed Person", "Lifting"),
  c("SCAF-ERECT", "Scaffold Erector (Basic Scaffolder)", "Scaffolding"),
  c("SCAF-SUP", "Scaffolding Supervisor", "Scaffolding"),
  c("SCAF-INSP", "Scaffolding Inspector", "Scaffolding"),
  c("WELD", "Welding (basic, 3G/6G, pipe welding)", "Trade Skills"),
  c("PIPE", "Pipe Fitter / Fabricator", "Trade Skills"),
  c("ELEC", "Electrician", "Trade Skills"),
  c("PAINT", "Painting / Abrasive Blasting / Coating", "Trade Skills"),
  c("FORKLIFT", "Forklift", "Trade Skills"),
  c("CRANE", "Mobile Crane / Tower Crane", "Trade Skills"),
  c("MEWP", "MEWP / Scissor Lift", "Trade Skills"),
  c("EXCAVATOR", "Excavator / Heavy Equipment", "Trade Skills"),
  c("CON-SUP", "Construction Supervisor", "Supervisor"),
  c("WSHC", "WSH Coordinator", "Supervisor"),
  c("SAFETY-COORD", "Safety Coordinator", "Supervisor"),
];

/** Courses from the list whose code is not already registered. */
export function missingCourses(existingCodes: (string | undefined)[]): CourseTemplate[] {
  const have = new Set(existingCodes.map((x) => (x ?? "").trim().toUpperCase()));
  return SINGAPORE_COURSES.filter((t) => !have.has((t.code ?? "").toUpperCase()));
}
