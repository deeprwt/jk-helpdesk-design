"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { fetchAsset, authHeaders } from "@/lib/api"
import AssetForm, {
    AssetFormState,
    User,
} from "@/components/asset/AssetForm"
import { Skeleton } from "@/components/ui/skeleton"
import RoleGate from "@/components/auth/RoleGate"

export default function EditAssetPage() {
    const { id } = useParams<{ id: string }>()

    const [data, setData] = React.useState<AssetFormState | null>(null)
    const [assignedUser, setAssignedUser] =
        React.useState<User | null>(null)

    React.useEffect(() => {
        const load = async () => {
            // Fetch asset main data
            const asset = await fetchAsset(id)
            if (!asset) return

            // Fetch asset details (key/value pairs)
            const detailsRes = await fetch(`/api/assets/${id}/details`, { headers: authHeaders() })
            const detailsData = detailsRes.ok ? await detailsRes.json() : { details: [] }
            const details: { key: string; value: string }[] = detailsData.details ?? []

            // Fetch current assignment
            const assignmentRes = await fetch(`/api/assets/${id}/assignment`, { headers: authHeaders() })
            const assignmentData = assignmentRes.ok ? await assignmentRes.json() : null

            let user: User | null = null
            if (assignmentData?.user_id) {
                const userRes = await fetch(`/api/users/${assignmentData.user_id}`, { headers: authHeaders() })
                const userData = userRes.ok ? await userRes.json() : null
                if (userData) {
                    const u = userData.user ?? userData
                    user = { id: u.id, email: u.email }
                }
            }

            const map = Object.fromEntries(
                details.map((d) => [d.key, d.value])
            )

            setAssignedUser(user)

            setData({
                asset_code: asset.asset_code ?? "",
                asset_type: asset.asset_type ?? "",
                model: asset.model ?? "",
                status: asset.status,
                location: asset.location ?? "",
                department: asset.department ?? "",
                serial_no: map.serial_no ?? "",
                cpu: map.cpu ?? "",
                ram: map.ram ?? "",
                storage: map.storage ?? "",
                os_name: map.os_name ?? "",
                mac_address: map.mac_address ?? "",
                vendor: map.vendor ?? "",
                purchase_date: asset.purchase_date ?? "",
                warranty_expiry: asset.warranty_expiry ?? "",
            })
        }

        load()
    }, [id])

    if (!data) return <Skeleton className="h-96 w-full" />

    return (
        <RoleGate allowedRoles={["engineer", "admin", "superadmin"]}>
            <AssetForm
                mode="edit"
                assetId={id}
                initialData={data}
                initialAssignedUser={assignedUser}
            />
        </RoleGate>
    )
}
