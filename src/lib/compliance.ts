import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Compliance check for deployment readiness.
 * Checks for mandatory safety course expiry.
 */
export async function checkDeploymentCompliance(employeeId: string) {
  const { data: certs, error } = await supabase
    .from("employee_certifications")
    .select("*")
    .eq("employee_id", employeeId);

  if (error) {
    console.error("Error checking compliance:", error);
    return { compliant: false, error: "Unable to verify safety compliance." };
  }

  // Define mandatory safety courses (e.g., CSOC, SCOS)
  const mandatoryCourses = ["CSOC", "Construction Safety Orientation Course", "SCOS"];
  
  const missingOrExpired = mandatoryCourses.filter(courseName => {
    const cert = certs.find(c => c.course_name.toLowerCase().includes(courseName.toLowerCase()));
    if (!cert) return true;
    if (cert.expiry_date && new Date(cert.expiry_date) < new Date()) return true;
    return false;
  });

  return {
    compliant: missingOrExpired.length === 0,
    missingOrExpired
  };
}
