import { createFileRoute } from "@tanstack/react-router";
import { DarkHorseApp } from "@/darkhorse/engine";

export const Route = createFileRoute("/")({ component: DarkHorseApp });
