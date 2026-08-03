import { 
  getVehicles, addVehicle, getTrips, addTrip, 
  getEmployees, getSites, getCompanies
} from "./store";
import type { Employee, Site } from "./types";

/**
 * Seeds demo transport data (vehicles and trips) for BSM, VRL, and Pluto.
 * This is a frontend utility to populate the Fleet Management module with realistic data.
 */
export function seedTransportDemoData() {
  const currentVehicles = getVehicles();
  const currentTrips = getTrips();
  const employees = getEmployees();
  const sites = getSites();
  const companies = getCompanies();
  
  if (currentVehicles.length > 5 && currentTrips.length > 10) {
    console.log("Transport data already exists, skipping seed.");
    return;
  }

  const bsm = companies.find(c => c.code === 'BSM') || companies[0];
  const vrl = companies.find(c => c.code === 'VRL') || companies[1] || bsm;
  const pluto = companies.find(c => c.code === 'PLT') || companies[2] || bsm;

  // Filter drivers based on trade or workerCategory
  const drivers = employees.filter(e => 
    (e.trade || "").toLowerCase().includes("driver") || 
    (e.workerCategory === "Driver")
  );
  
  const bsmDriver = drivers.find(e => e.companyId === bsm?.id) || drivers[0];
  const vrlDriver = drivers.find(e => e.companyId === vrl?.id) || drivers[1] || bsmDriver;
  const plutoDriver = drivers.find(e => e.companyId === pluto?.id) || drivers[2] || bsmDriver;

  // Filter sites - Site interface uses projectId, not companyId directly in types,
  // but many sites are usually linked via projects. We'll just take the first few sites available.
  const bsmSite = sites[0];
  const vrlSite = sites[1] || bsmSite;

  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const futureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return isoDate(d);
  };

  const demoVehicles = [
    { plateNo: 'GBB 1234 A', type: 'Lorry', makeModel: 'Isuzu NPR', capacity: 15, companyId: bsm?.id, status: 'Active', roadTaxExpiry: futureDate(30), insuranceExpiry: futureDate(120), inspectionDue: futureDate(60) },
    { plateNo: 'GBC 5678 B', type: 'Lorry', makeModel: 'Mitsubishi Fuso', capacity: 15, companyId: bsm?.id, status: 'Active', roadTaxExpiry: futureDate(45), insuranceExpiry: futureDate(180), inspectionDue: futureDate(90) },
    { plateNo: 'PH 1122 D', type: 'Bus', makeModel: 'Scania', capacity: 45, companyId: vrl?.id, status: 'Active', roadTaxExpiry: futureDate(90), insuranceExpiry: futureDate(200), inspectionDue: futureDate(30) },
    { plateNo: 'GBA 8822 F', type: 'Van', makeModel: 'Toyota Hiace', capacity: 10, companyId: vrl?.id, status: 'Active', roadTaxExpiry: futureDate(5), insuranceExpiry: futureDate(30), inspectionDue: futureDate(10) },
    { plateNo: 'PL 5566 G', type: 'Pickup', makeModel: 'Toyota Hilux', capacity: 5, companyId: pluto?.id, status: 'Active', roadTaxExpiry: futureDate(120), insuranceExpiry: futureDate(240), inspectionDue: futureDate(180) },
  ];

  const vehicleIds: string[] = [];
  demoVehicles.forEach(v => {
    const existing = currentVehicles.find(x => x.plateNo === v.plateNo);
    if (!existing) {
      const added = addVehicle(v as any);
      vehicleIds.push(added.id);
    } else {
      vehicleIds.push(existing.id);
    }
  });

  // Seed trips for the last 3 days and today
  for (let i = 0; i < 4; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = isoDate(date);
    
    // BSM Lorry Trip
    if (vehicleIds[0]) {
      addTrip({
        vehicleId: vehicleIds[0],
        driverEmployeeId: bsmDriver?.id || "",
        siteId: bsmSite?.id || "",
        date: dateStr,
        departureTime: "07:30",
        returnTime: "18:30",
        route: "Jurong Dorm → " + (bsmSite?.name || "Project Site A"),
        passengers: 12,
        status: i === 0 ? "Scheduled" : "Completed",
      });
    }

    // VRL Bus Trip
    if (vehicleIds[2]) {
      addTrip({
        vehicleId: vehicleIds[2],
        driverEmployeeId: vrlDriver?.id || "",
        siteId: vrlSite?.id || "",
        date: dateStr,
        departureTime: "07:00",
        returnTime: "19:00",
        route: "Tampines Dorm → " + (vrlSite?.name || "Project Site B"),
        passengers: 40,
        status: i === 0 ? "Scheduled" : "Completed",
      });
    }
  }

  console.log("Seeded transport demo data successfully.");
}
