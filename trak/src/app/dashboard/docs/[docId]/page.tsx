import { notFound } from "next/navigation";
import { getSingleDoc } from "@/app/actions/doc";
import DocEditor from "./doc-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ docId: string }>;
}

export default async function DocPage({ params }: PageProps) {
  const { docId } = await params;

  const docResult = await getSingleDoc(docId);

  if (docResult.error || !docResult.data) {
    notFound();
  }

  const doc = docResult.data;

  return <DocEditor doc={doc} />;
}




