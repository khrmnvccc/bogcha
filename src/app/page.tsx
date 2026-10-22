import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user || !user.profile.is_active) redirect("/kirish");
  redirect(homePathFor(user.profile.role));
}
