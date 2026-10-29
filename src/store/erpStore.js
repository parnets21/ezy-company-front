// ─────────────────────────────────────────────────────────────
//  ERP SHARED STORE  –  Tiles Industry B2B Flow
//  Manufacturer → Distributor (Tiles World Pvt Ltd) → Retailer
// ─────────────────────────────────────────────────────────────

// ── PRODUCTS catalogue (Tiles Industry) ──────────────────────
export const PRODUCTS_CATALOGUE = [
  {
    code: 'KAJ-VIT-800',
    name: 'Kajaria Vitrified Floor Tile 800×800mm',
    brand: 'Kajaria',
    category: 'Vitrified Tiles',
    size: '800×800 mm',
    finish: 'Glossy',
    material: 'Vitrified',
    color: 'Ivory',
    mrp: 95,
    purchasePrice: 62,
    dealerPrice: 72,
    sellingPrice: 78,
    retailPrice: 88,
    unit: 'Sq Ft',
    image: null,
    description: 'Kajaria premium vitrified floor tile, double charge, anti-skid, suitable for living room & halls',
  },
  {
    code: 'SOM-CER-600',
    name: 'Somany Ceramic Floor Tile 600×600mm',
    brand: 'Somany',
    category: 'Ceramic Tiles',
    size: '600×600 mm',
    finish: 'Matt',
    material: 'Ceramic',
    color: 'Grey',
    mrp: 52,
    purchasePrice: 32,
    dealerPrice: 38,
    sellingPrice: 42,
    retailPrice: 48,
    unit: 'Sq Ft',
    image: null,
    description: 'Somany ceramic floor tile, matt finish, suitable for kitchen & bathroom floors',
  },
  {
    code: 'JOH-WALL-300',
    name: 'Johnson Wall Tile 300×600mm',
    brand: 'Johnson',
    category: 'Wall Tiles',
    size: '300×600 mm',
    finish: 'Glossy',
    material: 'Ceramic',
    color: 'White',
    mrp: 45,
    purchasePrice: 26,
    dealerPrice: 32,
    sellingPrice: 36,
    retailPrice: 42,
    unit: 'Sq Ft',
    image: null,
    description: 'Johnson glossy white wall tile, suitable for bathroom, kitchen wall cladding',
  },
  {
    code: 'KAJ-PARK-400',
    name: 'Kajaria Outdoor Parking Tile 400×400mm',
    brand: 'Kajaria',
    category: 'Outdoor/Parking',
    size: '400×400 mm',
    finish: 'Anti-Skid',
    material: 'Vitrified',
    color: 'Dark Grey',
    mrp: 72,
    purchasePrice: 44,
    dealerPrice: 52,
    sellingPrice: 58,
    retailPrice: 66,
    unit: 'Sq Ft',
    image: null,
    description: 'Heavy duty anti-skid outdoor parking tile, frost resistant, suitable for parking areas & pathways',
  },
  {
    code: 'SOM-MOS-MIX',
    name: 'Somany Mosaic Collection 300×300mm',
    brand: 'Somany',
    category: 'Mosaic/Designer',
    size: '300×300 mm',
    finish: 'Glossy',
    material: 'Ceramic',
    color: 'Multicolor',
    mrp: 120,
    purchasePrice: 75,
    dealerPrice: 88,
    sellingPrice: 95,
    retailPrice: 108,
    unit: 'Sq Ft',
    image: null,
    description: 'Decorative mosaic collection, handcrafted look, ideal for feature walls & accent areas',
  },
]

// ── INITIAL INVENTORY (after Purchase from Manufacturers) ─────
export const INITIAL_INVENTORY = [
  { productCode: 'KAJ-VIT-800',  warehouse: 'Main Warehouse – Surat',  stockIn: 2400, stockOut: 0,   current: 2400, lowAlert: 200 },
  { productCode: 'SOM-CER-600',  warehouse: 'Main Warehouse – Surat',  stockIn: 3200, stockOut: 0,   current: 3200, lowAlert: 300 },
  { productCode: 'JOH-WALL-300', warehouse: 'Main Warehouse – Surat',  stockIn: 1800, stockOut: 0,   current: 1800, lowAlert: 150 },
  { productCode: 'KAJ-PARK-400', warehouse: 'Branch Warehouse – Mumbai', stockIn: 1200, stockOut: 0, current: 1200, lowAlert: 100 },
  { productCode: 'SOM-MOS-MIX',  warehouse: 'Main Warehouse – Surat',  stockIn: 400,  stockOut: 355, current: 45,   lowAlert: 50  },
]

// ── INITIAL PURCHASES (from Tile Manufacturers) ──────────────
export const INITIAL_PURCHASES = [
  { id: 'PUR-0001', date: '01 Aug 2026', supplier: 'Kajaria Ceramics Ltd',   productCode: 'KAJ-VIT-800',  product: 'Kajaria Vitrified Floor Tile 800×800mm',    qty: 2400, rate: 62, amount: 148800, gst: 26784, total: 175584, status: 'Received' },
  { id: 'PUR-0002', date: '01 Aug 2026', supplier: 'Somany Ceramics',        productCode: 'SOM-CER-600',  product: 'Somany Ceramic Floor Tile 600×600mm',       qty: 3200, rate: 32, amount: 102400, gst: 18432, total: 120832, status: 'Received' },
  { id: 'PUR-0003', date: '02 Aug 2026', supplier: 'Johnson Tiles Pvt Ltd',  productCode: 'JOH-WALL-300', product: 'Johnson Wall Tile 300×600mm',                qty: 1800, rate: 26, amount:  46800, gst:  8424, total:  55224, status: 'Received' },
  { id: 'PUR-0004', date: '02 Aug 2026', supplier: 'Kajaria Ceramics Ltd',   productCode: 'KAJ-PARK-400', product: 'Kajaria Outdoor Parking Tile 400×400mm',     qty: 1200, rate: 44, amount:  52800, gst:  9504, total:  62304, status: 'Received' },
  { id: 'PUR-0005', date: '03 Aug 2026', supplier: 'Somany Ceramics',        productCode: 'SOM-MOS-MIX',  product: 'Somany Mosaic Collection 300×300mm',         qty:  400, rate: 75, amount:  30000, gst:  5400, total:  35400, status: 'Received' },
]

// ── INITIAL ENQUIRIES (Retailers enquiring for tiles) ─────────
export const INITIAL_ENQUIRIES = [
  {
    id: 'ENQ-0001', date: '05 Aug 2026',
    retailer: 'Ramesh Tiles Store', mobile: '9876543210', location: 'Mumbai, MH',
    productCode: 'KAJ-VIT-800', product: 'Kajaria Vitrified Floor Tile 800×800mm',
    qty: 1000, unit: 'Sq Ft',
    offeredPrice: 78,
    distributorReply: 'Available – 2400 Sq Ft in stock. Rate ₹80/Sq Ft. Delivery within 2 days.',
    negotiationNote: 'Retailer requested ₹77. Settled at ₹78.',
    status: 'Confirmed',
    orderId: 'ORD-0001',
  },
  {
    id: 'ENQ-0002', date: '05 Aug 2026',
    retailer: 'Sharma Traders', mobile: '9812345678', location: 'Pune, MH',
    productCode: 'SOM-CER-600', product: 'Somany Ceramic Floor Tile 600×600mm',
    qty: 800, unit: 'Sq Ft',
    offeredPrice: 42,
    distributorReply: '',
    negotiationNote: '',
    status: 'New',
    orderId: null,
  },
  {
    id: 'ENQ-0003', date: '04 Aug 2026',
    retailer: 'Patel Tile World', mobile: '9700022334', location: 'Ahmedabad, GJ',
    productCode: 'JOH-WALL-300', product: 'Johnson Wall Tile 300×600mm',
    qty: 500, unit: 'Sq Ft',
    offeredPrice: 36,
    distributorReply: 'Available. Rate ₹37/Sq Ft. Minimum order 400 Sq Ft.',
    negotiationNote: '',
    status: 'Replied',
    orderId: null,
  },
  {
    id: 'ENQ-0004', date: '04 Aug 2026',
    retailer: 'Gupta Enterprises', mobile: '9800011223', location: 'Delhi, DL',
    productCode: 'KAJ-PARK-400', product: 'Kajaria Outdoor Parking Tile 400×400mm',
    qty: 2000, unit: 'Sq Ft',
    offeredPrice: 58,
    distributorReply: 'Rate ₹59/Sq Ft. Bulk discount available above 1500 Sq Ft.',
    negotiationNote: 'Counter offered ₹57. Negotiating.',
    status: 'Negotiation',
    orderId: null,
  },
]

// ── INITIAL ORDERS ────────────────────────────────────────────
export const INITIAL_ORDERS = [
  {
    id: 'ORD-0001', enquiryId: 'ENQ-0001', date: '05 Aug 2026', dueDate: '08 Aug 2026',
    customer: 'Ramesh Tiles Store', mobile: '9876543210', location: 'Mumbai, MH',
    productCode: 'KAJ-VIT-800', product: 'Kajaria Vitrified Floor Tile 800×800mm',
    qty: 1000, rate: 78,
    amount: 78000, gstPct: 18, gst: 14040, total: 92040,
    purchaseRate: 62, purchaseCost: 62000,
    transport: 3500, packing: 1200,
    status: 'Accepted',
    warehouseStatus: null,
    dispatchId: null,
  },
]

// ── INITIAL DISPATCHES ────────────────────────────────────────
export const INITIAL_DISPATCHES = [
  {
    id: 'DIS-0001', orderId: 'ORD-0001', date: '05 Aug 2026',
    customer: 'Ramesh Tiles Store',
    vehicle: 'GJ05KA2266', driver: 'Raju Yadav', driverMobile: '9988776655',
    transport: 'Shreeji Transport', lr: 'LR78901',
    dispatchDate: '05 Aug 2026', expectedDelivery: '07 Aug 2026',
    deliveredDate: '06 Aug 2026',
    status: 'Delivered',
  },
]

// ── INITIAL SALES (auto-created on Delivery) ─────────────────
export const INITIAL_SALES = [
  {
    id: 'SAL-0001', orderId: 'ORD-0001', dispatchId: 'DIS-0001', date: '07 Aug 2026',
    customer: 'Ramesh Tiles Store',
    productCode: 'KAJ-VIT-800', product: 'Kajaria Vitrified Floor Tile 800×800mm',
    qty: 1000, rate: 78,
    amount: 78000, gst: 14040, total: 92040,
    payment: 'Pending',
  },
]

// ── INITIAL PAYMENTS ──────────────────────────────────────────
export const INITIAL_PAYMENTS = {
  receivables: [
    {
      id: 'RCV-0001', customerId: 'Ramesh Tiles Store', orderId: 'ORD-0001', saleId: 'SAL-0001',
      invoiceAmt: 92040, received: 0, outstanding: 92040,
      dueDate: '20 Aug 2026', overdueDays: 0, status: 'Pending',
    },
  ],
  payables: [
    {
      id: 'PAY-0001', supplier: 'Kajaria Ceramics Ltd', purchaseId: 'PUR-0001',
      invoiceAmt: 175584, paid: 175584, outstanding: 0,
      dueDate: '15 Aug 2026', overdueDays: 0, status: 'Paid',
    },
    {
      id: 'PAY-0002', supplier: 'Somany Ceramics', purchaseId: 'PUR-0002',
      invoiceAmt: 120832, paid: 0, outstanding: 120832,
      dueDate: '18 Aug 2026', overdueDays: 0, status: 'Pending',
    },
    {
      id: 'PAY-0003', supplier: 'Johnson Tiles Pvt Ltd', purchaseId: 'PUR-0003',
      invoiceAmt: 55224, paid: 0, outstanding: 55224,
      dueDate: '20 Aug 2026', overdueDays: 0, status: 'Pending',
    },
  ],
  history: [
    {
      id: 'TXN-0001', date: '04 Aug 2026', type: 'Paid',
      party: 'Kajaria Ceramics Ltd',
      amount: 175584, mode: 'Bank Transfer', ref: 'NEFT20260804001',
      notes: 'Full payment for PUR-0001 (2400 Sq Ft Kajaria Vitrified Tile 800×800)',
    },
  ],
}
