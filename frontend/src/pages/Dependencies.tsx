import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Boxes, PackageCheck, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDependencies } from "@/hooks/useIntelligence";

export default function Dependencies() {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const query = useDependencies(repositoryId);
  const data = query.data;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-muted-foreground">Repository intelligence</p><h1 className="text-2xl font-semibold tracking-tight">Dependencies</h1><p className="mt-1 text-sm text-muted-foreground">Versions discovered from manifests in this repository.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="gap-1.5"><RefreshCw className={query.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh</Button><Button variant="ghost" size="sm" render={<Link to={`/repositories/${repositoryId}`} />}>Back to repository</Button></div>
    </div>
    {query.isLoading ? <Card><CardContent className="space-y-3 p-6"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card> : query.isError || !data?.available ? <Card><CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><AlertTriangle className="h-8 w-8 text-amber-500" /><p className="font-medium">Dependency data is unavailable</p><p className="text-sm text-muted-foreground">{data?.message ?? "The repository may not be indexed yet."}</p></CardContent></Card> : data.dependencies.length === 0 ? <Card><CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><Boxes className="h-8 w-8 text-muted-foreground" /><p className="font-medium">No supported manifests found</p><p className="text-sm text-muted-foreground">Add package.json, requirements.txt, or pyproject.toml to expose dependency intelligence.</p></CardContent></Card> : <Card><CardHeader><CardTitle className="text-base">{data.dependencies.length} dependencies</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="pb-3 pr-4">Package</th><th className="pb-3 pr-4">Ecosystem</th><th className="pb-3 pr-4">Installed</th><th className="pb-3 pr-4">Latest</th><th className="pb-3">Status</th></tr></thead><tbody>{data.dependencies.map((dependency) => <tr key={`${dependency.ecosystem}-${dependency.name}`} className="border-b last:border-0"><td className="py-3 pr-4 font-medium"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" />{dependency.name}</div><span className="text-xs text-muted-foreground">{dependency.source_file}</span></td><td className="py-3 pr-4"><Badge variant="outline">{dependency.ecosystem}</Badge></td><td className="py-3 pr-4 font-mono text-xs">{dependency.installed_version ?? "Not pinned"}</td><td className="py-3 pr-4 font-mono text-xs">{dependency.latest_version ?? "Unavailable"}</td><td className="py-3"><Badge variant={dependency.status === "outdated" ? "secondary" : dependency.status === "vulnerable" ? "destructive" : "outline"}>{dependency.status}</Badge></td></tr>)}</tbody></table></div></CardContent></Card>}
  </div>;
}
