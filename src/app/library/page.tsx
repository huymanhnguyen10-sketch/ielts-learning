import { Library } from "@/components/library/Library";
import { listMaterials } from "@/lib/actions/materials";

export default async function Page() {
  const materials = await listMaterials();
  return <Library materials={materials} />;
}
