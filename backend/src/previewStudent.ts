import bcrypt from "bcrypt";
import type { NextFunction, Response } from "express";
import { prisma } from "./prisma.js";
import { ensureTeacherGroups } from "./groups.js";
import type { AuthedRequest } from "./middleware.js";
import {
  PREVIEW_CONTROL_NUMBER,
  PREVIEW_DISPLAY_NAME,
  PREVIEW_GROUP_CODE,
  PREVIEW_PASSWORD,
  isPreviewControlNumber,
} from "./previewConstants.js";

export {
  PREVIEW_CONTROL_NUMBER,
  PREVIEW_DISPLAY_NAME,
  PREVIEW_GROUP_CODE,
  PREVIEW_PASSWORD,
  isPreviewControlNumber,
};

export async function getPreviewViewGroup(teacherId: string) {
  const groups = await prisma.classGroup.findMany({
    where: { teacherId, NOT: { code: PREVIEW_GROUP_CODE } },
    orderBy: [{ code: "asc" }, { shift: "asc" }],
  });
  return groups.find((g) => g.code === "301") ?? groups[0] ?? null;
}

export async function ensurePreviewStudent(teacherId: string) {
  await ensureTeacherGroups(teacherId);
  const viewGroup = await getPreviewViewGroup(teacherId);
  const previewGroup = await prisma.classGroup.upsert({
    where: {
      teacherId_code_shift: {
        teacherId,
        code: PREVIEW_GROUP_CODE,
        shift: "matutino",
      },
    },
    update: {},
    create: {
      teacherId,
      code: PREVIEW_GROUP_CODE,
      shift: "matutino",
    },
  });

  const existing = await prisma.user.findUnique({
    where: { controlNumber: PREVIEW_CONTROL_NUMBER },
    include: { group: { select: { id: true, code: true, shift: true } } },
  });
  if (
    existing &&
    existing.role === "STUDENT" &&
    existing.passwordSet &&
    existing.groupId === previewGroup.id
  ) {
    return {
      student: existing,
      viewGroup,
      controlNumber: PREVIEW_CONTROL_NUMBER,
      password: PREVIEW_PASSWORD,
      displayName: PREVIEW_DISPLAY_NAME,
      groupCode: viewGroup?.code ?? previewGroup.code,
    };
  }

  const passwordHash = await bcrypt.hash(PREVIEW_PASSWORD, 10);
  const student = await prisma.user.upsert({
    where: { controlNumber: PREVIEW_CONTROL_NUMBER },
    update: {
      displayName: PREVIEW_DISPLAY_NAME,
      passwordHash,
      passwordSet: true,
      recoverablePassword: PREVIEW_PASSWORD,
      role: "STUDENT",
      groupId: previewGroup.id,
      listNumber: null,
    },
    create: {
      controlNumber: PREVIEW_CONTROL_NUMBER,
      displayName: PREVIEW_DISPLAY_NAME,
      passwordHash,
      passwordSet: true,
      recoverablePassword: PREVIEW_PASSWORD,
      role: "STUDENT",
      groupId: previewGroup.id,
      listNumber: null,
    },
    include: { group: { select: { id: true, code: true, shift: true } } },
  });

  return {
    student,
    viewGroup,
    controlNumber: PREVIEW_CONTROL_NUMBER,
    password: PREVIEW_PASSWORD,
    displayName: PREVIEW_DISPLAY_NAME,
    groupCode: viewGroup?.code ?? previewGroup.code,
  };
}

export async function ensurePreviewStudentForAnyTeacher() {
  const teacher = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!teacher) return null;
  return ensurePreviewStudent(teacher.id);
}

export async function loadStudentViewContext(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      listNumber: true,
      controlNumber: true,
      groupId: true,
      group: { select: { teacherId: true, code: true, shift: true } },
    },
  });
  if (!me?.groupId || !me.group) return null;
  const preview = isPreviewControlNumber(me.controlNumber);
  const viewGroup = preview ? await getPreviewViewGroup(me.group.teacherId) : null;
  return {
    me,
    preview,
    groupId: viewGroup?.id ?? me.groupId,
    teacherId: me.group.teacherId,
  };
}

export async function requireNotPreviewStudent(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.auth || req.auth.role !== "STUDENT") return next();
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { controlNumber: true },
  });
  if (isPreviewControlNumber(user?.controlNumber)) {
    return res.status(403).json({
      error: "preview_readonly",
      message: "La cuenta de prueba solo sirve para ver la plataforma, no para guardar datos del grupo.",
    });
  }
  return next();
}
