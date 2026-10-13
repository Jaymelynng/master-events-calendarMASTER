> ⚠️ STALE (checked 2026-10-13): the 10-gym checklist and "Special Events" are out of date — the sync now lists every gym from the `gyms` table and every bucket from `event_types` (CLINIC, KIDS NIGHT OUT, OPEN GYM, CAMP, CAMP CARE, SPECIALTY, UNSORTED), and there is a SYNC ALL GYMS button that does every gym in one go (`SyncModal.js:69-82, 198, 1263`). Current: `docs/OPERATIONS/AUTO-SYNC-GUIDE.md` (also stale) / the Sync modal itself.

# 📋 SYNC QUICK REFERENCE
## For Non-Technical Users

**Last Updated:** December 28, 2025

---

## 🎯 THE BASICS

**What is Sync?**  
Sync pulls event information from iClassPro and puts it in our calendar.

**Why do we need it?**  
So our calendar always matches what's in iClassPro without manual data entry.

**How often should I sync?**  
- Monthly: Full sync of all gyms (required)
- Weekly: Quick check of gyms that changed (recommended)

---

## 🚀 THE FASTEST WAY (SYNC ALL)

### Step-by-Step:

1. **Open the Calendar** (teamcalendar.mygymtools.com)

2. **Shift+Click the 🪄 wand** (in stats table header) → Admin Dashboard opens

3. **Go to Quick Actions tab → Click "Automated Sync"**

4. **Click a gym name** (like "Capital Gymnastics Cedar Park")

5. **Click the big purple button:**
   
   ```
   🚀 SYNC ALL PROGRAMS
   ```

6. **Wait 30-60 seconds** (you'll see a spinning icon)

7. **See your results** - it will show:
   - CAMP: 36
   - KNO: 2
   - OPEN GYM: 2
   - etc.

8. **Click "🚀 Import X Events"** (green button)

9. **Done!** Click "🏢 Sync Another Gym" and repeat

---

## ⏱️ TIME GUIDE

| Task | Time |
|------|------|
| Sync ONE gym (all programs) | ~1-2 minutes |
| Sync ALL 10 gyms | ~10-15 minutes |
| Monthly full sync | ~15-20 minutes |

---

## 🎨 COLOR GUIDE (Progress Tracker)

| Color | Meaning |
|-------|---------|
| 🟢 **Green** | Synced! Events found |
| 🟡 **Yellow** | Synced! No events scheduled (that's OK) |
| 🔴 **Red/Pink** | Needs to be synced |

---

## ❓ COMMON QUESTIONS

### "What does SYNC ALL include?"
Everything! Kids Night Out, Clinics, Open Gym, ALL Camps (summer + school year), and Special Events.

### "What about camps - does it get summer AND school year?"
YES! One click gets all camp types:
- School Year Full Day
- School Year Half Day (if gym offers it)
- Summer Full Day
- Summer Half Day (if gym offers it)

### "Why does one column show a different time?"
That program type might not be offered at that gym. The system only syncs what exists.

### "What if it says 'No Events'?"
That's fine! It just means that gym doesn't have any of that event type scheduled right now. Yellow is OK.

### "Do I need to sync each event type separately?"
NO! Use "SYNC ALL PROGRAMS" to get everything at once. It's faster!

### "What if I only want to update one thing?"
You can still click individual buttons (KNO, CLINIC, etc.) below the SYNC ALL button.

---

## 🆘 IF SOMETHING GOES WRONG

### "It's taking forever"
- Normal: 30-60 seconds for SYNC ALL
- Too long: Close and try again

### "Invalid or missing API key"
- Check Vercel environment variables
- Make sure `REACT_APP_API_KEY` matches Railway's `API_KEY`

### "Import failed"
- Wait a minute and try again
- Check if Railway is running (API health check)

### "Events not showing on calendar"
- Hard refresh: Ctrl + Shift + R
- Make sure you're looking at the right month

### "Still having problems"
- Take a screenshot of the error
- Send to developer

---

## 📞 NEED HELP?

1. Check this guide first
2. Try closing and reopening the sync modal
3. Ask developer with screenshot of error

---

## ✅ MONTHLY CHECKLIST

```
□ Shift+Click 🪄 wand → Admin Dashboard → Quick Actions → Automated Sync
□ CCP (Cedar Park) - SYNC ALL - Import
□ CPF (Pflugerville) - SYNC ALL - Import
□ CRR (Round Rock) - SYNC ALL - Import
□ EST (Estrella) - SYNC ALL - Import
□ HGA (Houston) - SYNC ALL - Import
□ OAS (Oasis) - SYNC ALL - Import
□ RBA (RB Atascocita) - SYNC ALL - Import
□ RBK (RB Kingwood) - SYNC ALL - Import
□ SGT (Scottsdale) - SYNC ALL - Import
□ TIG (Tigar) - SYNC ALL - Import
□ All gyms showing green/yellow ✓
□ Done! 🎉
```

---

**That's it! You're a sync pro now!** 🏆


