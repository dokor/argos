import s from "./Stepper.module.scss";

type StepState = "completed" | "current" | "upcoming";

export type StepperProps = {
  steps: readonly { id: string; label: string }[];
  currentStep: string;
  label: string;
  statusLabels: Record<StepState, string>;
};

/** Read-only progress; the owning workflow controls transitions and validation. */
export default function Stepper({ steps, currentStep, label, statusLabels }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <ol className={s.steps} role="list" aria-label={label}>
      {steps.map((step, index) => {
        const state: StepState = index === currentIndex
          ? "current"
          : index < currentIndex ? "completed" : "upcoming";

        return (
          <li key={step.id} className={s.step} data-state={state}
            aria-current={state === "current" ? "step" : undefined}>
            <span className={s.marker} aria-hidden="true">
              {state === "completed" ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              ) : index + 1}
            </span>
            <span className={s.text}>
              <span className={s.label}>{step.label}</span>
              <span className={s.status}>{statusLabels[state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
