
import React, { useState, useEffect } from 'react';
import { User, DayAvailability } from '../../types';
import { getCounselorAvailability, saveAvailability, subscribeToAvailability } from '../../services/storageService';
import { Plus, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, addMonths, getDay } from 'date-fns';

// Polyfills for missing date-fns exports
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

interface AvailabilityManagerProps {
  user: User;
}

const MIN_INTERVAL_MINUTES = 80;

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({ user }) => {
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [newTime, setNewTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(startOfToday());

  useEffect(() => {
    loadAvailability();
    
    // Subscribe to realtime updates for this counselor's availability
    const unsubscribe = subscribeToAvailability(user.id, () => {
        loadAvailability();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const loadAvailability = async () => {
    const data = await getCounselorAvailability(user.id);
    setAvailability(data);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedDate || !newTime) return;

    // Prevent weekend selection
    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setError("Weekends are not available for selection.");
      return;
    }

    // Get current slots for this date
    const day = availability.find(d => d.date === selectedDate);
    const currentSlots = day ? day.slots.map(s => s.time) : [];

    if (currentSlots.includes(newTime)) {
      setError("This time slot already exists.");
      return;
    }

    // Interval Check: 1 hour 20 minutes (80 minutes)
    const newMinutes = timeToMinutes(newTime);
    const conflict = currentSlots.find(time => {
      const existingMinutes = timeToMinutes(time);
      return Math.abs(newMinutes - existingMinutes) < MIN_INTERVAL_MINUTES;
    });

    if (conflict) {
      setError(`Interval conflict! Must be at least 1h 20m from ${conflict}.`);
      return;
    }

    const updatedSlots = [...currentSlots, newTime].sort();
    await saveAvailability(user.id, selectedDate, updatedSlots);
    loadAvailability();
  };

  const handleDeleteSlot = async (date: string, timeToDelete: string) => {
    const day = availability.find(d => d.date === date);
    if (!day) return;

    const updatedSlots = day.slots.filter(s => s.time !== timeToDelete).map(s => s.time);
    await saveAvailability(user.id, date, updatedSlots);
    loadAvailability();
  };

  // Calendar Helpers
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(addMonths(currentMonth, -1));

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getDateStatus = (dateStr: string) => {
    const dayData = availability.find(d => d.date === dateStr);
    
    // Grey: No slots set (Unavailable/Empty)
    if (!dayData || dayData.slots.length === 0) return 'empty';
    
    // Check if fully booked
    const hasOpenSlot = dayData.slots.some(s => !s.isBooked);
    
    // Green: Available (has open slots)
    // Red: Fully Booked (slots exist but all taken)
    return hasOpenSlot ? 'available' : 'fully-booked';
  };

  const isWeekend = (date: Date) => {
    const day = getDay(date);
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Manage Availability</h2>
        <p className="text-slate-500">Set the dates and times you are available for student appointments.</p>
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
          <AlertCircle size={16} />
          <span>Note: A mandatory <strong>1 hour and 20 minutes</strong> interval is required between appointments.</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Slot Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              Add Time Slot
            </h3>
            
            {/* Calendar Widget */}
            <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth} className="p-1 hover:bg-white rounded text-slate-500">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-bold text-slate-700 text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
                <button type="button" onClick={nextMonth} className="p-1 hover:bg-white rounded text-slate-500">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="text-[10px] font-bold text-slate-400">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {/* Padding for start of month */}
                {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                
                {daysInMonth.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const status = getDateStatus(dateStr);
                  const isWknd = isWeekend(date);
                  const isSelected = selectedDate === dateStr;
                  const isPast = date < new Date(new Date().setHours(0,0,0,0));

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isWknd || isPast}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        h-8 w-full rounded-md flex items-center justify-center text-xs font-medium transition-all relative
                        ${isSelected ? 'ring-2 ring-indigo-600 z-10' : ''}
                        ${isWknd 
                            ? 'text-slate-300 bg-slate-100 cursor-not-allowed opacity-60' // Weekend style
                            : ''
                        }
                        ${!isWknd && !isSelected && status === 'available' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : ''}
                        ${!isWknd && !isSelected && status === 'fully-booked' ? 'bg-red-50 text-red-600 hover:bg-red-100' : ''}
                        ${!isWknd && !isSelected && status === 'empty' ? 'bg-white text-slate-600 hover:bg-slate-200' : ''}
                        ${isSelected && status === 'available' ? 'bg-emerald-600 text-white' : ''}
                        ${isSelected && status === 'fully-booked' ? 'bg-red-600 text-white' : ''}
                        ${isSelected && status === 'empty' ? 'bg-slate-800 text-white' : ''}
                      `}
                      title={isWknd ? "Weekends unavailable" : status}
                    >
                      {format(date, 'd')}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex justify-center gap-3 mt-3 text-[10px] text-slate-500">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Available</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Full</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Empty</div>
              </div>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selected Date</label>
                <input
                  type="date"
                  required
                  readOnly // Make read-only so they use the calendar
                  value={selectedDate}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                <input
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Add Slot to {format(new Date(selectedDate), 'MMM d')}
              </button>
            </form>
          </div>
        </div>

        {/* Current Availability List */}
        <div className="lg:col-span-2">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-200">
               <h3 className="font-semibold text-slate-800">Your Schedule</h3>
             </div>
             
             <div className="divide-y divide-slate-100">
               {availability
                 .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                 .filter(d => d.slots.length > 0)
                 .map((day) => (
                 <div key={day.date} className="p-6">
                   <div className="flex items-center gap-3 mb-4">
                     <div className={`p-2 rounded-lg ${
                       getDateStatus(day.date) === 'fully-booked' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                     }`}>
                       <CalendarIcon size={20} />
                     </div>
                     <div>
                       <h4 className="font-semibold text-slate-900">{format(new Date(day.date), 'EEEE, MMMM do, yyyy')}</h4>
                       <p className={`text-sm ${
                          getDateStatus(day.date) === 'fully-booked' ? 'text-red-500 font-medium' : 'text-slate-500'
                       }`}>
                         {day.slots.length} slots • {day.slots.filter(s => s.isBooked).length} booked
                       </p>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                     {day.slots.sort((a,b) => a.time.localeCompare(b.time)).map((slot) => (
                       <div 
                         key={slot.id} 
                         className={`relative group px-3 py-2 rounded-lg text-sm text-center border ${
                           slot.isBooked 
                             ? 'bg-amber-50 border-amber-200 text-amber-800 cursor-not-allowed' 
                             : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                         }`}
                       >
                         {slot.time}
                         {slot.isBooked && <span className="block text-[10px] uppercase font-bold mt-1">Booked</span>}
                         
                         {!slot.isBooked && (
                           <button
                             onClick={() => handleDeleteSlot(day.date, slot.time)}
                             className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                             title="Remove slot"
                           >
                             <Trash2 size={10} />
                           </button>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               
               {availability.filter(d => d.slots.length > 0).length === 0 && (
                 <div className="p-12 text-center text-slate-500">
                   <p>No availability set. Select a date on the calendar to add time slots.</p>
                 </div>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManager;
