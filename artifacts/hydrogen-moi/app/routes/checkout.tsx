import { type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData, type MetaFunction } from '@remix-run/react';
import { defer } from '@shopify/remix-oxygen';
import { CheckoutPage } from '~/components/CheckoutPage';

export const meta: MetaFunction = () => [
  { title: 'Checkout — Moi' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const { cart } = context;
  const cartData = await cart.get();

  return defer({
    cartId: cartData?.id ?? null,
    cartLines: cartData?.lines?.nodes ?? [],
    cartCost: cartData?.cost ?? null,
    checkoutUrl: cartData?.checkoutUrl ?? null,
  });
}

export default function Checkout() {
  const data = useLoaderData<typeof loader>();

  return (
    <div style={{ backgroundColor: '#faf8f5', minHeight: '100vh' }}>
      <CheckoutPage
        cartId={data.cartId}
        cartLines={data.cartLines as CartLine[]}
        cartCost={data.cartCost as CartCost | null}
        checkoutUrl={data.checkoutUrl}
      />
    </div>
  );
}

// Type helpers used by CheckoutPage
export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    selectedOptions: { name: string; value: string }[];
    product: {
      handle: string;
      title: string;
      featuredImage: { url: string; altText: string | null } | null;
    };
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
    image: { url: string; altText: string | null } | null;
  };
  cost: {
    totalAmount: { amount: string; currencyCode: string };
    amountPerQuantity: { amount: string; currencyCode: string };
    compareAtAmountPerQuantity: { amount: string; currencyCode: string } | null;
  };
};

export type CartCost = {
  subtotalAmount: { amount: string; currencyCode: string };
  totalAmount: { amount: string; currencyCode: string };
};
