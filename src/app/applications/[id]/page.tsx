import { ApplicationWorkspace } from "@/components/application-workspace";

export default function ApplicationPage({
  params,
}: {
  params: { id: string };
}) {
  return <ApplicationWorkspace id={params.id} />;
}
