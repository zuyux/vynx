'use client';

import { Calendar } from '@/components/ui/calendar';
import { OFFER_WEEKDAYS, type OfferSession } from '@/lib/offer-terms';

export default function WeeklySessionCalendar({ schedule, offerNumber, onChange }: { schedule: OfferSession[]; offerNumber: number; onChange: (schedule: OfferSession[]) => void }) {
  const weekdays = new Set(schedule.map(session => session.weekday));
  const descriptionId = `weekly-calendar-help-${offerNumber}`;
  function toggleWeekday(day: Date) {
    const weekday = day.getDay();
    if (weekdays.has(weekday)) {
      onChange(schedule.filter(session => session.weekday !== weekday));
    } else if (schedule.length < 28) {
      onChange([...schedule, { id: crypto.randomUUID(), weekday, time: '09:00', endTime: '17:00' }]);
    }
  }
  return <div className="space-y-3">
    <p id={descriptionId} className="text-xs leading-5 text-zinc-400">Click a date to select its weekday for every week. Click a highlighted day to remove that weekday’s sessions. Set start times and ending available hours below.</p>
    <Calendar
      role="application"
      aria-label={`Weekly session calendar for offer ${offerNumber}`}
      aria-describedby={descriptionId}
      weekStartsOn={1}
      fixedWeeks
      showOutsideDays={false}
      modifiers={{ selected: day => weekdays.has(day.getDay()) }}
      disabled={day => schedule.length >= 28 && !weekdays.has(day.getDay())}
      onDayClick={(day, modifiers) => { if (!modifiers.disabled && !modifiers.hidden) toggleWeekday(day); }}
      onDayKeyDown={(day, modifiers, event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!modifiers.disabled && !modifiers.hidden) toggleWeekday(day);
        }
      }}
      labels={{ labelDayButton: (day, modifiers) => `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${modifiers.selected ? ', repeats weekly' : ''}` }}
      classNames={{ root: 'w-full' }}
      className="dark w-full rounded-xl border border-white/10 bg-[#101015] p-2 text-white [--cell-size:1.5rem] [--primary:#b69aff] [--primary-foreground:#08080b] sm:[--cell-size:2rem]"
    />
    <p role="status" className="text-xs leading-5 text-violet-200">{weekdays.size ? `Repeats every ${OFFER_WEEKDAYS.filter((_, day) => weekdays.has(day)).join(', ')}.` : 'Select one or more weekdays to schedule your sessions.'}</p>
  </div>;
}
