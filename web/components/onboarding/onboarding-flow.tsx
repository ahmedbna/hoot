import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { GenderSelection } from './gender-selection';
import { BirthdaySelection } from './birthday-selection';
import { LanguageSelection } from './language-selection';
import { Doc } from '@/convex/_generated/dataModel';

export interface OnboardingData {
  gender: 'male' | 'female';
  birthday: Date;
  nativeLanguage: Doc<'languages'>;
  targetLanguage: Doc<'languages'>;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

type OnboardingStep =
  | 'gender'
  | 'birthday'
  | 'native-language'
  | 'target-language';

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('gender');
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>(
    {}
  );

  const steps: OnboardingStep[] = [
    'gender',
    'birthday',
    'native-language',
    'target-language',
  ];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const updateData = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) => {
    setOnboardingData((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      // Complete onboarding
      if (
        onboardingData.gender &&
        onboardingData.birthday &&
        onboardingData.nativeLanguage &&
        onboardingData.targetLanguage
      ) {
        onComplete(onboardingData as OnboardingData);
      }
    }
  };

  const handleGenderSelect = (gender: OnboardingData['gender']) => {
    updateData('gender', gender);
    setTimeout(() => nextStep(), 300);
  };

  const handleBirthdaySelect = (birthday: Date) => {
    updateData('birthday', birthday);
  };

  const handleNativeLanguageSelect = (language: Doc<'languages'>) => {
    updateData('nativeLanguage', language);
    setTimeout(() => nextStep(), 300);
  };

  const handleTargetLanguageSelect = (language: Doc<'languages'>) => {
    updateData('targetLanguage', language);
    setTimeout(() => nextStep(), 300);
  };

  return (
    <div className='min-h-screen bg-gradient-background'>
      <div className='container mx-auto px-4 py-8'>
        {/* Progress Bar */}
        <div className='max-w-md mx-auto mb-8'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-muted-foreground'>
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className='text-sm font-medium text-muted-foreground'>
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className='h-2' />
        </div>

        {/* Step Content */}
        <div className='max-w-4xl mx-auto'>
          {currentStep === 'gender' && (
            <GenderSelection onSelect={handleGenderSelect} />
          )}

          {currentStep === 'birthday' && (
            <BirthdaySelection
              onSelect={handleBirthdaySelect}
              onNext={nextStep}
            />
          )}

          {currentStep === 'native-language' && (
            <LanguageSelection
              type='native'
              selectedLanguage={onboardingData.nativeLanguage}
              onSelect={handleNativeLanguageSelect}
            />
          )}

          {currentStep === 'target-language' && (
            <LanguageSelection
              type='target'
              selectedLanguage={onboardingData.targetLanguage}
              excludeLanguage={onboardingData.nativeLanguage}
              onSelect={handleTargetLanguageSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
