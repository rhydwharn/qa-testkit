"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export interface TenantDisplay {
  tenantName: string | null;
  tenantLogoUrl: string | null;
  tenantLogoDisplay: "LOGO_ONLY" | "NAME_ONLY" | "LOGO_AND_NAME";
}

const TENANT_DISPLAY_EVENT = "qa_tm_tenant_display_update";

/** Broadcast new display values so every useTenant instance updates immediately (no JWT wait). */
export function broadcastTenantDisplay(display: TenantDisplay) {
  window.dispatchEvent(new CustomEvent<TenantDisplay>(TENANT_DISPLAY_EVENT, { detail: display }));
}

export function useTenant() {
  const { data: session, update } = useSession();

  // Live display values — override session until next page load / session refresh
  const [liveDisplay, setLiveDisplay] = useState<TenantDisplay | null>(null);

  useEffect(() => {
    function handleUpdate(e: Event) {
      setLiveDisplay((e as CustomEvent<TenantDisplay>).detail);
    }
    window.addEventListener(TENANT_DISPLAY_EVENT, handleUpdate);
    return () => window.removeEventListener(TENANT_DISPLAY_EVENT, handleUpdate);
  }, []);

  // Reset live override when the session itself refreshes (e.g. after refreshTenant resolves)
  useEffect(() => {
    setLiveDisplay(null);
  }, [session?.user?.tenantId]);

  async function switchTenant(tenantId: string) {
    await update({ tenantId });
    window.location.reload();
  }

  // Re-fetch the current tenant data from the DB and refresh the JWT.
  // Call this in the background after save; the sidebar already has live values via broadcast.
  async function refreshTenant() {
    const tid = session?.user?.tenantId;
    if (tid) await update({ tenantId: tid });
  }

  const sessionDisplay: TenantDisplay = {
    tenantName: session?.user?.tenantName ?? null,
    tenantLogoUrl: session?.user?.tenantLogoUrl ?? null,
    tenantLogoDisplay: (session?.user?.tenantLogoDisplay ?? "NAME_ONLY") as TenantDisplay["tenantLogoDisplay"],
  };
  const display = liveDisplay ?? sessionDisplay;

  return {
    tenantId: session?.user?.tenantId ?? null,
    tenantRole: session?.user?.tenantRole ?? null,
    tenantName: display.tenantName,
    tenantLogoUrl: display.tenantLogoUrl,
    tenantLogoDisplay: display.tenantLogoDisplay,
    switchTenant,
    refreshTenant,
  };
}
