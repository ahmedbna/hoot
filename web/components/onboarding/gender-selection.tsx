import { useState } from 'react';
import { Card } from '@/components/ui/card';

interface GenderSelectionProps {
  onSelect: (gender: 'male' | 'female') => void;
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male', icon: '👨' },
  { value: 'female', label: 'Female', icon: '👩' },
] as const;

export function GenderSelection({ onSelect }: GenderSelectionProps) {
  const [selectedGender, setSelectedGender] = useState<string>('');

  const handleSelect = (gender: (typeof GENDER_OPTIONS)[number]['value']) => {
    setSelectedGender(gender);
    onSelect(gender);
  };

  return (
    <div className='space-y-6'>
      <div className='text-center space-y-4'>
        <h1 className='text-3xl font-bold text-foreground'>
          Let's get to know you! 🎯
        </h1>
        <p className='text-muted-foreground text-lg'>
          This helps us personalize your learning experience
        </p>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto'>
        {GENDER_OPTIONS.map((option) => (
          <Card
            key={option.value}
            className={`p-6 cursor-pointer transition-all duration-200 hover:shadow-medium border-2 ${
              selectedGender === option.value
                ? 'border-primary bg-primary/5 shadow-glow'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => handleSelect(option.value)}
          >
            <div className='text-center space-y-2'>
              <div className='text-3xl'>{option.icon}</div>
              <p className='font-semibold text-foreground'>{option.label}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
