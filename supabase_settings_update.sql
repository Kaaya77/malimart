-- 1. Add new columns to vendor_profiles (Seller Settings)
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS business_reg_no TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS return_policy TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS auto_reply_message TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS google_analytics_id TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS order_notifications BOOLEAN DEFAULT true;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS stock_alerts BOOLEAN DEFAULT true;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS message_alerts BOOLEAN DEFAULT true;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT false;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS vrn TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS payout_schedule TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS processing_time TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS warranty TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS social_links JSONB;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS shipping_zones JSONB;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS payment_methods JSONB;

-- 2. Add new columns to profiles (Buyer Settings)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS newsletter BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_visibility BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_auth BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- 3. Create platform_settings table (Admin Settings)
CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY,
    maintenance_mode BOOLEAN DEFAULT false,
    new_signups BOOLEAN DEFAULT true,
    global_commission INTEGER DEFAULT 5,
    auto_approve_vendors BOOLEAN DEFAULT false
);

-- 4. Insert default platform settings if not exists
INSERT INTO platform_settings (id, maintenance_mode, new_signups, global_commission, auto_approve_vendors)
VALUES (1, false, true, 5, false)
ON CONFLICT (id) DO NOTHING;
