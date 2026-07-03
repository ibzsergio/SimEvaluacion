export type Role = "TEACHER" | "STUDENT";

export type ClassGroup = {
  id: string;
  code: string;
  shift: string;
  studentCount?: number;
  activityCount?: number;
  plannedActivities?: number | null;
  progressClosed?: boolean;
  progressClosedAt?: string | null;
  partialClosed?: boolean;
  partialClosedAt?: string | null;
};

export type User = {
  id: string;
  email?: string | null;
  controlNumber?: string | null;
  displayName: string;
  role: Role;
  listNumber?: number | null;
  group?: ClassGroup | null;
};

export type ActivityStatus = "pending" | "graded";

export type StudentActivity = {
  id: string;
  name: string;
  date: string;
  publishedAt: string;
  maxPoints: number;
  status: ActivityStatus;
  isOverdue: boolean;
  grade: { points: number; gradedAt: string } | null;
  submission: null;
};

export type StudentProgress = {
  group: ClassGroup | null;
  summary: {
    total: number;
    graded: number;
    pending: number;
    overdue: number;
  };
  courseProgress: {
    mode: "activities" | "points";
    closed: boolean;
    current: number;
    total: number;
    percent: number;
  };
  my: {
    score: number;
    place: number;
    totalStudents: number;
    badge: "gold" | "silver" | "bronze" | "top10" | null;
    listNumber: number | null;
    inTop10: boolean;
  };
  motivation: {
    displayName: string;
    firstName: string;
    dailyDate: string;
    dailyEmoji: string;
    dailyMessage: string;
    place: number;
    totalStudents: number;
    inTop10: boolean;
    emoji: string;
    title: string;
    message: string;
    pointsToTop10: number | null;
  };
  top10: {
    studentId: string;
    displayName: string;
    listNumber: number | null;
    score: number;
    place: number;
  }[];
  rankingRule: string;
  activities: StudentActivity[];
};

export type Activity = {
  id: string;
  date: string;
  name: string;
  maxPoints: number;
  signatureMax?: number;
  groupId?: string;
  group?: { code: string; shift: string };
  createdAt?: string;
};

export type GradeRow = {
  student: {
    id: string;
    listNumber: number | null;
    controlNumber: string | null;
    displayName: string;
  };
  grade: { points: number; gradedAt: string } | null;
  submission: { submittedAt: string } | null;
};

export type ImportResult = {
  summary: { total: number; created: number; updated: number; skipped: number };
  loginHint?: { usuario: string; primeraVez: string; ejemplo?: string };
};

export type GroupRankingRow = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  controlNumber: string | null;
  score: number;
  place: number;
  firstGradings: number;
  firstGradedAt: string | null;
  avgGradedAt: string | null;
  gradedActivityCount: number;
};

export type GroupRanking = {
  group: ClassGroup;
  ranking: GroupRankingRow[];
  top10: GroupRankingRow[];
  activityCount: number;
  rankingRule: string;
};

export type GroupWeekRow = {
  id: string;
  weekStart: string;
  weekEnd: string;
  closedAt: string | null;
  winner: {
    studentId: string;
    displayName: string;
    listNumber: number | null;
    controlNumber: string | null;
    score: number;
  } | null;
};

export type GroupWeeks = {
  group: ClassGroup;
  weeks: GroupWeekRow[];
};

export type PartialSummaryRow = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  controlNumber: string | null;
  totalPoints: number;
  weeksWon: number;
  weeklyWinnerScoreSum: number;
};

export type PartialSummary = {
  group: ClassGroup;
  rows: PartialSummaryRow[];
};

export type ImportWorkbookResult = {
  results: {
    groupCode: string;
    sheetName: string;
    summary: { total: number; created: number; updated: number; skipped: number };
  }[];
  skippedSheets: string[];
  message: string;
};
