import {
  getCustomer,
  getSubscription,
  listCustomers,
  listSubscriptions,
} from "@lemonsqueezy/lemonsqueezy.js";

/** Lemon subscription resource shape used by list/get APIs (attributes we need for plan sync). */
export type LemonSubscriptionRow = {
  id: string;
  attributes: {
    variant_id: number;
    customer_id: number;
    status: string;
    renews_at: string;
    ends_at: string | null;
    user_email?: string;
  };
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function dedupeById(rows: LemonSubscriptionRow[]): LemonSubscriptionRow[] {
  const seen = new Set<string>();
  const out: LemonSubscriptionRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

async function subscriptionsFromCustomerId(
  customerId: string,
): Promise<LemonSubscriptionRow[]> {
  const res = await getCustomer(customerId, { include: ["subscriptions"] });
  if (res.error || !res.data) {
    return [];
  }
  const root = res.data as {
    data?: { relationships?: { subscriptions?: { data?: Array<{ id: string; type: string }> } } };
    included?: Array<{
      type: string;
      id: string;
      attributes: LemonSubscriptionRow["attributes"];
    }>;
  };
  const out: LemonSubscriptionRow[] = [];

  if (root.included?.length) {
    for (const row of root.included) {
      if (row.type === "subscriptions") {
        out.push({ id: String(row.id), attributes: row.attributes });
      }
    }
  }

  if (!out.length) {
    const refs = root.data?.relationships?.subscriptions?.data;
    if (refs?.length) {
      for (const ref of refs) {
        const sub = await getSubscription(ref.id);
        if (!sub.error && sub.data?.data) {
          const d = sub.data.data;
          out.push({
            id: String(d.id),
            attributes: d.attributes as LemonSubscriptionRow["attributes"],
          });
        }
      }
    }
  }

  return out;
}

/**
 * Resolves subscriptions for a store using every reliable Lemon API path:
 * 1) Customer id (from `order_created` webhook / DB) — works when checkout email ≠ app email.
 * 2) listSubscriptions by user_email — normalized (trim + lowercase).
 * 3) listCustomers by email, then subscriptions per customer.
 */
export async function fetchSubscriptionsForStoreAndUser(args: {
  storeId: string;
  userEmail: string | null;
  paymentProcessorUserId: string | null;
}): Promise<LemonSubscriptionRow[]> {
  const emailNorm = args.userEmail ? normalizeEmail(args.userEmail) : "";
  const collected: LemonSubscriptionRow[] = [];

  if (args.paymentProcessorUserId) {
    collected.push(
      ...(await subscriptionsFromCustomerId(args.paymentProcessorUserId)),
    );
  }

  if (!collected.length && emailNorm) {
    const { data: body, error } = await listSubscriptions({
      filter: {
        storeId: args.storeId,
        userEmail: emailNorm,
      },
    });
    if (!error && body?.data?.length) {
      for (const row of body.data) {
        collected.push({
          id: String(row.id),
          attributes: row.attributes as LemonSubscriptionRow["attributes"],
        });
      }
    }
  }

  if (!collected.length && emailNorm) {
    const { data: custBody, error: custErr } = await listCustomers({
      filter: {
        storeId: args.storeId,
        email: emailNorm,
      },
    });
    if (!custErr && custBody?.data?.length) {
      for (const cust of custBody.data) {
        collected.push(
          ...(await subscriptionsFromCustomerId(String(cust.id))),
        );
      }
    }
  }

  return dedupeById(collected);
}

export { normalizeEmail };
