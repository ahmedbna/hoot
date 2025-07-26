import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface BirthdaySelectionProps {
  onSelect: (birthday: Date) => void;
  onNext: () => void;
}

export function BirthdaySelection({
  onSelect,
  onNext,
}: BirthdaySelectionProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      onSelect(date);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='text-center space-y-4'>
        <h1 className='text-3xl font-bold text-foreground'>
          {`When's your birthday? 🎂`}
        </h1>
      </div>

      <Card className='p-6 max-w-md mx-auto'>
        <Calendar
          mode='single'
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(date) =>
            date > new Date() || date < new Date('1900-01-01')
          }
          initialFocus
          className='w-full'
        />

        {selectedDate && (
          <div className='mt-4 p-4 bg-primary/5 rounded-lg text-center'>
            <p className='text-sm text-muted-foreground'>Selected date:</p>
            <p className='font-semibold text-foreground'>
              {format(selectedDate, 'MMMM d, yyyy')}
            </p>
          </div>
        )}
      </Card>

      {selectedDate && (
        <div className='text-center'>
          <Button onClick={onNext} size='lg' className='px-8'>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
