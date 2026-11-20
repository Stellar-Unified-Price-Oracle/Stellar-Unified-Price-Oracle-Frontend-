'use client';

import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';

type ChecklistStepId = 'pick-pairs' | 'create-alert' | 'connect-channel' | 'try-export';

interface ChecklistStep {
  id: ChecklistStepId;
  label: string;
  description: string;
}

const STEPS: ChecklistStep[] = [
  {
    id: 'pick-pairs',
    label: 'Pick your pairs',
    description: 'Choose the markets you want to follow.',
  },
  {
    id: 'create-alert',
    label: 'Create an alert',
    description: 'Get notified when a market moves.',
  },
  {
    id: 'connect-channel',
    label: 'Connect a channel',
    description: 'Route alerts to email, Slack, or webhooks.',
  },
  {
    id: 'try-export',
    label: 'Try an export',
    description: 'Download your data as CSV or JSON.',
  },
];

const STORAGE_KEY = 'onboarding-checklist';

interface ChecklistState {
  completed: ChecklistStepId[];
  dismissed: boolean;
}

const DEFAULT_STATE: ChecklistState = {
  completed: [],
  dismissed: false,
};

function loadState(): ChecklistState {
  const stored = storage.get<ChecklistState>(STORAGE_KEY);
  if (!stored || typeof stored !== 'object') {
    return DEFAULT_STATE;
  }
  return {
    completed: Array.isArray(stored.completed) ? stored.completed : [],
    dismissed: Boolean(stored.dismissed),
  };
}

export default function OnboardingChecklist() {
  const [state, setState] = useState<ChecklistState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ChecklistState) => {
    setState(next);
    storage.set(STORAGE_KEY, next);
  }, []);

  const toggleStep = useCallback(
    (id: ChecklistStepId) => {
      const isDone = state.completed.includes(id);
      const completed = isDone
        ? state.completed.filter((stepId) => stepId !== id)
        : [...state.completed, id];
      const allDone = STEPS.every((step) => completed.includes(step.id));
      persist({ completed, dismissed: allDone ? true : state.dismissed });
    },
    [state, persist]
  );

  const dismiss = useCallback(() => {
    persist({ ...state, dismissed: true });
  }, [state, persist]);

  if (!hydrated || state.dismissed) {
    return null;
  }

  const completedCount = STEPS.filter((step) => state.completed.includes(step.id)).length;

  return (
    <section
      aria-label="Getting started checklist"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Getting started</h2>
          <p className="mt-1 text-sm text-gray-500">
            {completedCount} of {STEPS.length} steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-sm text-gray-500 hover:text-gray-700"
          aria-label="Dismiss onboarding checklist"
        >
          Dismiss
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {STEPS.map((step) => {
          const done = state.completed.includes(step.id);
          return (
            <li key={step.id} className="flex items-start gap-3">
              <input
                id={`onboarding-${step.id}`}
                type="checkbox"
                checked={done}
                onChange={() => toggleStep(step.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor={`onboarding-${step.id}`} className="cursor-pointer">
                <span
                  className={
                    done
                      ? 'block text-sm font-medium text-gray-400 line-through'
                      : 'block text-sm font-medium text-gray-900'
                  }
                >
                  {step.label}
                </span>
                <span className="block text-sm text-gray-500">{step.description}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
