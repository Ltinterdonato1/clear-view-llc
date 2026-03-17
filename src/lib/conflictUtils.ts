import { isSameDay, isValid } from 'date-fns';

export const detectScheduleConflicts = (jobs: any[], attendance: any[]) => {
  if (!jobs.length || !attendance.length) return [];
  
  return jobs.filter(job => {
    // Only care about assigned, non-completed jobs
    if (!job.assignedTo || job.status === 'Archived' || job.status === 'Completed' || job.isNotification) return false;
    
    const bookedDates = (job.actualBookedDays || []).map((ts: any) => {
      if (ts?.toDate) return ts.toDate();
      if (ts?.seconds) return new Date(ts.seconds * 1000);
      return new Date(ts);
    }).filter((d: Date) => isValid(d));

    if (bookedDates.length === 0 && job.selectedDate) {
      const d = job.selectedDate.toDate ? job.selectedDate.toDate() : new Date(job.selectedDate);
      if (isValid(d)) bookedDates.push(d);
    }

    return bookedDates.some(date => {
      return attendance.some(att => {
        if (att.employeeId !== job.assignedTo) return false;
        const punchDate = att.startTime?.toDate ? att.startTime.toDate() : new Date(att.date);
        // Only vacation/sick records matter for conflicts
        return isSameDay(punchDate, date) && (att.type === 'vacation' || att.type === 'sick');
      });
    });
  });
};
