import { startOfDay } from 'date-fns';

const BASE_PRICES = {
  gutter_1_2_bed: 175, 
  gutter_3_4_bed: 225, 
  gutter_5_plus_bed: 275,
  window_ext: 8, 
  window_int: 8, 
  window_both: 14,
  ladder_2_story: 50, 
  ladder_3_story: 75,
  ladder_roof_only_2_story: 25,
  ladder_roof_only_3_story: 50,
  gutter_2_story_addon: 50, 
  gutter_polish_1: 50, gutter_polish_2: 75,
  pressure_1_car: 125, pressure_2_car: 175, pressure_3_car: 225,
  patio_base: 125,
  travel_surcharge: 80,
  deluxe_per_window: 2,
  MINIMUM_SERVICE_FEE: 175,
  skylight_ext: 13.5,
  skylight_int: 13.5,
  skylight_both: 18,
  solar_panel: 15,
  roof_blowoff_1_2: 100, 
  roof_blowoff_3_4: 150, 
  roof_blowoff_5: 200,
  moss_baking_soda_1_2: 40, moss_baking_soda_3_4: 50, moss_baking_soda_5: 60,
  moss_acid_wash_1_2: 250, 
  moss_acid_wash_3_4: 350, 
  moss_acid_wash_5: 450
};

const PATIO_PRICES: Record<string, number> = { 'xs': 125, 'small': 200, 'medium': 300, 'large': 325, 'xl': 400, 'xxl': 500 };
const PATIO_TIMES: Record<string, number> = { 'xs': 45, 'small': 90, 'medium': 120, 'large': 150, 'xl': 180, 'xxl': 240 };
const FENCE_PRICES: Record<string, number> = { '0-25': 50, '26-50': 100, '51-75': 150, '76-100': 200, '101-125': 250, '126-150': 300, '151+': 400 };
const FENCE_TIMES: Record<string, number> = { '0-25': 45, '26-50': 80, '51-75': 120, '76-100': 160, '101-125': 200, '126-150': 240, '151+': 300 };
const TREX_PRICES: Record<string, number> = { 'xs': 125, 'small': 200, 'medium': 300, 'large': 325, 'xl': 400, 'xxl': 500 };
const TREX_TIMES: Record<string, number> = { 'xs': 45, 'small': 90, 'medium': 120, 'large': 150, 'xl': 180, 'xxl': 240 };

export const TIME_SLOT_MAP: Record<string, string> = {
  'morning': '8:00 AM',
  'midday': '11:30 AM',
  'afternoon': '3:00 PM',
};

export const normalizeSlot = (slot: string) => {
  if (!slot) return 'morning';
  const s = slot.toLowerCase();
  if (s === 'morning' || s.includes('8:00')) return 'morning';
  if (s === 'midday' || s.includes('11:30')) return 'midday';
  if (s === 'afternoon' || s.includes('3:00')) return 'afternoon';
  return 'morning';
};

export const calculateJobStats = (jobData: any) => {
  if (jobData.isGoBack) {
    const redoMins = Number(jobData.redoDuration) || 30;
    return {
      total: "0.00",
      timeDisplay: `${Math.floor(redoMins / 60)}h ${redoMins % 60}m`,
      srv: jobData.selectedServices || ["Go-Back / Redo"],
      lineItems: [{ name: "Redo / Warranty", price: 0 }],
      serviceJobs: [{ name: "Go-Back / Redo", time: redoMins }],
      discounts: [],
      totalMinutes: redoMins,
      savings: "0.00",
      discountRate: "0",
      daysRequired: 1,
      isGoBack: true,
      referralBonus: "0.00",
      bundleSavings: "0.00",
      manualCredit: "0.00"
    };
  }

  let taxableSubtotal = 0;
  let nonTaxableSubtotal = 0;
  let totalMinutes = 0;
  let coreDiscountableBase = 0;
  const lineItems: { name: string; price: number }[] = [];
  const rawServiceJobs: { name: string; time: number }[] = [];

  const stories = Number(jobData.stories) || 1;
  const srv: string[] = Array.isArray(jobData.selectedServices) ? [...jobData.selectedServices] : [];
  const windowCount = Number(jobData.windowCount) || 0;
  const homeSize = jobData.homeSize || '1-2';

  // --- DYNAMIC TAX RATE LOGIC ---
  const getTaxRate = (city: string, branch: string) => {
    const c = (city || '').toLowerCase();
    const b = (branch || '').toLowerCase();

    // Pierce County (Tacoma/Puyallup)
    if (b.includes('tacoma') || b.includes('puyallup')) {
      if (c.includes('tacoma') || c.includes('ruston')) return 0.103;
      return 0.100; // Lakewood, Puyallup, Sumner, etc.
    }
    // Walla Walla County
    if (b.includes('walla')) {
      if (c.includes('walla') || c.includes('college')) return 0.090;
      return 0.082;
    }
    // Tri-Cities (Benton/Franklin)
    if (b.includes('tri')) {
      if (c.includes('finley')) return 0.080;
      if (c.includes('burbank')) return 0.082;
      return 0.087; // Kennewick, Pasco, Richland
    }
    return 0.087; // Default fallback
  };

  const TAX_RATE = getTaxRate(jobData.city, jobData.branch);

  // --- HEIGHT SURCHARGE LOGIC ---
  const hasStandardLadderService = (
    srv.includes('Gutter Cleaning') || 
    (srv.includes('Window Cleaning') && (jobData.windowType === 'exterior' || jobData.windowType === 'both')) ||
    jobData.mossAcidWash ||
    srv.includes('Solar Panel Cleaning')
  );

  let ladderPrice = 0;
  if (hasStandardLadderService) {
    ladderPrice = (stories === 2 || stories === 1.5) ? BASE_PRICES.ladder_2_story : stories === 3 ? BASE_PRICES.ladder_3_story : 0;
  } else if (jobData.roofBlowOff || jobData.mossTreatment) {
    ladderPrice = (stories === 2 || stories === 1.5) ? BASE_PRICES.ladder_roof_only_2_story : stories === 3 ? BASE_PRICES.ladder_roof_only_3_story : 0;
  }

  let ladderFeeClaimed = false;

  if (srv.includes('Window Cleaning')) {
    const windowType = jobData.windowType || 'none';
    if (windowType !== 'none') {
      const rate = windowType === 'both' ? BASE_PRICES.window_both : windowType === 'interior' ? BASE_PRICES.window_int : BASE_PRICES.window_ext;
      const typeLabel = windowType === 'both' ? 'E/I' : windowType === 'interior' ? 'INT' : 'EXT';
      let winPrice = (windowCount * rate);
      let winMins = (windowCount * (windowType === 'both' ? 9 : 5)) + 40;
      if (!ladderFeeClaimed && (windowType === 'exterior' || windowType === 'both') && ladderPrice > 0) { winPrice += ladderPrice; ladderFeeClaimed = true; }
      nonTaxableSubtotal += winPrice; coreDiscountableBase += winPrice; totalMinutes += winMins;
      lineItems.push({ name: `Window Cleaning ${typeLabel} (${windowCount})`, price: winPrice });
      rawServiceJobs.push({ name: 'Window Cleaning', time: winMins });
      if (jobData.deluxeWindow) { const sPrice = windowCount * BASE_PRICES.deluxe_per_window; nonTaxableSubtotal += sPrice; totalMinutes += (windowCount * 2); lineItems.push({ name: "Screen Cleaning", price: sPrice }); }
    }
    const sExt = Number(jobData.skylightCount) || 0;
    const sInt = Number(jobData.skylightInteriorCount) || 0;
    const sBoth = Math.min(sExt, sInt);
    const skyPrice = (sBoth * BASE_PRICES.skylight_both) + ((sExt - sBoth) * BASE_PRICES.skylight_ext) + ((sInt - sBoth) * BASE_PRICES.skylight_int);
    if (skyPrice > 0) {
      nonTaxableSubtotal += skyPrice; const sMins = (sBoth * 15) + (Math.abs(sExt - sInt) * 10); totalMinutes += sMins;
      
      let skyLabel = 'Skylights';
      if (sExt === sInt) {
        skyLabel = `Skylights E/I (${sExt})`;
      } else {
        const parts = [];
        if (sExt > 0) parts.push(`EXT ${sExt}`);
        if (sInt > 0) parts.push(`INT ${sInt}`);
        skyLabel = `Skylights: ${parts.join(' / ')}`;
      }
      
      lineItems.push({ name: skyLabel, price: skyPrice });
      const existingIdx = rawServiceJobs.findIndex(j => j.name === 'Window Cleaning');
      if (existingIdx >= 0) rawServiceJobs[existingIdx].time += sMins; else rawServiceJobs.push({ name: 'Skylights', time: sMins });
    }
  }

  if (srv.includes('Gutter Cleaning')) {
    let gutterBase = homeSize === '3-4' ? BASE_PRICES.gutter_3_4_bed : homeSize === '5+' ? BASE_PRICES.gutter_5_plus_bed : BASE_PRICES.gutter_1_2_bed;
    let gutterMins = (homeSize === '3-4' ? 80 : homeSize === '5+' ? 105 : 60) + (stories >= 2 ? 30 : 0);
    if (!ladderFeeClaimed && ladderPrice > 0) { gutterBase += ladderPrice; ladderFeeClaimed = true; }
    
    // Extra time for add-ons
    if (jobData.gutterFlush) {
      gutterMins += (homeSize === '3-4' ? 30 : homeSize === '5+' ? 45 : 20);
    }
    if (jobData.deluxeGutter) {
      gutterMins += (homeSize === '3-4' ? 60 : homeSize === '5+' ? 90 : 45);
    }

    taxableSubtotal += gutterBase; coreDiscountableBase += gutterBase; totalMinutes += gutterMins;
    lineItems.push({ name: "Gutter Cleaning", price: gutterBase });
    rawServiceJobs.push({ name: 'Gutter Cleaning', time: gutterMins });
    if (jobData.gutterFlush) { const gfPrice = (homeSize === '3-4' ? 50 : homeSize === '5+' ? 60 : 40); taxableSubtotal += gfPrice; lineItems.push({ name: "Downspout Flush", price: gfPrice }); }
    if (jobData.deluxeGutter) { const dgPrice = (stories >= 2 ? BASE_PRICES.gutter_polish_2 : BASE_PRICES.gutter_polish_1); taxableSubtotal += dgPrice; lineItems.push({ name: "Ext. Gutter Wash", price: dgPrice }); }
  }

  if (srv.includes('Pressure Washing')) {
    let pwMins = 0;
    if (jobData.drivewaySize && jobData.drivewaySize !== 'none') {
      const pwBase = jobData.drivewaySize === '5+' ? BASE_PRICES.pressure_3_car : jobData.drivewaySize === '3-4' ? BASE_PRICES.pressure_2_car : BASE_PRICES.pressure_1_car;
      const dMins = (jobData.drivewaySize === '5+' ? 165 : jobData.drivewaySize === '3-4' ? 120 : 90);
      taxableSubtotal += pwBase; coreDiscountableBase += pwBase; pwMins += dMins;
      lineItems.push({ name: `Driveway (${jobData.drivewaySize} Car)`, price: pwBase });
    }
    if (jobData.patioSize && jobData.patioSize !== 'none') {
      const pSize = jobData.patioSize as string;
      const pPrice = PATIO_PRICES[pSize] || 0; const pMins = PATIO_TIMES[pSize] || 60;
      taxableSubtotal += pPrice; pwMins += pMins;
      lineItems.push({ name: `Patio/Walkways (${pSize.toUpperCase()})`, price: pPrice });
    }
    if (jobData.sidingCleaning) {
      const sPrice = (homeSize === '5+' ? 450 : homeSize === '3-4' ? 300 : 200) + ((stories - 1) * 150);
      const sMins = (stories * 60);
      taxableSubtotal += sPrice; pwMins += sMins;
      lineItems.push({ name: "Siding Soft-Wash", price: sPrice });
    }
    if (jobData.fenceSize && jobData.fenceSize !== 'none') {
      const fSize = jobData.fenceSize as string;
      const fPrice = FENCE_PRICES[fSize] || 0; const fMins = FENCE_TIMES[fSize] || 120;
      taxableSubtotal += fPrice; pwMins += fMins;
      lineItems.push({ name: `Cedar Restoration (${fSize}ft)`, price: fPrice });
    }
    if (jobData.trexDeckSize && jobData.trexDeckSize !== 'none') {
      const tSize = jobData.trexDeckSize as string;
      const tPrice = TREX_PRICES[tSize] || 0; const tMins = TREX_TIMES[tSize] || 90;
      taxableSubtotal += tPrice; pwMins += tMins;
      lineItems.push({ name: `Trex Acid Wash (${tSize.toUpperCase()})`, price: tPrice });
    }
    if (pwMins > 0) { totalMinutes += pwMins; rawServiceJobs.push({ name: 'Pressure Washing', time: pwMins }); }
  }

  if (srv.includes('Roof Cleaning')) {
    let rcMins = 0;
    if (jobData.roofBlowOff) {
      let blowPrice = homeSize === '5+' ? BASE_PRICES.roof_blowoff_5 : homeSize === '3-4' ? BASE_PRICES.roof_blowoff_3_4 : BASE_PRICES.roof_blowoff_1_2;
      const bMins = (homeSize === '5+' ? 90 : homeSize === '3-4' ? 60 : 45);
      if (!ladderFeeClaimed && ladderPrice > 0) { blowPrice += ladderPrice; ladderFeeClaimed = true; }
      taxableSubtotal += blowPrice; rcMins += bMins;
      lineItems.push({ name: "Roof Blow-off", price: blowPrice });
    }
    if (jobData.mossTreatment) {
      const mossPrice = homeSize === '5+' ? BASE_PRICES.moss_baking_soda_5 : homeSize === '3-4' ? BASE_PRICES.moss_baking_soda_3_4 : BASE_PRICES.moss_baking_soda_1_2;
      taxableSubtotal += mossPrice; rcMins += 20;
      lineItems.push({ name: "Baking Soda Moss Out", price: mossPrice });
    }
    if (jobData.mossAcidWash) {
      let acidPrice = homeSize === '5+' ? BASE_PRICES.roof_blowoff_5 : homeSize === '3-4' ? BASE_PRICES.roof_blowoff_3_4 : BASE_PRICES.roof_blowoff_1_2;
      const aMins = 60;
      if (!ladderFeeClaimed && ladderPrice > 0) { acidPrice += ladderPrice; ladderFeeClaimed = true; }
      taxableSubtotal += acidPrice; rcMins += aMins;
      lineItems.push({ name: "Light Acid Wash", price: acidPrice });
    }
    if (rcMins > 0) { totalMinutes += rcMins; rawServiceJobs.push({ name: 'Roof Cleaning', time: rcMins }); }
  }

  if (srv.includes('Solar Panel Cleaning')) {
    const pCount = Number(jobData.solarPanelCount) || 0;
    let solarPrice = pCount * BASE_PRICES.solar_panel;
    const solarMins = (pCount * 5) + 20;
    if (!ladderFeeClaimed && ladderPrice > 0) { solarPrice += ladderPrice; ladderFeeClaimed = true; }
    taxableSubtotal += solarPrice; totalMinutes += solarMins;
    lineItems.push({ name: `Solar Cleaning (${pCount})`, price: solarPrice });
    rawServiceJobs.push({ name: 'Solar Panel Cleaning', time: solarMins });
  }

  // --- GRANULAR CONTINUOUS FLOW PACKING LOGIC ---
  const SERVICE_PRIORITY: Record<string, number> = {
    'Roof Cleaning': 1, 'Gutter Cleaning': 2, 'Pressure Washing': 3, 'Solar Panel Cleaning': 4, 'Window Cleaning': 5, 'Skylights': 6
  };
  
  const sortedRawJobs = [...rawServiceJobs].sort((a, b) => (SERVICE_PRIORITY[a.name] || 99) - (SERVICE_PRIORITY[b.name] || 99));
  const serviceJobs: { name: string; time: number }[] = [];
  
  let currentDayRemaining = 540;
  
  sortedRawJobs.forEach(job => {
    let jobTimeRemaining = job.time;
    let partNum = 1;
    
    while (jobTimeRemaining > 0) {
      if (jobTimeRemaining <= currentDayRemaining) {
        serviceJobs.push({ name: partNum > 1 ? `${job.name} (Part ${partNum})` : job.name, time: jobTimeRemaining });
        currentDayRemaining -= jobTimeRemaining;
        jobTimeRemaining = 0;
      } else {
        if (currentDayRemaining > 0) {
          serviceJobs.push({ name: `${job.name} (Part ${partNum})`, time: currentDayRemaining });
          jobTimeRemaining -= currentDayRemaining;
          partNum++;
        }
        currentDayRemaining = 540;
      }
    }
  });

  let coreDiscountRate = 0;
  if (srv.includes('Window Cleaning') && srv.includes('Gutter Cleaning') && jobData.drivewaySize && jobData.drivewaySize !== 'none') coreDiscountRate = 0.20;
  else if (srv.includes('Window Cleaning') && (srv.includes('Gutter Cleaning') || jobData.drivewaySize && jobData.drivewaySize !== 'none')) coreDiscountRate = 0.10;

  const bundleSavings = (coreDiscountableBase * coreDiscountRate);
  const referralCredit = parseFloat(jobData.referralCredit || "0");
  const discounts: { name: string; amount: number }[] = [];
  if (bundleSavings > 0) discounts.push({ name: `Bundle Discount (${coreDiscountRate * 100}%)`, amount: bundleSavings });
  if (referralCredit > 0) discounts.push({ name: "Referral Credit", amount: referralCredit });

  const totalBase = taxableSubtotal + nonTaxableSubtotal;
  const totalDiscounts = bundleSavings + referralCredit;
  
  let finalTotalBeforeTax = totalBase - totalDiscounts;
  if (jobData.finalPrice) finalTotalBeforeTax = parseFloat(jobData.finalPrice);

  const taxableRatio = totalBase > 0 ? taxableSubtotal / totalBase : 0;
  const taxablePortion = finalTotalBeforeTax * taxableRatio;
  
  const tax = taxablePortion * TAX_RATE;
  if (tax > 0) lineItems.push({ name: `Sales Tax (${(TAX_RATE * 100).toFixed(1)}% on Taxable Services)`, price: tax });
  
  let finalTotal = finalTotalBeforeTax + tax;
  if (srv.length > 0 && finalTotal < BASE_PRICES.MINIMUM_SERVICE_FEE) {
    const diff = BASE_PRICES.MINIMUM_SERVICE_FEE - finalTotal;
    lineItems.push({ name: "Minimum Service Adjustment", price: diff });
    finalTotal = BASE_PRICES.MINIMUM_SERVICE_FEE;
  }
  
  if (jobData.hasEarnedReferralReward) { const reward = finalTotal * 0.10; finalTotal -= reward; discounts.push({ name: "Referral Reward (10%)", amount: reward }); }
  if (jobData.militaryDiscount) { const mil = finalTotal * 0.10; finalTotal -= mil; discounts.push({ name: "Military Discount (10%)", amount: mil }); }

  return { 
    total: finalTotal.toFixed(2), timeDisplay: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
    srv, lineItems, serviceJobs, discounts, totalMinutes, bundleSavings: bundleSavings.toFixed(2), manualCredit: referralCredit.toFixed(2),
    savings: (bundleSavings + referralCredit + (jobData.militaryDiscount ? finalTotal * 0.10 : 0)).toFixed(2),
    discountRate: (coreDiscountRate * 100).toFixed(0),
    daysRequired: Math.ceil(totalMinutes / 540), referralBonus: ((totalBase - bundleSavings) * 0.10).toFixed(2)
  };
};

const getSafeDate = (d: any): Date | null => {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d.seconds !== undefined) return new Date(d.seconds * 1000);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const getDayOccupancySummary = (jobs: any[], viewDate: Date, userEmail?: string) => {
  const data = new Map<number, { count: number; unassigned: number }>();
  const isAdmin = userEmail === 'clearview3cleaners@gmail.com' || !userEmail;
  jobs.forEach(job => {
    if (job.isNotification) return;
    if (userEmail && !isAdmin && job.assignedTo !== userEmail) return;
    
    const bookedDates = (job.actualBookedDays || []).map((ts: any) => getSafeDate(ts))
      .filter((d: Date | null): d is Date => d !== null);
    
    // If actualBookedDays is empty, fallback to selectedDate
    if (bookedDates.length === 0 && job.selectedDate) {
      const d = getSafeDate(job.selectedDate);
      if (d) bookedDates.push(d);
    }

    bookedDates.forEach((d: Date) => {
      const normalized = startOfDay(d);
      if (normalized.getMonth() === viewDate.getMonth() && normalized.getFullYear() === viewDate.getFullYear()) {
        const day = normalized.getDate();
        const prev = data.get(day) || { count: 0, unassigned: 0 };
        data.set(day, { count: prev.count + 1, unassigned: prev.unassigned + (job.assignedTo ? 0 : 1) });
      }
    });
  });
  return data;
};

export const filterJobsBySelectedDay = (jobs: any[], viewDate: Date, selectedDay: number, userEmail?: string) => {
  const selectedDateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay);
  const isAdmin = userEmail === 'clearview3cleaners@gmail.com' || !userEmail;
  
  // Use a Map to ensure each job is only included once in the result for the selected day
  const uniqueJobs = new Map<string, any>();

  jobs.forEach(j => {
    if (j.isNotification) return;
    
    const bookedDates = (j.actualBookedDays || []).map((ts: any) => getSafeDate(ts))
      .filter((d: Date | null): d is Date => d !== null);

    if (bookedDates.length === 0 && j.selectedDate) {
      const d = getSafeDate(j.selectedDate);
      if (d) bookedDates.push(d);
    }

    const isOnSelectedDay = bookedDates.some((d: Date) => startOfDay(d).getTime() === startOfDay(selectedDateObj).getTime());
    
    if (isOnSelectedDay) {
      const canSee = isAdmin ? true : j.assignedTo === userEmail;
      if (canSee) {
        uniqueJobs.set(j.id, j);
      }
    }
  });

  return Array.from(uniqueJobs.values());
};
