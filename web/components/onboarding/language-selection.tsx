import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';

interface LanguageSelectionProps {
  type: 'native' | 'target';
  selectedLanguage?: Doc<'languages'>;
  excludeLanguage?: Doc<'languages'>;
  onSelect: (language: Doc<'languages'>) => void;
  onNext?: () => void;
}

export function LanguageSelection({
  type,
  onSelect,
  selectedLanguage,
  onNext,
}: LanguageSelectionProps) {
  const languages = useQuery(api.languages.getAll);

  // const availableLanguages = excludeLanguage
  //   ? languages?.filter((lang) => lang.code !== excludeLanguage.code)
  //   : languages;

  const nativeLanguages = languages?.filter(
    (lang) => lang.code === 'ar' || lang.code === 'en'
  );
  const learningLanguages = languages?.filter((lang) => lang.code === 'de');

  const availableLanguages =
    type === 'native' ? nativeLanguages : learningLanguages;

  const title =
    type === 'native'
      ? "What's your native language? 🏠"
      : 'Which language do you want to learn? 🎯';

  const subtitle =
    type === 'native'
      ? "This helps us explain concepts in a way you'll understand"
      : "Choose the language you'd like to master";

  const handleSelect = (language: Doc<'languages'>) => {
    onSelect(language);
  };

  return (
    <div className='space-y-6'>
      <div className='text-center space-y-4'>
        <h1 className='text-3xl font-bold text-foreground'>{title}</h1>
        <p className='text-muted-foreground text-lg'>{subtitle}</p>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto'>
        {availableLanguages?.map((language) => (
          <Card
            key={language.code}
            className={`p-6 cursor-pointer transition-all duration-200 hover:shadow-medium border-2 ${
              selectedLanguage?.code === language.code
                ? 'border-primary bg-primary/5 shadow-glow'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => handleSelect(language)}
          >
            <div className='text-center space-y-3'>
              <div className='text-4xl'>{language.flag}</div>
              <p className='font-semibold text-foreground text-lg'>
                {language.name}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {selectedLanguage && onNext && (
        <div className='text-center'>
          <Button onClick={onNext} size='lg' className='px-8'>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
