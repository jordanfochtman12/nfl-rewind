import { createFileRoute } from "@tanstack/react-router";
import { GameEntry } from "@/components/game/GameEntry";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GameEntry />;
}
