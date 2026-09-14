import { prisma } from "./prisma.js";
import {
  SKILL_ROLE_LABELS,
  SKILL_SURVEY_QUESTIONS,
  TEAM_ROLE_ORDER,
  buildProfilePayload,
  scoreSkillSurvey,
  type SkillRole,
  type SkillScores,
} from "./skillSurvey.js";

function asScores(value: unknown): SkillScores {
  const raw = (value ?? {}) as Partial<SkillScores>;
  return {
    scrumMaster: Number(raw.scrumMaster) || 0,
    productOwner: Number(raw.productOwner) || 0,
    developer: Number(raw.developer) || 0,
    uiDesigner: Number(raw.uiDesigner) || 0,
    qaDocs: Number(raw.qaDocs) || 0,
  };
}

function asAnswers(value: unknown): Record<string, number> {
  const raw = (value ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function getSurveyDefinition() {
  return {
    scale: {
      min: 1,
      max: 5,
      labels: ["Nada", "Poco", "Regular", "Bastante", "Mucho"],
    },
    roles: SKILL_ROLE_LABELS,
    questions: SKILL_SURVEY_QUESTIONS.map((q) => ({
      id: q.id,
      text: q.text,
      dimension: q.dimension,
    })),
  };
}

export async function getStudentSurveyState(studentId: string) {
  const me = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, groupId: true, displayName: true },
  });
  if (!me?.groupId) throw new Error("student_without_group");

  const response = await prisma.skillSurveyResponse.findUnique({
    where: { studentId },
  });

  const membership = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: {
      team: { select: { id: true, name: true, groupId: true } },
    },
  });

  const definition = getSurveyDefinition();
  if (!response) {
    return {
      completed: false,
      definition,
      profile: null,
      team: null,
    };
  }

  const scores = asScores(response.scores);
  const answers = asAnswers(response.answers);
  const role = response.suggestedRole as SkillRole;

  return {
    completed: true,
    definition,
    profile: buildProfilePayload(answers, scores, role),
    team:
      membership && membership.team.groupId === me.groupId
        ? {
            id: membership.team.id,
            name: membership.team.name,
            role: membership.role,
            roleLabel: SKILL_ROLE_LABELS[membership.role as SkillRole] ?? membership.role,
          }
        : null,
    updatedAt: response.updatedAt.toISOString(),
  };
}

export async function submitStudentSurvey(studentId: string, answers: Record<string, number>) {
  const me = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, groupId: true },
  });
  if (!me?.groupId) throw new Error("student_without_group");

  for (const q of SKILL_SURVEY_QUESTIONS) {
    const v = Number(answers[q.id]);
    if (!Number.isFinite(v) || v < 1 || v > 5) {
      throw new Error("incomplete_answers");
    }
  }

  const { scores, suggestedRole } = scoreSkillSurvey(answers);

  const saved = await prisma.skillSurveyResponse.upsert({
    where: { studentId },
    create: {
      studentId,
      groupId: me.groupId,
      answers,
      scores,
      suggestedRole,
    },
    update: {
      groupId: me.groupId,
      answers,
      scores,
      suggestedRole,
    },
  });

  return {
    completed: true,
    profile: buildProfilePayload(answers, scores, suggestedRole),
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function getTeacherSurveyBoard(teacherId: string, groupId: string) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) throw new Error("group_not_found");

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
  });

  const responses = await prisma.skillSurveyResponse.findMany({
    where: { groupId },
  });
  const byStudent = new Map(responses.map((r) => [r.studentId, r]));

  const teams = await prisma.projectTeam.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        include: {
          student: {
            select: { id: true, displayName: true, listNumber: true, controlNumber: true },
          },
        },
      },
    },
  });

  const memberTeamByStudent = new Map<string, { teamId: string; teamName: string; role: string }>();
  for (const team of teams) {
    for (const m of team.members) {
      memberTeamByStudent.set(m.studentId, {
        teamId: team.id,
        teamName: team.name,
        role: m.role,
      });
    }
  }

  const rows = students.map((s, index) => {
    const resp = byStudent.get(s.id);
    const teamInfo = memberTeamByStudent.get(s.id) ?? null;
    if (!resp) {
      return {
        student: { ...s, listPosition: index + 1 },
        completed: false,
        profile: null,
        team: teamInfo
          ? {
              ...teamInfo,
              roleLabel: SKILL_ROLE_LABELS[teamInfo.role as SkillRole] ?? teamInfo.role,
            }
          : null,
      };
    }
    const scores = asScores(resp.scores);
    const answers = asAnswers(resp.answers);
    const role = resp.suggestedRole as SkillRole;
    return {
      student: { ...s, listPosition: index + 1 },
      completed: true,
      profile: buildProfilePayload(answers, scores, role),
      team: teamInfo
        ? {
            ...teamInfo,
            roleLabel: SKILL_ROLE_LABELS[teamInfo.role as SkillRole] ?? teamInfo.role,
          }
        : null,
      updatedAt: resp.updatedAt.toISOString(),
    };
  });

  return {
    group,
    definition: getSurveyDefinition(),
    completedCount: rows.filter((r) => r.completed).length,
    totalStudents: rows.length,
    rows,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      members: t.members.map((m) => ({
        studentId: m.studentId,
        role: m.role,
        roleLabel: SKILL_ROLE_LABELS[m.role as SkillRole] ?? m.role,
        student: m.student,
      })),
    })),
  };
}

type TeamMemberInput = { studentId: string; role: string };

function validateTeamSize(members: TeamMemberInput[]) {
  if (members.length < 4 || members.length > 5) {
    throw new Error("invalid_team_size");
  }
}

async function assertStudentsInGroup(groupId: string, studentIds: string[]) {
  const found = await prisma.user.findMany({
    where: { role: "STUDENT", groupId, id: { in: studentIds } },
    select: { id: true },
  });
  if (found.length !== studentIds.length) throw new Error("invalid_students");
}

export async function createProjectTeam(
  teacherId: string,
  groupId: string,
  name: string,
  members: TeamMemberInput[],
) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true },
  });
  if (!group) throw new Error("group_not_found");

  validateTeamSize(members);
  const ids = members.map((m) => m.studentId);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate_members");
  await assertStudentsInGroup(groupId, ids);

  const already = await prisma.projectTeamMember.findMany({
    where: { studentId: { in: ids } },
    select: { studentId: true },
  });
  if (already.length) throw new Error("student_already_in_team");

  const team = await prisma.projectTeam.create({
    data: {
      groupId,
      name: name.trim() || "Equipo",
      createdById: teacherId,
      members: {
        create: members.map((m) => ({
          studentId: m.studentId,
          role: m.role,
        })),
      },
    },
    include: {
      members: {
        include: {
          student: {
            select: { id: true, displayName: true, listNumber: true, controlNumber: true },
          },
        },
      },
    },
  });

  return team;
}

export async function updateProjectTeam(
  teacherId: string,
  groupId: string,
  teamId: string,
  name: string,
  members: TeamMemberInput[],
) {
  const team = await prisma.projectTeam.findFirst({
    where: { id: teamId, groupId, group: { teacherId } },
    select: { id: true },
  });
  if (!team) throw new Error("team_not_found");

  validateTeamSize(members);
  const ids = members.map((m) => m.studentId);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate_members");
  await assertStudentsInGroup(groupId, ids);

  const conflict = await prisma.projectTeamMember.findMany({
    where: {
      studentId: { in: ids },
      NOT: { teamId },
    },
    select: { studentId: true },
  });
  if (conflict.length) throw new Error("student_already_in_team");

  await prisma.$transaction(async (tx) => {
    await tx.projectTeamMember.deleteMany({ where: { teamId } });
    await tx.projectTeam.update({
      where: { id: teamId },
      data: {
        name: name.trim() || "Equipo",
        members: {
          create: members.map((m) => ({
            studentId: m.studentId,
            role: m.role,
          })),
        },
      },
    });
  });

  return prisma.projectTeam.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          student: {
            select: { id: true, displayName: true, listNumber: true, controlNumber: true },
          },
        },
      },
    },
  });
}

export async function deleteProjectTeam(teacherId: string, groupId: string, teamId: string) {
  const team = await prisma.projectTeam.findFirst({
    where: { id: teamId, groupId, group: { teacherId } },
    select: { id: true },
  });
  if (!team) throw new Error("team_not_found");
  await prisma.projectTeam.delete({ where: { id: teamId } });
  return { ok: true };
}

type ScoredStudent = {
  id: string;
  displayName: string;
  scores: SkillScores;
  suggestedRole: SkillRole;
};

/**
 * Sugiere equipos de 4–5 equilibrados por rol dominante.
 * No guarda: el docente confirma.
 */
export async function suggestProjectTeams(teacherId: string, groupId: string) {
  const board = await getTeacherSurveyBoard(teacherId, groupId);
  const completed = board.rows.filter((r) => r.completed && r.profile) as Array<{
    student: { id: string; displayName: string };
    profile: { suggestedRole: SkillRole; scores: SkillScores };
  }>;

  if (completed.length < 4) throw new Error("not_enough_completed");

  const pool: ScoredStudent[] = completed.map((r) => ({
    id: r.student.id,
    displayName: r.student.displayName,
    scores: r.profile.scores,
    suggestedRole: r.profile.suggestedRole,
  }));

  function planTeamSizes(n: number): number[] {
    for (let fives = Math.floor(n / 5); fives >= 0; fives--) {
      const rem = n - fives * 5;
      if (rem % 4 === 0) {
        return [...Array(fives).fill(5), ...Array(rem / 4).fill(4)];
      }
    }
    const fives = Math.floor(n / 5);
    const rem = n - fives * 5;
    if (rem >= 4) return [...Array(fives).fill(5), 4];
    return Array(fives).fill(5);
  }

  const validSizes = planTeamSizes(pool.length);
  const usedForTeams = validSizes.reduce((a: number, b: number) => a + b, 0);

  const unused = [...pool].sort((a, b) => {
    const maxA = Math.max(...Object.values(a.scores));
    const maxB = Math.max(...Object.values(b.scores));
    return maxB - maxA;
  });

  const suggested: Array<{
    name: string;
    members: Array<{ studentId: string; displayName: string; role: SkillRole; roleLabel: string }>;
  }> = [];

  let teamIndex = 1;
  for (const size of validSizes) {
    const roles = TEAM_ROLE_ORDER.slice(0, size);
    const members: Array<{ studentId: string; displayName: string; role: SkillRole; roleLabel: string }> =
      [];

    for (const role of roles) {
      const dimKey =
        role === "scrum_master"
          ? "scrumMaster"
          : role === "product_owner"
            ? "productOwner"
            : role === "developer"
              ? "developer"
              : role === "ui_designer"
                ? "uiDesigner"
                : "qaDocs";

      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < unused.length; i++) {
        const s = unused[i]!;
        const score = s.scores[dimKey];
        const bonus = s.suggestedRole === role ? 5 : 0;
        const total = score + bonus;
        if (total > bestScore) {
          bestScore = total;
          bestIdx = i;
        }
      }
      const chosen = unused.splice(bestIdx, 1)[0]!;
      members.push({
        studentId: chosen.id,
        displayName: chosen.displayName,
        role,
        roleLabel: SKILL_ROLE_LABELS[role],
      });
    }

    suggested.push({
      name: `Equipo ${teamIndex}`,
      members,
    });
    teamIndex++;
  }

  const unassigned = unused.map((s) => ({
    studentId: s.id,
    displayName: s.displayName,
    suggestedRole: s.suggestedRole,
    suggestedRoleLabel: SKILL_ROLE_LABELS[s.suggestedRole],
  }));

  return {
    teamSizes: validSizes,
    assignedCount: usedForTeams,
    suggested,
    unassigned,
    note:
      unassigned.length > 0
        ? `${unassigned.length} alumno(s) quedaron sin equipo en la sugerencia; asígnalos manualmente (equipos solo de 4 o 5).`
        : null,
  };
}
