"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { apiMe, fetchUsers, authHeaders } from "@/lib/api";

type UserRole = "user" | "engineer" | "admin" | "superadmin";

interface OnlineEngineer {
  id: string;
  full_name: string;
  avatar_url: string | null;
  last_seen_at: string;
}

export default function TeammatesCard() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [engineers, setEngineers] = useState<OnlineEngineer[]>([]);
  const [ready, setReady] = useState<boolean>(false);

  /* Presence heartbeat — update last_seen_at via API */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const updatePresence = async () => {
      await fetch("/api/users/presence", {
        method: "PATCH",
        headers: authHeaders(),
      }).catch(() => {});
    };

    const start = () => {
      updatePresence();
      interval = setInterval(updatePresence, 30000);
    };

    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  /* Load role + online engineers */
  useEffect(() => {
    const load = async () => {
      const me = await apiMe();

      if (!me) {
        setReady(true);
        return;
      }

      setRole(me.role);

      /* Normal users see nothing */
      if (me.role === "user") {
        setReady(true);
        return;
      }

      const onlineCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      // Fetch engineers online via API — server scopes to accessible org
      const res = await fetch(
        `/api/users?role=engineer&online_since=${encodeURIComponent(onlineCutoff)}&limit=5`,
        { headers: authHeaders() }
      );
      const data = res.ok ? await res.json() : { users: [] };

      setEngineers(data.users ?? []);
      setReady(true);
    };

    load();
  }, []);

  /* Do not render for normal users */
  if (!ready || role === "user") {
    return null;
  }

  const title =
    role === "admin" ? "Online Engineers" : "Teammates";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          {title}
        </CardTitle>

        {role === "admin" && (
          <Link
            href="/engineers"
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {engineers.map((engineer) => (
          <div
            key={engineer.id}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={engineer.avatar_url ?? undefined}
                  />
                  <AvatarFallback>
                    {engineer.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Online dot */}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
              </div>

              <p className="text-sm font-medium">
                {engineer.full_name}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/profile/${engineer.id}`}>
                    View Details
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {engineers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No engineers are online right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
