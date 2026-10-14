import { prisma } from "./prisma.js";
import { exclusionForLectura } from "./lecturaSession.js";
import { findBestNameMatch, normalizePersonName } from "./excel.js";
import { isPreviewControlNumber } from "./previewConstants.js";
import {
  SKILL_ROLE_LABELS,
  SKILL_ROLE_SHORT,
  SKILL_SURVEY_QUESTIONS,
  TEAM_ROLE_ORDER,
  buildProfilePayload,
  emptyScores,
  scoreSkillSurvey,
  type SkillRole,
  type SkillScores,
} from "./skillSurvey.js";

/** Roles que el docente marcó para quienes no contestaron encuesta en 301. No son un equipo. */
const MARKED_NO_SURVEY_ROLES_301: Array<{ name: string; needles: string[]; role: SkillRole }> = [
  { name: "Martinez Cañas Landon Oswaldo", needles: ["landon", "oswaldo"], role: "scrum_master" },
  { name: "Gutierrez Rivero Malillany Chantal", needles: ["malillany"], role: "ui_designer" },
  { name: "Muciño Encino Natalia Isabella", needles: ["natalia", "isabella"], role: "qa_docs" },
  { name: "Santiago Emeterio Brandon Yael", needles: ["brandon", "yael"], role: "product_owner" },
  { name: "Vazquez Velez Uriel", needles: ["uriel"], role: "developer" },
];

type LockedMember = { name: string; needles: string[]; role: SkillRole };
type LockedTeam = { name: string; members: LockedMember[] };

/** Equipos 1–4 como los aprobó el docente. En 5 y 6 se reasignaron roles para no dejar puros diseñadores. */
const LOCKED_TEAMS_301: LockedTeam[] = [
  {
    name: "Equipo 1",
    members: [
      { name: "Retana Montiel Jonathan Zareth", needles: ["zareth"], role: "scrum_master" },
      { name: "Romero Morales Mariana Itzel", needles: ["itzel"], role: "product_owner" },
      { name: "Gasca Castillo Rodrigo", needles: ["gasca"], role: "developer" },
      { name: "Jaimes Garcia Erik", needles: ["jaimes"], role: "ui_designer" },
      { name: "Muciño Encino Natalia Isabella", needles: ["natalia", "isabella"], role: "qa_docs" },
    ],
  },
  {
    name: "Equipo 2",
    members: [
      { name: "Gutierrez Gutierrez Maura Isabelaa", needles: ["maura"], role: "scrum_master" },
      { name: "Santiago Emeterio Brandon Yael", needles: ["brandon"], role: "product_owner" },
      { name: "Moni Agustin Sahory Sherlyn", needles: ["sherlyn"], role: "developer" },
      { name: "Perez Reyes Paola Michelle", needles: ["paola"], role: "ui_designer" },
      { name: "Perez Martinez Ximena Abigail", needles: ["ximena"], role: "qa_docs" },
    ],
  },
  {
    name: "Equipo 3",
    members: [
      { name: "Martinez Cañas Landon Oswaldo", needles: ["landon"], role: "scrum_master" },
      { name: "Herrera Miranda Paulina Marisol", needles: ["paulina"], role: "product_owner" },
      { name: "Mendoza Muciño Marco Abraham", needles: ["abraham"], role: "developer" },
      { name: "Perez Nuñez Fernanda", needles: ["fernanda"], role: "ui_designer" },
      { name: "Castillo Estrada Yael Martin", needles: ["estrada"], role: "qa_docs" },
    ],
  },
  {
    name: "Equipo 4",
    members: [
      { name: "Chamorro Diaz Miguel Salvador", needles: ["chamorro"], role: "scrum_master" },
      { name: "Reyes Gutierrez Valentina", needles: ["valentina"], role: "product_owner" },
      { name: "Vazquez Velez Uriel", needles: ["uriel"], role: "developer" },
      { name: "Ramirez Julian Abril Sheridan", needles: ["sheridan"], role: "ui_designer" },
      { name: "Gomez Flores Dafne Regina", needles: ["dafne"], role: "qa_docs" },
    ],
  },
  {
    name: "Equipo 5",
    members: [
      { name: "Angeles Martinez Sarahi", needles: ["sarahi"], role: "scrum_master" },
      { name: "Cipriano Cruz Adriana", needles: ["cipriano"], role: "product_owner" },
      { name: "Ramirez Montoya Erik", needles: ["montoya"], role: "developer" },
      { name: "Gutierrez Rivero Malillany Chantal", needles: ["malillany"], role: "ui_designer" },
      { name: "Muciño Reyes Jade Sarai", needles: ["jade"], role: "qa_docs" },
    ],
  },
  {
    name: "Equipo 6",
    members: [
      { name: "Gutierrez Ferreyra Raymundo Anastacio", needles: ["raymundo"], role: "scrum_master" },
      { name: "Solano Hernandez Hamlet", needles: ["hamlet"], role: "product_owner" },
      { name: "Mejia De La Luz Maya", needles: ["maya"], role: "developer" },
      { name: "Sedeño Espinosa Leslie Abigail", needles: ["leslie"], role: "ui_designer" },
      { name: "Moreno Flores Jimena", needles: ["jimena"], role: "qa_docs" },
    ],
  },
];

function isSkillRole(value: string | null | undefined): value is SkillRole {
  return TEAM_ROLE_ORDER.includes(value as SkillRole);
}

function assignedRoleOf(resp: { assignedRole?: string | null; suggestedRole?: string | null } | null): SkillRole | null {
  if (!resp) return null;
  if (isSkillRole(resp.assignedRole)) return resp.assignedRole;
  if (isSkillRole(resp.suggestedRole)) return resp.suggestedRole;
  return null;
}

function roleLabel(role: string | null | undefined) {
  if (!role) return "";
  return SKILL_ROLE_SHORT[role as SkillRole] ?? SKILL_ROLE_LABELS[role as SkillRole] ?? role;
}

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

function hasSurveyAnswers(value: unknown): boolean {
  return Object.keys(asAnswers(value)).length > 0;
}

function findStudentByNeedles<T extends { displayName: string }>(
  students: T[],
  name: string,
  needles: string[],
): T | undefined {
  const byName = findBestNameMatch(students, name);
  if (byName) return byName;
  return students.find((s) => {
    const n = normalizePersonName(s.displayName);
    return needles.every((needle) => n.includes(normalizePersonName(needle)));
  });
}

function findMarkedNoSurveyStudent<T extends { displayName: string }>(
  students: T[],
  spec: (typeof MARKED_NO_SURVEY_ROLES_301)[number],
): T | undefined {
  return findStudentByNeedles(students, spec.name, spec.needles);
}

function resolveLockedTeams301<T extends { id: string; displayName: string }>(students: T[]) {
  const used = new Set<string>();
  const teams: Array<{ name: string; members: Array<{ studentId: string; displayName: string; role: SkillRole }> }> = [];
  for (const team of LOCKED_TEAMS_301) {
    const members: Array<{ studentId: string; displayName: string; role: SkillRole }> = [];
    for (const spec of team.members) {
      const student = findStudentByNeedles(
        students.filter((s) => !used.has(s.id)),
        spec.name,
        spec.needles,
      );
      if (!student) return null;
      used.add(student.id);
      members.push({ studentId: student.id, displayName: student.displayName, role: spec.role });
    }
    teams.push({ name: team.name, members });
  }
  return teams;
}

async function persistAssignedRole(studentId: string, groupId: string, role: SkillRole) {
  await prisma.skillSurveyResponse.upsert({
    where: { studentId },
    create: {
      studentId,
      groupId,
      answers: {},
      scores: emptyScores(),
      suggestedRole: role,
      assignedRole: role,
    },
    update: {
      groupId,
      assignedRole: role,
    },
  });
}

/** Guarda los roles marcados y deshace el equipo que formaban solo ellos. */
async function applyMarkedNoSurveyRoles301(
  groupId: string,
  students: Array<{ id: string; displayName: string }>,
): Promise<boolean> {
  const matched: Array<{ studentId: string; role: SkillRole }> = [];
  for (const spec of MARKED_NO_SURVEY_ROLES_301) {
    const student = findMarkedNoSurveyStudent(students, spec);
    if (student) matched.push({ studentId: student.id, role: spec.role });
  }
  if (!matched.length) return false;

  for (const m of matched) {
    await persistAssignedRole(m.studentId, groupId, m.role);
    await prisma.projectTeamMember.updateMany({
      where: { studentId: m.studentId },
      data: { role: m.role },
    });
  }

  const matchedIds = new Set(matched.map((m) => m.studentId));
  const leftover = await prisma.projectTeam.findMany({
    where: { groupId },
    select: { id: true, members: { select: { studentId: true } } },
  });
  let dissolved = false;
  for (const team of leftover) {
    if (team.members.length > 0 && team.members.every((m) => matchedIds.has(m.studentId))) {
      await prisma.projectTeam.delete({ where: { id: team.id } });
      dissolved = true;
    }
  }
  return dissolved || matched.length > 0;
}

/** Crea o corrige solo Equipo 5 y 6. Nunca borra Equipo 1–4 si ya existen. */
async function fillMissingLockedTeams301(
  teacherId: string,
  groupId: string,
  students: Array<{ id: string; displayName: string }>,
) {
  const locked = resolveLockedTeams301(students);
  if (!locked) {
    console.warn("[skill-survey] 301: no se armaron los 6 equipos fijos (faltó algún nombre)");
    return false;
  }

  const existing = await prisma.projectTeam.findMany({
    where: { groupId },
    include: { members: { select: { studentId: true, role: true } } },
  });

  let changed = false;
  for (const lockedTeam of locked) {
    const isFrontFour = /^equipo [1-4]$/i.test(lockedTeam.name.trim());
    const current = existing.find(
      (t) => t.name.trim().toLowerCase() === lockedTeam.name.trim().toLowerCase(),
    );
    if (isFrontFour && current && current.members.length >= 4) continue;

    const samePeople =
      current &&
      current.members.length === lockedTeam.members.length &&
      lockedTeam.members.every((m) => current.members.some((e) => e.studentId === m.studentId));
    const designerHeavy = (current?.members.filter((m) => m.role === "ui_designer").length ?? 0) >= 3;
    if (samePeople && !designerHeavy) continue;

    const ids = lockedTeam.members.map((m) => m.studentId);
    if (current) {
      await prisma.projectTeam.delete({ where: { id: current.id } });
    }
    await prisma.projectTeamMember.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.projectTeam.deleteMany({
      where: { groupId, members: { none: {} } },
    });

    for (const m of lockedTeam.members) {
      await persistAssignedRole(m.studentId, groupId, m.role);
    }

    await prisma.projectTeam.create({
      data: {
        groupId,
        name: lockedTeam.name,
        createdById: teacherId,
        leaderId: lockedTeam.members.find((m) => m.role === "scrum_master")?.studentId ?? null,
        members: {
          create: lockedTeam.members.map((m) => ({
            studentId: m.studentId,
            role: m.role,
          })),
        },
      },
    });
    changed = true;
  }
  return changed;
}

export async function ensure301MarkedRoles() {
  const group = await prisma.classGroup.findFirst({
    where: { code: "301" },
    select: { id: true, teacherId: true },
  });
  if (!group) return;
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId: group.id },
    select: { id: true, displayName: true },
  });
  await applyMarkedNoSurveyRoles301(group.id, students);
  await fillMissingLockedTeams301(group.teacherId, group.id, students);
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

export async function getStudentSurveyState(studentId: string, viewGroupId?: string) {
  const me = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, groupId: true, displayName: true },
  });
  if (!me) throw new Error("student_without_group");
  const groupId = viewGroupId ?? me.groupId;
  if (!groupId) throw new Error("student_without_group");

  const response = await prisma.skillSurveyResponse.findUnique({
    where: { studentId },
  });
  const assignedRole = assignedRoleOf(response);
  const membership = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          groupId: true,
          leaderId: true,
          members: {
            include: {
              student: { select: { id: true, displayName: true, listNumber: true } },
            },
          },
        },
      },
    },
  });

  const teamRow = membership && membership.team.groupId === groupId ? membership.team : null;
  const leaderStillInTeam = teamRow?.leaderId
    ? teamRow.members.some((m) => m.studentId === teamRow.leaderId)
    : false;
  const leaderId = leaderStillInTeam ? teamRow!.leaderId : null;
  const preferred = teamRow?.members.find((m) => m.role === "scrum_master") ?? null;
  const myRole = teamRow
    ? (membership!.role as SkillRole)
    : assignedRole;

  return {
    completed: Boolean(assignedRole),
    assignedRole: myRole,
    assignedRoleLabel: myRole ? roleLabel(myRole) : null,
    definition: getSurveyDefinition(),
    profile: assignedRole
      ? {
          suggestedRole: assignedRole,
          suggestedRoleLabel: roleLabel(assignedRole),
        }
      : null,
    team: teamRow
      ? {
          id: teamRow.id,
          name: teamRow.name,
          role: membership!.role,
          roleLabel: roleLabel(membership!.role),
          leaderId,
          leaderName: leaderId
            ? (teamRow.members.find((m) => m.studentId === leaderId)?.student.displayName ?? null)
            : null,
          preferredLeaderId: preferred?.studentId ?? null,
          preferredLeaderName: preferred?.student.displayName ?? null,
          members: teamRow.members
            .slice()
            .sort((a, b) => TEAM_ROLE_ORDER.indexOf(a.role as SkillRole) - TEAM_ROLE_ORDER.indexOf(b.role as SkillRole))
            .map((m) => ({
              studentId: m.studentId,
              displayName: m.student.displayName,
              role: m.role,
              roleLabel: roleLabel(m.role),
              isLeader: m.studentId === leaderId,
            })),
        }
      : null,
    updatedAt: response?.updatedAt.toISOString(),
  };
}

export async function assignStudentRole(teacherId: string, groupId: string, studentId: string, role: SkillRole) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true },
  });
  if (!group) throw new Error("group_not_found");
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", groupId },
    select: { id: true, displayName: true, controlNumber: true },
  });
  if (!student || isPreviewControlNumber(student.controlNumber)) throw new Error("invalid_students");
  if (exclusionForLectura(group.code, student.displayName)) throw new Error("invalid_students");

  await persistAssignedRole(studentId, groupId, role);

  const membership = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: { team: { select: { groupId: true } } },
  });
  if (membership && membership.team.groupId === groupId) {
    await prisma.projectTeamMember.update({
      where: { studentId },
      data: { role },
    });
  }

  return getTeacherSurveyBoard(teacherId, groupId);
}

export async function chooseProjectTeamLeader(studentId: string, nomineeId: string, viewGroupId?: string) {
  const membership = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: { team: { select: { id: true, groupId: true, leaderId: true } } },
  });
  if (!membership) throw new Error("not_in_team");
  if (viewGroupId && membership.team.groupId !== viewGroupId) throw new Error("not_in_team");
  const nominee = await prisma.projectTeamMember.findFirst({
    where: { teamId: membership.teamId, studentId: nomineeId },
    select: { studentId: true },
  });
  if (!nominee) throw new Error("invalid_leader");
  await prisma.projectTeam.update({
    where: { id: membership.teamId },
    data: { leaderId: nomineeId },
  });
  return getStudentSurveyState(studentId, viewGroupId ?? membership.team.groupId);
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
    orderBy: [{ listNumber: "asc" }, { displayName: "asc" }],
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
  });

  if (group.code.trim() === "301") {
    try {
      await applyMarkedNoSurveyRoles301(group.id, students);
      await fillMissingLockedTeams301(teacherId, group.id, students);
    } catch (err) {
      console.warn("[skill-survey] 301 fill teams skipped:", err);
    }
  }

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

  const skipped: Array<{ displayName: string; reason: string }> = [];
  const eligible = students.filter((s) => {
    if (isPreviewControlNumber(s.controlNumber)) return false;
    const reason = exclusionForLectura(group.code, s.displayName);
    if (reason) {
      skipped.push({ displayName: s.displayName, reason });
      return false;
    }
    return true;
  });

  const rows = eligible.map((s, index) => {
    const resp = byStudent.get(s.id);
    const teamInfo = memberTeamByStudent.get(s.id) ?? null;
    const teamRole = teamInfo && isSkillRole(teamInfo.role) ? teamInfo.role : null;
    const assignedRole = assignedRoleOf(resp ?? null) ?? teamRole;
    const scores = resp ? asScores(resp.scores) : emptyScores();
    const answers = resp ? asAnswers(resp.answers) : {};
    const hasSurvey = hasSurveyAnswers(resp?.answers);
    return {
      student: { ...s, listPosition: index + 1 },
      completed: hasSurvey,
      hasSurvey,
      assignedRole,
      assignedRoleLabel: assignedRole ? roleLabel(assignedRole) : null,
      profile: assignedRole ? buildProfilePayload(answers, scores, assignedRole) : null,
      team: teamInfo
        ? {
            ...teamInfo,
            roleLabel: roleLabel(teamInfo.role),
          }
        : null,
      updatedAt: resp?.updatedAt.toISOString(),
    };
  });

  return {
    group,
    definition: getSurveyDefinition(),
    completedCount: rows.filter((r) => r.completed).length,
    assignedCount: rows.filter((r) => r.assignedRole).length,
    totalStudents: rows.length,
    skipped,
    rows,
    teams: teams.map((t) => {
      const leaderStill = t.leaderId ? t.members.some((m) => m.studentId === t.leaderId) : false;
      const leaderId = leaderStill ? t.leaderId : null;
      const sm = t.members.find((m) => m.role === "scrum_master");
      return {
        id: t.id,
        name: t.name,
        leaderId,
        leaderName: leaderId
          ? (t.members.find((m) => m.studentId === leaderId)?.student.displayName ?? null)
          : null,
        preferredLeaderId: sm?.studentId ?? null,
        members: t.members.map((m) => ({
          studentId: m.studentId,
          role: m.role,
          roleLabel: roleLabel(m.role),
          student: m.student,
        })),
      };
    }),
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
    select: { studentId: true, teamId: true },
  });
  if (already.length) {
    const oldTeamIds = [...new Set(already.map((a) => a.teamId))];
    await prisma.projectTeamMember.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.projectTeam.deleteMany({
      where: { id: { in: oldTeamIds }, members: { none: {} } },
    });
  }

  for (const m of members) {
    if (isSkillRole(m.role)) await persistAssignedRole(m.studentId, groupId, m.role);
  }

  const team = await prisma.projectTeam.create({
    data: {
      groupId,
      name: name.trim() || "Equipo",
      createdById: teacherId,
      leaderId: members.find((m) => m.role === "scrum_master")?.studentId ?? null,
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
        leaderId: members.find((m) => m.role === "scrum_master")?.studentId ?? null,
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

export async function replaceAllProjectTeams(
  teacherId: string,
  groupId: string,
  teams: Array<{ name: string; members: TeamMemberInput[] }>,
) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true },
  });
  if (!group) throw new Error("group_not_found");
  for (const team of teams) {
    validateTeamSize(team.members);
    const ids = team.members.map((m) => m.studentId);
    if (new Set(ids).size !== ids.length) throw new Error("duplicate_members");
    await assertStudentsInGroup(groupId, ids);
  }
  const allIds = teams.flatMap((t) => t.members.map((m) => m.studentId));
  if (new Set(allIds).size !== allIds.length) throw new Error("duplicate_members");

  for (const team of teams) {
    for (const m of team.members) {
      if (isSkillRole(m.role)) await persistAssignedRole(m.studentId, groupId, m.role);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectTeam.deleteMany({ where: { groupId } });
    for (const team of teams) {
      await tx.projectTeam.create({
        data: {
          groupId,
          name: team.name.trim() || "Equipo",
          createdById: teacherId,
          leaderId: team.members.find((m) => m.role === "scrum_master")?.studentId ?? null,
          members: {
            create: team.members.map((m) => ({
              studentId: m.studentId,
              role: m.role,
            })),
          },
        },
      });
    }
  });

  return getTeacherSurveyBoard(teacherId, groupId);
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

type PoolStudent = {
  id: string;
  displayName: string;
  role: SkillRole;
};

function shufflePool<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function planTeamSizes(n: number, groupCode: string): number[] {
  if (groupCode.trim() === "301") return Array.from({ length: 6 }, () => 5);
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

/**
 * Sugiere equipos equilibrados con el rol que asignó el docente.
 * En 301: siempre 6 equipos de 5; quienes no contestaron encuesta se mezclan, no van juntos.
 */
function fillMissingRoles(team: PoolStudent[]) {
  const needed = TEAM_ROLE_ORDER.slice(0, team.length);
  const taken = new Set<SkillRole>();
  const reassign: PoolStudent[] = [];
  for (const member of team) {
    if (needed.includes(member.role) && !taken.has(member.role)) {
      taken.add(member.role);
    } else {
      reassign.push(member);
    }
  }
  const missing = needed.filter((role) => !taken.has(role));
  for (const member of reassign) {
    const next = missing.shift();
    if (next) member.role = next;
  }
}

export async function suggestProjectTeams(teacherId: string, groupId: string) {
  const board = await getTeacherSurveyBoard(teacherId, groupId);
  const is301 = board.group.code.trim() === "301";
  if (is301) {
    const locked = resolveLockedTeams301(board.rows.map((r) => r.student));
    if (locked) {
      return {
        teamSizes: locked.map((t) => t.members.length),
        assignedCount: locked.reduce((n, t) => n + t.members.length, 0),
        suggested: locked.map((t) => ({
          name: t.name,
          members: t.members.map((m) => ({
            studentId: m.studentId,
            displayName: m.displayName,
            role: m.role,
            roleLabel: SKILL_ROLE_LABELS[m.role],
          })),
        })),
        unassigned: [],
        note: "Equipos 1 a 4 se quedaron como los armamos. En 5 y 6 se cambió el rol para que cada uno tenga Scrum Master, Product Owner, Desarrollador, Diseño/UI y QA (ya no puros diseñadores). Pulsa Guardar los 6 equipos.",
      };
    }
  }
  const assigned = board.rows.filter((r) => r.assignedRole && (is301 || !r.team)) as Array<{
    student: { id: string; displayName: string };
    assignedRole: SkillRole;
  }>;

  if (assigned.length < 4) throw new Error("not_enough_completed");

  const pool: PoolStudent[] = shufflePool(
    assigned.map((r) => ({
      id: r.student.id,
      displayName: r.student.displayName,
      role: r.assignedRole,
    })),
  );

  const sizes = planTeamSizes(pool.length, board.group.code);
  const teams: PoolStudent[][] = sizes.map(() => []);

  const byRole = new Map<SkillRole, PoolStudent[]>();
  for (const role of TEAM_ROLE_ORDER) byRole.set(role, []);
  for (const student of pool) {
    const list = byRole.get(student.role) ?? [];
    list.push(student);
    byRole.set(student.role, list);
  }
  for (const role of TEAM_ROLE_ORDER) {
    byRole.set(role, shufflePool(byRole.get(role) ?? []));
  }

  const overflow: PoolStudent[] = [];
  for (const role of TEAM_ROLE_ORDER) {
    const bucket = byRole.get(role) ?? [];
    let teamIndex = 0;
    for (const student of bucket) {
      let placed = false;
      for (let step = 0; step < teams.length; step++) {
        const idx = (teamIndex + step) % teams.length;
        const team = teams[idx]!;
        const hasRole = team.some((m) => m.role === role);
        if (team.length < (sizes[idx] ?? 5) && !hasRole) {
          team.push(student);
          teamIndex = idx + 1;
          placed = true;
          break;
        }
      }
      if (!placed) overflow.push(student);
    }
  }

  let fillIndex = 0;
  for (const student of shufflePool(overflow)) {
    for (let step = 0; step < teams.length; step++) {
      const idx = (fillIndex + step) % teams.length;
      const team = teams[idx]!;
      if (team.length < (sizes[idx] ?? 5)) {
        team.push(student);
        fillIndex = idx + 1;
        break;
      }
    }
  }

  for (const team of teams) fillMissingRoles(team);

  const placedIds = new Set(teams.flatMap((t) => t.map((m) => m.id)));
  const unassigned = pool
    .filter((s) => !placedIds.has(s.id))
    .map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      suggestedRole: s.role,
      suggestedRoleLabel: SKILL_ROLE_LABELS[s.role],
    }));

  const suggested = teams
    .filter((members) => members.length > 0)
    .map((members, index) => ({
      name: `Equipo ${index + 1}`,
      members: members.map((m) => ({
        studentId: m.id,
        displayName: m.displayName,
        role: m.role,
        roleLabel: SKILL_ROLE_LABELS[m.role],
      })),
    }));

  const shortTeams = suggested.filter((t) => t.members.length < 5).length;
  let note: string | null = null;
  if (is301 && (suggested.length !== 6 || shortTeams > 0 || unassigned.length > 0)) {
    note = `En 301 van 6 equipos de 5. Hay ${pool.length} alumnos con rol. Asigna rol a quienes falten y vuelve a sugerir. Quienes no contestaron encuesta se mezclan; no forman un equipo aparte.`;
  } else if (unassigned.length > 0) {
    note = `${unassigned.length} alumno(s) no cupieron; asígnalos a un equipo que tenga menos de 5.`;
  }

  return {
    teamSizes: suggested.map((t) => t.members.length),
    assignedCount: placedIds.size,
    suggested,
    unassigned,
    note,
  };
}
