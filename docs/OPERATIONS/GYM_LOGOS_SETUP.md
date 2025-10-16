# 🎨 Gym Logos Setup Guide
## How to Add Gym Logos to Supabase Storage

**Last Updated:** January 7, 2025  
**Status:** Ready to Implement  
**Storage Location:** Supabase Storage Bucket

---

## 🎯 Overview

Your calendar now supports **circular gym logo badges** in the left column! When you add logos to Supabase, they'll automatically replace the colored placeholders.

---

## 📋 STEP-BY-STEP SETUP

### **Step 1: Create Storage Bucket in Supabase**

1. Go to: `https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf`
2. Click **"Storage"** in left sidebar
3. Click **"Create a new bucket"**
4. Settings:
   - **Name:** `gym-logos`
   - **Public bucket:** ✅ YES (so images can be displayed)
   - **File size limit:** 1MB (plenty for logos)
   - **Allowed MIME types:** `image/png, image/jpeg, image/jpg, image/webp`
5. Click **"Create bucket"**

---

### **Step 2: Upload Gym Logos**

**Required Logo Files:**

Upload these files to your `gym-logos` bucket:

```
gym-logos/
├── CCP.png  (Capital Gymnastics Cedar Park)
├── CPF.png  (Capital Gymnastics Pflugerville)
├── CRR.png  (Capital Gymnastics Round Rock)
├── HGA.png  (Houston Gymnastics Academy)
├── RBA.png  (Rowland Ballard Atascocita)
├── RBK.png  (Rowland Ballard Kingwood)
├── EST.png  (Estrella Gymnastics)
├── OAS.png  (Oasis Gymnastics)
├── SGT.png  (Scottsdale Gymnastics)
└── TIG.png  (Tigar Gymnastics)
```

**How to Upload:**
1. In Supabase Storage, open the `gym-logos` bucket
2. Click **"Upload file"**
3. Select logo file
4. Repeat for all 10 gyms

**Logo Requirements:**
- **Format:** PNG or JPG (PNG recommended for transparency)
- **Size:** 200x200px minimum (will be displayed at 40x40px)
- **Shape:** Square (will be cropped to circle automatically)
- **File size:** Under 500KB each
- **Background:** Transparent PNG works best

---

### **Step 3: Add Logo URLs to Database**

#### **Option A: Get Public URLs from Supabase**

1. In Supabase Storage, click on uploaded logo
2. Click **"Copy URL"**
3. URL format: `https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/CCP.png`

#### **Option B: Use SQL to Update All at Once**

Run this in Supabase SQL Editor:

```sql
-- Add logo_url column to gyms table (if not exists)
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Update all gym logos with Supabase Storage URLs
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/CCP.png' WHERE id = 'CCP';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/CPF.png' WHERE id = 'CPF';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/CRR.png' WHERE id = 'CRR';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/HGA.png' WHERE id = 'HGA';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/RBA.png' WHERE id = 'RBA';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/RBK.png' WHERE id = 'RBK';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/EST.png' WHERE id = 'EST';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/OAS.png' WHERE id = 'OAS';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/SGT.png' WHERE id = 'SGT';
UPDATE gyms SET logo_url = 'https://xftiwouxpefchwoxxgpf.supabase.co/storage/v1/object/public/gym-logos/TIG.png' WHERE id = 'TIG';

-- Verify logos were added
SELECT id, name, logo_url FROM gyms ORDER BY id;
```

---

### **Step 4: Test in Your App**

1. Refresh your calendar app
2. Logos should appear automatically!
3. If logo fails to load, colored badge shows as fallback

---

## 🎨 Current Status: Colored Placeholders

**Until you upload logos, the calendar shows colored badges:**

| Gym | Color | Badge |
|-----|-------|-------|
| CCP | Blue (#1f53a3) | CCP in white circle |
| CPF | Blue (#1f53a3) | CPF in white circle |
| CRR | Pink (#ff1493) | CRR in white circle |
| HGA | Red (#c91724) | HGA in white circle |
| RBA | Navy (#1a3c66) | RBA in white circle |
| RBK | Navy (#1a3c66) | RBK in white circle |
| EST | Dark Navy (#011837) | EST in white circle |
| OAS | Teal (#3eb29f) | OAS in white circle |
| SGT | Orange-Red (#c72b12) | SGT in white circle |
| TIG | Orange (#f57f20) | TIG in white circle |

**These look professional but real logos will be even better!**

---

## 🔧 How the Code Works

**Logo Display Logic:**

```javascript
const logoUrl = gym.logo_url; // From Supabase gyms table

if (logoUrl) {
  // Show real logo image
  <img src={logoUrl} className="w-10 h-10 rounded-full" />
} else {
  // Show colored placeholder badge
  <div style={{ backgroundColor: gymColor }}>
    {gymId}
  </div>
}
```

**Features:**
- ✅ Automatic fallback if logo fails to load
- ✅ Circular cropping with CSS
- ✅ 40×40px display size
- ✅ Shadow and border for polish
- ✅ No code changes needed - just add database URLs!

---

## 📝 Where to Get Gym Logos

### **Option 1: From Gym Websites**
- Visit each gym's website
- Right-click logo → "Save image as..."
- Save as PNG with gym ID name

### **Option 2: From Social Media**
- Facebook profile pictures
- Instagram profile pictures
- Usually high resolution

### **Option 3: Request from Gyms**
- Email: "Can you send your logo for our calendar system?"
- Most gyms have logo files ready

### **Option 4: Already Have Them?**
- Check your email/Google Drive/computer
- You might already have these from previous projects

---

## 🎯 Quick Checklist

- [ ] Create `gym-logos` bucket in Supabase Storage
- [ ] Make bucket public
- [ ] Upload 10 gym logos (CCP, CPF, CRR, HGA, RBA, RBK, EST, OAS, SGT, TIG)
- [ ] Add `logo_url` column to gyms table
- [ ] Update gyms table with Storage URLs
- [ ] Refresh app to see logos!

---

## 💡 Pro Tips

### **Logo Preparation:**
1. **Crop to square** before uploading
2. **Remove background** if possible (PNG transparency)
3. **High resolution** (200×200px minimum)
4. **Consistent style** across all gyms

### **Naming Convention:**
- Use gym ID codes: `CCP.png` not `capital-cedar-park.png`
- All caps for consistency
- Same file extension for all

### **Testing:**
- Upload one logo first to test
- Verify it displays correctly
- Then batch upload the rest

---

## 🚨 Troubleshooting

### **Logo doesn't show:**
- Check file name matches gym ID exactly
- Verify bucket is public
- Check logo URL in gyms table is correct
- Look for browser console errors

### **Logo looks blurry:**
- Upload higher resolution image
- Minimum 200×200px recommended

### **Logo shape is wrong:**
- Save as square image (1:1 ratio)
- CSS automatically makes it circular

---

## 🎉 Result

Once set up, your calendar will have:
- ✅ **Professional gym logos** in left column
- ✅ **Circular badges** (40×40px)
- ✅ **Instant visual recognition**
- ✅ **Brand consistency**
- ✅ **Event counts** below each logo

**This makes your calendar look like a professional SaaS product!** 🚀

---

**Next Steps:** Whenever you're ready, follow Step 1 to create the Supabase Storage bucket!




