import { type ActionFunctionArgs } from '@shopify/remix-oxygen';
import { CartForm } from '@shopify/hydrogen';

/**
 * Cart route: handles all CartForm actions (add, remove, update lines, apply
 * discount codes, etc.). This route is never rendered as a page — it only
 * handles form submissions from the CartDrawer and product pages.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const { cart } = context;

  const formData = await request.formData();
  const { action, inputs } = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No cartAction defined');
  }

  let status = 200;
  let result: Record<string, unknown>;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;
      const discountCodes =
        formDiscountCode
          ? [formDiscountCode, ...(inputs.discountCodes ?? [])]
          : inputs.discountCodes ?? [];
      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate:
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();

  const { cart: cartResult, errors } = result;
  return Response.json(
    { cart: cartResult, errors },
    { status, headers },
  );
}
