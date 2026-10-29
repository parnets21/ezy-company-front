/**
 * productFieldSchema.js
 *
 * Product-type-driven field schema for the Add / Edit Product form.
 *
 * Each product "type" maps to an ordered list of field definitions. The form
 * renders these fields dynamically once a Product Type is chosen. Common fields
 * (name, pricing, stock, images, unit, gst) live outside this schema and are
 * always shown.
 *
 * Field definition shape:
 *   {
 *     key,          // unique key (also the attributes[] key when storeIn==='attributes')
 *     label,        // UI label
 *     type,         // 'text' | 'number' | 'select'
 *     options,      // string[] for selects (optional)
 *     unit,         // suffix shown after the input, e.g. 'mm', 'ft', 'cm' (optional)
 *     required,     // boolean — enforced by the form
 *     storeIn,      // 'column'  -> saved to an existing Product model field (key = column name)
 *                   // 'attributes' -> saved into product.attributes[key] (Mixed JSON)
 *     placeholder,  // optional input placeholder
 *     section,      // optional section label for grouping in UI
 *     autoCompute,  // optional — if true, input is read-only; value computed from other fields
 *   }
 *
 * storeIn === 'column' keys MUST match real Product schema columns:
 *   size, finish, material, color, surface, thickness, grade, tile_type,
 *   application, anti_skid, origin, manufacturer, design, collection,
 *   pcs_per_box, sqft_per_box, weight_per_box
 * Everything else uses storeIn: 'attributes'.
 *
 * Field lists are based on real-world natural stone trade practice:
 *   - Granite: dimensional stone with slab/tile specs, finish, Mohs hardness,
 *     density, water absorption, compressive strength per ASTM / IS standards.
 *   - Marble: calcareous stone with veining patterns, polish grade,
 *     acid sensitivity, typical flooring / countertop specs.
 *   - Natural Stone Block: raw quarry block with gross/net dimensions,
 *     CBM volume, tonnage, block ID, quarry reference, fissure info.
 *   - Non-Sanitary Item: general merchandise (tools, accessories, chemicals,
 *     packaging) with SKU, barcode, net/gross weight, shelf life etc.
 */

// ── Explicit product types the user can select directly ──────────────
export const PRODUCT_TYPES = [
  { value: 'granite',         label: 'Granite' },
  { value: 'marble',          label: 'Marble' },
  { value: 'stone_block',     label: 'Natural Stone Block' },
  { value: 'non_sanitary',    label: 'Non-Sanitary Item' },
  { value: 'tiles',           label: 'Tiles / Vitrified' },
  { value: 'sanitaryware',    label: 'Sanitaryware' },
  { value: 'other',           label: 'Other / General' },
]

export const CATEGORY_TYPES = PRODUCT_TYPES.map(p => p.value)

// ── Shared option lists ────────────────────────────────────────────────
const TILE_SIZES = [
  '300x300','300x450','300x600','400x400','450x900',
  '600x600','600x1200','800x800','800x1600',
  '1000x1000','1200x1200','1200x2400','800x2400','1200x1800','400x1200','300x900','300x1200','75x300','75x150','200x200','Custom',
]
const FILTER_SIZES_FEET = [
  '1x1 Feet','2x2 Feet','2x4 Feet','4x4 Feet','4x8 Feet','3x6 Feet','3x8 Feet','1x2 Feet','1x4 Feet','Other',
]
const MATERIAL_TYPES = [
  'Ceramic','Vitrified (Full Body)','Vitrified (Double Charge)','Vitrified (Glazed - GVT)','Vitrified (Nano Polished)','Porcelain','Natural Stone Look','Designer / Digital','3D / Elevation','Mosaic','Glass','Other',
]
const TILE_QUALITY_GRADES = [
  'Premium (First Quality)','Standard (Commercial)','Economy (Builder Grade)','Seconds / Export Surplus','Imported Premium',
]
const TILE_ROOM_AREAS = [
  'Living Room','Bedroom','Hall','Kitchen','Bathroom','Balcony','Terrace','Pooja Room','Dining Room','Drawing Room','Hallway / Passage','Foyer / Lobby','Office / Commercial','Restaurant','Hotel / Hospitality','Hospital','School','Bar Unit','Utility Area','TV Unit Wall','Parking','Outdoor Patio','Garden / Paving','Staircase','Elevation / Facade','Swimming Pool','Porch / Pathway','Shop / Retail',
]
const TILE_FINISHES_EXPANDED = [
  'Glossy','High Gloss (90+ GU)','Super Glossy','Matt / Matte','Satin','Sugar Finish','Polished','Nano Polished','Rustic','Textured','Carving / Embossed','Metallic','Lappato (Semi-Polished)','Wood Look / Plank','Stone Look','Digital Print','Mosaic Pattern','Subway / Bevelled','Kitkat / Fluted','Herringbone','Hexagon / Geometric','3D Elevation','Leather / Brushed','Anti Skid (R9-R13)','Acid Resistant',
]
const EDGE_TYPES = ['Rectified','Non-Rectified (Cushioned)','Pressed Edge','Bevelled Edge','Chamfered','Lugged / Interlocking','Other']
const TILE_COLOUR_FAMILIES = [
  'White','Off-White / Ivory','Cream / Beige','Brown','Tan / Terracotta','Grey','Charcoal / Black','Blue','Green','Red / Maroon','Pink / Peach','Yellow / Gold','Purple','Multi Colour / Mix','Wood Brown','Stone Grey','Marble White','Monochrome (B&W)','Custom',
]
const TILE_DESIGN_STYLES = [
  'Plain / Solid','Marble Look / Vein','Granite / Stone Look','Wooden / Plank','Subway / Metro','Moroccan','Geometric','Floral / Ornamental','Brick / Fluted / Kitkat','Mosaic','Herringbone / Chevron','Hexagonal','3D / Relief','Terrazzo','Cement / Concrete','Kota / Slate','Travertine','Onyx','Highlighter / Border','Digital Art','Custom Design',
]
const SLAB_SIZES_FEET = [
  '2x2 ft','2x4 ft','3x5 ft','3x6 ft','3x7 ft','3x8 ft',
  '4x2 ft','4x6 ft','4x7 ft','4x8 ft','4x9 ft','4x10 ft',
  '5x2 ft','5x3 ft','5x4 ft','5x5 ft','5x6 ft','5x7 ft','5x8 ft',
  '6x3 ft','6x4 ft','6x5 ft','6x6 ft','7x4 ft','8x4 ft','9x5 ft','10x5 ft',
  'Custom',
]
const SLAB_SIZES_MM = [
  '600x600 mm','800x800 mm','900x900 mm','1000x1000 mm',
  '1200x600 mm','1200x800 mm','1200x1200 mm','1600x800 mm',
  '1800x900 mm','2400x1200 mm','3000x1500 mm','Custom',
]
const TILE_TYPES     = ['Floor Tile','Wall Tile','Floor & Wall','Outdoor','Pool Tile','Parking','Elevation','Mosaic']
const ANTI_SKID      = ['R9','R10','R11','R12','R13','Non Slip','Normal']
const WATER_ABS_TILE = ['BIa (≤0.5% Vitrified)','BIb (0.5–3%)','BIIa (3–6%)','BIIb (6–10%)','BIII (>10%)']
const PEI_RATING     = ['PEI I (Light)','PEI II (Moderate)','PEI III (Medium)','PEI IV (Heavy)','PEI V (Extra Heavy)']

// ── Natural-stone-specific options ─────────────────────────────────────
const STONE_FINISHES = [
  'Polished','Honed','Leather (Brushed)','Flamed','River Wash',
  'Sawn Cut','Sand Blasted','Bush Hammered','Tumbled','Lapidotro','Natural Cleft',
]
const GRANITE_GRADES = [
  'Grade 1 (Commercial)','Grade 2 (Standard)','Grade 3 (Premium)','Grade 4 (Exotic / Rare)',
]
const MARBLE_GRADES = [
  'A Grade (Premium / Premium Select)','B Grade (Standard)','C Grade (Commercial)','D Grade (Rustic / Filled)',
]
const MARBLE_COLOUR_FAMILIES = [
  'Pure White / Snow White','Off White / Ivory White','Beige / Cream / Botticino','Cream Marfil / Perlato',
  'Grey / Bardiglio / Cement','Blue Grey / Palissandro','Brown / Emperador','Reddish / Rojo / Rosso','Pink / Rosa Portogallo',
  'Green / Verde Guatemala / Udaipur','Black / Black Marquina','Yellow / Giallo / Golden','Multi Colour / Breccia','Veined Marble / Onyx Look','Custom',
]
const MARBLE_SURFACE_TREATMENTS = [
  'Natural / Unfilled','Epoxy Resined & Filled','Polyester Filled','Reinforced with Fiberglass Mesh','Honeycomb Backed','Water Repellent Impregnated','Antique / Tumbled (Aged)','Acid Washed','Bush Hammered','Sand Blasted / Flamed','Filled & Honed','Filled & Polished',
]
const VEIN_ORIENTATION = [
  'Straight Vein Cut (Vein)','Cross Cut (Fleuri / Flower)','Random Vein','Book-Matched Set','Flow-Matched Set','Butterfly / Open-Book Pattern','Herringbone / Chevron Layout','Mosaic / Random Pattern',
]
const STONE_USE_AREAS = [
  'Floor Tiles (Full Body)','Wall Cladding / Elevation','Kitchen Countertop / Island','Bathroom Vanity Top','Staircase Steps & Risers','Window Sill / Door Frame','Table Top / Furniture','Fireplace Surround','Column / Pillar Cladding','Monument / Sculpture','Temple & Mandir','Lobby / Entrance Flooring','Hotel / Hospitality','Mall / Commercial','Swimming Pool Coping','Backsplash / Bathroom Wall','Outdoor Patio / Sitout','Pooja Room','Other / Custom',
]
const STONE_THICKNESS_MM = [
  '15 mm','16 mm','18 mm','20 mm (2 cm)','25 mm','30 mm (3 cm)','40 mm (4 cm)','50 mm (5 cm)','Custom',
]
const STONE_ORIGINS = [
  'India','Italy','Spain','China','Portugal','Brazil','Turkey','UAE',
  'Greece','Egypt','Vietnam','Iran','Norway','Finland','South Africa','USA','Mexico',
]
const GRANITE_VARIETIES = [
  'Black Galaxy','Steel Grey','Kuppam Green','Mysore White','Hassan Green',
  'Imperial Red','Lavender Blue','Siva Blue','Sapphire Blue','Crystal Yellow',
  'Desert Brown','Juparana Granite','Alaska White','Absolute Black','Black Pearl',
  'Tan Brown','Coffee Brown','Paradiso Classic','Vizag Blue','Amba White',
  'Kashmir White','Kashmir Gold','Santa Cecilia','Uba Tuba','Verde Ubatuba',
  'Baltic Brown','Tiger Skin Yellow','G603 Grey','G654 Dark Grey','G682 Rusty Yellow',
  'Shanxi Black','Multicolor Red','Paradiso Bash','Fish Black','Colonial White',
  'Giallo Ornamental','New Venetian Gold','Black Forest','Lavender Blue','Custom',
]
const MARBLE_VARIETIES = [
  'Makrana White','Makrana Chak Dungri','Rajnagar White','Udaipur Green','Ambaji White',
  'Agaria White','Morwad White','Banswara White','Wonder White','Wonder Beige',
  'Katni Beige','Katni Yellow','Dungri Marble','Sawar Marble','Kishangarh White',
  'Rajsamand Marble','Floyd White','Piyara White','Onyx Marble (Green)','Onyx Marble (Pink)',
  'Forest Marble (Brown)','Zebra Marble','Tiger Skin Marble','Jaisalmer Yellow',
  'Statuario (Italy)','Statuario Venato (Italy)','Carrara White (Italy)','Carrara Gioia (Italy)',
  'Calacatta (Italy)','Calacatta Borghini (Italy)','Calacatta Gold (Italy)',
  'Botticino Classico (Italy)','Botticino Fiorito (Italy)','Breccia Aurora (Italy)',
  'Emperador Light (Spain)','Emperador Dark (Spain)','Crema Marfil (Spain)','Crema Nova (Spain)',
  'Rosa Portogallo (Portugal)','Verde Guatemala (Guatemala)','Thassos White (Greece)',
  'Black Marquina (China)','Nero Marquina','Volakas White (Greece)','Drama White (Greece)',
  'Afyon White (Turkey)','Afyon Sugar (Turkey)','Bianco Dolomiti','Polaris White','Custom',
]
const STONE_PRODUCT_FORM = [
  'Slab (Raw)','Slab (Polished)','Cut-to-Size Tile','Strips','Steps & Risers',
  'Countertop Blank','Vanity Top','Window Sill','Curb Stone','Kerb Stone',
  'Paving Stone','Wall Cladding','Monument / Tombstone','Custom',
]
const VEIN_PATTERNS = [
  'Solid / Uniform','Light Veining','Moderate Veining','Heavy Veining',
  'Book-Matchable','Flowing Veins','Spider Veins','Cloudy Pattern','Brecciated','Fossiliferous','Speckled','Granular','Mottled',
]
const MOHS_HARDNESS = ['4','5','6','6.5','7','7.5','8']
const ABSORPTION_LEVELS = [
  '< 0.1% (Very Low)','0.1 – 0.3% (Low)','0.3 – 0.5% (Medium)','0.5 – 1.0% (High)','> 1.0% (Very High)',
]
const ACID_SENSITIVITY = ['None / Low','Moderate (seal recommended)','High (must seal)']
const DENSITY_RANGE = ['2600','2650','2700','2750','2800','2850','2900','2950','3000','3100']
const COMPRESSIVE_MPA  = ['80','100','120','140','160','180','200','220','240','260','300']
const FLEXURAL_MPA     = ['10','12','14','16','18','20','22','25','28','30']
const EDGE_TREATMENTS = [
  'Raw / Sawn Edge','Eased Edge (Bevel)','Bullnose (Full Round)','Half Bullnose','Dupont Edge','Ogee Edge','Chiseled Edge','Pencil Round','Flat Edge','Custom Profile','Beveled Edge (45°)','Laminated Edge','Custom',
]
const GRANITE_USE_AREAS = [
  'Kitchen Countertop','Bathroom Vanity','Floor Tiles','Wall Cladding','Stair Steps & Risers','Window Sill','Curb Stone','Paving Stone','Outdoor Patio','Monument / Tombstone','Furniture Table Top','Backsplash','Fireplace Surround','Pool Coping','Column Cladding','Outdoor Kitchen','Commercial Flooring','Custom Project',
]
const TOLERANCE_GRADES = [
  'Premium (±0.3mm)','Standard (±0.5mm)','Commercial (±1.0mm)','Rough / Industrial Grade',
]
const POLISH_GLOSS = ['60 GU (Satin)','70 GU (Standard)','80 GU (Good)','90 GU (Premium)','95+ GU (Mirror)','Honed (Matte)','Leather Finish',
]
const BACKING_TYPES = [
  'None','Fiberglass Mesh Backing','Aluminum Honeycomb Backing','Steel Reinforcement','Plywood Laminated','Granite Backsplash','Resin / Epoxy Backing',
]
const SEALANT_TYPES = [
  'No Sealant Required','Impregnating Sealant (Silane/Siloxane)','Topical Coating Sealant','Enhancing Sealant (Color Boost)','Food-Safe Penetrating Sealer','Annual Re-Seal Recommended','3-5 Year Sealant',
]
const PACKING_METHODS = [
  'Wooden Crate (Fumigated)','Wooden Bundle (A-Frame)','Foam Padded Wooden Case','Steel Rack','Palletized with Shrink Wrap','Custom Export Packaging',
]

// ── Natural Stone Block options ────────────────────────────────────────
const BLOCK_STONE_KIND = [
  'Granite Block','Marble Block','Sandstone Block','Limestone Block',
  'Slate Block','Quartzite Block','Basalt Block','Travertine Block','Onyx Block',
]
const BLOCK_QUALITY_GRADE = [
  'A Grade (Export / Premium)','B Grade (Standard)','C Grade (Commercial / RCC)','Rough / Unclassified',
]
const BLOCK_FISSURE_RATING = [
  'No Visible Fissures','Minor Fissures (Fillable)','Moderate Fissures','Heavy Fissures / Faults',
]
const QUARRY_NAMES_INDIA = [
  'Kishangarh (Rajasthan)','Makrana (Rajasthan)','Rajsamand (Rajasthan)','Udaipur (Rajasthan)',
  'Jalore (Rajasthan)','Sirohi (Rajasthan)','Koppal (Karnataka)','Hassan (Karnataka)',
  'Mysore (Karnataka)','Chittoor (AP)','Krishna (AP)','Jodhpur (Rajasthan)','Custom',
]

// ── Non-Sanitary (general goods) options ────────────────────────────────
const NS_ITEM_CATEGORY = [
  'Adhesives & Chemicals','Grout & Mortar','Sealers & Protectants','Cleaning & Care',
  'Tools & Equipment','Safety & PPE','Packaging Material','Spacers & Levellers',
  'Taps & Accessories','Lighting Fixtures','Hardware','Profile Edging',
  'Miscellaneous Accessories','Flooring Accessories',
]
const NS_MATERIAL = [
  'Plastic / PVC','Stainless Steel (SS304)','Stainless Steel (SS316)','Brass',
  'Aluminium','Ceramic','Rubber','Glass','Wood','Paper / Cardboard','Cotton / Fabric',
  'Epoxy / Resin','Cementitious','Chemical / Liquid','Nylon / Polymer','Other',
]
const NS_UNIT_LIST = [
  'Nos','Piece','Packet','Box','Carton','Bag','Bottle','Can','Drum','Roll','Pair','Set','Kg','Litre','Metre','Sq Ft','Sq Mtr',
]
const HAZARD_CLASSES = ['Non-Hazardous','Flammable','Corrosive','Toxic / Harmful','Oxidizing','Aerosol / Pressurized']

// ── Sanitaryware / Blocks / Tiles legacy options (kept for existing data) ──
const BLOCK_TYPES    = ['AAC Block','Concrete Block','Fly Ash Brick','Solid Block','Hollow Block','Paver Block']
const BLOCK_SIZES    = [
  '600x200x100 mm','600x200x150 mm','600x200x200 mm','600x200x230 mm',
  '600x250x100 mm','600x250x150 mm','600x250x200 mm',
  '400x200x100 mm','400x200x200 mm','230x110x75 mm','Custom',
]
const BLOCK_GRADE_CB = ['AAC-2','AAC-3','AAC-4','AAC-6','Grade A','Grade B']
const SANITARY_TYPE  = ['Wash Basin','Water Closet (WC)','One Piece Closet','Urinal','Cistern','Pedestal','Squatting Pan','Bidet']
const SANITARY_MOUNT = ['Wall Hung','Floor Mounted','One Piece','Counter Top','Under Counter','Table Top']
const FLUSH_TYPES    = ['Single Flush','Dual Flush','Rimless','Concealed','External Cistern']

// ── Per-product-type field definitions ──────────────────────────────────
export const PRODUCT_FIELD_SCHEMA = {
  // ──────────────── TILES / VITRIFIED ────────────────
  tiles: [
    // ── Product Identification ──
    { key: 'material_type',   label: 'Material / Tile Type',             type: 'select', options: MATERIAL_TYPES,         required: true,  storeIn: 'attributes', section: 'Product Identification' },
    { key: 'tile_type',       label: 'Primary Application (Floor/Wall/Combined)', type: 'select', options: TILE_TYPES, required: true, storeIn: 'column', section: 'Product Identification' },
    { key: 'color',           label: 'Dominant Colour Family',           type: 'select', options: TILE_COLOUR_FAMILIES,   required: true,  storeIn: 'column',     section: 'Product Identification' },
    { key: 'grade',           label: 'Quality Grade',                    type: 'select', options: TILE_QUALITY_GRADES,    required: true,  storeIn: 'column',     section: 'Product Identification' },
    { key: 'origin',          label: 'Country of Manufacture',           type: 'select', options: STONE_ORIGINS,          required: false, storeIn: 'column',     section: 'Product Identification' },
    { key: 'brand',           label: 'Brand / Manufacturer',             type: 'text',                                        required: false, storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Somany, Kajaria, Johnson, Nitco, MyTyles' },
    { key: 'series',          label: 'Collection / Series Name',         type: 'text',                                        required: false, storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Marvel Onyx, Wood Vogue, Urban Stone' },

    // ── Dimensional Specifications ──
    { key: 'size',            label: 'Actual Size (mm)',                 type: 'select', options: TILE_SIZES,             required: true,  storeIn: 'column',     section: 'Dimensional Specifications' },
    { key: 'filter_size_ft',  label: 'Filter / Nominal Size',            type: 'select', options: FILTER_SIZES_FEET,       required: false, storeIn: 'attributes', section: 'Dimensional Specifications' },
    { key: 'thickness',       label: 'Tile Thickness',                   type: 'text',   unit: 'mm',                       required: true,  storeIn: 'column',     section: 'Dimensional Specifications', placeholder: 'e.g. 8, 8.5, 9, 10, 12' },
    { key: 'piece_length_mm', label: 'Piece Exact Length',               type: 'number', unit: 'mm',                       required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'Measured length in mm' },
    { key: 'piece_width_mm',  label: 'Piece Exact Width',                type: 'number', unit: 'mm',                       required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'Measured width in mm' },
    { key: 'edge_type',       label: 'Edge / Rectification',             type: 'select', options: EDGE_TYPES,               required: false, storeIn: 'attributes', section: 'Dimensional Specifications' },
    { key: 'area_per_piece_sqft', label: 'Area Per Piece (Sq.Ft)',       type: 'number', unit: 'sqft',                     required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'Auto or manual: L×W mm ÷ 92903' },

    // ── Surface, Design & Visual ──
    { key: 'finish',          label: 'Surface Finish',                   type: 'select', options: TILE_FINISHES_EXPANDED,  required: true,  storeIn: 'column',     section: 'Surface, Design & Visual' },
    { key: 'design',          label: 'Design / Pattern Style',           type: 'select', options: TILE_DESIGN_STYLES,      required: false, storeIn: 'column',     section: 'Surface, Design & Visual' },
    { key: 'surface',         label: 'Surface Notes / Texture',          type: 'text',                                        required: false, storeIn: 'column',     section: 'Surface, Design & Visual', placeholder: 'e.g. Stone texture, Natural veins, Carved, Smooth' },
    { key: 'anti_skid',       label: 'Anti-Skid Rating',                 type: 'select', options: ANTI_SKID,                required: false, storeIn: 'column',     section: 'Surface, Design & Visual' },
    { key: 'print_type',      label: 'Print / Ink Type',                 type: 'select', options: ['Digital Inkjet','Screen Print','Soluble Salt','Double Charge','Solid Color','Natural','3D Relief','Other'], required: false, storeIn: 'attributes', section: 'Surface, Design & Visual' },
    { key: 'body_colour',     label: 'Body / Base Colour',               type: 'text',                                        required: false, storeIn: 'attributes', section: 'Surface, Design & Visual', placeholder: 'e.g. Red body, White body' },

    // ── Application & Suitability ──
    { key: 'application',     label: 'Primary Application',              type: 'select', options: TILE_ROOM_AREAS,         required: true,  storeIn: 'column',     section: 'Application & Suitability' },
    { key: 'floor_use_areas', label: 'Floor Suitability Rooms',          type: 'text',                                        required: false, storeIn: 'attributes', section: 'Application & Suitability', placeholder: 'e.g. Living Room, Kitchen, Bedroom, Parking, Outdoor' },
    { key: 'wall_use_areas',  label: 'Wall Suitability Rooms',           type: 'text',                                        required: false, storeIn: 'attributes', section: 'Application & Suitability', placeholder: 'e.g. Bathroom, Kitchen, Elevation, TV Unit, Hall' },
    { key: 'outdoor_rating',  label: 'Outdoor Suitability',              type: 'select', options: ['Yes - Heavy Duty','Yes - Patio Only','No - Indoor Only','Swimming Pool Grade','Parking Grade (Heavy Vehicle)'], required: false, storeIn: 'attributes', section: 'Application & Suitability' },
    { key: 'frost_resistant', label: 'Frost / Thermal Resistant',        type: 'select', options: ['Yes','No'],             required: false, storeIn: 'attributes', section: 'Application & Suitability' },

    // ── Physical / Technical Specs ──
    { key: 'water_absorption',label: 'Water Absorption Group',           type: 'select', options: WATER_ABS_TILE,           required: false, storeIn: 'attributes', section: 'Physical / Technical Specs' },
    { key: 'pei_rating',      label: 'PEI Abrasion Rating',              type: 'select', options: PEI_RATING,               required: false, storeIn: 'attributes', section: 'Physical / Technical Specs' },
    { key: 'shade_variation', label: 'Shade Variation (V Rating)',       type: 'select', options: ['V0 - Uniform','V1 - Minimal','V2 - Slight','V3 - Moderate','V4 - Considerable','V5 - Random / Natural'], required: false, storeIn: 'attributes', section: 'Physical / Technical Specs' },
    { key: 'acid_resistant',  label: 'Chemical / Acid Resistant',        type: 'select', options: ['Yes','No','Yes (Industrial Grade)'], required: false, storeIn: 'attributes', section: 'Physical / Technical Specs' },
    { key: 'stain_resistant', label: 'Stain Resistant',                  type: 'select', options: ['Yes','No','Yes (Coated)'], required: false, storeIn: 'attributes', section: 'Physical / Technical Specs' },

    // ── Packing & Quantity ──
    { key: 'pcs_per_box',     label: 'Pieces Per Box',                   type: 'number',                                      required: true,  storeIn: 'column',     section: 'Packing & Quantity', placeholder: 'e.g. 10, 8, 6, 4' },
    { key: 'sqft_per_box',    label: 'Coverage Area Per Box',            type: 'number', unit: 'sqft',                       required: true,  storeIn: 'column',     section: 'Packing & Quantity', placeholder: 'e.g. 9.69, 15.5, 31' },
    { key: 'weight_per_box',  label: 'Weight Per Box',                   type: 'number', unit: 'kg',                         required: false, storeIn: 'column',     section: 'Packing & Quantity', placeholder: 'e.g. 14, 18, 28, 35' },
    { key: 'boxes_per_pallet',label: 'Boxes Per Pallet / Crate',         type: 'number',                                      required: false, storeIn: 'attributes', section: 'Packing & Quantity', placeholder: 'e.g. 40 boxes per pallet' },
    { key: 'sqft_per_pallet', label: 'Total Sq.Ft Per Pallet',           type: 'number', unit: 'sqft',                       required: false, storeIn: 'attributes', section: 'Packing & Quantity' },
    { key: 'packing_notes',   label: 'Packing / Handling Notes',         type: 'text',                                        required: false, storeIn: 'attributes', section: 'Packing & Quantity', placeholder: 'e.g. Corrugated box, Styrofoam corners, Palletized, 2% breakage max' },
  ],

  // ──────────────── GRANITE ────────────────
  granite: [
    // ── Product Identification ──
    { key: 'stone_variety',   label: 'Granite Variety / Trade Name', type: 'select', options: GRANITE_VARIETIES, required: true,  storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Black Galaxy, Steel Grey' },
    { key: 'color',           label: 'Dominant Colour',            type: 'select', options: [],                required: true,  storeIn: 'column',    section: 'Product Identification', placeholder: 'e.g. Black, Grey, Red' },
    { key: 'origin',          label: 'Country / Region of Origin', type: 'select', options: STONE_ORIGINS,     required: true,  storeIn: 'column',    section: 'Product Identification' },
    { key: 'grade',           label: 'Quality Grade',              type: 'select', options: GRANITE_GRADES,    required: true,  storeIn: 'column',    section: 'Product Identification' },
    { key: 'product_form',    label: 'Product Form',               type: 'select', options: STONE_PRODUCT_FORM,required: true,  storeIn: 'attributes',section: 'Product Identification' },
    { key: 'quarry_lot_ref',  label: 'Quarry / Lot Reference',     type: 'text',                            required: false, storeIn: 'attributes',section: 'Product Identification', placeholder: 'e.g. Lot #GL-2025-0417, Quarry Kishangarh' },

    // ── Dimensional Specifications ──
    { key: 'size_mm',         label: 'Nominal Size (mm)',          type: 'select', options: SLAB_SIZES_MM,     required: false, storeIn: 'attributes',section: 'Dimensional Specifications', placeholder: 'Standard size selector' },
    { key: 'size_ft',         label: 'Nominal Size (Feet)',        type: 'select', options: SLAB_SIZES_FEET,   required: false, storeIn: 'attributes',section: 'Dimensional Specifications' },
    { key: 'length_mm',       label: 'Exact Length',               type: 'number', unit: 'mm',                required: false, storeIn: 'attributes',section: 'Dimensional Specifications', placeholder: 'Measured length in mm' },
    { key: 'width_mm',        label: 'Exact Width',                type: 'number', unit: 'mm',                required: false, storeIn: 'attributes',section: 'Dimensional Specifications', placeholder: 'Measured width in mm' },
    { key: 'thickness',       label: 'Thickness',                  type: 'select', options: STONE_THICKNESS_MM,required: true,  storeIn: 'column',    section: 'Dimensional Specifications' },
    { key: 'tolerance_grade', label: 'Tolerance / Flatness Grade', type: 'select', options: TOLERANCE_GRADES,  required: false, storeIn: 'attributes',section: 'Dimensional Specifications' },
    { key: 'area_per_piece',  label: 'Area Per Piece',             type: 'number', unit: 'sqft',              required: false, storeIn: 'attributes',section: 'Dimensional Specifications', placeholder: 'Computed or measured' },

    // ── Surface & Visual ──
    { key: 'finish',          label: 'Surface Finish',             type: 'select', options: STONE_FINISHES,    required: true,  storeIn: 'column',    section: 'Surface & Visual' },
    { key: 'polish_gloss',    label: 'Polish Gloss Level',         type: 'select', options: POLISH_GLOSS,      required: false, storeIn: 'attributes',section: 'Surface & Visual' },
    { key: 'veining_texture', label: 'Veining / Texture Pattern',  type: 'select', options: VEIN_PATTERNS,     required: false, storeIn: 'attributes',section: 'Surface & Visual' },
    { key: 'edge_treatment',  label: 'Edge Treatment / Profile',   type: 'select', options: EDGE_TREATMENTS,   required: false, storeIn: 'attributes',section: 'Surface & Visual' },
    { key: 'surface',         label: 'Surface Remarks',            type: 'text',                            required: false, storeIn: 'column',    section: 'Surface & Visual', placeholder: 'e.g. Mirror Polish, Leather finish, Filled' },
    { key: 'design',          label: 'Design / Pattern Name',      type: 'select', options: [],                required: false, storeIn: 'column',    section: 'Surface & Visual' },
    { key: 'book_matchable',  label: 'Book-Match Availability',    type: 'select', options: ['Yes','No'],      required: false, storeIn: 'attributes',section: 'Surface & Visual' },
    { key: 'anti_skid',       label: 'Anti-Skid / Grip Rating',    type: 'select', options: ANTI_SKID,          required: false, storeIn: 'column',    section: 'Surface & Visual' },
    { key: 'shade_variation', label: 'Shade Variation',            type: 'select', options: ['V0 - Uniform','V1 - Minimal','V2 - Slight','V3 - Moderate','V4 - Natural / Random'], required: false, storeIn: 'attributes', section: 'Surface & Visual' },

    // ── Application & Usage ──
    { key: 'application',     label: 'Primary Application',        type: 'select', options: GRANITE_USE_AREAS, required: true,  storeIn: 'column',    section: 'Application & Usage' },
    { key: 'usage_floor',     label: 'Floor Use Areas',            type: 'text',                            required: false, storeIn: 'attributes',section: 'Application & Usage', placeholder: 'e.g. Living Room, Kitchen, Hall, Balcony' },
    { key: 'usage_wall',      label: 'Wall Use Areas',             type: 'text',                            required: false, storeIn: 'attributes',section: 'Application & Usage', placeholder: 'e.g. Cladding, Backsplash, Bathroom Wall' },
    { key: 'outdoor_suitable',label: 'Outdoor Suitability',        type: 'select', options: ['Yes','No','Yes - Frost Resistant'], required: false, storeIn: 'attributes',section: 'Application & Usage' },
    { key: 'commercial_rating', label: 'Commercial / Heavy Use',   type: 'select', options: ['Yes - Heavy Commercial','Yes - Standard','Yes - Light Commercial','No - Residential Only'], required: false, storeIn: 'attributes', section: 'Application & Usage' },

    // ── Physical / Mechanical Properties ──
    { key: 'density',         label: 'Density',                    type: 'select', options: DENSITY_RANGE,     required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties', unit: 'kg/m³' },
    { key: 'water_absorption',label: 'Water Absorption',           type: 'select', options: ABSORPTION_LEVELS, required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties' },
    { key: 'mohs_hardness',   label: 'Mohs Hardness',              type: 'select', options: MOHS_HARDNESS,     required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties' },
    { key: 'compressive_strength', label: 'Compressive Strength',  type: 'select', options: COMPRESSIVE_MPA,   required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties', unit: 'MPa' },
    { key: 'flexural_strength',label: 'Flexural / Modulus Strength',type: 'select', options: FLEXURAL_MPA,     required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties', unit: 'MPa' },
    { key: 'acid_sensitivity',label: 'Chemical / Acid Sensitivity',type: 'select', options: ACID_SENSITIVITY,  required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties' },
    { key: 'sealant_required',label: 'Sealant Type Recommended',   type: 'select', options: SEALANT_TYPES,     required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties' },
    { key: 'backing_type',    label: 'Backing / Reinforcement',    type: 'select', options: BACKING_TYPES,     required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties' },
    { key: 'certifications',  label: 'Certifications / Standards', type: 'text',                           required: false, storeIn: 'attributes',section: 'Physical / Mechanical Properties', placeholder: 'e.g. ASTM C615, IS 1131, ISI Mark' },

    // ── Packing & Quantity ──
    { key: 'pcs_per_crate',   label: 'Pieces / Crate',             type: 'number',                          required: false, storeIn: 'attributes',section: 'Packing & Quantity' },
    { key: 'sqft_per_crate',  label: 'Sq.Ft / Crate',              type: 'number', unit: 'sqft',              required: false, storeIn: 'attributes',section: 'Packing & Quantity' },
    { key: 'weight_per_crate',label: 'Weight / Crate',             type: 'number', unit: 'kg',                required: false, storeIn: 'attributes',section: 'Packing & Quantity' },
    { key: 'packing_method',  label: 'Packing Method',             type: 'select', options: PACKING_METHODS,   required: false, storeIn: 'attributes',section: 'Packing & Quantity' },
    { key: 'crates_per_container', label: 'Crates / Container',    type: 'number',                          required: false, storeIn: 'attributes',section: 'Packing & Quantity', placeholder: 'e.g. 20 crates / 20ft container' },
    { key: 'breakage_allowance', label: 'Breakage Allowance %',    type: 'number', unit: '%',                 required: false, storeIn: 'attributes',section: 'Packing & Quantity', placeholder: 'e.g. 1-2% max' },
  ],

  // ──────────────── MARBLE ────────────────
  marble: [
    // ── Product Identification
    { key: 'stone_variety',   label: 'Marble Variety / Trade Name',     type: 'select', options: MARBLE_VARIETIES,         required: true,  storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Makrana White, Statuario, Calacatta Gold' },
    { key: 'color',           label: 'Dominant Colour Family',         type: 'select', options: MARBLE_COLOUR_FAMILIES,   required: true,  storeIn: 'column',     section: 'Product Identification' },
    { key: 'origin',          label: 'Country / Quarry Origin',        type: 'select', options: STONE_ORIGINS,            required: true,  storeIn: 'column',     section: 'Product Identification' },
    { key: 'grade',           label: 'Quality Grade',                  type: 'select', options: MARBLE_GRADES,             required: true,  storeIn: 'column',     section: 'Product Identification' },
    { key: 'product_form',    label: 'Product Form',                   type: 'select', options: STONE_PRODUCT_FORM,        required: true,  storeIn: 'attributes', section: 'Product Identification' },
    { key: 'quarry_lot_ref',  label: 'Quarry / Lot / Block Ref.',      type: 'text',                                        required: false, storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Quarry-Batch 2025-RJN-14' },
    { key: 'extraction_date', label: 'Extraction / Arrival Date',      type: 'text',                                        required: false, storeIn: 'attributes', section: 'Product Identification', placeholder: 'Date of mining or shipment arrival' },
    { key: 'series_collection', label: 'Collection / Series',          type: 'text',                                        required: false, storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Marvel Onyx, Calacatta Gold Series' },
    { key: 'brand_manufacturer', label: 'Brand / Manufacturer',       type: 'text',                                        required: false, storeIn: 'attributes', section: 'Product Identification', placeholder: 'e.g. Kishangarh Marble, Italian Imported' },

    // ── Dimensional Specifications
    { key: 'size_mm',         label: 'Slab / Tile Nominal Size (mm)',  type: 'select', options: SLAB_SIZES_MM,            required: false, storeIn: 'attributes', section: 'Dimensional Specifications' },
    { key: 'size_ft',         label: 'Slab Nominal Size (Feet)',       type: 'select', options: SLAB_SIZES_FEET,          required: false, storeIn: 'attributes', section: 'Dimensional Specifications' },
    { key: 'length_mm',       label: 'Exact Length (mm)',              type: 'number', unit: 'mm',                          required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'Measured length mm' },
    { key: 'width_mm',        label: 'Exact Width (mm)',               type: 'number', unit: 'mm',                          required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'Measured width mm' },
    { key: 'thickness',       label: 'Slab / Tile Thickness',          type: 'select', options: STONE_THICKNESS_MM,         required: true,  storeIn: 'column',     section: 'Dimensional Specifications' },
    { key: 'tolerance_grade', label: 'Dimensional Tolerance',          type: 'select', options: TOLERANCE_GRADES,           required: false, storeIn: 'attributes', section: 'Dimensional Specifications' },
    { key: 'area_per_piece',  label: 'Area Per Piece (Sq.Ft)',         type: 'number', unit: 'sqft',                        required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'Auto: L×W mm ÷ 92903' },
    { key: 'filter_size_ft',  label: 'Filter / Nominal Size',          type: 'select', options: FILTER_SIZES_FEET,          required: false, storeIn: 'attributes', section: 'Dimensional Specifications' },
    { key: 'piece_count_per_slab', label: 'Tiles / Slab',              type: 'number', unit: 'pcs',                         required: false, storeIn: 'attributes', section: 'Dimensional Specifications', placeholder: 'e.g. 8 cut tiles from 1 slab' },

    // ── Surface & Visual Treatment
    { key: 'finish',          label: 'Surface Finish',                 type: 'select', options: STONE_FINISHES,             required: true,  storeIn: 'column',     section: 'Surface & Visual Treatment' },
    { key: 'polish_gloss',    label: 'Polish Gloss Level',             type: 'select', options: POLISH_GLOSS,               required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'vein_pattern',    label: 'Vein Texture / Pattern',         type: 'select', options: VEIN_PATTERNS,              required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'vein_orientation',label: 'Vein Orientation / Cut',         type: 'select', options: VEIN_ORIENTATION,           required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'vein_colour',     label: 'Vein Colour',                    type: 'select', options: MARBLE_COLOUR_FAMILIES,     required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment', placeholder: 'Dominant vein colour' },
    { key: 'edge_treatment',  label: 'Edge Treatment / Profile',       type: 'select', options: EDGE_TREATMENTS,            required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'surface_treatment', label: 'Surface Treatment',            type: 'select', options: MARBLE_SURFACE_TREATMENTS,  required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'book_matchable',  label: 'Book-Match Available',           type: 'select', options: ['Yes (Full Set)','Yes (Partial)','No – Random'], required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'book_match_pieces', label: 'Book-Match Pieces / Set',      type: 'number', unit: 'pcs',                         required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment', placeholder: 'e.g. 4, 6, 8 pieces per book-match set' },
    { key: 'filler_type',     label: 'Filler / Resin Type',            type: 'select', options: ['Epoxy Resin','Polyester Resin','Clear Resin','Colour-Matched Filler','Unfilled / Natural','Reinforced Filler'], required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },
    { key: 'surface',         label: 'Surface Remarks',                type: 'text',                                        required: false, storeIn: 'column',     section: 'Surface & Visual Treatment', placeholder: 'e.g. Natural fissures, filled, polished to 90 GU' },
    { key: 'design',          label: 'Design / Batch / Series',        type: 'select', options: [],                            required: false, storeIn: 'column',     section: 'Surface & Visual Treatment' },
    { key: 'anti_skid',       label: 'Anti-Skid / Grip Rating',        type: 'select', options: ANTI_SKID,                   required: false, storeIn: 'column',     section: 'Surface & Visual Treatment' },
    { key: 'shade_variation', label: 'Shade Variation (V-Rating)',     type: 'select', options: ['V0 - Uniform','V1 - Minimal','V2 - Slight','V3 - Moderate','V4 - Considerable','V5 - Natural / Random'], required: false, storeIn: 'attributes', section: 'Surface & Visual Treatment' },

    // ── Application & Usage Areas
    { key: 'application',     label: 'Primary Application',            type: 'select', options: STONE_USE_AREAS,            required: true,  storeIn: 'column',     section: 'Application & Usage Areas' },
    { key: 'usage_floor',     label: 'Floor Use Areas',                type: 'text',                                        required: false, storeIn: 'attributes', section: 'Application & Usage Areas', placeholder: 'e.g. Lobby, Living, Pooja Room, Hallway' },
    { key: 'usage_wall',      label: 'Wall / Cladding Areas',          type: 'text',                                        required: false, storeIn: 'attributes', section: 'Application & Usage Areas', placeholder: 'e.g. Bathroom Wall, TV Unit, Elevation, Columns' },
    { key: 'usage_countertop',label: 'Countertop / Furniture Use',     type: 'text',                                        required: false, storeIn: 'attributes', section: 'Application & Usage Areas', placeholder: 'e.g. Kitchen Counter, Vanity Top, Table Top' },
    { key: 'outdoor_suitable',label: 'Outdoor Suitability',            type: 'select', options: ['Yes – Climate Resistant','Yes – Patio Only','No – Indoor Only','Frost Resistant','Temple / Mandir Outdoor'], required: false, storeIn: 'attributes', section: 'Application & Usage Areas' },
    { key: 'room_areas',      label: 'Room Suitability',               type: 'text',                                        required: false, storeIn: 'attributes', section: 'Application & Usage Areas', placeholder: 'e.g. Living Room, Bedroom, Pooja, Hotel Lobby' },
    { key: 'commercial_rating', label: 'Commercial / Heavy Use',       type: 'select', options: ['Yes - Heavy Commercial','Yes - Standard Commercial','Yes - Light Commercial','No - Residential Only'], required: false, storeIn: 'attributes', section: 'Application & Usage Areas' },

    // ── Physical / Chemical & Mechanical Properties
    { key: 'material_type',   label: 'Stone Classification',           type: 'select', options: ['Calcite Marble (Limestone)','Dolomitic Marble','Serpentine Marble','Onyx Marble','Travertine Marble','Brecciated Marble','Metamorphosed Limestone'], required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'density',         label: 'Density',                        type: 'select', options: DENSITY_RANGE,               required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties', unit: 'kg/m³' },
    { key: 'water_absorption',label: 'Water Absorption',               type: 'select', options: ABSORPTION_LEVELS,           required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'porosity_rating', label: 'Porosity Rating',                type: 'select', options: ['Low (<0.5%)','Medium (0.5-1%)','High (1-2%)','Very High (>2%)'], required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'mohs_hardness',   label: 'Mohs Hardness',                  type: 'select', options: ['2.5','3','3.5','4','4.5','5'], required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'compressive_strength', label: 'Compressive Strength',      type: 'select', options: COMPRESSIVE_MPA,             required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties', unit: 'MPa' },
    { key: 'flexural_strength', label: 'Flexural / Modulus of Rupture',type: 'select', options: FLEXURAL_MPA,                required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties', unit: 'MPa' },
    { key: 'acid_sensitivity',label: 'Acid Sensitivity (Etch Risk)',   type: 'select', options: ACID_SENSITIVITY,            required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'stain_resistance',label: 'Stain Resistance',               type: 'select', options: ['Excellent (Sealed)','Good (Sealed)','Moderate (Seal Recommended)','Poor (Must Seal)','Unsealed / High Absorption'], required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'thermal_stability', label: 'Thermal / Frost Resistance',   type: 'select', options: ['Excellent - Frost Proof','Good - Low Expansion','Moderate - Climate Change OK','Poor - Avoid Extreme Temp'], required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'sealant_required',label: 'Sealant Type / Requirement',     type: 'select', options: SEALANT_TYPES,                required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'backing_type',    label: 'Backing / Reinforcement',        type: 'select', options: BACKING_TYPES,                required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'radioactivity_level', label: 'Radiation / Radon Level',    type: 'select', options: ['Below Safe Limit (A1)','Safe for Interior (A2)','Check Certificate','Not Tested'], required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties' },
    { key: 'certifications',  label: 'Certifications / Standards',     type: 'text',                                        required: false, storeIn: 'attributes', section: 'Physical / Chemical & Mechanical Properties', placeholder: 'e.g. ASTM C503, EN 12058, IS 1130, ISI Mark' },

    // ── Packing & Quantity
    { key: 'pcs_per_crate',   label: 'Pieces / Slabs Per Crate',       type: 'number',                                      required: false, storeIn: 'attributes', section: 'Packing & Quantity' },
    { key: 'sqft_per_crate',  label: 'Sq.Ft / Per Crate',              type: 'number', unit: 'sqft',                        required: false, storeIn: 'attributes', section: 'Packing & Quantity' },
    { key: 'weight_per_crate',label: 'Weight Per Crate',               type: 'number', unit: 'kg',                          required: false, storeIn: 'attributes', section: 'Packing & Quantity' },
    { key: 'packing_method',  label: 'Packing Method',                 type: 'select', options: PACKING_METHODS,             required: false, storeIn: 'attributes', section: 'Packing & Quantity' },
    { key: 'crates_per_container', label: 'Crates / Container (20ft)', type: 'number',                                      required: false, storeIn: 'attributes', section: 'Packing & Quantity', placeholder: 'e.g. 20 crates per 20ft container' },
    { key: 'total_sqft_container', label: 'Total Sq.Ft / Container',   type: 'number', unit: 'sqft',                        required: false, storeIn: 'attributes', section: 'Packing & Quantity' },
    { key: 'breakage_allowance', label: 'Breakage Allowance %',        type: 'number', unit: '%',                           required: false, storeIn: 'attributes', section: 'Packing & Quantity', placeholder: 'e.g. 2-3% breakage max' },
    { key: 'packing_notes',   label: 'Packing / Handling Notes',       type: 'text',                                        required: false, storeIn: 'attributes', section: 'Packing & Quantity', placeholder: 'e.g. A-Frame wooden bundle, foam padded, ISPM-15 fumigated' },
  ],

  // ──────────────── NATURAL STONE BLOCK ────────────────
  stone_block: [
    // ── Block Identification
    { key: 'block_id',        label: 'Block ID / Lot No.',         type: 'text',                            required: true,  storeIn: 'attributes', placeholder: 'e.g. BLK-RAJ-2025-0417', section: 'Block Identification' },
    { key: 'block_stone_type',label: 'Stone Type',                 type: 'select', options: BLOCK_STONE_KIND,  required: true,  storeIn: 'attributes', section: 'Block Identification' },
    { key: 'stone_variety',   label: 'Variety / Trade Name',       type: 'select', options: [...GRANITE_VARIETIES, ...MARBLE_VARIETIES], required: true, storeIn: 'attributes', section: 'Block Identification' },
    { key: 'color',           label: 'Dominant Colour',            type: 'select', options: [],                required: true,  storeIn: 'column', section: 'Block Identification' },
    { key: 'origin',          label: 'Origin / Country',           type: 'select', options: STONE_ORIGINS,     required: true,  storeIn: 'column', section: 'Block Identification' },
    { key: 'quarry_name',     label: 'Quarry / Mine Location',     type: 'select', options: QUARRY_NAMES_INDIA, required: false, storeIn: 'attributes', section: 'Block Identification' },
    { key: 'block_grade',     label: 'Quality Grade',              type: 'select', options: BLOCK_QUALITY_GRADE,required: true,  storeIn: 'attributes', section: 'Block Identification' },

    // ── Gross Block Dimensions (mm)
    { key: 'gross_length_mm', label: 'Gross Length',               type: 'number', unit: 'mm',                required: true,  storeIn: 'attributes', placeholder: 'Before cutting', section: 'Gross Block Dimensions' },
    { key: 'gross_width_mm',  label: 'Gross Width / Height',       type: 'number', unit: 'mm',                required: true,  storeIn: 'attributes', placeholder: 'Before cutting', section: 'Gross Block Dimensions' },
    { key: 'gross_height_mm', label: 'Gross Thickness / Depth',    type: 'number', unit: 'mm',                required: true,  storeIn: 'attributes', placeholder: 'Before cutting', section: 'Gross Block Dimensions' },

    // ── Net (Usable) Block Dimensions (mm)
    { key: 'net_length_mm',   label: 'Net (Usable) Length',        type: 'number', unit: 'mm',                required: false, storeIn: 'attributes', placeholder: 'After dressing', section: 'Net (Usable) Block Dimensions' },
    { key: 'net_width_mm',    label: 'Net (Usable) Width',         type: 'number', unit: 'mm',                required: false, storeIn: 'attributes', placeholder: 'After dressing', section: 'Net (Usable) Block Dimensions' },
    { key: 'net_height_mm',   label: 'Net (Usable) Thickness',     type: 'number', unit: 'mm',                required: false, storeIn: 'attributes', placeholder: 'After dressing', section: 'Net (Usable) Block Dimensions' },

    // ── Computed Volume & Weight (auto, but editable)
    { key: 'gross_cbm',       label: 'Gross Volume (CBM)',         type: 'number', unit: 'm³',                required: false, storeIn: 'attributes', placeholder: 'L×W×H ÷ 1e9 (auto)', section: 'Computed Volume & Weight' },
    { key: 'net_cbm',         label: 'Net (Usable) Volume (CBM)',  type: 'number', unit: 'm³',                required: false, storeIn: 'attributes', placeholder: 'auto if net dims filled', section: 'Computed Volume & Weight' },
    { key: 'density',         label: 'Assumed Density',            type: 'select', options: DENSITY_RANGE,     required: false, storeIn: 'attributes', unit: 'kg/m³', placeholder: 'Default 2700 kg/m³', section: 'Computed Volume & Weight' },
    { key: 'gross_weight_tons',label: 'Gross Weight',              type: 'number', unit: 'Tons',              required: false, storeIn: 'attributes', placeholder: 'CBM × Density ÷ 1000 (auto)', section: 'Computed Volume & Weight' },
    { key: 'net_weight_tons', label: 'Net Weight',                 type: 'number', unit: 'Tons',              required: false, storeIn: 'attributes', placeholder: 'auto if net CBM filled', section: 'Computed Volume & Weight' },

    // ── Visual & Quality Notes
    { key: 'veining_texture', label: 'Veining / Texture',          type: 'select', options: VEIN_PATTERNS,     required: false, storeIn: 'attributes', section: 'Visual & Quality Notes' },
    { key: 'fissure_rating',  label: 'Fissure / Crack Rating',     type: 'select', options: BLOCK_FISSURE_RATING,required: false, storeIn: 'attributes', section: 'Visual & Quality Notes' },
    { key: 'expected_slabs',  label: 'Expected Slab Yield (Nos)',  type: 'number',                          required: false, storeIn: 'attributes', placeholder: 'Estimated recoverable slabs', section: 'Visual & Quality Notes' },
    { key: 'expected_sqft',   label: 'Expected Sq.Ft Yield',       type: 'number', unit: 'sqft',              required: false, storeIn: 'attributes', section: 'Visual & Quality Notes' },
    { key: 'block_notes',     label: 'Block Notes / Remarks',      type: 'text',                            required: false, storeIn: 'attributes', placeholder: 'e.g. Wire saw cut, dye test pass, reserve block', section: 'Visual & Quality Notes' },
  ],

  // ──────────────── NON-SANITARY ITEM (general goods) ────────────────
  non_sanitary: [
    // ── Identification
    { key: 'item_sku',        label: 'SKU / Item Code',            type: 'text',                            required: true,  storeIn: 'attributes', placeholder: 'Internal SKU e.g. ADH-001', section: 'Product Identification' },
    { key: 'ns_category',     label: 'Item Category',              type: 'select', options: NS_ITEM_CATEGORY,  required: true,  storeIn: 'attributes', section: 'Product Identification' },
    { key: 'brand',           label: 'Make / Brand',               type: 'select', options: [],                required: false, storeIn: 'attributes', section: 'Product Identification' },
    { key: 'model',           label: 'Model / Part No.',           type: 'select', options: [],                required: false, storeIn: 'attributes', section: 'Product Identification' },

    // ── Physical Specs
    { key: 'ns_material',     label: 'Material / Composition',     type: 'select', options: NS_MATERIAL,       required: false, storeIn: 'attributes', section: 'Physical Specifications' },
    { key: 'color',           label: 'Colour',                     type: 'select', options: [],                required: false, storeIn: 'column', section: 'Physical Specifications' },
    { key: 'item_length_cm',  label: 'Length',                     type: 'number', unit: 'cm',                required: false, storeIn: 'attributes', section: 'Physical Specifications' },
    { key: 'item_width_cm',   label: 'Width',                      type: 'number', unit: 'cm',                required: false, storeIn: 'attributes', section: 'Physical Specifications' },
    { key: 'item_height_cm',  label: 'Height',                     type: 'number', unit: 'cm',                required: false, storeIn: 'attributes', section: 'Physical Specifications' },
    { key: 'net_weight_g',    label: 'Net Weight',                 type: 'number', unit: 'g',                 required: false, storeIn: 'attributes', section: 'Physical Specifications' },
    { key: 'gross_weight_g',  label: 'Gross Weight (with pack)',   type: 'number', unit: 'g',                 required: false, storeIn: 'attributes', section: 'Physical Specifications' },

    // ── Packing & Shipping
    { key: 'pack_qty',        label: 'Qty / Pack',                 type: 'number',                          required: false, storeIn: 'attributes', placeholder: 'Pieces per inner pack', section: 'Packing & Shipping' },
    { key: 'pack_qty_outer',  label: 'Qty / Outer Carton',         type: 'number',                          required: false, storeIn: 'attributes', placeholder: 'Pieces per master carton', section: 'Packing & Shipping' },
    { key: 'ns_unit',         label: 'Sales Unit',                 type: 'select', options: NS_UNIT_LIST,      required: false, storeIn: 'attributes', section: 'Packing & Shipping' },
    { key: 'barcode',         label: 'EAN / Barcode',              type: 'text',                            required: false, storeIn: 'column', section: 'Packing & Shipping' },
    { key: 'hsn_code',        label: 'HSN / Tariff Code',          type: 'text',                            required: false, storeIn: 'column', section: 'Packing & Shipping' },
    { key: 'country_of_origin',label: 'Country of Manufacture',    type: 'select', options: STONE_ORIGINS,     required: false, storeIn: 'attributes', section: 'Packing & Shipping' },

    // ── Handling & Shelf Life
    { key: 'hazard_class',    label: 'Hazard / Handling Class',    type: 'select', options: HAZARD_CLASSES,    required: false, storeIn: 'attributes', section: 'Handling & Shelf Life' },
    { key: 'shelf_life_months',label: 'Shelf Life',                type: 'number', unit: 'Months',            required: false, storeIn: 'attributes', placeholder: 'Expiry / best before', section: 'Handling & Shelf Life' },
    { key: 'storage_conditions',label: 'Storage Instructions',     type: 'text',                            required: false, storeIn: 'attributes', placeholder: 'e.g. Cool dry place, keep away from fire', section: 'Handling & Shelf Life' },
    { key: 'warranty_months', label: 'Warranty Period',            type: 'number', unit: 'Months',            required: false, storeIn: 'attributes', section: 'Handling & Shelf Life' },
    { key: 'usage_directions',label: 'Usage Directions',           type: 'text',                            required: false, storeIn: 'attributes', placeholder: 'Short usage / application notes', section: 'Handling & Shelf Life' },
  ],

  // ── Legacy (kept for existing data and non-stone masonry products) ──
  blocks: [
    // ── Block Type & Identification ──
    { key: 'block_type',          label: 'Block Type',               type: 'select', options: ['Glass Block','AAC Block','Concrete Block','Fly Ash Brick','Solid Block','Hollow Block','Paver Block'], required: true,  storeIn: 'attributes', section: 'Block Identification' },
    // ── Glass Block Fields (shown for all, most relevant when block_type = Glass Block) ──
    { key: 'size',                label: 'Size (L×W)',               type: 'select', options: ['190x190 mm','240x240 mm','240x115 mm','190x90 mm','145x145 mm','200x200 mm','300x300 mm','100x100 mm','Custom'], required: true,  storeIn: 'column',     section: 'Dimensions' },
    { key: 'thickness',           label: 'Thickness (Depth)',        type: 'select', options: ['80 mm','90 mm','100 mm','60 mm','50 mm','Custom'], required: true,  storeIn: 'column',     section: 'Dimensions' },
    { key: 'color',               label: 'Colour',                   type: 'select', options: ['Clear / Transparent','Frosted / Mist','White / Opaque','Grey','Blue','Green','Amber / Bronze','Pink','Black','Custom'], required: true,  storeIn: 'column',     section: 'Appearance' },
    { key: 'finish',              label: 'Pattern / Texture',        type: 'select', options: ['Smooth / Plain','Mist / Frosted','Wavy','Granite Pattern','Fluted','Ripple','Iceberg','Diamond','Hammered','Custom'], required: true,  storeIn: 'column',     section: 'Appearance' },
    { key: 'light_transmission',  label: 'Light Transmission',       type: 'select', options: ['High (70%+)','Medium (40–70%)','Low (< 40%)','Opaque'], required: false, storeIn: 'attributes', section: 'Appearance' },
    { key: 'application',         label: 'Application Area',         type: 'select', options: ['Interior Wall','Exterior Wall / Facade','Partition Wall','Bathroom / Wet Areas','Staircase','Shower Enclosure','Commercial / Retail','Residential','Other'], required: true,  storeIn: 'column',     section: 'Application' },
    { key: 'origin',              label: 'Country of Origin',        type: 'select', options: ['India','China','Italy','Germany','France','Turkey','Vietnam','Other'], required: false, storeIn: 'column',     section: 'Identification' },
    // ── Structural / Physical (Glass Block) ──
    { key: 'weight_per_piece',    label: 'Weight Per Piece',         type: 'number', unit: 'kg',    required: false, storeIn: 'attributes', section: 'Physical Specs', placeholder: 'e.g. 2.5' },
    { key: 'thermal_insulation',  label: 'Thermal Insulation (U-value)', type: 'text', required: false, storeIn: 'attributes', section: 'Physical Specs', placeholder: 'e.g. 2.5 W/m²K' },
    { key: 'sound_insulation',    label: 'Sound Insulation',         type: 'text', required: false, storeIn: 'attributes', section: 'Physical Specs', placeholder: 'e.g. Rw 40 dB' },
    // ── Packing ──
    { key: 'pcs_per_box',         label: 'Pieces Per Box / Pack',    type: 'number', required: false, storeIn: 'column',     section: 'Packing', placeholder: 'e.g. 6, 8, 10' },
    { key: 'weight_per_box',      label: 'Weight Per Box',           type: 'number', unit: 'kg', required: false, storeIn: 'column',     section: 'Packing' },
    // ── Masonry Block Fields (AAC / Concrete) ──
    { key: 'grade',               label: 'Grade / Strength Class',   type: 'select', options: BLOCK_GRADE_CB,    required: false, storeIn: 'column',     section: 'Masonry Specs' },
    { key: 'compressive_strength',label: 'Compressive Strength',     type: 'number', unit: 'N/mm²',             required: false, storeIn: 'attributes', section: 'Masonry Specs' },
    { key: 'density',             label: 'Density',                  type: 'number', unit: 'kg/m³',             required: false, storeIn: 'attributes', section: 'Masonry Specs' },
    { key: 'pcs_per_cubic_m',     label: 'Pieces / m³',              type: 'number',                            required: false, storeIn: 'attributes', section: 'Masonry Specs' },
  ],

  sanitaryware: [
    { key: 'product_kind',    label: 'Product Type',               type: 'select', options: SANITARY_TYPE,     required: true,  storeIn: 'attributes', section: 'Sanitaryware Details' },
    { key: 'mounting',        label: 'Mounting',                   type: 'select', options: SANITARY_MOUNT,     required: true,  storeIn: 'attributes', section: 'Sanitaryware Details' },
    { key: 'color',           label: 'Colour',                     type: 'select', options: [],                required: true,  storeIn: 'column',    placeholder: 'e.g. White / Ivory', section: 'Sanitaryware Details' },
    { key: 'dimensions',      label: 'Dimensions (W×D×H)',         type: 'select', options: [],                unit: 'mm',      required: true,  storeIn: 'attributes', placeholder: 'e.g. 660x380x710', section: 'Sanitaryware Details' },
    { key: 'flush_type',      label: 'Flush Type',                 type: 'select', options: FLUSH_TYPES,       required: false, storeIn: 'attributes', section: 'Sanitaryware Details' },
    { key: 'design',          label: 'Model / Design',             type: 'select', options: [],                required: false, storeIn: 'column', section: 'Sanitaryware Details' },
  ],

  other: [
    { key: 'size',      label: 'Size',      type: 'select', options: [], required: true,  storeIn: 'column', section: 'General Product Details' },
    { key: 'finish',    label: 'Finish',    type: 'select', options: [], required: false, storeIn: 'column', section: 'General Product Details' },
    { key: 'color',     label: 'Colour',    type: 'select', options: [], required: false, storeIn: 'column', section: 'General Product Details' },
    { key: 'material',  label: 'Material',  type: 'select', options: [], required: false, storeIn: 'column', section: 'General Product Details' },
    { key: 'thickness', label: 'Thickness', type: 'select', options: [], unit: 'mm', required: false, storeIn: 'column', section: 'General Product Details' },
  ],
}

// Sensible default unit per product type (used to preselect the Unit field).
export const CATEGORY_DEFAULT_UNIT = {
  tiles:         'Box',
  granite:       'Sq Ft',
  marble:        'Sq Ft',
  stone_block:   'CBM',
  blocks:        'Nos',
  sanitaryware:  'Piece',
  non_sanitary:  'Nos',
  other:         'Nos',
}

/**
 * Match a free-text category / sub-category name to one of the known product
 * types. Falls back to 'other' when nothing matches.
 * NOTE: keyword checks are ordered — more specific first.
 */
export function matchCategoryType(...names) {
  const text = names.filter(Boolean).join(' ').toLowerCase()
  if (!text) return 'other'

  if (/\b(granite)\b/.test(text))                                                          return 'granite'
  if (/\b(marble|onyx|travertine|quartzite?|limestone|sandstone|slate|basalt|travertin)\b/.test(text)) return 'marble'
  if (/\b(stone.?block|quarry.?block|raw.?block|granite.?block|marble.?block|block.?stone)\b/.test(text)) return 'stone_block'
  if (/\b(aac|block|brick|paver|clc|fly.?ash|hollow.?block|solid.?block)\b/.test(text))   return 'blocks'
  if (/\b(sanitary|basin|closet|wc|urinal|cistern|toilet|bidet|pedestal|water.?closet)\b/.test(text)) return 'sanitaryware'
  if (/\b(non.?sanitary|accessory|chemical|adhesive|grout|sealer|tool|hardware|packaging)\b/.test(text)) return 'non_sanitary'
  if (/\b(tile|tiles|vitrified|ceramic|porcelain|mosaic|gvt|pgvt|double.?charge)\b/.test(text)) return 'tiles'
  return 'other'
}

/** Return the field list for a category type (never undefined). */
export function fieldsForType(type) {
  return PRODUCT_FIELD_SCHEMA[type] || PRODUCT_FIELD_SCHEMA.other
}

/** Human label for a product type (shown in form headings etc). */
export function labelForType(type) {
  const map = {
    tiles:          'Tiles / Vitrified',
    granite:        'Granite (Natural Stone)',
    marble:         'Marble / Decorative Stone',
    stone_block:    'Natural Stone Block (Quarry Block)',
    blocks:         'Glass Block / AAC / Concrete Block',
    sanitaryware:   'Sanitaryware',
    non_sanitary:   'Non-Sanitary / General Items',
    other:          'General Product',
  }
  return map[type] || 'General Product'
}

/** Short one/two word label (for dropdowns, chips). */
export function shortLabelForType(type) {
  const map = {
    tiles:          'Tiles',
    granite:        'Granite',
    marble:         'Marble',
    stone_block:    'Stone Block',
    blocks:         'Blocks',
    sanitaryware:   'Sanitaryware',
    non_sanitary:   'Non-Sanitary',
    other:          'Other',
  }
  return map[type] || 'Other'
}

/** Humanize an attribute key that has no schema definition. */
export function humanizeKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bMm\b/g, '(mm)')
    .replace(/\bFt\b/g, '(ft)')
    .replace(/\bCbm\b/g, 'CBM')
    .replace(/\bSqft\b/g, 'Sq.Ft')
    .replace(/\bSku\b/g, 'SKU')
    .replace(/\bEan\b/g, 'EAN')
    .replace(/\bHsn\b/g, 'HSN')
    .replace(/\bWc\b/g, 'WC')
}
