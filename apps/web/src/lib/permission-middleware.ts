import { canUserDoAction, FeatureName } from "@/lib/permissions";
import { err } from "@/lib/api-helpers";

/**
 * Middleware to enforce permission checks on API routes
 */
export async function enforcePermission(
  userId: string,
  projectId: string,
  featureName: FeatureName
) {
  const hasPermission = await canUserDoAction(userId, projectId, featureName);

  if (!hasPermission) {
    return err(
      `Feature "${featureName}" is not available for your role`,
      403
    );
  }

  return null; // Permission granted
}

/**
 * Batch check multiple permissions
 */
export async function enforceMultiplePermissions(
  userId: string,
  projectId: string,
  featureNames: FeatureName[]
) {
  for (const featureName of featureNames) {
    const result = await enforcePermission(userId, projectId, featureName);
    if (result) return result;
  }
  return null; // All permissions granted
}
