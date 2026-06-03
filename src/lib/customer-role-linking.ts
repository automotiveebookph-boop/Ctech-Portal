import { supabaseFleet } from "@/lib/supabase-fleet";

type CustomerLookup = {
  id: string;
};

export type CustomerRoleRow = {
  role: string;
  customer_id: string | null;
};

async function findCustomerIdByEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) return null;

  const exactMatch = await supabaseFleet
    .from("customers")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  let customerId = (exactMatch.data as CustomerLookup | null)?.id ?? null;

  if (!customerId) {
    const caseInsensitiveMatch = await supabaseFleet
      .from("customers")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    customerId = (caseInsensitiveMatch.data as CustomerLookup | null)?.id ?? null;
  }

  return customerId;
}

export async function getOrCreateCustomerRole(
  userId: string,
  email: string | null | undefined,
  existingRole: CustomerRoleRow | null,
) {
  if (existingRole?.role === "customer") {
    const customerId = await ensureCustomerRoleCustomerId(userId, email, existingRole.customer_id);
    return { ...existingRole, customer_id: customerId };
  }

  if (existingRole) return existingRole;

  const customerId = await findCustomerIdByEmail(email);
  if (!customerId) return null;

  const { error } = await supabaseFleet.from("user_roles").insert([
    {
      user_id: userId,
      role: "customer",
      customer_id: customerId,
    },
  ]);

  if (error) {
    // Row already exists (race condition); read the real row back.
    const { data } = await supabaseFleet
      .from("user_roles")
      .select("role, customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  }

  return { role: "customer", customer_id: customerId };
}

export async function ensureCustomerRoleCustomerId(
  userId: string,
  email: string | null | undefined,
  currentCustomerId: string | null | undefined,
) {
  if (currentCustomerId) return currentCustomerId;

  const customerId = await findCustomerIdByEmail(email);
  if (!customerId) return null;

  await supabaseFleet
    .from("user_roles")
    .update({ customer_id: customerId })
    .eq("user_id", userId)
    .eq("role", "customer");

  return customerId;
}
