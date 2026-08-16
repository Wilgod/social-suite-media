import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@social-suite/db";
import { randomSuffix, slugify } from "@/lib/slug";

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8, { error: "Password must be at least 8 characters" }),
  organizationName: z.string().min(2).max(64),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, password, organizationName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);
  const baseSlug = slugify(organizationName) || "org";

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, passwordHash } });

    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await tx.organization.findUnique({ where: { slug } });
      if (!collision) break;
      slug = `${baseSlug}-${randomSuffix()}`;
    }

    const organization = await tx.organization.create({ data: { name: organizationName, slug } });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
        acceptedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
