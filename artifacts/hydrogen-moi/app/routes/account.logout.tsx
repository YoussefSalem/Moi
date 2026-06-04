import { type ActionFunctionArgs } from '@shopify/remix-oxygen';

export async function action({ context }: ActionFunctionArgs) {
  const { customerAccount } = context;
  return customerAccount.logout();
}

export async function loader() {
  return null;
}
