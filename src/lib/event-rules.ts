import { INTERVIEW_ASSIGNMENT_TASK_PREFIX, isInterviewEvent } from "@/lib/constants";
import { formatHebrewDate, isWithinNextDays } from "@/lib/dates";

export function needsInterviewAssignment(event: {
  notes: string;
  date: Date | string;
  evaluatorCount: number;
}) {
  return (
    isInterviewEvent(event.notes) &&
    isWithinNextDays(event.date, 30) &&
    event.evaluatorCount === 0
  );
}

export function interviewAssignmentTaskTitle(date: Date | string) {
  return `${INTERVIEW_ASSIGNMENT_TASK_PREFIX} בתאריך ${formatHebrewDate(date)}`;
}
