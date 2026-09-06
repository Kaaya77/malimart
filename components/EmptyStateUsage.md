# EmptyState usage notes

Replace simple "nothing here" messages with a canonical EmptyState component that provides:

- A friendly heading and short description explaining why the screen is empty.
- A primary CTA that nudges users toward a meaningful action (e.g. "Browse products", "Create your first product").
- Optional secondary actions and links to help resources.
- Accessible markup (role="status" or role="region" as appropriate) and meaningful aria attributes.

Suggested approach
1. Create `components/EmptyState.tsx` if not present. Example props: title, description, primaryAction {label, href/onClick}, secondaryAction.
2. Replace bare messages in:
   - pages/Wishlist
   - pages/Orders
   - seller dashboard empty states
   - any other list views that show nothing
3. Add visual tests / stories for the EmptyState component and ensure CTAs are keyboard accessible.

Example usage

```tsx
<EmptyState
  title="Your wishlist is empty"
  description="Save items you like to come back later"
  primaryAction={{ label: "Browse products", href: "/" }}
/>
```
