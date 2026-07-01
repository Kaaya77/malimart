
import { Product } from './types';

// Constants
export const APP_NAME = "MaliMart";
export const CURRENCY = "TZS";

/**
 * Role-aware path for "message this seller". Buyers get the rich inbox
 * (MessagingHub with product/order context); sellers and admins go to the
 * unified /messages thread — sending a seller to /buyer just bounces them
 * off the role guard and loses the intent.
 */
export const messageSellerPath = (role: string | undefined | null, sellerId: string) =>
  role === 'buyer' || !role
    ? `/buyer?tab=inbox&sellerId=${sellerId}`
    : `/messages/${sellerId}`;

// Formatter
export const formatTZS = (amount: number | null | undefined) =>
  (amount || 0).toLocaleString('sw-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Price Helper
export const getEffectiveUnitPrice = (item: any): number => {
  if (typeof item.price_at_add === 'number' && item.price_at_add > 0) {
    return item.price_at_add;
  }
  if (item.selectedVariant) {
    return item.selectedVariant.sale_price ?? item.selectedVariant.base_price ?? 0;
  }
  return item.price ?? 0;
};

export const calculateVatIncluded = (gross: number, vatDecimal: number): number => {
  if (vatDecimal <= 0) return 0;
  const ex = gross / (1 + vatDecimal);
  return gross - ex;
};

export const normalizeVatRate = (raw?: number): number => {
  if (raw === undefined) return 0.18;
  return raw > 1 ? raw / 100 : raw;
};

// --- VALIDATION LOGIC ---
export const isValidTanzanianPhone = (phone: string): boolean => {
  // Matches 07xxxxxxxx, 06xxxxxxxx, +2557xxxxxxxx, +2556xxxxxxxx
  const regex = /^(0|\+255)[67]\d{8}$/;
  return regex.test(phone.replace(/\s/g, ''));
};

export const isValidTIN = (tin: string): boolean => {
  // TIN should be exactly 9 digits, optionally formatted with hyphens (e.g., 123-456-789)
  const digitsOnly = tin.replace(/\D/g, '');
  return digitsOnly.length === 9;
};

export const isValidVRN = (vrn: string): boolean => {
  // VRN in Tanzania is typically 9 digits, sometimes with a 'V' or 'W' at the end.
  // We'll just check if it has at least 9 digits.
  const digitsOnly = vrn.replace(/\D/g, '');
  return digitsOnly.length >= 9;
};

export const resolveShippingFee = (
  region: string, 
  district: string, 
  baseFee: number, 
  shippingZones: {region: string, district: string, fee: number}[]
): number => {
  // 1. Check for specific District match
  const districtMatch = shippingZones.find(z => z.region === region && z.district === district);
  if (districtMatch) return districtMatch.fee;

  // 2. Check for Region-wide match ('All Districts')
  const regionMatch = shippingZones.find(z => z.region === region && z.district === 'All Districts');
  if (regionMatch) return regionMatch.fee;

  // 3. Fallback to Base Fee
  return baseFee;
};

// Centralized Category Data
export const CATEGORY_HIERARCHY: Record<string, string[]> = {
  'Fashion & Beauty': ['Men', 'Women', 'Fabrics', 'Jewelry', 'Skincare', 'Shoes', 'Bags'],
  'Pantry & Spices': ['Coffee', 'Tea', 'Whole Spices', 'Masala Blends', 'Honey & Preserves', 'Grains', 'Snacks'],
  'Handicrafts': ['Wood Carvings', 'Paintings', 'Sculptures', 'Traditional Masks', 'Souvenirs', 'Pottery'],
  'Electronics': ['Mobile Phones', 'Audio', 'Accessories', 'Small Appliances', 'Laptops', 'Cameras'],
  'Home & Living': ['Furniture', 'Home Decor', 'Kitchenware', 'Bedding', 'Lighting', 'Rugs'],
  'Agriculture': ['Seeds & Saplings', 'Fertilizers', 'Farm Tools', 'Animal Feed', 'Poultry', 'Livestock', 'Fresh Produce'],
  'Construction': ['Cement & Building Materials', 'Paints & Finishes', 'Plumbing', 'Electrical', 'Hardware Tools', 'Roofing', 'Tiles & Flooring'],
  'Kids & Toys': ['Educational', 'Dolls & Action Figures', 'Outdoor Play', 'Baby Gear', 'School Supplies', 'Children Clothing'],
  'Vehicles': ['Car Parts', 'Motorcycle Parts', 'Car Accessories', 'Tires & Rims', 'Oils & Fluids', 'Safety Gear'],
  'Books & Stationery': ['Textbooks', 'Fiction & Non-Fiction', 'Notebooks & Paper', 'Office Supplies', 'Art Supplies', 'Greeting Cards']
};

// Standardized Data for Dropdowns
export const TANZANIA_REGIONS = [
  'Dar es Salaam', 'Arusha', 'Dodoma', 'Mwanza', 'Zanzibar', 'Mbeya', 
  'Morogoro', 'Tanga', 'Kilimanjaro', 'Kigoma', 'Tabora', 'Iringa',
  'Kagera', 'Mara', 'Shinyanga', 'Ruvuma', 'Mtwara', 'Lindi', 'Singida',
  'Rukwa', 'Pwani (Coast)', 'Manyara', 'Geita', 'Katavi', 'Njombe', 'Simiyu', 'Songwe'
];

export const TANZANIA_DISTRICTS: Record<string, string[]> = {
  'Dar es Salaam': ['Ilala', 'Kinondoni', 'Temeke', 'Kigamboni', 'Ubungo'],
  'Arusha': ['Arusha City', 'Arumeru', 'Karatu', 'Longido', 'Monduli', 'Ngorongoro'],
  'Dodoma': ['Dodoma City', 'Bahi', 'Chamwino', 'Chemba', 'Kondoa', 'Kongwa', 'Mpwapwa'],
  'Mwanza': ['Nyamagana', 'Ilemela', 'Sengerema', 'Magu', 'Misungwi', 'Ukerewe', 'Kwimba'],
  'Zanzibar': ['Mjini Magharibi', 'Kaskazini Unguja', 'Kusini Unguja', 'Kaskazini Pemba', 'Kusini Pemba'],
  'Mbeya': ['Mbeya City', 'Chunya', 'Kyela', 'Mbarali', 'Rungwe', 'Busokelo'],
  'Morogoro': ['Morogoro Urban', 'Kilosa', 'Kilombero', 'Ulanga', 'Mvomero', 'Gairo', 'Malinyi'],
  'Tanga': ['Tanga City', 'Muheza', 'Korogwe', 'Lushoto', 'Handeni', 'Pangani', 'Kilindi', 'Mkinga'],
  'Kilimanjaro': ['Moshi Urban', 'Hai', 'Rombo', 'Mwanga', 'Same', 'Siha'],
  'Kigoma': ['Kigoma-Ujiji', 'Kasulu', 'Kibondo', 'Uvinza', 'Buhigwe', 'Kakonko'],
  'Tabora': ['Tabora Urban', 'Nzega', 'Igunga', 'Urambo', 'Sikonge', 'Uyui', 'Kaliua'],
  'Iringa': ['Iringa Urban', 'Iringa Rural', 'Kilolo', 'Mufindi'],
};

export const MOBILE_MONEY_PROVIDERS = ['M-Pesa (Vodacom)', 'Tigo Pesa', 'Airtel Money', 'HaloPesa', 'Ezypesa (Zantel)', 'T-Pesa (TTCL)'];
export const BANK_PROVIDERS = ['CRDB Bank', 'NMB Bank', 'Equity Bank', 'KCB Bank', 'Stanbic Bank', 'Standard Chartered', 'NBC', 'Absa Bank', 'Exim Bank'];
export const SOCIAL_PLATFORMS = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'X (Twitter)', 'YouTube', 'LinkedIn'];