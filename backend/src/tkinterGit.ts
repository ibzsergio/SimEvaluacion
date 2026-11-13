import { Router } from "express";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";

type TeamRow = {
  id: string;
  name: string;
  leaderId: string | null;
  members: Array<{ student: { id: string; displayName: string; listNumber: number | null } }>;
};

function ordenarEquipos(teams: TeamRow[]) {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }) || a.id.localeCompare(b.id));
}

function equipoPublico(team: TeamRow) {
  const members = [...team.members].sort((a, b) => {
    if (a.student.id === team.leaderId) return -1;
    if (b.student.id === team.leaderId) return 1;
    return a.student.displayName.localeCompare(b.student.displayName, "es");
  });
  return {
    id: team.id,
    name: team.name,
    leaderId: team.leaderId,
    members: members.map((member) => ({
      id: member.student.id,
      displayName: member.student.displayName,
      listNumber: member.student.listNumber,
      isLeader: member.student.id === team.leaderId,
    })),
  };
}

async function equiposDelGrupo(groupId: string) {
  const teams = await prisma.projectTeam.findMany({
    where: { groupId },
    select: {
      id: true,
      name: true,
      leaderId: true,
      members: { select: { student: { select: { id: true, displayName: true, listNumber: true } } } },
    },
  });
  return ordenarEquipos(teams).map(equipoPublico);
}

export const tkinterGitTeacherRouter = Router();
tkinterGitTeacherRouter.use(requireAuth, requireTeacher);

tkinterGitTeacherRouter.get("/groups/:groupId/tkinter-git", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  return res.json({ groupCode: group.code, teams: await equiposDelGrupo(group.id) });
});

export function registerStudentTkinterGitRoutes(app: import("express").Express) {
  app.get("/student/tkinter-git", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const student = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { groupId: true, group: { select: { code: true } } },
    });
    if (!student?.groupId) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un grupo. Pide al docente que te asigne.",
      });
    }
    const teams = await equiposDelGrupo(student.groupId);
    const mine = teams.find((team) => team.members.some((member) => member.id === req.auth!.userId)) ?? null;
    return res.json({
      groupCode: student.group?.code ?? "",
      myTeamId: mine?.id ?? null,
      teams,
    });
  });
}
