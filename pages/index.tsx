import { useEffect, useState } from 'react';
import { storage } from '../utils/storage';

const ONBOARDING_KEY = 'onboarding-checklist';

const ONBOARDING_STEPS = [
  { id: 'pick-pairs', label: 'Pick pairs' },
  { id: 'create-alert', label: 'Create an alert' },
  { id: 'connect-channel', label: 'Connect a channel' },
  { id: 'try-export', label: 'Try an export' },
] as const;

type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

type OnboardingState = {
  completed: OnboardingStepId[];
  dismissed: boolean;
};

const defaultOnboardingState: OnboardingState = {
  completed: [],
  dismissed: false,
};

function readOnboardingState(): OnboardingState {
  const stored = storage.get<OnboardingState>(ONBOARDING_KEY);
  if (!stored) return defaultOnboardingState;
  return {
    completed: Array.isArray(stored.completed) ? stored.completed : [],
    dismissed: Boolean(stored.dismissed),
  };
}

function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState>(defaultOnboardingState);

  useEffect(() => {
    setState(readOnboardingState());
  }, []);

  const persist = (next: OnboardingState) => {
    setState(next);
    storage.set(ONBOARDING_KEY, next);
  };

  const toggleStep = (id: OnboardingStepId) => {
    const completed = state.completed.includes(id)
      ? state.completed.filter((step) => step !== id)
      : [...state.completed, id];
    const allDone = ONBOARDING_STEPS.every((step) => completed.includes(step.id));
    persist({ completed, dismissed: state.dismissed || allDone });
  };

  const dismiss = () => persist({ ...state, dismissed: true });

  if (state.dismissed) return null;

  return (
    <section className="onboarding-checklist">
      <header className="onboarding-checklist__header">
        <h2>Get started</h2>
        <button type="button" onClick={dismiss} aria-label="Dismiss checklist">
          Dismiss
        </button>
      </header>
      <ul>
        {ONBOARDING_STEPS.map((step) => (
          <li key={step.id}>
            <label>
              <input
                type="checkbox"
                checked={state.completed.includes(step.id)}
                onChange={() => toggleStep(step.id)}
              />
              {step.label}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <OnboardingChecklist />
    </main>
  );
}
