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
  currentPartial?: number;
  diplomaEnabled?: boolean;
  diplomaEnabledAt?: string | null;
  lecturaReleased?: boolean;
  lecturaReleasedAt?: string | null;
  torreReleased?: boolean;
  torreReleasedAt?: string | null;
  compilerReleased?: boolean;
  compilerReleasedAt?: string | null;
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

export type ExemptionStatus = {
  tier: "exempt" | "can_exempt" | "keep_going" | "none";
  label: string;
  shortLabel: string;
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
    participationStars?: number;
    placeBeforeAttendance?: number;
    placesDroppedByAttendance?: number;
    attendanceDemotionMessages?: string[];
  };
  classEngagement?: {
    participationStars: number;
    attendance: {
      present: number;
      absent: number;
      late: number;
      justified: number;
      totalDays: number;
      ratePercent: number;
    };
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
    exemption: ExemptionStatus;
  };
  top10: {
    studentId: string;
    displayName: string;
    listNumber: number | null;
    score: number;
    place: number;
    exemption?: ExemptionStatus;
  }[];
  rankingPartial?: number;
  rankingRule: string;
  activities: StudentActivity[];
  seating?: StudentSeating | null;
  lectura?: StudentLectura | null;
  torre?: StudentTorre | null;
};

export type StudentSeating = {
  date: string;
  theme: SeatingTheme;
  seatNumber: number;
  row: number;
  col: number;
  label: string;
  color: string;
  colorName: string;
  columnColorName: string;
  listPosition: number | null;
  listNumber: number | null;
  displayName: string;
};

export type StudentLectura = {
  topic: string;
  sessionNumber: number;
  readingIndex: number;
  teamCount: number;
  minutes?: number;
  colorName: string;
  hex: string;
  columna: string;
  titulo: string;
  mision: string;
  texto: string;
  clave: string[];
  preguntaGuia: string;
  producto: string;
  organizador: Array<{ caja: string; hijos: string }>;
  displayName: string;
  isLeader?: boolean;
  leaderId?: string | null;
  leaderName?: string | null;
  startedAt?: string | null;
  roleName: string;
  roleTask: string;
  speakScript: string;
  paragraphIndex: number;
  paragraph: string;
  teammates: Array<{
    studentId: string;
    displayName: string;
    roleName: string;
    roleTask: string;
    speakScript: string;
    paragraphIndex: number;
    paragraph: string;
    isMe: boolean;
  }>;
  pastReadings?: Array<{
    topic: string;
    sessionNumber: number;
    readingIndex: number;
    teamCount: number;
    minutes?: number;
    colorName: string;
    hex: string;
    columna: string;
    titulo: string;
    mision: string;
    texto: string;
    clave: string[];
    preguntaGuia: string;
    producto: string;
    organizador: Array<{ caja: string; hijos: string }>;
    displayName: string;
    isLeader?: boolean;
    leaderId?: string | null;
    leaderName?: string | null;
    startedAt?: string | null;
    roleName: string;
    roleTask: string;
    speakScript: string;
    paragraphIndex: number;
    paragraph: string;
    teammates: StudentLectura["teammates"];
  }>;
};

export type StudentTorre = {
  minutes: number;
  colorName: string;
  hex: string;
  columna: string;
  displayName: string;
  isLeader: boolean;
  leaderId: string | null;
  leaderName: string | null;
  startedAt: string | null;
  pausedAt?: string | null;
  members: Array<{
    studentId: string;
    displayName: string;
    listNumber: number | null;
  }>;
};

export type TorreSession = {
  groupId: string;
  groupCode: string;
  released: boolean;
  releasedAt: string | null;
  paused?: boolean;
  pausedAt?: string | null;
  minutes: number;
  teamCount: number;
  teams: Array<{
    key: string;
    readingIndex: number;
    colorName: string;
    hex: string;
    columna: string;
    members: Array<{
      studentId: string;
      displayName: string;
      listNumber: number | null;
    }>;
    leaderId: string | null;
    leaderName: string | null;
    startedAt: string | null;
  }>;
};

export type LecturaSession = {
  groupId: string;
  groupCode: string;
  shift: string;
  topic: string;
  sessionNumber: number;
  generatedAt: string | null;
  released: boolean;
  releasedAt: string | null;
  theme: SeatingTheme | null;
  teamCount: number;
  minutes?: number;
  skipped: Array<{ displayName: string; reason: "baja" | "incapacidad" }>;
  hasContent: boolean;
  teams: Array<{
    key?: string;
    readingIndex: number;
    colorName: string;
    hex: string;
    columna: string;
    titulo: string;
    mision: string;
    texto: string;
    clave: string[];
    preguntaGuia: string;
    producto: string;
    organizador: Array<{ caja: string; hijos: string }>;
    leaderId?: string | null;
    leaderName?: string | null;
    startedAt?: string | null;
    members: Array<{
      studentId: string;
      displayName: string;
      listNumber: number | null;
      row: number;
      col: number;
      roleName: string;
      roleTask: string;
      speakScript: string;
      paragraphIndex: number;
      paragraph: string;
    }>;
  }>;
  history?: Array<{
    sessionNumber: number;
    topic: string;
    generatedAt: string | null;
    teams: LecturaSession["teams"];
  }>;
};

export type SeatingCell = {
  row: number;
  col: number;
  seatNumber: number;
  empty: boolean;
  color: string | null;
  colorName: string | null;
  student: {
    id: string;
    displayName: string;
    listNumber: number | null;
    listPosition: number;
    controlNumber: string | null;
  } | null;
};

export type SeatingMode =
  | "random"
  | "alphabetical"
  | "alphabetical_snake"
  | "by_ranking"
  | "shuffle_rows"
  | "column_teams";

export type SeatingTheme = "column_colors" | "random_colors" | "row_colors" | "team_pairs";

export type SeatingPlan = {
  group: { id: string; code: string; shift: string };
  date: string;
  rows: number;
  cols: number;
  capacity: number;
  mode: SeatingMode;
  modeLabel: string;
  theme: SeatingTheme;
  assignedCount: number;
  studentCount: number;
  unseatedCount: number;
  overflow: boolean;
  grid: SeatingCell[];
  updatedAt: string | null;
  /** Fecha en la que se guardó el acomodo que se está mostrando. */
  assignedDate?: string | null;
  /** True si no hay acomodo en la fecha pedida y se muestra el último vigente. */
  isCarriedOver?: boolean;
  history?: string[];
  unseatedStudents?: Array<{
    id: string;
    displayName: string;
    listPosition: number;
  }>;
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
  partialNumber?: number;
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

export type GradesMatrix = {
  group: Pick<ClassGroup, "id" | "code" | "shift">;
  partialNumber: number;
  activities: Activity[];
  students: Array<{
    id: string;
    displayName: string;
    listNumber: number | null;
    controlNumber: string | null;
  }>;
  cells: Record<string, Record<string, { points: number; gradedAt: string }>>;
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
  exemption: ExemptionStatus;
  placeBeforeAttendance?: number;
  placesDroppedByAttendance?: number;
  attendanceDemotionMessages?: string[];
};

export type GroupRanking = {
  group: ClassGroup;
  ranking: GroupRankingRow[];
  top10: GroupRankingRow[];
  activityCount: number;
  rankingPartial?: number;
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
  place: number;
  weeksWon: number;
  weeklyWinnerScoreSum: number;
  exemption: ExemptionStatus;
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

export type OfficeExamQuestion = {
  id: string;
  program: "WORD" | "POWERPOINT" | "EXCEL";
  sortOrder: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption?: string;
};

export type OfficeExamTeacherData = {
  exam: {
    id: string;
    title: string;
    enabledForStudents: boolean;
    enabledAt: string | null;
    timeLimitMinutes: number;
    questionCount: number;
    instructions: string;
    questionsPreview: OfficeExamQuestion[];
  };
  summary: {
    totalStudents: number;
    submitted: number;
    inProgress: number;
    notStarted: number;
    wordCount: number;
    powerpointCount: number;
    excelCount: number;
  };
  rows: {
    studentId: string;
    displayName: string;
    controlNumber: string | null;
    listNumber: number | null;
    groupId: string;
    groupCode: string;
    place: number;
    isExempt: boolean;
    totalFirmas: number;
    firmasScore6: number;
    examStatus: string;
    examCorrect: number | null;
    examScore4: number;
    finalGrade: number;
    submittedAt: string | null;
  }[];
};

export type OfficeExamState = {
  available: boolean;
  reason?: string;
  enabled?: boolean;
  status?: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  instructions?: string;
  timeLimitMinutes?: number;
  questionCount?: number;
  isExempt?: boolean;
  place?: number;
  totalFirmas?: number;
  firmasReference?: number;
  firmasScore6?: number;
  projectedGradeWithoutExam?: number;
  examAffectsGrade?: boolean;
  attemptId?: string;
  answers?: Record<string, string>;
  questions?: OfficeExamQuestion[];
  startedAt?: string;
  lastSavedAt?: string;
  correctCount?: number;
  examScore4?: number;
  finalGrade?: number;
  submittedAt?: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  groupId: string | null;
  createdAt: string;
  group?: { code: string } | null;
};

export type TaskItem = {
  id: string;
  title: string;
  body: string;
  groupId: string | null;
  dueDate: string | null;
  createdAt: string;
  group?: { code: string } | null;
};

export type SchoolCalendarInfo = {
  id: string;
  title: string;
  semesterLabel: string | null;
  fileName: string;
  mimeType: string;
  publishedAt: string;
};

export type TeacherCommsData = {
  announcements: Announcement[];
  tasks: TaskItem[];
  calendar: SchoolCalendarInfo | null;
  groups: Pick<ClassGroup, "id" | "code" | "shift">[];
};

export type StudentCommsData = {
  announcements: Pick<Announcement, "id" | "title" | "body" | "createdAt" | "groupId">[];
  tasks: Pick<TaskItem, "id" | "title" | "body" | "dueDate" | "createdAt" | "groupId">[];
  calendar: SchoolCalendarInfo | null;
};

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED";

export type ClassDayRow = {
  student: {
    id: string;
    displayName: string;
    listNumber: number | null;
    controlNumber: string | null;
  };
  attendance: AttendanceStatus;
  stars: number;
  saved: boolean;
  /** Faltas acumuladas (solo ABSENT; justificada no cuenta). */
  absenceCount?: number;
};

export type ClassDaySheet = {
  group: Pick<ClassGroup, "id" | "code" | "shift">;
  date: string;
  currentPartial?: number;
  datePartial?: number;
  isHistory?: boolean;
  history?: { partialNumber: number; dates: string[] }[];
  maxStars: number;
  /** Umbral: alerta si faltas > este valor (por defecto 3). */
  absenceAlertAfter?: number;
  rows: ClassDayRow[];
};

export type SkillRole =
  | "scrum_master"
  | "product_owner"
  | "developer"
  | "ui_designer"
  | "qa_docs";

export type SkillSurveyQuestion = {
  id: string;
  text: string;
  dimension: string;
};

export type SkillSurveyProfile = {
  suggestedRole: SkillRole;
  suggestedRoleLabel: string;
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    max: number;
    percent: number;
  }>;
  scores: Record<string, number>;
  answers: Record<string, number>;
};

export type StudentSkillSurveyState = {
  completed: boolean;
  definition: {
    scale: { min: number; max: number; labels: string[] };
    roles: Record<string, string>;
    questions: SkillSurveyQuestion[];
  };
  profile: SkillSurveyProfile | null;
  team: { id: string; name: string; role: string; roleLabel: string } | null;
  updatedAt?: string;
};

export type TeacherSkillSurveyBoard = {
  group: Pick<ClassGroup, "id" | "code" | "shift">;
  definition: StudentSkillSurveyState["definition"];
  completedCount: number;
  totalStudents: number;
  rows: Array<{
    student: {
      id: string;
      displayName: string;
      listNumber: number | null;
      controlNumber: string | null;
      listPosition: number;
    };
    completed: boolean;
    profile: SkillSurveyProfile | null;
    team: { teamId: string; teamName: string; role: string; roleLabel: string } | null;
    updatedAt?: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    members: Array<{
      studentId: string;
      role: string;
      roleLabel: string;
      student: {
        id: string;
        displayName: string;
        listNumber: number | null;
        controlNumber: string | null;
      };
    }>;
  }>;
};

export type TeamSuggestion = {
  teamSizes: number[];
  assignedCount: number;
  suggested: Array<{
    name: string;
    members: Array<{
      studentId: string;
      displayName: string;
      role: SkillRole;
      roleLabel: string;
    }>;
  }>;
  unassigned: Array<{
    studentId: string;
    displayName: string;
    suggestedRole: SkillRole;
    suggestedRoleLabel: string;
  }>;
  note: string | null;
};

export type ListasF1PreviewRow = {
  studentId: string;
  displayName: string;
  controlNumber: string | null;
  listNumber: number | null;
  activityPoints: number;
  activityMax: number;
  activityScore: number;
  participationStars: number;
  participationMax: number;
  participationScore: number;
  rankingScore: number;
  scale6: number;
  attendancePercent: number;
  deliveredCount?: number;
  examScore4: number | null;
  finalGrade: number | null;
  place: number;
  firstGradings: number;
  firstGradedAt: string | null;
  deliveryPriority: number;
};

export type ListasF1LiveScale = {
  partialNumber: number;
  activityCount: number;
  activityMax: number;
  classDays: number;
  useParticipation: boolean;
  firstPlaceScore: number;
  rows: ListasF1PreviewRow[];
};

export type ListasF1Preview = {
  group: {
    id: string;
    code: string;
    shift: string;
    partialClosed: boolean;
    partialClosedAt: string | null;
    currentPartial?: number;
  };
  rule: {
    scaleMax: number;
    examMax: number;
    activityWeight: number;
    participationWeight: number;
    starsPerDay: number;
    description: string;
  };
  scalePartial?: number;
  livePartial?: number;
  activityCount: number;
  activityMax: number;
  classDays: number;
  useParticipation: boolean;
  firstPlaceScore: number;
  rows: ListasF1PreviewRow[];
  live?: ListasF1LiveScale | null;
  excel: {
    templateFound: boolean;
    expectedGroups: string[];
    teacherGroups: string[];
    sheets: Array<{ code: string; found: boolean; excelStudents: number }>;
    matchedInExcel: number;
  };
};
