import { css } from "../../../styled-system/css";

export interface Step {
  label: string;
  status: "completed" | "active" | "pending";
}

interface ImportStepperProps {
  steps: Step[];
}

export function ImportStepper({ steps }: ImportStepperProps) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "0",
        px: "2",
      })}
    >
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
            })}
          >
            <div
              className={css({
                w: "6",
                h: "6",
                rounded: "full",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "xs",
                fontWeight: "600",
                flexShrink: 0,
                transition: "all 200ms",
                ...(step.status === "completed" && {
                  bg: "teal.9",
                  color: "white",
                }),
                ...(step.status === "active" && {
                  bg: "teal.3",
                  color: "teal.11",
                }),
                ...(step.status === "pending" && {
                  bg: "bg.subtle",
                  color: "fg.muted",
                }),
              })}
            >
              {step.status === "completed" ? "\u2713" : i + 1}
            </div>
            <span
              className={css({
                fontSize: "sm",
                fontWeight: step.status === "active" ? "600" : "400",
                color: step.status === "pending" ? "fg.muted" : "fg.default",
                whiteSpace: "nowrap",
              })}
            >
              {step.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className={css({
                w: "8",
                h: "px",
                mx: "2",
                bg: step.status === "completed" ? "teal.9" : "border.subtle",
                transition: "background 200ms",
              })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
