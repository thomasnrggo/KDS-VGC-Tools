import { redirect } from "next/navigation";

interface OldTeamBuilderPageProps {
  params: Promise<{ teamId: string }>;
}

/** The Team Builder's old per-team address — a saved team is edited from My Teams now. */
export default async function OldTeamBuilderPage({ params }: OldTeamBuilderPageProps) {
  const { teamId } = await params;
  redirect(`/teams/${teamId}/edit`);
}
