import { requireMembership } from "@/features/identity";

// Walking-skeleton home page — now the first PROTECTED consumer: layer-2
// guard (requireMembership) is live, so a suspended/soft-deleted user's
// session dies here on their next request. The real dashboard (widgets +
// activity, SPEC §5) arrives in the Periphery stage.
export default async function HomePage() {
  const { user, group, membership } = await requireMembership();
  return (
    <main>
      <h1>{group.name}</h1>
      <p>
        שלום, <bdi dir="ltr">{user.email}</bdi> ({membership.role})
      </p>
      <p>השלד עומד. הבנייה — פרוסה אחר פרוסה.</p>
    </main>
  );
}
