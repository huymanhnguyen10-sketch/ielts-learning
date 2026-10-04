import { Practice } from "@/components/practice/Practice";
import { getPracticeData } from "@/lib/actions/practice";
import { TOPICS } from "@/lib/topics";

export default async function Page() {
  const { items, history } = await getPracticeData();
  const topics = TOPICS.map(([v, l]) => [v, l] as [string, string]);
  return <Practice items={items} history={history} topics={topics} />;
}
