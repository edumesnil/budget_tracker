import type { ReactNode } from "react";
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ValidationSummaryCardProps {
  bankName: string;
  statementType: string;
  totalCount: number;
  flaggedCount: number;
  unparseableCount: number;
  knownCount: number;
  pendingAiCount: number;
  onReviewAll: () => void;
  onShowFlaggedFirst: () => void;
}

export function ValidationSummaryCard({
  bankName,
  statementType,
  totalCount,
  flaggedCount,
  unparseableCount,
  knownCount,
  pendingAiCount,
  onReviewAll,
  onShowFlaggedFirst,
}: ValidationSummaryCardProps) {
  return (
    <Card.Root>
      <Card.Body className={css({ pt: "6" })}>
        <p
          className={css({
            fontSize: "sm",
            fontWeight: "600",
            color: "fg.default",
            mb: "3",
          })}
        >
          Parsed {totalCount} transactions from {bankName} {statementType}
        </p>

        <div
          className={css({
            display: "flex",
            flexDir: "column",
            gap: "1.5",
            mb: "4",
          })}
        >
          {knownCount > 0 && (
            <SummaryLine icon="\u25CF" color="teal.11">
              {knownCount} auto-categorized (known merchants)
            </SummaryLine>
          )}
          {pendingAiCount > 0 && (
            <SummaryLine icon="\u25CF" color="fg.muted">
              {pendingAiCount} pending AI categorization
            </SummaryLine>
          )}
          {flaggedCount > 0 && (
            <SummaryLine icon="\u26A0" color="expense">
              {flaggedCount} flagged — amounts need verification
            </SummaryLine>
          )}
          {unparseableCount > 0 && (
            <SummaryLine icon="\u2715" color="fg.disabled">
              {unparseableCount} row{unparseableCount > 1 ? "s" : ""} could not be parsed
            </SummaryLine>
          )}
        </div>

        <div className={css({ display: "flex", gap: "3" })}>
          <Button size="sm" onClick={onReviewAll}>
            Review all
          </Button>
          {flaggedCount > 0 && (
            <Button variant="outline" size="sm" onClick={onShowFlaggedFirst}>
              Show flagged first
            </Button>
          )}
        </div>
      </Card.Body>
    </Card.Root>
  );
}

function SummaryLine({
  icon,
  color,
  children,
}: {
  icon: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "2",
        fontSize: "sm",
      })}
    >
      <span className={css({ color, flexShrink: 0 })}>{icon}</span>
      <span className={css({ color: "fg.default" })}>{children}</span>
    </div>
  );
}
