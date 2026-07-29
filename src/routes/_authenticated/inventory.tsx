import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package, PackagePlus, AlertTriangle, ShoppingCart, Plus, Search, Trash2, Download, Check } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getInventory, getMovements, getPurchaseOrders, getSites, getEmployees, getCurrentCompany,
  addInventoryItem, deleteInventoryItem, addStockMovement, deleteStockMovement,
  addPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder,
  stockOnHand, lowStockItems, inventoryValue,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { InventoryItem, StockMovement, PurchaseOrder } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Procurement — BSM Workforce & Operations" },
      { name: "description", content: "Store items, stock in/out movements, reorder alerts and purchase orders." },
      { property: "og:title", content: "Inventory & Procurement — BSM Workforce & Operations" },
      { property: "og:description", content: "Store items, stock in/out movements, reorder alerts and purchase orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const categories: InventoryItem["category"][] = ["PPE", "Consumable", "Tool", "Spare Part", "Stationery", "Dormitory", "Other"];
const moveTypes: StockMovement["movementType"][] = ["In", "Out", "Return", "Damaged", "Adjustment"];
const poStatuses: PurchaseOrder["status"][] = ["Draft", "Sent", "Partially Received", "Received", "Cancelled"];

const emptyItem = {
  sku: "", name: "", category: "Consumable" as InventoryItem["category"], unit: "pcs",
  openingQty: 0, reorderLevel: 0, unitCost: 0, location: "", supplier: "", remarks: "",
};

const emptyMove = {
  itemId: "", movementType: "Out" as StockMovement["movementType"], quantity: 1,
  movementDate: today(), siteId: "", employeeId: "", referenceNo: "", remarks: "",
};

const emptyPo = {
  poNo: "", supplier: "", itemId: "", quantity: 1, unitCost: 0,
  orderDate: today(), expectedDate: "", status: "Draft" as PurchaseOrder["status"], remarks: "",
};

export default function InventoryPage() {
  const companyId = getCurrentCompany();
  const [items, setItems] = useState(getInventory());
  const [movements, setMovements] = useState(getMovements());
  const [orders, setOrders] = useState(getPurchaseOrders());
  const [sites] = useState(getSites());
  const [employees] = useState(getEmployees());
  const [search, setSearch] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [moveForm, setMoveForm] = useState(emptyMove);
  const [poForm, setPoForm] = useState(emptyPo);

  function refresh() {
    setItems(getInventory());
    setMovements(getMovements());
    setOrders(getPurchaseOrders());
  }

  const scopedItems = useMemo(
    () => items.filter((i) => !companyId || !i.companyId || i.companyId === companyId),
    [items, companyId],
  );
  const itemIds = new Set(scopedItems.map((i) => i.id));
  const scopedMoves = movements.filter((m) => itemIds.has(m.itemId));
  const scopedOrders = orders.filter((p) => !companyId || !p.companyId || p.companyId === companyId);

  const itemName = (id?: string) => items.find((i) => i.id === id)?.name ?? "—";
  const siteName = (id?: string) => sites.find((s) => s.id === id)?.name ?? "—";
  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? "—";

  const lows = lowStockItems(companyId || undefined);
  const openPos = scopedOrders.filter((p) => p.status !== "Received" && p.status !== "Cancelled");
  const totalValue = inventoryValue(companyId || undefined);

  const q = search.trim().toLowerCase();
  const filteredItems = scopedItems.filter(
    (i) => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || (i.supplier ?? "").toLowerCase().includes(q),
  );
  const filteredMoves = scopedMoves.filter((m) => !q || itemName(m.itemId).toLowerCase().includes(q));
  const filteredOrders = scopedOrders.filter(
    (p) => !q || p.poNo.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q),
  );

  function saveItem() {
    if (!itemForm.name.trim()) return toast.error("Item name required");
    addInventoryItem({
      ...itemForm,
      sku: itemForm.sku.trim() || `ITM-${String(items.length + 1).padStart(4, "0")}`,
      companyId: companyId || undefined,
    });
    setItemForm(emptyItem);
    setItemOpen(false);
    refresh();
    toast.success("Item added");
  }

  function saveMove() {
    if (!moveForm.itemId) return toast.error("Select an item");
    if (!moveForm.quantity) return toast.error("Quantity required");
    if (moveForm.movementType === "Out" && moveForm.quantity > stockOnHand(moveForm.itemId)) {
      return toast.error(`Only ${stockOnHand(moveForm.itemId)} in stock`);
    }
    addStockMovement({
      ...moveForm,
      siteId: moveForm.siteId || undefined,
      employeeId: moveForm.employeeId || undefined,
    });
    setMoveForm(emptyMove);
    setMoveOpen(false);
    refresh();
    toast.success("Stock movement recorded");
  }

  function savePo() {
    if (!poForm.supplier.trim()) return toast.error("Supplier required");
    addPurchaseOrder({
      ...poForm,
      poNo: poForm.poNo.trim() || `PO-${String(orders.length + 1).padStart(4, "0")}`,
      itemId: poForm.itemId || undefined,
      expectedDate: poForm.expectedDate || undefined,
      companyId: companyId || undefined,
    });
    setPoForm(emptyPo);
    setPoOpen(false);
    refresh();
    toast.success("Purchase order created");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory & Procurement</h1>
            <p className="text-sm text-muted-foreground">Store items, stock in/out, reorder alerts and purchase orders.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportRows(
                "inventory",
                filteredItems.map((i) => ({
                  SKU: i.sku, Name: i.name, Category: i.category, Unit: i.unit,
                  OnHand: stockOnHand(i.id), Reorder: i.reorderLevel, UnitCost: i.unitCost,
                  Value: stockOnHand(i.id) * i.unitCost, Location: i.location ?? "", Supplier: i.supplier ?? "",
                })),
              )
            }
          >
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Items" value={String(scopedItems.length)} icon={<Package className="h-4 w-4" />} />
          <SummaryCard title="Stock value" value={`S$${totalValue.toFixed(0)}`} icon={<PackagePlus className="h-4 w-4" />} />
          <SummaryCard title="Low stock" value={String(lows.length)} icon={<AlertTriangle className="h-4 w-4" />} />
          <SummaryCard title="Open POs" value={String(openPos.length)} icon={<ShoppingCart className="h-4 w-4" />} />
        </div>

        {lows.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" /> Reorder needed
            </p>
            <div className="flex flex-wrap gap-2">
              {lows.map(({ item, onHand }) => (
                <span key={item.id} className="rounded-full border bg-card px-3 py-1 text-xs">
                  {item.name} — {onHand} {item.unit} (min {item.reorderLevel})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="po">Purchase Orders</TabsTrigger>
          </TabsList>

          {/* ---------- items ---------- */}
          <TabsContent value="items" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={itemOpen} onOpenChange={setItemOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />New item</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>New inventory item</DialogTitle>
                    <DialogDescription>Register a store item with reorder level and unit cost.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>SKU</Label>
                      <Input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} placeholder="auto" />
                    </div>
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v as InventoryItem["category"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Unit</Label>
                      <Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Opening qty</Label>
                      <Input type="number" value={itemForm.openingQty} onChange={(e) => setItemForm({ ...itemForm, openingQty: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Reorder level</Label>
                      <Input type="number" value={itemForm.reorderLevel} onChange={(e) => setItemForm({ ...itemForm, reorderLevel: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit cost (S$)</Label>
                      <Input type="number" value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Location</Label>
                      <Input value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Supplier</Label>
                      <Input value={itemForm.supplier} onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Remarks</Label>
                      <Textarea value={itemForm.remarks} onChange={(e) => setItemForm({ ...itemForm, remarks: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveItem}>Save item</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <EmptyState className="border-0 bg-transparent" icon={<Package className="h-5 w-5" />} title="No items" description="Add your first store item." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((i) => {
                      const onHand = stockOnHand(i.id);
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                          <TableCell className="font-medium">{i.name}</TableCell>
                          <TableCell>{i.category}</TableCell>
                          <TableCell className="text-right">
                            <span className={onHand <= i.reorderLevel && i.reorderLevel > 0 ? "font-semibold text-destructive" : ""}>
                              {onHand} {i.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{i.reorderLevel}</TableCell>
                          <TableCell className="text-right">S${(onHand * i.unitCost).toFixed(2)}</TableCell>
                          <TableCell>{i.location || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                deleteInventoryItem(i.id);
                                refresh();
                                toast.success("Item deleted");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ---------- movements ---------- */}
          <TabsContent value="movements" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />Record movement</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Stock movement</DialogTitle>
                    <DialogDescription>Issue to site/worker, receive stock or adjust.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Item</Label>
                      <Select value={moveForm.itemId} onValueChange={(v) => setMoveForm({ ...moveForm, itemId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {scopedItems.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name} ({stockOnHand(i.id)} {i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select value={moveForm.movementType} onValueChange={(v) => setMoveForm({ ...moveForm, movementType: v as StockMovement["movementType"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{moveTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Quantity</Label>
                      <Input type="number" value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Date</Label>
                      <Input type="date" value={moveForm.movementDate} onChange={(e) => setMoveForm({ ...moveForm, movementDate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Reference</Label>
                      <Input value={moveForm.referenceNo} onChange={(e) => setMoveForm({ ...moveForm, referenceNo: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Site</Label>
                      <Select value={moveForm.siteId || "none"} onValueChange={(v) => setMoveForm({ ...moveForm, siteId: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Worker</Label>
                      <Select value={moveForm.employeeId || "none"} onValueChange={(v) => setMoveForm({ ...moveForm, employeeId: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {employees.slice(0, 200).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Remarks</Label>
                      <Textarea value={moveForm.remarks} onChange={(e) => setMoveForm({ ...moveForm, remarks: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveMove}>Save movement</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMoves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <EmptyState className="border-0 bg-transparent" icon={<PackagePlus className="h-5 w-5" />} title="No movements" description="Record stock in or out." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMoves.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{m.movementDate}</TableCell>
                        <TableCell className="font-medium">{itemName(m.itemId)}</TableCell>
                        <TableCell><StatusBadge status={m.movementType} /></TableCell>
                        <TableCell className="text-right">{m.quantity}</TableCell>
                        <TableCell>{siteName(m.siteId)}</TableCell>
                        <TableCell>{empName(m.employeeId)}</TableCell>
                        <TableCell className="text-xs">{m.referenceNo || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              deleteStockMovement(m.id);
                              refresh();
                              toast.success("Movement deleted");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ---------- purchase orders ---------- */}
          <TabsContent value="po" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={poOpen} onOpenChange={setPoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />New PO</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>New purchase order</DialogTitle>
                    <DialogDescription>Order stock from a supplier; receiving adds it to inventory.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>PO No</Label>
                      <Input value={poForm.poNo} onChange={(e) => setPoForm({ ...poForm, poNo: e.target.value })} placeholder="auto" />
                    </div>
                    <div className="space-y-1">
                      <Label>Supplier</Label>
                      <Input value={poForm.supplier} onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Item</Label>
                      <Select value={poForm.itemId || "none"} onValueChange={(v) => setPoForm({ ...poForm, itemId: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {scopedItems.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Quantity</Label>
                      <Input type="number" value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit cost (S$)</Label>
                      <Input type="number" value={poForm.unitCost} onChange={(e) => setPoForm({ ...poForm, unitCost: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Order date</Label>
                      <Input type="date" value={poForm.orderDate} onChange={(e) => setPoForm({ ...poForm, orderDate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Expected date</Label>
                      <Input type="date" value={poForm.expectedDate} onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Status</Label>
                      <Select value={poForm.status} onValueChange={(v) => setPoForm({ ...poForm, status: v as PurchaseOrder["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{poStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Remarks</Label>
                      <Textarea value={poForm.remarks} onChange={(e) => setPoForm({ ...poForm, remarks: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={savePo}>Create PO</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO No</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <EmptyState className="border-0 bg-transparent" icon={<ShoppingCart className="h-5 w-5" />} title="No purchase orders" description="Create your first PO." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.poNo}</TableCell>
                        <TableCell className="font-medium">{p.supplier}</TableCell>
                        <TableCell>{itemName(p.itemId)}</TableCell>
                        <TableCell className="text-right">{p.quantity}</TableCell>
                        <TableCell className="text-right">S${(p.quantity * p.unitCost).toFixed(2)}</TableCell>
                        <TableCell>{p.expectedDate || "—"}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.status !== "Received" && p.status !== "Cancelled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Mark received"
                                onClick={() => {
                                  receivePurchaseOrder(p.id);
                                  refresh();
                                  toast.success("PO received, stock updated");
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                deletePurchaseOrder(p.id);
                                refresh();
                                toast.success("PO deleted");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
