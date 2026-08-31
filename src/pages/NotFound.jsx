import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 text-center">
      <div className="hr-logo hr-tone-coral mb-6 size-16">
        <Sparkles className="size-7" />
      </div>
      <p className="font-display text-8xl font-black tracking-tight text-foreground opacity-10 select-none">
        404
      </p>
      <h1 className="font-display -mt-6 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
        Page Not Found
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-3.5" /> Go Back
        </Button>
        <Button size="sm" onClick={() => navigate("/")}>
          Dashboard
        </Button>
      </div>
    </main>
  );
}
