"use client";

import * as React from "react";
import { apiMe, authHeaders } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type UserAddress = {
  country: string | null;
  city: string | null;
  postal_code: string | null;
  present_address: string | null;
  permanent_address: string | null;
};

export default function UserAddressCard() {
  const [data, setData] = React.useState<UserAddress | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAddress = async () => {
      setLoading(true);

      const me = await apiMe();
      if (!me) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/users/${me.id}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        const user = json.user ?? json;
        setData({
          country: user.country ?? null,
          city: user.city ?? null,
          postal_code: user.postal_code ?? null,
          present_address: user.present_address ?? null,
          permanent_address: user.permanent_address ?? null,
        });
      }

      setLoading(false);
    };

    fetchAddress();
  }, []);

  return (
    <Card className="rounded-2xl border">
      <CardHeader>
        <CardTitle>Address</CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <AddressSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
            <AddressItem label="Country" value={data?.country} />
            <AddressItem label="City" value={data?.city} />
            <AddressItem label="Postal Code" value={data?.postal_code} />
            <AddressItem
              label="Present Address"
              value={data?.present_address}
            />
            <AddressItem
              label="Permanent Address"
              value={data?.permanent_address}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- helpers ---------------- */

function AddressItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {value || "—"}
      </p>
    </div>
  );
}

function AddressSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
