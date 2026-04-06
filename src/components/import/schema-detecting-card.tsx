import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function SchemaDetectingCard() {
  return (
    <Card.Root>
      <Card.Body
        className={css({
          pt: "6",
          display: "flex",
          flexDir: "column",
          gap: "3",
          alignItems: "center",
          py: "12",
        })}
      >
        <Spinner size="lg" />
        <p className={css({ fontSize: "sm", color: "fg.muted" })}>
          Analyzing statement structure...
        </p>
        <p className={css({ fontSize: "xs", color: "fg.disabled" })}>
          This only happens once per bank format.
        </p>
      </Card.Body>
    </Card.Root>
  );
}
