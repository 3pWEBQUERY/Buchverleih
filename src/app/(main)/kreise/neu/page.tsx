import { pageUser } from "@/lib/page";
import { CircleForm } from "../circle-form";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export async function generateMetadata() {
  return { title: CIRCLES[await getLocale()].newTitle };
}

export default async function Page() {
  await pageUser("/kreise/neu");
  return <CircleForm />;
}
