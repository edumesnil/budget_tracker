import { createToaster } from "@ark-ui/react/toast";

export const toaster = createToaster({
  placement: "bottom-end",
  max: 5,
  duration: 7000,
});
