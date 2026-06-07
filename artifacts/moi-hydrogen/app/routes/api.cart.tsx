import { json, type ActionFunctionArgs } from "@shopify/remix-oxygen";

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  const { cart } = context;

  if (actionType === "add") {
    const merchandiseId = formData.get("merchandiseId") as string;
    const quantity = parseInt(formData.get("quantity") as string, 10) || 1;

    if (!merchandiseId) {
      return json({ error: "merchandiseId is required" }, { status: 400 });
    }

    const result = await cart.addLines([{ merchandiseId, quantity }]);
    const headers = cart.setCartId(result.cart.id);
    return json({ cart: result.cart }, { headers });
  }

  if (actionType === "update") {
    const lineId = formData.get("lineId") as string;
    const quantity = parseInt(formData.get("quantity") as string, 10);

    if (!lineId) {
      return json({ error: "lineId is required" }, { status: 400 });
    }

    if (quantity <= 0) {
      const result = await cart.removeLines([lineId]);
      const headers = cart.setCartId(result.cart.id);
      return json({ cart: result.cart }, { headers });
    }

    const result = await cart.updateLines([{ id: lineId, quantity }]);
    const headers = cart.setCartId(result.cart.id);
    return json({ cart: result.cart }, { headers });
  }

  if (actionType === "remove") {
    const lineId = formData.get("lineId") as string;
    if (!lineId) {
      return json({ error: "lineId is required" }, { status: 400 });
    }

    const result = await cart.removeLines([lineId]);
    const headers = cart.setCartId(result.cart.id);
    return json({ cart: result.cart }, { headers });
  }

  if (actionType === "note") {
    const note = formData.get("note") as string;
    const result = await cart.updateNote(note);
    const headers = cart.setCartId(result.cart.id);
    return json({ cart: result.cart }, { headers });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}
