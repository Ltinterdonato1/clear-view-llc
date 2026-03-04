import { describe, it, expect } from 'vitest';
import { normalizeSlot, calculateJobStats, getDayOccupancySummary, filterJobsBySelectedDay } from './scheduleUtils';

describe('scheduleUtils', () => {
  describe('normalizeSlot', () => {
    it('should return morning for default or empty input', () => {
      expect(normalizeSlot('')).toBe('morning');
      expect(normalizeSlot(null as any)).toBe('morning');
    });

    it('should normalize various morning strings', () => {
      expect(normalizeSlot('morning')).toBe('morning');
      expect(normalizeSlot('MORNING')).toBe('morning');
      expect(normalizeSlot('8:00 AM')).toBe('morning');
    });

    it('should normalize midday strings', () => {
      expect(normalizeSlot('midday')).toBe('midday');
      expect(normalizeSlot('11:30 AM')).toBe('midday');
    });

    it('should normalize afternoon strings', () => {
      expect(normalizeSlot('afternoon')).toBe('afternoon');
      expect(normalizeSlot('3:00 PM')).toBe('afternoon');
    });
  });

  describe('calculateJobStats', () => {
    it('should calculate window cleaning correctly', () => {
      const jobData = {
        selectedServices: ['Window Cleaning'],
        windowCount: 10,
        windowType: 'exterior',
        stories: 1
      };
      
      const stats = calculateJobStats(jobData);
      // 10 windows * 8 (ext) = 80. Minimum charge is 175.
      expect(stats.total).toBe('175.00');
    });

    it('should calculate multiple services and apply discount', () => {
      const jobData = {
        selectedServices: ['Window Cleaning', 'Gutter Cleaning', 'Pressure Washing'],
        windowCount: 20,
        windowType: 'both', // 14 per window
        stories: 1,
        homeSize: '1-2', // gutter base 150
        drivewaySize: '1-2', // pressure base 175
      };

      // subtotal (windows) = 20 * 14 = 280
      // taxableAmount (gutters + pressure) = 150 + 175 = 325
      // Combined = 280 + 325 = 605
      // Discount (3 services = 20%) = 605 * 0.20 = 121
      // Before tax total = 605 - 121 = 484
      // Tax (8.5% on taxableAmount after discount?) 
      // Note: Logic in calculateJobStats: 
      // const finalTotal = Math.max((combinedBeforeDiscount * (1 - discountRate)) + (taxableAmount * TAX_RATE), srv.length > 0 ? BASE_PRICES.MINIMUM_CHARGE : 0);
      // finalTotal = (605 * 0.8) + (325 * 0.085) = 484 + 27.625 = 511.625
      
      const stats = calculateJobStats(jobData);
      expect(stats.total).toBe('511.63');
      expect(stats.discountRate).toBe('20');
      expect(stats.savings).toBe('121.00');
    });

    it('should respect minimum charge', () => {
      const jobData = {
        selectedServices: ['Window Cleaning'],
        windowCount: 1,
        windowType: 'exterior',
      };
      const stats = calculateJobStats(jobData);
      expect(stats.total).toBe('175.00');
    });
  });

  describe('getDayOccupancySummary', () => {
    it('should return correct counts for jobs on specific days', () => {
      const jobs = [
        { 
          id: '1', 
          assignedTo: 'worker@example.com', 
          actualBookedDays: [new Date(2026, 1, 20)] 
        },
        { 
          id: '2', 
          assignedTo: 'worker@example.com', 
          actualBookedDays: [new Date(2026, 1, 20), new Date(2026, 1, 21)] 
        }
      ];
      const viewDate = new Date(2026, 1, 1);
      const summary = getDayOccupancySummary(jobs, viewDate, 'worker@example.com');
      
      expect(summary.get(20)?.count).toBe(2);
      expect(summary.get(20)?.unassigned).toBe(0);
      expect(summary.get(21)?.count).toBe(1);
    });

    it('should filter by worker email if not admin', () => {
      const jobs = [
        { 
          id: '1', 
          assignedTo: 'worker1@example.com', 
          actualBookedDays: [new Date(2026, 1, 20)] 
        },
        { 
          id: '2', 
          assignedTo: 'worker2@example.com', 
          actualBookedDays: [new Date(2026, 1, 20)] 
        }
      ];
      const viewDate = new Date(2026, 1, 1);
      const summary = getDayOccupancySummary(jobs, viewDate, 'worker1@example.com');
      
      expect(summary.get(20)?.count).toBe(1);
    });

    it('should show all jobs for admin email', () => {
      const jobs = [
        { 
          id: '1', 
          assignedTo: 'worker1@example.com', 
          actualBookedDays: [new Date(2026, 1, 20)] 
        },
        { 
          id: '2', 
          assignedTo: undefined, 
          actualBookedDays: [new Date(2026, 1, 20)] 
        }
      ];
      const viewDate = new Date(2026, 1, 1);
      const summary = getDayOccupancySummary(jobs, viewDate, 'clearview3cleaners@gmail.com');
      
      expect(summary.get(20)?.count).toBe(2);
      expect(summary.get(20)?.unassigned).toBe(1);
    });
  });

  describe('filterJobsBySelectedDay', () => {
    const jobs = [
      { 
        id: '1', 
        assignedTo: 'worker1@example.com', 
        actualBookedDays: [new Date(2026, 1, 20)] 
      },
      { 
        id: '2', 
        assignedTo: 'worker2@example.com', 
        actualBookedDays: [new Date(2026, 1, 20)] 
      },
      { 
        id: '3', 
        assignedTo: 'worker1@example.com', 
        actualBookedDays: [new Date(2026, 1, 21)] 
      }
    ];

    it('should return jobs for a specific day', () => {
      const filtered = filterJobsBySelectedDay(jobs, new Date(2026, 1, 1), 20, 'clearview3cleaners@gmail.com');
      expect(filtered).toHaveLength(2);
      expect(filtered.map(j => j.id)).toContain('1');
      expect(filtered.map(j => j.id)).toContain('2');
    });

    it('should filter by user email for non-admin', () => {
      const filtered = filterJobsBySelectedDay(jobs, new Date(2026, 1, 1), 20, 'worker1@example.com');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should return empty if no jobs on that day', () => {
      const filtered = filterJobsBySelectedDay(jobs, new Date(2026, 1, 1), 22, 'clearview3cleaners@gmail.com');
      expect(filtered).toHaveLength(0);
    });
  });
});
