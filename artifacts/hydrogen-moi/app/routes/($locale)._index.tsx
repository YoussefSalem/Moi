/**
 * Locale-prefixed index redirect — handles URLs like /en, /ar, etc.
 * Redirects to root.
 */
import { redirect, type LoaderFunctionArgs } from '@shopify/remix-oxygen';

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.locale) return redirect('/');
  return redirect('/');
}
