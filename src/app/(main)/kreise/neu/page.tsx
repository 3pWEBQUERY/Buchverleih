import { pageUser } from "@/lib/page";
import { CircleForm } from "../circle-form";

export const metadata = { title: "Kreis gründen" };

export default async function Page() {
  await pageUser("/kreise/neu");
  return <CircleForm />;
}
