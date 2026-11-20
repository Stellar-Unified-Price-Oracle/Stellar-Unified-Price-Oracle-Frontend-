import React, { useEffect, useState } from 'react';
import { storage } from '../utils/storage';

const ONBOARDING_KEY = 'onboarding-checklist';

interface OnboardingState {
  pickPairs: boolean;
  createAlert: boolean;
  connectChannel: boolean;
  tryExport: boolean;
  dismissed: boolean;
}

const defaultOnboardingState: OnboardingState = {
  pickPairs: false,
  createAlert: false,
  connectChannel: false,
  tryExport: false,
  dismissed: false,
};

const onboardingSteps: { key: keyof Omit<OnboardingState, 'dismissed'>; label: string }[] = [
  { key: 'pickPairs', label: 'Pick pairs' },
  { key: 'createAlert', label: 'Create an alert' },
  { key: 'connectChannel', label: 'Connect a channel' },
  { key: 'tryExport', label: 'Try an export' },
];

function loadOnboardingState(): OnboardingState {
  try {
    const raw = storage.getItem(ONBOARDING_KEY);
    if (!raw) return defaultOnboardingState;
    return { ...defaultOnboardingState, ...JSON.parse(raw) };
  } catch {
    return defaultOnboardingState;
  }
}

function saveOnboardingState(state: OnboardingState) {
  try {
    storage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

interface DashboardProps {
  [key: string]: unknown;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
  const [onboarding, setOnboarding] = useState<OnboardingState>(loadOnboardingState);

  useEffect(() => {
    saveOnboardingState(onboarding);
  }, [onboarding]);

  const completedCount = onboardingSteps.filter((step) => onboarding[step.key]).length;
  const allComplete = completedCount === onboardingSteps.length;
  const showChecklist = !onboarding.dismissed && !allComplete;

  const toggleStep = (key: keyof Omit<OnboardingState, 'dismissed'>) => {
    setOnboarding((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const dismissChecklist = () => {
    setOnboarding((prev) => ({ ...prev, dismissed: true }));
  };

  return (
    <div className="dashboard">
      {showChecklist && (
        <div className="onboarding-checklist" role="region" aria-label="Getting started checklist">
          <div className="onboarding-checklist__header">
            <h2>Getting started</h2>
            <button
              type="button"
              className="onboarding-checklist__dismiss"
              onClick={dismissChecklist}
              aria-label="Dismiss checklist"
            >
              ×
            </button>
          </div>
          <p className="onboarding-checklist__progress">
            {completedCount} of {onboardingSteps.length} complete
          </p>
          <ul className="onboarding-checklist__steps">
            {onboardingSteps.map((step) => (
              <li key={step.key}>
                <label>
                  <input
                    type="checkbox"
                    checked={onboarding[step.key]}
                    onChange={() => toggleStep(step.key)}
                  />
                  {step.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* existing dashboard content */}
    </div>
  );
};

export default Dashboard;
